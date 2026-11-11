"""Exercise the deployment lifecycle without a Docker daemon or application data."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest


SOURCE = Path(__file__).with_name("start.sh")
SETTINGS = (
    "SAGER_STACK_NAME",
    "SAGER_PUBLIC_HOST",
    "SAGER_SECRETS_DIR",
    "SAGER_COOLIFY_APPLICATION_ID",
)
MOCK_DOCKER = r'''
import json
import os
from pathlib import Path
import sys

sys.stdout.reconfigure(newline="\n")
path = Path(os.environ["MOCK_DOCKER_STATE"])
state = json.loads(path.read_text())
args = sys.argv[1:]
state["calls"].append(args)
action = args[:]
if action[0] == "compose":
    action = action[1:]
    for flag in ("--project-name", "--project-directory", "--env-file", "-f"):
        assert action[0] == flag, action
        action = action[2:]
    if action[0] == "--profile":
        action = action[2:]
command = action[0]
target = action[-1]
stage = command + (":" + target if command in ("up", "run") else "")
if args[0] == "run":
    stage = "secret-check"
failed = state.get("failure") == stage
if stage == "up:backend":
    state["backend_whatsapp"] = os.environ.get("SAGER_INTEGRATIONS_WHATSAPP_ENABLED")
if command == "stop" and not failed:
    for service in ("gateway", "backend"):
        if state.get("stale") != service:
            state["services"][service] = "exited"
elif command == "ps":
    if not failed:
        print("gateway-id\nbackend-id")
elif command == "inspect":
    for container in action[3:]:
        print(state["services"][container.removesuffix("-id")])
elif command == "up":
    # A failing health wait may leave a newly started container running.
    state["services"][target] = "running"
elif command not in ("config", "run", "stop"):
    raise AssertionError(action)
path.write_text(json.dumps(state))
sys.exit(7 if failed else 0)
'''


class RawLabelTests(unittest.TestCase):
    def test_runtime_labels_are_lists_for_coolify_raw_parser_append(self):
        # Coolify 4.3.14 appends labels to a collection. A mapping would acquire
        # integer keys and become invalid YAML for Compose after that operation.
        manifest = SOURCE.parents[2] / "compose.coolify.yml"
        blocks = {}
        service = None
        in_labels = False
        for line in manifest.read_text().splitlines():
            match = re.fullmatch(r"  ([a-z-]+):", line)
            if match:
                service = match.group(1)
                in_labels = False
            elif line == "    labels:":
                in_labels = True
                blocks[service] = []
            elif in_labels and line.startswith("      "):
                blocks[service].append(line)
            else:
                in_labels = False
        self.assertEqual(set(blocks), {"database", "backend", "gateway", "whatsapp-gateway", "whatsapp-gateway-proxy"})
        for service, labels in blocks.items():
            with self.subTest(service=service):
                self.assertTrue(labels)
                self.assertTrue(all(line.startswith("      - ") for line in labels))
                self.assertTrue(all("=" in line.removeprefix("      - ") for line in labels))
                self.assertIn("      - coolify.managed=true", labels)
                self.assertIn("      - coolify.type=application", labels)
                self.assertIn("      - coolify.applicationId=${SAGER_COOLIFY_APPLICATION_ID:?Set the existing Coolify application ID}", labels)


class StartupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.name == "nt":
            cls.bash = str(Path(os.environ.get("ProgramFiles", "C:/Program Files"))
                           / "Git/bin/bash.exe")
        else:
            cls.bash = shutil.which("bash")
        if not cls.bash or not Path(cls.bash).is_file():
            raise unittest.SkipTest("Bash is required for the startup lifecycle tests")

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="sager-start-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.shell_root = subprocess.run(
            [self.bash, "-c", "pwd -P"], cwd=self.root, capture_output=True,
            check=True, text=True,
        ).stdout.strip()
        script = self.root / "infra/coolify/start.sh"
        script.parent.mkdir(parents=True)
        shutil.copyfile(SOURCE, script)
        self.script = script
        (self.root / "compose.coolify.yml").write_text("services: {}\n")
        self.env_file = self.root / ".env"
        self.env_file.write_text(
            "SAGER_STACK_NAME=sager-test-one\n"
            "SAGER_PUBLIC_HOST=sager.example.test\n"
            "SAGER_SECRETS_DIR=/srv/sager/private/secrets\n"
            "SAGER_COOLIFY_APPLICATION_ID=123\n"
        )
        self.state_file = self.root / "mock-state.json"
        self.state = {
            "calls": [],
            "services": {"database": "exited", "backend": "running", "gateway": "running"},
        }
        binaries = self.root / "bin"
        binaries.mkdir()
        docker = binaries / "docker"
        docker.write_text(
            '#!/usr/bin/env bash\nexec "$MOCK_PYTHON" "$MOCK_DOCKER_SCRIPT" "$@"\n',
            newline="\n",
        )
        docker.chmod(0o755)
        mock = self.root / "mock_docker.py"
        mock.write_text(MOCK_DOCKER)
        self.environment = os.environ.copy()
        for key in SETTINGS:
            self.environment.pop(key, None)
        self.environment.update({
            "PATH": str(binaries) + os.pathsep + self.environment.get("PATH", ""),
            "MOCK_PYTHON": Path(sys.executable).as_posix(),
            "MOCK_DOCKER_SCRIPT": mock.as_posix(),
            "MOCK_DOCKER_STATE": self.state_file.as_posix(),
            "MSYS_NO_PATHCONV": "1",
        })

    def run_script(self, *arguments):
        self.state_file.write_text(json.dumps(self.state))
        result = subprocess.run(
            [self.bash, self.script.as_posix(), *arguments],
            cwd=self.root / "bin",
            env=self.environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.state = json.loads(self.state_file.read_text())
        return result

    def actions(self):
        return [call[9:] for call in self.state["calls"] if call[0] == "compose"]

    def assert_stopped(self):
        self.assertEqual(self.state["services"]["backend"], "exited")
        self.assertEqual(self.state["services"]["gateway"], "exited")

    def assert_no_runtime_up(self):
        self.assertFalse(any(action[0] == "up" and action[-1] in ("backend", "gateway")
                             for action in self.actions()))

    def test_success_orders_stopping_maintenance_and_separate_health_waits(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.actions(), [
            ["config", "--quiet"],
            ["stop", "--timeout", "30", "gateway", "backend"],
            ["ps", "--all", "--quiet", "gateway", "backend"],
            ["up", "-d", "--no-build", "--wait", "--wait-timeout", "120", "database"],
            ["--profile", "maintenance", "run", "--rm", "-T", "--no-deps", "--pull", "never", "migrate"],
            ["--profile", "maintenance", "run", "--rm", "-T", "--no-deps", "--pull", "never", "initialize-runtime"],
            ["up", "-d", "--no-build", "--no-deps", "--pull", "never", "--wait", "--wait-timeout", "240", "backend"],
            ["up", "-d", "--no-build", "--no-deps", "--pull", "never", "--wait", "--wait-timeout", "90", "gateway"],
        ])
        for call in self.state["calls"]:
            if call[0] == "compose":
                self.assertEqual(call[1:9], [
                    "--project-name", "sager-test-one",
                    "--project-directory", self.shell_root,
                    "--env-file", self.shell_root + "/.env",
                    "-f", self.shell_root + "/compose.coolify.yml",
                ])
        self.assertNotIn("/srv/sager/private", result.stdout + result.stderr)

    def test_each_maintenance_failure_blocks_runtime_start(self):
        for failure in ("up:database", "run:migrate", "run:initialize-runtime"):
            with self.subTest(failure=failure):
                self.state["calls"] = []
                self.state["failure"] = failure
                result = self.run_script()
                self.assertNotEqual(result.returncode, 0)
                self.assert_stopped()
                self.assert_no_runtime_up()
                actions = self.actions()
                if failure == "run:migrate":
                    self.assertFalse(any(action[-1] == "initialize-runtime" for action in actions))
                if failure == "up:database":
                    self.assertFalse(any("run" in action for action in actions))

    def test_backend_health_failure_stops_new_backend_and_never_starts_gateway(self):
        self.state["failure"] = "up:backend"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assert_stopped()
        self.assertFalse(any(action[0] == "up" and action[-1] == "gateway"
                             for action in self.actions()))

    def test_gateway_health_failure_also_stops_healthy_backend(self):
        self.state["failure"] = "up:gateway"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assert_stopped()
        self.assertEqual(self.actions()[-2][0], "stop")

    def enable_whatsapp(self):
        self.env_file.write_text(self.env_file.read_text() + "SAGER_INTEGRATIONS_WHATSAPP_ENABLED=true\n")

    def whatsapp_actions(self):
        return [action for action in self.actions() if action[:2] == ["--profile", "whatsapp"]]

    def test_whatsapp_stays_off_by_default(self):
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.whatsapp_actions(), [])
        self.assertFalse(any(call[0] == "run" for call in self.state["calls"]))

    def test_whatsapp_starts_after_the_healthy_sager(self):
        self.enable_whatsapp()
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.actions()[-3:], [
            ["up", "-d", "--no-build", "--no-deps", "--pull", "never", "--wait", "--wait-timeout", "90", "gateway"],
            ["--profile", "whatsapp", "run", "--rm", "-T", "--no-deps", "--pull", "never", "whatsapp-gateway-prepare"],
            ["--profile", "whatsapp", "up", "-d", "--no-build", "--no-deps", "--pull", "never", "--wait",
             "--wait-timeout", "90", "whatsapp-gateway", "whatsapp-gateway-proxy"],
        ])
        # The secrets directory is 0700; the gateway image's own user cannot list it.
        check = next(call for call in self.state["calls"] if call[0] == "run")
        self.assertEqual(check[check.index("--user") + 1], "0:0")
        self.assertEqual(self.state["backend_whatsapp"], "true")

    def test_whatsapp_failure_never_takes_the_sager_down(self):
        for failure in ("run:whatsapp-gateway-prepare", "up:whatsapp-gateway-proxy"):
            with self.subTest(failure=failure):
                self.setUp()
                self.enable_whatsapp()
                self.state["failure"] = failure
                result = self.run_script()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("the SAGER stays up", result.stderr)
                self.assertEqual(self.state["services"]["backend"], "running")
                self.assertEqual(self.state["services"]["gateway"], "running")

    def test_whatsapp_without_secret_files_starts_the_sager_without_it(self):
        # Coolify removes the old containers before this script, so a failure here meant a 503.
        self.enable_whatsapp()
        self.state["failure"] = "secret-check"
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("secret files are missing", result.stderr)
        self.assertEqual(self.whatsapp_actions(), [])
        self.assertEqual(self.state["backend_whatsapp"], "false")
        self.assertEqual(self.state["services"]["backend"], "running")
        self.assertEqual(self.state["services"]["gateway"], "running")

    def test_stale_running_backend_blocks_even_database_start(self):
        self.state["stale"] = "backend"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Runtime must be stopped", result.stderr)
        self.assertIn("operator intervention", result.stderr)
        self.assertFalse(any(action[0] in ("up", "run") for action in self.actions()))

    def test_docker_stop_failure_never_runs_migrations(self):
        self.state["failure"] = "stop"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("operator intervention", result.stderr)
        self.assertFalse(any(action[0] in ("up", "run") for action in self.actions()))

    def test_compose_validation_failure_stops_before_touching_containers(self):
        self.state["failure"] = "config"
        result = self.run_script()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.actions(), [["config", "--quiet"]])
        self.assertEqual(self.state["services"]["backend"], "running")

    def test_env_file_supports_literals_comments_and_crlf_without_shell_execution(self):
        marker = self.root / "must-not-exist"
        content = self.env_file.read_text().replace(
            "SAGER_STACK_NAME=sager-test-one", " export SAGER_STACK_NAME = 'sager-quoted' # project"
        ).replace(
            "SAGER_SECRETS_DIR=/srv/sager/private/secrets",
            'SAGER_SECRETS_DIR="/srv/sager/private secrets" # host mount',
        ) + f"UNRELATED=$(touch '{marker.as_posix()}')\n"
        self.env_file.write_bytes(content.replace("\n", "\r\n").encode())
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state["calls"][0][2], "sager-quoted")
        self.assertFalse(marker.exists())

    def test_exported_project_name_wins_over_runtime_env(self):
        self.environment["SAGER_STACK_NAME"] = "sager-exported"
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(all(call[2] == "sager-exported" for call in self.state["calls"]
                            if call[0] == "compose"))

    def test_missing_project_name_uses_documented_default(self):
        self.env_file.write_text(self.env_file.read_text().replace("SAGER_STACK_NAME=sager-test-one\n", ""))
        result = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state["calls"][0][2], "sager-homologacao")

    def test_unsafe_operational_values_fail_before_docker_commands(self):
        for original, replacement in (
            ("sager-test-one", "$(id)"),
            ("sager-test-one", "../another-stack"),
            ("/srv/sager/private/secrets", "relative/secrets"),
            ("APPLICATION_ID=123", "APPLICATION_ID=not-an-id"),
        ):
            with self.subTest(replacement=replacement):
                content = self.env_file.read_text()
                self.env_file.write_text(content.replace(original, replacement))
                self.state["calls"] = []
                result = self.run_script()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(self.state["calls"], [])
                self.env_file.write_text(content)


if __name__ == "__main__":
    unittest.main()
