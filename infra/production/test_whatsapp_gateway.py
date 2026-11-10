"""Check the gateway isolation in the rendered manifests and through disposable containers."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
NGINX = "nginx:1.30.0-alpine@sha256:0272e4604ed93c1792f03695a033a6e8546840f86e0de20a884bb17d2c924883"
WAHA = "devlikeapro/waha:gows-2026.10.1@sha256:1f7faeb0227ad5edb5711f7058bfce807ea65e5f92234af0778e4db140f6eb46"
MANIFESTS = ("compose.yaml", "compose.coolify.yml", "infra/production/compose.yml")
WEBHOOK = "/api/v1/integracoes/whatsapp/webhook"
HOST = "sager.example.test"
ECHO = ("pid /tmp/echo.pid; error_log /dev/stderr warn; events {} http { access_log off; "
        "client_max_body_size 0; client_body_temp_path /tmp/client; proxy_temp_path /tmp/proxy; "
        "fastcgi_temp_path /tmp/fastcgi; uwsgi_temp_path /tmp/uwsgi; scgi_temp_path /tmp/scgi; "
        "server { listen PORT; location / { return 200 "
        "\"$request_method $request_uri|$http_host|$http_x_forwarded_host|$http_x_forwarded_for|"
        "$http_x_forwarded_proto|$http_x_forwarded_port|$http_forwarded|$http_x_webhook_hmac\"; } } }")


def docker(*args, check=False, timeout=60):
    return subprocess.run(["docker", *args], text=True, encoding="utf-8", capture_output=True,
                          check=check, timeout=timeout)


@unittest.skipUnless(shutil.which("docker"), "Docker is required to render the manifests")
class ManifestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="sager-whatsapp-manifest-")
        env = dict(os.environ, SAGER_PUBLIC_HOST=HOST, SAGER_SECRETS_DIR=cls.temp.name,
                   SAGER_TLS_DIR=cls.temp.name, SAGER_COOLIFY_APPLICATION_ID="1",
                   SAGER_DB_PASSWORD="synthetic", SAGER_RATE_LIMIT_SECRET="synthetic",
                   SAGER_INTEGRATIONS_WHATSAPP_API_KEY="synthetic-key",
                   SAGER_INTEGRATIONS_WHATSAPP_WEBHOOK_SECRET="synthetic-secret")
        cls.configs = {}
        for name in MANIFESTS:
            result = subprocess.run(
                ["docker", "compose", "-f", str(ROOT / name), "--profile", "whatsapp", "--profile", "maintenance",
                 "config", "--format", "json"],
                text=True, encoding="utf-8", capture_output=True, env=env, timeout=60)
            if result.returncode:
                raise AssertionError(result.stderr)
            cls.configs[name] = json.loads(result.stdout)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def each(self):
        for name, config in self.configs.items():
            with self.subTest(manifest=name):
                yield config

    def test_gateway_is_pinned_restricted_and_outside_the_application_networks(self):
        for config in self.each():
            gateway = config["services"]["whatsapp-gateway"]
            self.assertEqual(gateway["image"], WAHA)
            self.assertEqual(gateway["profiles"], ["whatsapp"])
            self.assertEqual(set(gateway["networks"]), {"whatsapp_private", "whatsapp_egress"})
            self.assertNotIn("network_mode", gateway)
            self.assertNotIn("ports", gateway)
            self.assertEqual(gateway["user"], "10001:10001")
            self.assertTrue(gateway["read_only"])
            self.assertEqual(gateway["cap_drop"], ["ALL"])
            self.assertEqual(gateway["security_opt"], ["no-new-privileges:true"])
            self.assertEqual(gateway["environment"]["WHATSAPP_FILES_LIFETIME"], "86400")
            self.assertEqual(gateway["environment"]["WHATSAPP_DEFAULT_ENGINE"], "GOWS")
            self.assertEqual(gateway["environment"]["WAHA_DASHBOARD_ENABLED"], "false")
            self.assertEqual(gateway["environment"]["WHATSAPP_SWAGGER_ENABLED"], "false")
            self.assertEqual(gateway["environment"]["WHATSAPP_HOOK_EVENTS"],
                             "message.any,message.ack,session.status")
            self.assertEqual(gateway["environment"]["WHATSAPP_HOOK_URL"],
                             "http://whatsapp-gateway-proxy:8080" + WEBHOOK)
            retries = gateway["environment"]
            self.assertGreaterEqual(int(retries["WHATSAPP_HOOK_RETRIES_ATTEMPTS"])
                                    * int(retries["WHATSAPP_HOOK_RETRIES_DELAY_SECONDS"]), 600)
            self.assertEqual({volume["source"] for volume in gateway["volumes"]}, {"waha_sessions", "waha_media"})

    def test_networks_keep_backend_and_gateway_apart(self):
        for config in self.each():
            proxy, backend = config["services"]["whatsapp-gateway-proxy"], config["services"]["backend"]
            self.assertEqual(set(proxy["networks"]), {"whatsapp_api", "whatsapp_private"})
            self.assertNotIn("ports", proxy)
            self.assertNotIn("network_mode", proxy)
            self.assertIn("whatsapp_api", backend["networks"])
            self.assertNotIn("whatsapp_private", backend["networks"])
            self.assertNotIn("whatsapp_egress", backend["networks"])
            networks = config["networks"]
            self.assertTrue(networks["whatsapp_api"]["internal"])
            self.assertTrue(networks["whatsapp_private"]["internal"])
            self.assertFalse(networks["whatsapp_egress"].get("internal", False))
            self.assertEqual(len(networks["whatsapp_egress"]["ipam"]["config"]), 1)

    def test_the_sager_never_depends_on_the_gateway_and_defaults_to_disabled(self):
        for config in self.each():
            for service, definition in config["services"].items():
                if not service.startswith("whatsapp-"):
                    self.assertFalse(set(definition.get("depends_on", {})) & {"whatsapp-gateway", "whatsapp-gateway-proxy"})
            environment = config["services"]["backend"]["environment"]
            self.assertEqual(environment["SAGER_INTEGRATIONS_WHATSAPP_ENABLED"], "false")
            self.assertEqual(environment["SAGER_INTEGRATIONS_WHATSAPP_BASE_URL"], "http://whatsapp-gateway-proxy:3000")

    def test_gateway_receives_no_application_secret_and_backup_leaves_the_session_out(self):
        for name in MANIFESTS[1:]:
            with self.subTest(manifest=name):
                services = self.configs[name]["services"]
                self.assertEqual({secret["source"] for secret in services["whatsapp-gateway"]["secrets"]},
                                 {"waha_api_key", "waha_webhook_hmac"})
                self.assertEqual({volume["source"] for volume in services["archive-files"]["volumes"]}, {"documents"})
        recovery = (ROOT / "infra/production/recovery.py").read_text(encoding="utf-8")
        self.assertNotIn("waha", recovery)


@unittest.skipUnless(shutil.which("docker"), "Docker is required for the isolation test")
class IsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if docker("info", "--format", "{{.ServerVersion}}").returncode:
            raise unittest.SkipTest("Docker daemon unavailable")
        cls.token = uuid.uuid4().hex[:10]
        cls.name = "sager-whatsapp-test-" + cls.token
        cls.networks = {key: f"{cls.name}-{key}" for key in ("api", "private")}
        cls.containers = []
        cls.temp = tempfile.TemporaryDirectory(prefix="sager-whatsapp-proxy-")
        folder = Path(cls.temp.name)
        folder.chmod(0o755)
        for key, port in (("backend", 8080), ("gateway", 3000)):
            file = folder / f"{key}.conf"
            file.write_text(ECHO.replace("PORT", str(port)), newline="\n")
            file.chmod(0o444)
        try:
            for network in cls.networks.values():
                docker("network", "create", "--internal", network, check=True)
            # The proxy starts first: it must come up with neither neighbour available.
            cls.run_container("proxy", "api", ["--env", f"SAGER_PUBLIC_HOST={HOST}",
                                               "--env", "SAGER_WEBHOOK_UPSTREAM=backend:8080",
                                               "--memory", "32m", "--memory-swap", "32m",
                                               "--mount", "type=bind,readonly,dst=/etc/nginx/whatsapp-gateway-proxy.conf.template,"
                                               f"src={ROOT / 'infra/production/whatsapp-gateway-proxy.conf.template'}",
                                               "--network-alias", "whatsapp-gateway-proxy"],
                              ["-c", "envsubst '$SAGER_PUBLIC_HOST $SAGER_WEBHOOK_UPSTREAM' < /etc/nginx/whatsapp-gateway-proxy.conf.template > /tmp/nginx.conf && exec nginx -c /tmp/nginx.conf -g 'daemon off;'"])
            docker("network", "connect", "--alias", "whatsapp-gateway-proxy", cls.networks["private"], cls.containers[-1], check=True)
            cls.assert_proxy_running()
            cls.run_container("backend", "api", ["--network-alias", "backend", "--mount",
                                                 f"type=bind,src={folder / 'backend.conf'},dst=/opt/echo.conf,readonly"],
                              ["-c", "exec nginx -c /opt/echo.conf -g 'daemon off;'"])
            cls.run_container("gateway", "private", ["--network-alias", "whatsapp-gateway", "--mount",
                                                     f"type=bind,src={folder / 'gateway.conf'},dst=/opt/echo.conf,readonly"],
                              ["-c", "exec nginx -c /opt/echo.conf -g 'daemon off;'"])
            cls.payload("backend", "/tmp/14m", 14)
        except BaseException:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        for container in reversed(cls.containers):
            docker("rm", "-f", container)
        for network in cls.networks.values():
            docker("network", "rm", network)
        cls.temp.cleanup()

    @classmethod
    def container(cls, key):
        return f"{cls.name}-{key}"

    @classmethod
    def run_container(cls, key, network, options, command):
        docker("run", "-d", "--name", cls.container(key), "--network", cls.networks[network],
               "--read-only", "--user", "101:101", "--cap-drop", "ALL", "--tmpfs", "/tmp:rw,nosuid,size=32m" if key != "proxy" else "/tmp:rw,noexec,nosuid,size=8m",
               *options, "--entrypoint", "sh", NGINX, *command, check=True)
        cls.containers.append(cls.container(key))

    @classmethod
    def payload(cls, key, path, mebibytes):
        # BusyBox wget measures --post-file with strlen, so the content cannot hold NUL bytes.
        docker("exec", cls.container(key), "sh", "-c",
               f"head -c {mebibytes * 1048576} /dev/zero | tr '\\000' a > {path}", check=True)

    @classmethod
    def assert_proxy_running(cls):
        state = docker("inspect", "--format", "{{.State.Running}}", cls.container("proxy"), check=True).stdout.strip()
        if state != "true":
            raise AssertionError(docker("logs", cls.container("proxy")).stderr)

    def wget(self, peer, url, *options):
        return docker("exec", self.container(peer), "wget", "-S", "-O", "-", *options, url)

    def from_gateway(self, path, *options):
        return self.wget("gateway", "http://whatsapp-gateway-proxy:8080" + path, *options)

    def test_gateway_cannot_reach_the_backend_directly(self):
        result = self.wget("gateway", "http://backend:8080/actuator/health", "-T", "3")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("bad address", result.stderr)

    def test_post_to_the_webhook_passes_with_rebuilt_headers(self):
        result = self.from_gateway(WEBHOOK + "?drop=1", "--post-data", "{}",
                                   "--header", "X-Webhook-Hmac: synthetic-signature",
                                   "--header", "Host: forged.example.test",
                                   "--header", "X-Forwarded-Host: forged.example.test",
                                   "--header", "X-Forwarded-For: 203.0.113.77",
                                   "--header", "X-Forwarded-Proto: http",
                                   "--header", "X-Forwarded-Port: 80",
                                   "--header", "Forwarded: for=203.0.113.77")
        self.assertEqual(result.returncode, 0, result.stderr)
        fields = result.stdout.split("|")
        self.assertEqual(fields[0], "POST " + WEBHOOK)
        self.assertEqual(fields[1:3], [HOST, HOST])
        self.assertNotIn("203.0.113.77", result.stdout)
        self.assertEqual(fields[4:7], ["https", "443", ""])
        self.assertEqual(fields[7], "synthetic-signature")

    def test_any_other_method_or_route_answers_404(self):
        for path, options in ((WEBHOOK, ()),
                              ("/", ()),
                              ("/actuator/health", ()),
                              ("/api/v1/auth/login", ("--post-data", "x")),
                              ("/actuator/health", ("--post-data", "x")),
                              (WEBHOOK + "/", ("--post-data", "x")),
                              (WEBHOOK + "/../../../auth/login", ("--post-data", "x")),
                              (WEBHOOK + "%2f..%2f..%2f..%2fauth%2flogin", ("--post-data", "x")),
                              ("/actuator/..;/api/v1/integracoes/whatsapp/webhook", ("--post-data", "x"))):
            with self.subTest(path=path, options=options):
                result = self.from_gateway(path, *options)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("404", result.stderr)
                self.assertEqual(result.stdout, "")

    def test_webhook_keeps_the_one_mebibyte_limit(self):
        self.payload("gateway", "/tmp/2m", 2)
        result = self.from_gateway(WEBHOOK, "--post-file", "/tmp/2m")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("413", result.stderr)

    def test_backend_reaches_the_gateway_with_a_base64_document_through_the_small_tmpfs(self):
        result = self.wget("backend", "http://whatsapp-gateway-proxy:3000/api/sendFile",
                           "--post-file", "/tmp/14m", "--header", "X-Api-Key: synthetic-key")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(result.stdout.startswith("POST /api/sendFile|"), result.stdout)
        self.assert_proxy_running()

    def test_proxy_survives_the_gateway_going_down(self):
        docker("stop", "--timeout", "1", self.container("gateway"), check=True)
        try:
            result = self.wget("backend", "http://whatsapp-gateway-proxy:3000/ping", "-T", "10")
            self.assertNotEqual(result.returncode, 0)
            self.assertRegex(result.stderr, "50[24]")
            self.assert_proxy_running()
        finally:
            docker("start", self.container("gateway"), check=True)


if __name__ == "__main__":
    unittest.main()
