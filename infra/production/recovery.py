#!/usr/bin/env python3
"""Encrypted, coordinated database + permanent document recovery for one Compose stack."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from datetime import datetime, timezone
import zipfile

UUID_NAME = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
DB_COMMAND = 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec '


class RecoveryError(Exception):
    pass


def run(command, *, data=None, output=None):
    result = subprocess.run(command, input=data, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=600, check=False)
    if result.returncode:
        # Database errors and provider logs can contain private values.
        raise RecoveryError("Recovery command failed; inspect the restricted operator environment.")
    return result.stdout


def metadata(path):
    checksum = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(chunk)
            size += len(chunk)
    return {"sha256": checksum.hexdigest(), "size": size}


def documents_from_tar(path, destination=None):
    documents = {}
    with tarfile.open(path, mode="r:") as archive:
        for item in archive.getmembers():
            if item.isdir() and item.name in (".", "./"):
                continue
            name = item.name.removeprefix("./")
            if not UUID_NAME.fullmatch(name) or not item.isfile() or not 1 <= item.size <= 10 * 1024 * 1024:
                raise RecoveryError("Document volume contains an unexpected entry; recovery stopped.")
            if name in documents:
                raise RecoveryError("Duplicate document in recovery input.")
            checksum = hashlib.sha256()
            size = 0
            target = (destination / name).open("xb") if destination else None
            try:
                with archive.extractfile(item) as source:
                    for chunk in iter(lambda: source.read(1024 * 1024), b""):
                        checksum.update(chunk)
                        size += len(chunk)
                        if target:
                            target.write(chunk)
            finally:
                if target:
                    target.close()
            if size != item.size:
                raise RecoveryError("Incomplete document in recovery input.")
            documents[name] = {"sha256": checksum.hexdigest(), "size": size}
    return documents


class Stack:
    def __init__(self, args):
        self.command = ["docker", "compose", "--env-file", str(Path(args.env_file).resolve()),
                        "-f", str(Path(args.compose).resolve())]
        self.config = json.loads(run(self.command + ["config", "--format", "json"]))
        self.name = self.config["name"]
        if not self.name or "database" not in self.config["services"]:
            raise RecoveryError("Recovery requires the SAGER production Compose configuration.")

    def compose(self, *arguments, **kwargs):
        return run(self.command + list(arguments), **kwargs)

    def sql(self, query):
        return self.compose("exec", "-T", "database", "sh", "-c", DB_COMMAND +
                            "psql --no-psqlrc --no-password -U sager_owner -d sager "
                            "-At -v ON_ERROR_STOP=1", data=query.encode()).decode().strip()

    def running(self, service):
        return bool(self.compose("ps", "--status", "running", "-q", service).strip())

    def archive_documents(self, output):
        return self.compose("run", "--rm", "--no-deps", "-T", "archive-files",
                            "-C", "/data/documents", "-cf", "-", ".", output=output)


def require_tools():
    if not shutil.which("docker") or not shutil.which("age"):
        raise RecoveryError("Install Docker Compose and the official age CLI before recovery.")


def create(args):
    require_tools()
    stack = Stack(args)
    output = Path(args.output).resolve()
    if output.exists() or not output.parent.is_dir():
        raise RecoveryError("Use a new output file in an existing restricted directory.")
    was_running = stack.running("backend")
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="sager-recovery-", dir=args.work_dir) as temporary:
        os.chmod(temporary, 0o700)
        work = Path(temporary)
        try:
            if was_running:
                stack.compose("stop", "--timeout", "40", "backend")
            if stack.running("backend"):
                raise RecoveryError("Application still running; coordinated backup refused.")
            point = stack.sql("SELECT COALESCE(MAX(sequence),0) FROM sager_audit_event;")
            schema = stack.sql("SELECT version FROM flyway_schema_history WHERE success AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;")
            dump = work / "database.dump"
            with dump.open("xb") as target:
                run(stack.command + ["exec", "-T", "database", "sh", "-c", DB_COMMAND +
                    "pg_dump --no-password -U sager_owner -d sager --format=custom --no-acl"], output=target)
            documents_tar = work / "documents.tar"
            with documents_tar.open("xb") as target:
                stack.archive_documents(target)
            document_root = work / "documents"
            document_root.mkdir(mode=0o700)
            documents = documents_from_tar(documents_tar, document_root)
            files = {"database.dump": dump, **{"documents/" + name: document_root / name for name in documents}}
            manifest = {"format": 1, "sourceStack": stack.name, "schemaVersion": schema,
                        "createdAt": datetime.now(timezone.utc).isoformat(), "auditSequence": int(point),
                        "files": {"database.dump": metadata(dump), **{"documents/" + name: value for name, value in documents.items()}}}
            plain = work / "recovery.zip"
            with zipfile.ZipFile(plain, "w", zipfile.ZIP_STORED) as archive:
                archive.writestr("manifest.json", json.dumps(manifest, sort_keys=True))
                for name, path in files.items():
                    archive.write(path, name)
            encrypted = work / "recovery.age"
            run(["age", "--recipient", args.recipient, "--output", str(encrypted), str(plain)])
            os.chmod(encrypted, 0o600)
            # Exclusive creation prevents accidentally replacing another recovery point.
            with output.open("xb") as target, encrypted.open("rb") as source:
                shutil.copyfileobj(source, target)
            os.chmod(output, 0o600)
        finally:
            if was_running:
                stack.compose("start", "backend")
    print(json.dumps({"result": "encrypted_backup_created", "schemaVersion": schema,
                      "auditSequence": int(point), "documents": len(documents),
                      "elapsedSeconds": round(time.monotonic() - started, 2)}))


def validate_archive(path, destination):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or "manifest.json" not in names:
            raise RecoveryError("Invalid recovery archive.")
        manifest = json.loads(archive.read("manifest.json"))
        if (not isinstance(manifest, dict) or type(manifest.get("format")) is not int
                or manifest["format"] != 1 or not isinstance(manifest.get("files"), dict)
                or "database.dump" not in manifest["files"]):
            raise RecoveryError("Unsupported recovery format.")
        if (not isinstance(manifest.get("sourceStack"), str) or not manifest["sourceStack"]
                or not isinstance(manifest.get("schemaVersion"), str) or not manifest["schemaVersion"]
                or type(manifest.get("auditSequence")) is not int or manifest["auditSequence"] < 0):
            raise RecoveryError("Invalid recovery point metadata.")
        if set(names) != {"manifest.json", *manifest["files"]}:
            raise RecoveryError("Recovery manifest does not match archive entries.")
        files = {}
        for name, expected in manifest["files"].items():
            if (not isinstance(expected, dict) or set(expected) != {"sha256", "size"}
                    or type(expected.get("size")) is not int or expected["size"] < 1
                    or not isinstance(expected.get("sha256"), str)
                    or not re.fullmatch(r"[0-9a-f]{64}", expected["sha256"])):
                raise RecoveryError("Invalid recovery file metadata.")
            if name != "database.dump" and not (name.startswith("documents/") and UUID_NAME.fullmatch(name[10:])):
                raise RecoveryError("Unexpected recovery file path.")
            item = archive.getinfo(name)
            if item.file_size != expected.get("size") or item.is_dir():
                raise RecoveryError("Recovery entry size differs from manifest.")
            if name.startswith("documents/") and not 1 <= item.file_size <= 10 * 1024 * 1024:
                raise RecoveryError("Document exceeds the storage contract.")
            target = destination / name
            target.parent.mkdir(mode=0o700, exist_ok=True)
            with archive.open(name) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output, 1024 * 1024)
            if metadata(target) != expected:
                raise RecoveryError("Recovery file integrity mismatch.")
            files[name] = target
        return manifest, files


def restore(args):
    require_tools()
    stack = Stack(args)
    started = time.monotonic()
    if stack.running("backend") or stack.running("gateway"):
        raise RecoveryError("Stop backend and gateway of the isolated recovery stack first.")
    with tempfile.TemporaryDirectory(prefix="sager-restore-", dir=args.work_dir) as temporary:
        os.chmod(temporary, 0o700)
        plain = Path(temporary) / "recovery.zip"
        run(["age", "--decrypt", "--identity", str(Path(args.identity).resolve()),
             "--output", str(plain), str(Path(args.archive).resolve())])
        work = Path(temporary)
        manifest, files = validate_archive(plain, work)
        if stack.name == manifest.get("sourceStack"):
            raise RecoveryError("Restore requires a different, isolated Compose stack.")
        if stack.sql("SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';") != "0":
            raise RecoveryError("Target database is not empty; restore never overwrites existing data.")
        before = work / "before.tar"
        with before.open("xb") as target:
            stack.archive_documents(target)
        if documents_from_tar(before):
            raise RecoveryError("Target document volume is not empty.")
        with files["database.dump"].open("rb") as source:
            result = subprocess.run(stack.command + ["exec", "-T", "database", "sh", "-c", DB_COMMAND +
                "pg_restore --no-password -U sager_owner -d sager --no-owner --no-acl "
                "--single-transaction --exit-on-error"], stdin=source, stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE, timeout=600, check=False)
        if result.returncode:
            raise RecoveryError("Database restore failed; keep the isolated application stopped.")
        # A restored browser cookie must not revive a session from the old recovery point.
        stack.sql("DELETE FROM spring_session;")
        documents_tar = work / "documents.tar"
        with tarfile.open(documents_tar, mode="w:") as archive:
            for name, path in files.items():
                if not name.startswith("documents/"):
                    continue
                item = tarfile.TarInfo(name[10:])
                item.size, item.mode, item.uid, item.gid = path.stat().st_size, 0o600, 10001, 10001
                with path.open("rb") as source:
                    archive.addfile(item, source)
        with documents_tar.open("rb") as source:
            result = subprocess.run(stack.command + ["run", "--rm", "--no-deps", "-T", "archive-files",
                "--no-same-owner", "-C", "/data/documents", "-xf", "-"], stdin=source,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600, check=False)
        if result.returncode:
            raise RecoveryError("Document restore failed; keep the isolated application stopped.")
        after = work / "after.tar"
        with after.open("xb") as target:
            stack.archive_documents(target)
        restored = documents_from_tar(after)
        expected = {name[10:]: value for name, value in manifest["files"].items() if name.startswith("documents/")}
        if restored != expected:
            raise RecoveryError("Restored document verification failed; keep application stopped.")
        actual = stack.sql("SELECT COALESCE(MAX(sequence),0) FROM sager_audit_event;")
        if actual != str(manifest["auditSequence"]):
            raise RecoveryError("Restored audit point differs from manifest; keep application stopped.")
        schema = stack.sql("SELECT version FROM flyway_schema_history WHERE success AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;")
        if schema != manifest["schemaVersion"]:
            raise RecoveryError("Restored schema differs from manifest; keep application stopped.")
    print(json.dumps({"result": "isolated_restore_verified", "schemaVersion": manifest["schemaVersion"],
                      "auditSequence": int(actual), "documents": len(restored), "sessionsDiscarded": True,
                      "elapsedSeconds": round(time.monotonic() - started, 2), "applicationStarted": False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--compose", default=str(Path(__file__).with_name("compose.yml")))
    parser.add_argument("--env-file", required=True)
    parser.add_argument("--work-dir", help="Private encrypted temporary filesystem; required operationally for real data")
    actions = parser.add_subparsers(dest="action", required=True)
    backup = actions.add_parser("create")
    backup.add_argument("--recipient", required=True, help="Public age recipient; private identity remains offline")
    backup.add_argument("--output", required=True)
    recovery = actions.add_parser("restore")
    recovery.add_argument("--archive", required=True)
    recovery.add_argument("--identity", required=True, help="Path to the operator's private age identity")
    args = parser.parse_args()
    try:
        (create if args.action == "create" else restore)(args)
    except (RecoveryError, OSError, ValueError, tarfile.TarError, zipfile.BadZipFile, subprocess.TimeoutExpired):
        print("Recovery failed; application state and private operator diagnostics require review.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
