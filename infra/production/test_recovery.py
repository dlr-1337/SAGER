"""Focused recovery tests without credentials, Docker or external services."""
import argparse
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import zipfile

SPEC = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("recovery.py"))
recovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recovery)
DOCUMENT = "00000000-0000-4000-8000-000000000001"


def file_metadata(content):
    return {"sha256": hashlib.sha256(content).hexdigest(), "size": len(content)}


def tar_bytes(entries=()):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:") as archive:
        for name, content, kind in entries:
            member = tarfile.TarInfo(name)
            member.type = kind
            member.size = len(content) if kind == tarfile.REGTYPE else 0
            if kind == tarfile.SYMTYPE:
                member.linkname = "../operator-secret"
            archive.addfile(member, io.BytesIO(content) if member.isfile() else None)
    return output.getvalue()


class FakeStack:
    def __init__(self, *, name="target", backend=False, gateway=False, tables="0", documents=()):
        self.name = name
        self.command = ["docker", "compose", "--project-name", name]
        self.backend, self.gateway, self.tables = backend, gateway, tables
        self.documents = documents
        self.commands, self.queries = [], []

    def running(self, service):
        return self.backend if service == "backend" else self.gateway

    def compose(self, *command, data=None, output=None):
        self.commands.append(command)
        if command[0] == "stop":
            self.backend = False
        elif command[0] == "start":
            self.backend = True
        return b""

    def sql(self, query):
        self.queries.append(query)
        if "pg_tables" in query:
            return self.tables
        if "MAX(sequence)" in query:
            return "7"
        if "flyway_schema_history" in query:
            return "19"
        return ""

    def archive_documents(self, output):
        output.write(tar_bytes(self.documents))


