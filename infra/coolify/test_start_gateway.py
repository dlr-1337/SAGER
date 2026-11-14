"""Focused startup/security tests against the pinned nginx base, without app builds."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
IMAGE = "nginx:1.30.0-alpine@sha256:0272e4604ed93c1792f03695a033a6e8546840f86e0de20a884bb17d2c924883"
HOST = "sager.example.test"


def docker(*args, check=False):
    return subprocess.run(["docker", *args], text=True, encoding="utf-8", capture_output=True,
                          check=check, timeout=40)


class StaticPolicyTests(unittest.TestCase):
    def test_standalone_remains_default_and_proxy_is_packaged(self):
        source = (ROOT / "infra/production/gateway.Dockerfile").read_text()
        self.assertEqual(re.findall(r"^FROM .+ AS (\S+)$", source, re.M)[-1], "standalone")
        self.assertIn("FROM gateway-runtime AS coolify", source)
        self.assertIn("COPY infra/production/sager-proxy.conf /etc/nginx/sager-proxy.conf", source)
        runtime = source.split("AS gateway-runtime", 1)[1].split("\nFROM ", 1)[0]
        self.assertIn("COPY infra/production/sager-security-headers.conf /etc/nginx/sager-security-headers.conf", runtime)
        self.assertIn("EXPOSE 8080 8443", source.split("AS standalone", 1)[1])

    def test_csp_and_sensitive_locations_match_existing_production_policy(self):
        standalone = (ROOT / "infra/production/nginx.conf.template").read_text()
        coolify = (ROOT / "infra/coolify/nginx.conf.template").read_text()
        for prefix in ["add_header ", "log_format operational ", "limit_req_zone "]:
            original = [line.strip() for line in standalone.splitlines() if line.strip().startswith(prefix)]
            actual = [line.strip() for line in coolify.splitlines() if line.strip().startswith(prefix)]
            self.assertEqual(original, actual)
        self.assertIn("geo $realip_remote_addr $sager_trusted_peer", coolify)
        self.assertIn("~^https$ 1;", coolify)
        self.assertIn("listen 127.0.0.1:8081;", coolify)
        self.assertNotIn("ssl_certificate", coolify)

    def test_upload_limit_covers_only_the_exact_routes_in_both_gateways(self):
        for name in ("infra/production/nginx.conf.template", "infra/coolify/nginx.conf.template"):
            with self.subTest(name=name):
                source = (ROOT / name).read_text()
                self.assertEqual(re.findall(r"client_max_body_size (\S+);", source), ["1m", "11m"])
                self.assertEqual(source.count("include /etc/nginx/sager-security-headers.conf;"), 2)
                self.assertNotIn("clicksign", source)
                pattern = re.search(r"location ~ (\^/api/v1/\S+) \{", source)[1]
                uuid = "00000000-0000-0000-0000-000000000000"
                for route in (f"/api/v1/conversas/{uuid}/mensagens", f"/api/v1/saidas-longas/{uuid}/autorizacao/arquivos"):
                    self.assertRegex(route, pattern)
                for route in ("/api/v1/integracoes/whatsapp/webhook", f"/api/v1/conversas/{uuid}/mensagens/x",
                              "/api/v1/conversas/mensagens", f"/api/v1/saidas-longas/{uuid}/autorizacao/arquivos/{uuid}"):
                    self.assertNotRegex(route, pattern)

    def test_included_security_headers_keep_the_approved_policy(self):
        source = (ROOT / "infra/production/sager-security-headers.conf").read_text()
        lines = [line for line in source.splitlines() if line.startswith("add_header ")]
        self.assertEqual([line.split()[1] for line in lines], ["Strict-Transport-Security", "X-Content-Type-Options",
                                                              "Referrer-Policy", "Permissions-Policy", "Content-Security-Policy"])
        self.assertTrue(all(line.endswith(" always;") for line in lines))
        self.assertIn("microphone=(self)", source)
        self.assertIn("media-src 'self' blob:", source)
        self.assertNotIn("Cache-Control", source)

    def test_only_hashed_build_files_are_immutable_in_both_gateways(self):
        generic = r"location ~* \.(?:js|css|woff2?|svg|png|jpe?g|ico)$"
        for name in ("infra/production/nginx.conf.template", "infra/coolify/nginx.conf.template"):
            with self.subTest(name=name):
                source = (ROOT / name).read_text()
                hashed = re.search(r'location ~ "(\^/\(\?:\(\?:main\S+)" \{', source)
                self.assertIsNotNone(hashed)
                # nginx uses the first matching regex location, so the hashed one must come first.
                self.assertLess(hashed.start(), source.index(generic))
                block = source[hashed.end():source.index("}", hashed.end())]
                self.assertIn("try_files $uri =404;", block)
                self.assertIn("include /etc/nginx/sager-security-headers.conf;", block)
                self.assertIn("add_header Cache-Control $sager_asset_cache always;", block)
                cache = re.search(r"map \$status \$sager_asset_cache \{([^}]*)\}", source)[1]
                self.assertEqual(re.findall(r"^\s*(\S+) (.+);$", cache, re.M),
                                 [("default", "no-store"), ("200", "'public, max-age=31536000, immutable'"),
                                  ("304", "'public, max-age=31536000, immutable'")])
                self.assertIn("$request_time $upstream_response_time';", source)
                for route in ("main-WJFN5VBD.js", "chunk-BD-lnXbU.js", "styles-EFZDFVRE.css",
                              "media/open-sans-latin-400-normal-WXNQF4GQ.woff2"):
                    self.assertRegex("/" + route, hashed[1])
                for route in ("favicon.svg", "og-image.png", "if-goiano-urutai.png", "index.html",
                              "manifest.webmanifest", "main.js", "chunk-short.js", "media/a/b-WXNQF4GQ.woff2"):
                    self.assertNotRegex("/" + route, hashed[1])


@unittest.skipUnless(shutil.which("docker"), "Docker is required for the focused shell/container tests")
class StartupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if docker("info", "--format", "{{.ServerVersion}}").returncode:
            raise unittest.SkipTest("Docker daemon unavailable")
        cls.temp = tempfile.TemporaryDirectory(prefix="sager-coolify-start-")
        folder = Path(cls.temp.name)
        # The bind mount is read by nginx uid 101; mkdtemp is 0700 on Linux.
        # This directory contains only synthetic test executables, never secrets.
        folder.chmod(0o755)
        (folder / "nslookup").write_text("#!/bin/sh\n[ \"$1\" = coolify-proxy ] && [ \"$2\" = 127.0.0.11 ] || exit 9\nprintf '%s\\n' \"$DNS_RESULT\"\nexit \"${DNS_EXIT_CODE:-0}\"\n", newline="\n")
        (folder / "nginx").write_text("#!/bin/sh\nif [ \"$1\" = -t ]; then if [ \"${REAL_NGINX_TEST:-0}\" = 1 ]; then exec /usr/sbin/nginx \"$@\"; fi; exit 0; fi\ncat \"$SAGER_COOLIFY_REALIP_FILE\" \"$SAGER_COOLIFY_PEERS_FILE\"\nwhile [ $# -gt 0 ]; do if [ \"$1\" = -c ]; then shift; cat \"$1\"; break; fi; shift; done\n", newline="\n")
        for file in folder.iterdir():
            file.chmod(0o555)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def start(self, addresses=(), host=HOST, exit_code=0, raw=None, real_syntax=False):
        answer = raw if raw is not None else "Server: 127.0.0.11\nAddress: 127.0.0.11:53\n\n" + "\n".join("Name: coolify-proxy\nAddress: " + address for address in addresses)
        return docker("run", "--rm", "--read-only", "--user", "101:101", "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m",
                      "--mount", f"type=bind,src={self.temp.name},dst=/opt/testbin,readonly",
                      "--mount", f"type=bind,src={ROOT / 'infra/coolify/start-gateway.sh'},dst=/opt/start-gateway.sh,readonly",
                      "--mount", f"type=bind,src={ROOT / 'infra/coolify/nginx.conf.template'},dst=/etc/nginx/nginx.conf.template,readonly",
                      "--mount", f"type=bind,src={ROOT / 'infra/production/sager-proxy.conf'},dst=/etc/nginx/sager-proxy.conf,readonly",
                      "--mount", f"type=bind,src={ROOT / 'infra/production/sager-security-headers.conf'},dst=/etc/nginx/sager-security-headers.conf,readonly",
                      "--add-host", "backend:127.0.0.1", "--env", f"REAL_NGINX_TEST={int(real_syntax)}",
                      "--env", "PATH=/opt/testbin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                      "--env", f"SAGER_PUBLIC_HOST={host}", "--env", f"DNS_RESULT={answer}", "--env", f"DNS_EXIT_CODE={exit_code}",
                      "--entrypoint", "sh", IMAGE, "/opt/start-gateway.sh")

    def test_ipv4_ipv6_and_exact_peer_entries_keep_nginx_variables(self):
        result = self.start(["172.20.0.2", "FD00:1234::2", "172.20.0.2", "::ffff:172.20.0.3"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.count("set_real_ip_from 172.20.0.2;"), 1)
        self.assertIn("set_real_ip_from fd00:1234::2;", result.stdout)
        self.assertIn("set_real_ip_from ::ffff:172.20.0.3;", result.stdout)
        self.assertNotIn("set_real_ip_from 127.0.0.11;", result.stdout)
        self.assertIn("$realip_remote_addr", result.stdout)
        self.assertIn("~*^sager\\.example\\.test(:443)?$", result.stdout)

    def test_dns_unavailable_or_empty_fails_closed(self):
        for kwargs in [{"exit_code": 1}, {"addresses": []}, {"raw": "Name: attacker\nAddress: 172.20.0.2"}]:
            with self.subTest(kwargs=kwargs):
                result = self.start(**kwargs)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(result.stdout, "")

    def test_rendered_ipv6_and_mapped_addresses_pass_real_nginx_syntax(self):
        result = self.start(["fd00:1234::2", "2001:db8:1:2:3:4:5:6", "::ffff:172.20.0.3"], real_syntax=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("syntax is ok", result.stderr)
        self.assertIn("test is successful", result.stderr)

    def test_malformed_or_non_unicast_ips_never_render_configuration(self):
        for address in ["127.0.0.1", "0.0.0.0", "224.0.0.1", "172.20.0.999", "172.020.0.2", "172.20.0.0/16",
                        "::", "::1", "ff02::1", "fd00:::2", "fd00::1::2", "10000::2", "fd00::2%eth0", "::ffff:127.0.0.1", "172.20.0.2;include"]:
            with self.subTest(address=address):
                result = self.start(["172.20.0.2", address])
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertIn("valid unicast proxy IP addresses", result.stderr)

    def test_hostname_validation_precedes_dns_or_render(self):
        for host in ["", "sager.example.test;", "-sager.test", "sager..test", "sager.test.", "sager.example.test\nother.example.test", "127.0.0.1", "a" * 64 + ".test"]:
            with self.subTest(host=host):
                result = self.start(["172.20.0.2"], host=host)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("valid DNS hostname", result.stderr)


@unittest.skipUnless(shutil.which("docker"), "Docker is required for nginx smoke")
class NginxSmokeTests(unittest.TestCase):
    def test_only_resolved_original_proxy_peer_and_https_host_can_access_gateway(self):
        token = uuid.uuid4().hex[:10]
        network = "sager-coolify-gateway-test-" + token
        names = {key: network + "-" + key for key in ["proxy", "backend", "gateway"]}
        with tempfile.TemporaryDirectory(prefix="sager-coolify-nginx-") as temp:
            folder = Path(temp)
            (folder / "index.html").write_text('<meta name="sager-environment" content="production"><meta property="og:image" content="__SAGER_ORIGIN__/og-image.png">Synthetic gateway smoke', newline="\n")
            (folder / "manifest.webmanifest").write_text('{"name":"SAGER"}', newline="\n")
            (folder / "main-WJFN5VBD.js").write_text("export {};\n", newline="\n")
            (folder / "backend.conf").write_text("pid /tmp/backend.pid; error_log /dev/stderr warn; events {} http { access_log off; client_body_temp_path /tmp/client; proxy_temp_path /tmp/proxy; fastcgi_temp_path /tmp/fastcgi; uwsgi_temp_path /tmp/uwsgi; scgi_temp_path /tmp/scgi; server { listen 8080; location / { return 200 \"$http_host|$http_x_forwarded_for|$http_x_forwarded_proto|$http_x_forwarded_port|$http_forwarded\"; } } }", newline="\n")
            created = []
            try:
                docker("network", "create", "--internal", network, check=True)
                for key, alias in [("proxy", "coolify-proxy"), ("backend", "backend")]:
                    args = ["run", "-d", "--name", names[key], "--network", network, "--network-alias", alias, "--read-only", "--user", "101:101", "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m"]
                    if key == "proxy":
                        args += ["--entrypoint", "sh", IMAGE, "-c", "sleep 120"]
                    else:
                        args += ["--mount", f"type=bind,src={folder / 'backend.conf'},dst=/opt/backend.conf,readonly", "--entrypoint", "nginx", IMAGE, "-c", "/opt/backend.conf", "-g", "daemon off;"]
                    docker(*args, check=True); created.append(names[key])
                docker("run", "-d", "--name", names["gateway"], "--network", network, "--network-alias", "gateway",
                       "--read-only", "--user", "101:101", "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m",
                       "--mount", f"type=bind,src={ROOT / 'infra/coolify/start-gateway.sh'},dst=/opt/start-gateway.sh,readonly",
                       "--mount", f"type=bind,src={ROOT / 'infra/coolify/nginx.conf.template'},dst=/etc/nginx/nginx.conf.template,readonly",
                       "--mount", f"type=bind,src={ROOT / 'infra/production/sager-proxy.conf'},dst=/etc/nginx/sager-proxy.conf,readonly",
                       "--mount", f"type=bind,src={ROOT / 'infra/production/sager-security-headers.conf'},dst=/etc/nginx/sager-security-headers.conf,readonly",
                       "--mount", f"type=bind,src={folder / 'main-WJFN5VBD.js'},dst=/usr/share/nginx/html/main-WJFN5VBD.js,readonly",
                       "--mount", f"type=bind,src={folder / 'index.html'},dst=/usr/share/nginx/html/index.html,readonly",
                       "--mount", f"type=bind,src={folder / 'manifest.webmanifest'},dst=/usr/share/nginx/html/manifest.webmanifest,readonly",
                       "--env", f"SAGER_PUBLIC_HOST={HOST}", "--entrypoint", "sh", IMAGE, "/opt/start-gateway.sh", check=True)
                created.append(names["gateway"])
                health = None
                for _ in range(30):
                    health = docker("exec", names["gateway"], "wget", "-q", "-O", "-", "http://127.0.0.1:8081/readiness")
                    if health.returncode == 0: break
                    time.sleep(0.2)
                self.assertEqual(health.returncode, 0, docker("logs", names["gateway"]).stderr)
                self.assertEqual(health.stdout, "ready\n")

                def request(peer="proxy", route="/api/probe", host=HOST, proto="https", xff="198.51.100.5, 203.0.113.9"):
                    return docker("exec", names[peer], "wget", "-S", "-O", "-", "--header", "Host: " + host,
                                  "--header", "X-Forwarded-Proto: " + proto, "--header", "X-Forwarded-For: " + xff,
                                  "--header", "Forwarded: for=spoof;proto=http", "http://gateway:8080" + route)

                response = request()
                self.assertEqual(response.returncode, 0, response.stderr)
                self.assertEqual(response.stdout, HOST + "|203.0.113.9|https|443|")
                for proto in ["http", "HTTPS", "https,http", ""]:
                    self.assertIn("403", request(proto=proto).stderr)
                proxy_ip = docker("inspect", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}", names["proxy"], check=True).stdout.strip()
                self.assertIn("403", request(peer="backend", xff=proxy_ip).stderr)
                self.assertNotEqual(request(host="unknown.example.test").returncode, 0)
                self.assertIn("403", request(host=HOST + ":8080").stderr)
                for route in ["/demonstracao", "/actuator/health", "/readiness", "/missing.js"]:
                    self.assertIn("404", request(route=route).stderr)
                page = request(route="/acesso")
                self.assertIn("Synthetic gateway smoke", page.stdout)
                self.assertIn(f'content="https://{HOST}/og-image.png"', page.stdout)
                self.assertNotIn("__SAGER_ORIGIN__", page.stdout)
                manifest = request(route="/manifest.webmanifest")
                self.assertEqual(manifest.stdout, '{"name":"SAGER"}')
                for header in ["Content-Type: application/manifest+json", "Strict-Transport-Security", "Content-Security-Policy",
                               "Cache-Control: no-store"]:
                    self.assertIn(header, manifest.stderr)
                hashed = request(route="/main-WJFN5VBD.js")
                self.assertEqual(hashed.returncode, 0, hashed.stderr)
                for header in ["Cache-Control: public, max-age=31536000, immutable", "Strict-Transport-Security",
                               "Content-Security-Policy", "X-Content-Type-Options: nosniff", "Permissions-Policy"]:
                    self.assertIn(header, hashed.stderr)
                self.assertNotIn("no-store", hashed.stderr)
                # BusyBox wget hides the headers of an error response; curl shows them.
                missing = docker("exec", names["proxy"], "curl", "-sS", "-o", "/dev/null", "-D", "-", "-H", "Host: " + HOST,
                                 "-H", "X-Forwarded-Proto: https", "-H", "X-Forwarded-For: 198.51.100.5",
                                 "http://gateway:8080/chunk-AAAAAAAA.js")
                self.assertIn("HTTP/1.1 404", missing.stdout, missing.stderr)
                self.assertIn("Cache-Control: no-store", missing.stdout)
                self.assertIn("Content-Security-Policy", missing.stdout)
                self.assertNotIn("immutable", missing.stdout)
                self.assertIn("Strict-Transport-Security", response.stderr)
                self.assertIn("Content-Security-Policy", response.stderr)
                self.assertNotEqual(docker("exec", names["proxy"], "wget", "-q", "-O", "-", "http://gateway:8081/readiness").returncode, 0)
            finally:
                for name in reversed(created):
                    docker("rm", "-f", name)
                docker("network", "rm", network)


if __name__ == "__main__":
    unittest.main()