class FakeComposeCLI:
    """Exercise real Stack command routing without Docker, secrets or encryption."""
    def __init__(self, *, backend=False, documents=()):
        self.backend = backend
        self.documents = tar_bytes(documents)
        self.commands = []

    @staticmethod
    def action(command):
        position = 2
        while command[position] in {"--env-file", "-f", "--project-name"}:
            position += 2
        return command[position]

    def execute(self, command, *, data=None, output=None):
        if command[0] == "age":
            shutil.copyfile(command[-1], command[command.index("--output") + 1])
            return b""
        self.commands.append(command)
        action = self.action(command)
        if action == "config":
            name = (command[command.index("--project-name") + 1]
                    if "--project-name" in command else "default-project")
            # Inactive maintenance services may be absent from the rendered config;
            # archive-files is still explicitly targeted by its one-off run.
            return json.dumps({"name": name,
                               "services": {"database": {}, "backend": {}, "gateway": {}}}).encode()
        if action == "ps":
            return b"synthetic-container" if command[-1] == "backend" and self.backend else b""
        if action == "stop":
            self.backend = False
        elif action == "start":
            self.backend = True
        elif action == "exec":
            if "pg_dump" in command[-1]:
                output.write(b"PGDMP synthetic fixture")
            elif data:
                query = data.decode()
                if "pg_tables" in query:
                    return b"0"
                if "MAX(sequence)" in query:
                    return b"7"
                if "flyway_schema_history" in query:
                    return b"19"
        elif action == "run":
            output.write(self.documents)
        return b""

    def process(self, command, **kwargs):
        self.commands.append(command)
        if self.action(command) == "run":
            self.documents = kwargs["stdin"].read()
        return SimpleNamespace(returncode=0)


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def archive(self, *, content=b"synthetic document", manifest_change=None, extra=None):
        files = {"database.dump": b"PGDMP synthetic fixture", "documents/" + DOCUMENT: content}
        manifest = {
            "format": 1, "sourceStack": "source", "schemaVersion": "19",
            "createdAt": "2026-09-30T00:00:00+00:00", "auditSequence": 7,
            "files": {name: file_metadata(value) for name, value in files.items()},
        }
        if manifest_change:
            manifest_change(manifest)
        archive_path = self.root / "input.zip"
        with zipfile.ZipFile(archive_path, "w") as archive:
            archive.writestr("manifest.json", json.dumps(manifest))
            for name, value in files.items():
                archive.writestr(name, value)
            if extra:
                archive.writestr(*extra)
        return archive_path

    def destination(self):
        target = self.root / "validated"
        target.mkdir(exist_ok=True)
        return target

    def restore_args(self, archive):
        return argparse.Namespace(env_file="unused", compose="unused", work_dir=str(self.root),
                                  archive=str(archive), identity=str(self.root / "unused-identity"))

    def decrypted_copy(self, command, **kwargs):
        # These tests replace age only; the real encryption is covered by the operator proof.
        shutil.copyfile(command[-1], command[command.index("--output") + 1])
        return b""

    def stack_args(self, **extra):
        return SimpleNamespace(env_file=str(self.root / "operator.env"),
                               compose=str(self.root / "compose.yml"), **extra)

    def assert_project_commands(self, commands, project):
        self.assertTrue(commands)
        for command in commands:
            with self.subTest(command=command):
                self.assertEqual(command[:2], ["docker", "compose"])
                self.assertEqual(command.count("--project-name"), 1)
                position = command.index("--project-name")
                self.assertEqual(command[position + 1], project)
                self.assertLess(position, command.index(FakeComposeCLI.action(command)))

    def test_default_stack_preserves_existing_command_without_project_name_attribute(self):
        arguments = self.stack_args()
        expected = ["docker", "compose", "--env-file", arguments.env_file, "-f", arguments.compose]
        config = b'{"name":"existing-production","services":{"database":{}}}'
        with patch.object(recovery, "run", return_value=config) as execute:
            stack = recovery.Stack(arguments)
        self.assertEqual(stack.command, expected)
        self.assertEqual(stack.name, "existing-production")
        execute.assert_called_once_with(expected + ["config", "--format", "json"])

    def test_valid_compose_project_names_apply_to_rendered_configuration(self):
        for project in ["sager-homologacao", "0", "qa_test-7"]:
            with self.subTest(project=project):
                cli = FakeComposeCLI()
                with patch.object(recovery, "run", side_effect=cli.execute):
                    stack = recovery.Stack(self.stack_args(project_name=project))
                self.assertEqual(stack.name, project)
                self.assert_project_commands(cli.commands, project)

    def test_invalid_project_names_are_rejected_before_running_compose(self):
        for project in ["", "Sager", "sager.qa", "sager qa", "-sager", "_sager", "sager/qa",
                        "sager:qa", "sager\nqa", "ságer", 7, True]:
            with self.subTest(project=project):
                with patch.object(recovery, "run") as execute:
                    with self.assertRaises(recovery.RecoveryError):
                        recovery.Stack(self.stack_args(project_name=project))
                    execute.assert_not_called()

    def test_create_routes_config_dump_archive_stop_and_start_to_explicit_project(self):
        project = "sager-homologacao"
        cli = FakeComposeCLI(backend=True,
                             documents=[(DOCUMENT, b"synthetic document", tarfile.REGTYPE)])
        arguments = self.stack_args(project_name=project, work_dir=str(self.root),
                                    output=str(self.root / "project.age"), recipient="synthetic-public-recipient")
        with patch.object(recovery, "require_tools"), \
                patch.object(recovery, "run", side_effect=cli.execute), \
                redirect_stdout(io.StringIO()):
            recovery.create(arguments)
        self.assert_project_commands(cli.commands, project)
        self.assertTrue(cli.backend)
        self.assertTrue(any("pg_dump" in command[-1] for command in cli.commands))
        self.assertTrue(any(FakeComposeCLI.action(command) == "run" and "archive-files" in command
                            for command in cli.commands))
        self.assertTrue(any(FakeComposeCLI.action(command) == "stop" for command in cli.commands))
        self.assertTrue(any(FakeComposeCLI.action(command) == "start" for command in cli.commands))
        with zipfile.ZipFile(arguments.output) as archive:
            self.assertEqual(json.loads(archive.read("manifest.json"))["sourceStack"], project)

    def test_restore_routes_config_database_and_document_subprocesses_to_explicit_project(self):
        project = "sager-homologacao-recuperacao"
        cli = FakeComposeCLI()
        arguments = self.stack_args(project_name=project, work_dir=str(self.root),
                                    archive=str(self.archive()), identity=str(self.root / "unused-identity"))
        with patch.object(recovery, "require_tools"), \
                patch.object(recovery, "run", side_effect=cli.execute), \
                patch.object(recovery.subprocess, "run", side_effect=cli.process), \
                redirect_stdout(io.StringIO()) as report:
            recovery.restore(arguments)
        self.assert_project_commands(cli.commands, project)
        self.assertTrue(any("pg_restore" in command[-1] for command in cli.commands))
        self.assertTrue(any(FakeComposeCLI.action(command) == "run" and "-xf" in command
                            for command in cli.commands))
        self.assertFalse(any(FakeComposeCLI.action(command) == "start" for command in cli.commands))
        self.assertFalse(json.loads(report.getvalue())["applicationStarted"])

    def test_project_name_cli_option_is_forwarded_for_create_and_restore(self):
        cases = [("create", ["--recipient", "synthetic-public-recipient", "--output", "unused.age"]),
                 ("restore", ["--archive", "unused.age", "--identity", "unused-identity"])]
        for action, options in cases:
            with self.subTest(action=action):
                argv = ["recovery.py", "--env-file", "unused", "--project-name",
                        "sager-homologacao", action, *options]
                with patch("sys.argv", argv), patch.object(recovery, action) as execute:
                    self.assertEqual(recovery.main(), 0)
                self.assertEqual(execute.call_args.args[0].project_name, "sager-homologacao")

    def test_valid_archive_preserves_hashes_and_only_uuid_document_names(self):
        manifest, files = recovery.validate_archive(self.archive(), self.destination())
        self.assertEqual(set(files), {"database.dump", "documents/" + DOCUMENT})
        self.assertEqual(recovery.metadata(files["documents/" + DOCUMENT]),
                         manifest["files"]["documents/" + DOCUMENT])

    def test_corrupted_document_hash_is_rejected(self):
        archive = self.archive(manifest_change=lambda m: m["files"]["documents/" + DOCUMENT].update(sha256="0" * 64))
        with self.assertRaises(recovery.RecoveryError):
            recovery.validate_archive(archive, self.destination())

    def test_unlisted_or_parent_path_is_rejected_without_writing_outside_target(self):
        archive = self.archive(extra=("../operator-secret", b"synthetic"))
        with self.assertRaises(recovery.RecoveryError):
            recovery.validate_archive(archive, self.destination())
        self.assertFalse((self.root / "operator-secret").exists())

    def test_tar_rejects_links_duplicates_nested_paths_and_empty_documents(self):
        cases = [
            [(DOCUMENT, b"", tarfile.SYMTYPE)],
            [(DOCUMENT, b"one", tarfile.REGTYPE), (DOCUMENT, b"two", tarfile.REGTYPE)],
            [("nested/" + DOCUMENT, b"one", tarfile.REGTYPE)],
            [(DOCUMENT, b"", tarfile.REGTYPE)],
        ]
        for entries in cases:
            with self.subTest(entries=[(name, kind) for name, _, kind in entries]):
                path = self.root / "documents.tar"
                path.write_bytes(tar_bytes(entries))
                with self.assertRaises(recovery.RecoveryError):
                    recovery.documents_from_tar(path)

    def test_malformed_file_metadata_fails_with_controlled_recovery_error(self):
        archive = self.archive(manifest_change=lambda m: m["files"].update({"database.dump": None}))
        with self.assertRaises(recovery.RecoveryError):
            recovery.validate_archive(archive, self.destination())

    def test_zero_byte_document_is_rejected_from_zip_contract(self):
        with self.assertRaises(recovery.RecoveryError):
            recovery.validate_archive(self.archive(content=b""), self.destination())

    def test_failed_encryption_restarts_previous_backend_and_publishes_no_output(self):
        stack = FakeStack(name="source", backend=True)
        arguments = argparse.Namespace(env_file="unused", compose="unused", work_dir=str(self.root),
                                       output=str(self.root / "new.age"), recipient="synthetic-public-recipient")
        def execute(command, *, output=None, **kwargs):
            if command[0] == "age":
                raise recovery.RecoveryError("Synthetic encryption failure")
            output.write(b"PGDMP synthetic fixture")
            return b""
        with patch.object(recovery, "require_tools"), patch.object(recovery, "Stack", return_value=stack), patch.object(recovery, "run", side_effect=execute):
            with self.assertRaises(recovery.RecoveryError):
                recovery.create(arguments)
        self.assertTrue(stack.backend)
        self.assertEqual(stack.commands, [("stop", "--timeout", "40", "backend"), ("start", "backend")])
        self.assertFalse((self.root / "new.age").exists())
        self.assertEqual(list(self.root.glob("sager-recovery-*")), [])

    def test_restore_guards_same_stack_nonempty_database_documents_and_running_application(self):
        archive = self.archive()
        cases = [FakeStack(name="source"), FakeStack(tables="1"),
                 FakeStack(documents=[(DOCUMENT, b"existing", tarfile.REGTYPE)]),
                 FakeStack(backend=True), FakeStack(gateway=True)]
        for stack in cases:
            with self.subTest(stack=stack.name, tables=stack.tables, backend=stack.backend, gateway=stack.gateway, documents=bool(stack.documents)):
                with patch.object(recovery, "require_tools"), patch.object(recovery, "Stack", return_value=stack), patch.object(recovery, "run", side_effect=self.decrypted_copy), patch.object(recovery.subprocess, "run") as mutation:
                    with self.assertRaises(recovery.RecoveryError):
                        recovery.restore(self.restore_args(archive))
                    mutation.assert_not_called()
                self.assertNotIn("DELETE FROM spring_session;", stack.queries)
                self.assertFalse(any(c[0] == "start" for c in stack.commands))

    def test_verified_restore_discards_sessions_and_keeps_application_stopped(self):
        stack = FakeStack()
        # A snapshot without permanent documents still requires the verified database and manifest.
        archive = self.archive()
        with zipfile.ZipFile(archive) as source:
            manifest = json.loads(source.read("manifest.json"))
            dump = source.read("database.dump")
        manifest["files"].pop("documents/" + DOCUMENT)
        with zipfile.ZipFile(archive, "w") as target:
            target.writestr("manifest.json", json.dumps(manifest))
            target.writestr("database.dump", dump)
        with patch.object(recovery, "require_tools"), patch.object(recovery, "Stack", return_value=stack), patch.object(recovery, "run", side_effect=self.decrypted_copy), patch.object(recovery.subprocess, "run", return_value=argparse.Namespace(returncode=0)), redirect_stdout(io.StringIO()) as report:
            recovery.restore(self.restore_args(archive))
        self.assertIn("DELETE FROM spring_session;", stack.queries)
        self.assertFalse(stack.backend or stack.gateway)
        self.assertFalse(any(c[0] == "start" for c in stack.commands))
        self.assertFalse(json.loads(report.getvalue())["applicationStarted"])


if __name__ == "__main__":
    unittest.main()
