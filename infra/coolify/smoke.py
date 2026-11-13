#!/usr/bin/env python3
"""Exercise the Coolify manifest using only a fresh, disposable Docker project.

Python 3.10+, Docker Compose v2 and OpenSSL are required. Credentials, CA keys,
rendered configuration and subprocess logs are created outside every Git checkout.
"""

import argparse
import hashlib
import hmac
import http.client
from http.cookies import SimpleCookie
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import queue
import re
import secrets
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlencode, urlsplit


ROOT = Path(__file__).resolve().parents[2]
HOST = 'sager.example.test'
TRAEFIK_IMAGE = (
    'traefik:v3.6@sha256:'
    '31267173a15b4944e797a76ffd9c419707c8d8b32fe5b610f80cd0cfa05f372d'
)
IMAGE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._/:@-]*')
RUNTIME_CHECK = """
SELECT current_user = 'sager_runtime'
  AND NOT (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
           FROM pg_roles WHERE rolname = current_user)
  AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
  AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
  AND NOT has_table_privilege(current_user, 'public.flyway_schema_history', 'INSERT')
  AND NOT has_table_privilege(current_user, 'public.flyway_schema_history', 'UPDATE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'UPDATE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'DELETE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'TRUNCATE')
  AND has_table_privilege(current_user, 'public.sager_audit_event', 'SELECT')
  AND has_table_privilege(current_user, 'public.sager_audit_event', 'INSERT')
  AND has_table_privilege(current_user, 'public.sager_login_rate_bucket', 'UPDATE');
"""


class SmokeError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SmokeError(message)


def stage(message):
    print(f'Coolify smoke: {message}', flush=True)


class LocalHTTPSConnection(http.client.HTTPSConnection):
    """Connect to loopback while preserving TLS SNI and DNS hostname verification."""

    def connect(self):
        raw = socket.create_connection(('127.0.0.1', self.port), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise


class ProductionIndex(HTMLParser):
    def __init__(self):
        super().__init__()
        self.markers = []
        self.styles = []
        self.scripts = []
        self.inline_scripts = 0
        self.print_styles = 0
        self.noscript = 0

    def handle_starttag(self, tag, attributes):
        values = dict(attributes)
        if tag == 'noscript':
            self.noscript += 1
        if self.noscript:
            return
        if tag == 'meta' and values.get('name') == 'sager-environment':
            self.markers.append(values.get('content'))
        if tag == 'link' and 'stylesheet' in values.get('rel', '').lower().split():
            media = values.get('media', '').strip().lower()
            if media == 'print':
                self.print_styles += 1
            elif media in ('', 'all', 'screen') and 'disabled' not in values:
                self.styles.append(values.get('href', ''))
        if tag == 'script':
            if values.get('src'):
                self.scripts.append(values['src'])
            else:
                kind = values.get('type', '').split(';', 1)[0].lower().strip()
                if kind in ('', 'module', 'importmap', 'speculationrules') or re.fullmatch(
                    r'(?:application|text)/(?:x-)?(?:java|ecma)script', kind
                ):
                    self.inline_scripts += 1

    def handle_endtag(self, tag):
        if tag == 'noscript' and self.noscript:
            self.noscript -= 1


class Smoke:
    def __init__(self, args):
        self.args = args
        self.project = 'sager-coolify-smoke-' + secrets.token_hex(12)
        self.temporary = None
        self.started = False
        self.log_number = 0
        self.cookies = {}
        self.openssl = shutil.which('openssl')
        if not self.openssl and os.name == 'nt':
            candidate = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git/usr/bin/openssl.exe'
            if candidate.is_file():
                self.openssl = str(candidate)
        require(self.openssl, 'OpenSSL is required.')
        require(shutil.which('docker'), 'Docker is required.')
        self.env = os.environ.copy()
        self.env['MSYS_NO_PATHCONV'] = '1'
        self.images = {
            'SAGER_BACKEND_IMAGE': args.backend_image or f'sager-backend:{self.project}',
            'SAGER_GATEWAY_IMAGE': args.gateway_image or f'sager-gateway:{self.project}',
            'SAGER_INITIALIZER_IMAGE': args.initializer_image or f'sager-initializer:{self.project}',
        }

    def run(self, arguments, label, *, data=None, timeout=300, check=True):
        self.log_number += 1
        result = subprocess.run(
            [str(value) for value in arguments], input=data, capture_output=True,
            env=self.env, timeout=timeout, check=False,
        )
        if self.temporary:
            log = self.temporary / f'{self.log_number:03d}-{label}.log'
            log.write_bytes(result.stdout + b'\n' + result.stderr)
            log.chmod(0o600)
        if check:
            require(result.returncode == 0, f'{label} failed (exit {result.returncode}).')
        return result

    def compose(self, *arguments):
        return ['docker', 'compose', '--project-name', self.project,
                '--file', self.temporary / 'compose.json', *arguments]

    def prepare(self):
        self.run(['docker', 'compose', 'version'], 'compose-version')
        self.run(['docker', 'info', '--format', '{{json .ServerVersion}}'], 'docker-info')
        for resource, command in (
            ('containers', ['docker', 'ps', '-aq']),
            ('volumes', ['docker', 'volume', 'ls', '-q']),
            ('networks', ['docker', 'network', 'ls', '-q']),
        ):
            result = self.run(command + ['--filter', f'label=com.docker.compose.project={self.project}'],
                              f'collision-{resource}')
            require(not result.stdout.strip(), 'The generated Docker project is already in use.')
        self.temporary = Path(tempfile.mkdtemp(prefix='sager-coolify-smoke.')).resolve()
        require(not self.temporary.is_relative_to(ROOT), 'Temporary secrets must stay outside the repository.')
        require(not any((parent / '.git').exists() for parent in (self.temporary, *self.temporary.parents)),
                'Temporary secrets must stay outside every Git checkout.')
        self.temporary.chmod(0o700)
        (self.temporary / '.sager-smoke-owned').write_text(self.project, encoding='ascii')
        for folder in ('secrets', 'ca', 'tls'):
            (self.temporary / folder).mkdir(mode=0o700)
        self.secret_values = {}
        for name in ('db_owner_password', 'db_runtime_password', 'login_rate_secret',
                     'waha_api_key', 'waha_webhook_hmac'):
            value = secrets.token_hex(32)
            require(value not in self.secret_values.values(), 'Synthetic secrets must differ.')
            self.secret_values[name] = value
            file = self.temporary / 'secrets' / name
            file.write_text(value, encoding='ascii')
            file.chmod(0o444)
        self.env.update(self.images)
        self.env.update({
            'SAGER_STACK_NAME': self.project,
            'SAGER_PUBLIC_HOST': HOST,
            'SAGER_COOLIFY_APPLICATION_ID': self.project,
            'SAGER_SECRETS_DIR': str(self.temporary / 'secrets'),
        })
        self.certificates()
        source = self.run(
            ['docker', 'compose', '--project-name', self.project, '--file', ROOT / 'compose.coolify.yml',
             '--profile', 'maintenance', 'config', '--format', 'json'], 'render-compose',
        )
        config = json.loads(source.stdout)
        require(config.get('name') == self.project, 'The rendered manifest has an unexpected project.')
        required = {'database', 'migrate', 'initialize-runtime', 'backend', 'gateway', 'archive-files'}
        require(required <= config.get('services', {}).keys(), 'The maintenance services must be rendered.')
        require(config['networks']['coolify'].get('external') is True
                and config['networks']['coolify'].get('name') == 'coolify',
                'The source must declare the expected external Coolify network.')
        # This replacement exists only in the disposable smoke manifest.
        config['networks']['coolify'] = {'name': self.project + '_coolify'}
        for section in ('volumes', 'networks'):
            for key, resource in config.get(section, {}).items():
                require(not resource.get('external') and resource.get('name') == f'{self.project}_{key}',
                        'Smoke refuses shared volumes or networks.')
        for service in config['services'].values():
            require(not service.get('container_name') and not service.get('ports'),
                    'Application containers must have generated names and no published ports.')
            service['labels'] = {'sager.smoke.owner': self.project}
        self.proxy_config()
        config['services']['smoke-proxy'] = {
            'image': TRAEFIK_IMAGE,
            'command': ['--entrypoints.http.address=:8080', '--entrypoints.https.address=:8443',
                        '--entrypoints.http.forwardedheaders.insecure=false',
                        '--entrypoints.https.forwardedheaders.insecure=false',
                        '--providers.file.filename=/etc/traefik/dynamic.yml', '--log.level=ERROR'],
            'networks': {'coolify': {'aliases': ['coolify-proxy']}},
            'ports': [{'target': port, 'host_ip': '127.0.0.1', 'protocol': 'tcp'} for port in (8080, 8443)],
            'volumes': [
                {'type': 'bind', 'source': str(self.temporary / 'dynamic.yml'),
                 'target': '/etc/traefik/dynamic.yml', 'read_only': True},
                {'type': 'bind', 'source': str(self.temporary / 'tls'),
                 'target': '/etc/traefik/tls', 'read_only': True},
            ],
            'user': '65532:65532', 'read_only': True, 'cap_drop': ['ALL'],
            'security_opt': ['no-new-privileges:true'], 'mem_limit': '128m', 'cpus': 0.25,
            'labels': {'sager.smoke.owner': self.project},
            'logging': {'driver': 'json-file', 'options': {'max-size': '2m', 'max-file': '2'}},
        }
        (self.temporary / 'compose.json').write_text(json.dumps(config), encoding='utf-8')
        self.run(self.compose('config', '--quiet'), 'validate-compose')
        # Refuse collisions with explicit resource names even if they have no Compose label.
        for section, kind in (('networks', 'network'), ('volumes', 'volume')):
            for resource in config[section].values():
                result = self.run(['docker', kind, 'inspect', resource['name']], f'check-{kind}', check=False)
                require(result.returncode != 0, 'An explicit smoke resource name already exists.')
        self.config = config

    def certificates(self):
        stage('creating private synthetic secrets and a trusted test CA')
        ca, tls = self.temporary / 'ca', self.temporary / 'tls'
        extensions = ca / 'server.ext'
        extensions.write_text(
            f'subjectAltName=DNS:{HOST}\nbasicConstraints=critical,CA:FALSE\n'
            'keyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n',
            encoding='ascii',
        )
        self.run([self.openssl, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
                  '-keyout', ca / 'ca-key.pem', '-out', ca / 'ca.pem', '-subj', '/CN=SAGER synthetic smoke CA',
                  '-addext', 'basicConstraints=critical,CA:TRUE',
                  '-addext', 'keyUsage=critical,keyCertSign,cRLSign'], 'create-ca')
        self.run([self.openssl, 'req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256',
                  '-keyout', tls / 'key.pem', '-out', ca / 'server.csr', '-subj', f'/CN={HOST}'], 'create-csr')
        self.run([self.openssl, 'x509', '-req', '-in', ca / 'server.csr', '-CA', ca / 'ca.pem',
                  '-CAkey', ca / 'ca-key.pem', '-CAcreateserial', '-out', tls / 'server.pem',
                  '-days', '1', '-sha256', '-extfile', extensions], 'sign-certificate')
        # The nonroot proxy gets only the leaf certificate/key, never the CA signing key.
        tls.chmod(0o755)
        for file in tls.iterdir():
            file.chmod(0o444)
        self.tls_context = ssl.create_default_context(cafile=str(ca / 'ca.pem'))
        require(self.tls_context.check_hostname and self.tls_context.verify_mode == ssl.CERT_REQUIRED,
                'TLS must verify the CA and public hostname.')

    def proxy_config(self):
        dynamic = {
            'http': {
                'routers': {
                    'sager-http': {'rule': f'Host(`{HOST}`)', 'entryPoints': ['http'],
                                   'middlewares': ['redirect'], 'service': 'gateway'},
                    'sager-https': {'rule': f'Host(`{HOST}`)', 'entryPoints': ['https'],
                                    'tls': {}, 'service': 'gateway'},
                },
                'middlewares': {'redirect': {'redirectScheme': {'scheme': 'https', 'permanent': True}}},
                'services': {'gateway': {'loadBalancer': {'servers': [{'url': 'http://gateway:8080'}]}}},
            },
            'tls': {'certificates': [{'certFile': '/etc/traefik/tls/server.pem',
                                      'keyFile': '/etc/traefik/tls/key.pem'}]},
        }
        # JSON flow syntax is valid YAML; Traefik selects its parser by extension.
        file = self.temporary / 'dynamic.yml'
        file.write_text(json.dumps(dynamic), encoding='utf-8')
        file.chmod(0o444)

    def images_ready(self):
        if self.args.build:
            stage('building backend, Coolify gateway and packaged initializer')
            self.run(self.compose('--profile', 'maintenance', 'build', 'backend', 'gateway',
                                  'initialize-runtime'), 'build-images', timeout=1200)
        for image in self.images.values():
            self.run(['docker', 'image', 'inspect', image], 'validate-image')
        result = self.run(['docker', 'image', 'inspect', TRAEFIK_IMAGE], 'validate-proxy-image', check=False)
        if result.returncode:
            stage('pulling the pinned official Traefik image')
            self.run(['docker', 'pull', TRAEFIK_IMAGE], 'pull-proxy', timeout=180)
        inspected = json.loads(self.run(['docker', 'image', 'inspect', TRAEFIK_IMAGE], 'proxy-digest').stdout)
        digest = TRAEFIK_IMAGE.split('@', 1)[1]
        require(any(value.endswith('@' + digest) for value in inspected[0].get('RepoDigests', [])),
                'Traefik must use its pinned official image digest.')

    def maintenance(self, service, label):
        return self.run(self.compose('--profile', 'maintenance', 'run', '--rm', '-T', '--no-deps',
                                     '--pull', 'never', service), label, timeout=180)

    def sql(self, sql, *, runtime=False, check=True):
        if runtime:
            command = self.compose('--profile', 'maintenance', 'run', '--rm', '-T', '--no-deps',
                                   '--pull', 'never', '--entrypoint', 'sh', 'initialize-runtime')
            secret, user = 'db_runtime_password', 'sager_runtime'
        else:
            command = self.compose('exec', '-T', 'database', 'sh')
            secret, user = 'db_owner_password', 'sager_owner'
        script = (f'export PGPASSWORD="$(cat /run/secrets/{secret})"; '
                  'exec psql --no-psqlrc --no-password --host=database '
                  f'--username={user} --dbname=sager --tuples-only --no-align --set=ON_ERROR_STOP=1')
        return self.run(command + ['-eu', '-c', script], 'runtime-query' if runtime else 'owner-query',
                        data=sql.encode('utf-8'), check=check)

    def start(self):
        stage('starting the exclusive database, migration and runtime initialization')
        self.started = True
        self.run(self.compose('up', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '120',
                              'database'), 'database-up', timeout=150)
        self.maintenance('migrate', 'migration')
        self.maintenance('initialize-runtime', 'initialize-runtime')
        latest = max(int(re.match(r'V(\d+)__', file.name)[1])
                     for file in (ROOT / 'backend/src/main/resources/db/migration').glob('V*__*.sql'))
        migrated = self.sql(f"SELECT max(version::int) = {latest} AND bool_and(success) FROM flyway_schema_history;")
        require(migrated.stdout.strip() == b't', f'All migrations through V{latest} must succeed.')
        require(self.sql(RUNTIME_CHECK, runtime=True).stdout.strip() == b't',
                'The runtime role must have only the approved database privileges.')
        denied = self.sql('CREATE TABLE sager_smoke_forbidden (id int);', runtime=True, check=False)
        require(denied.returncode != 0 and b'permission denied for schema public' in denied.stderr,
                'The runtime role must reject schema DDL.')
        self.maintenance('initialize-runtime', 'initialize-runtime-again')
        require(self.sql(RUNTIME_CHECK, runtime=True).stdout.strip() == b't',
                'A repeated initializer must preserve runtime login and privileges.')
        self.create_account()
        stage('starting production backend, private Traefik and the Coolify gateway')
        self.run(self.compose('up', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '240',
                              'backend'), 'backend-up', timeout=270)
        # Docker DNS must expose coolify-proxy before the gateway validates its peer.
        self.run(self.compose('up', '--no-build', '--pull', 'never', '-d', 'smoke-proxy'), 'proxy-up')
        self.run(self.compose('up', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '120',
                              'gateway'), 'gateway-up', timeout=150)
        self.http_port = self.port(8080)
        self.https_port = self.port(8443)
        self.wait_proxy_tls()
        self.isolation()

    def wait_proxy_tls(self):
        # The file provider loads asynchronously. Every attempt retains full TLS validation.
        deadline = time.monotonic() + 15
        while True:
            connection = LocalHTTPSConnection(HOST, self.https_port, context=self.tls_context, timeout=3)
            try:
                connection.connect()
                return
            except OSError:
                require(time.monotonic() < deadline,
                        'The proxy TLS certificate did not pass CA and hostname verification.')
                time.sleep(1)
            finally:
                connection.close()

    def create_account(self):
        stage('creating the synthetic account through the existing CLI in a private PTY')
        self.enrollment = 'SMOKE-OPERATOR-001'
        self.email = 'smoke.operator@example.test'
        self.password = 'Smk!' + secrets.token_hex(20)
        java = ('java -Xmx256m -Djava.io.tmpdir=/tmp -jar /app/app.jar '
                f'--sager-account=create --matricula={self.enrollment} --email={self.email} '
                '--name="Synthetic smoke operator" --profile=gestor')
        command = self.compose('run', '--rm', '-T', '--no-deps', '--pull', 'never',
                               '--entrypoint', 'script', 'backend', '--echo=never', '--flush',
                               '--return', '--command', java, '/dev/null')
        process = subprocess.Popen([str(part) for part in command], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=self.env)
        events = queue.Queue()
        output = bytearray()

        def read_output():
            while True:
                value = process.stdout.read(1)
                events.put(value)
                if not value:
                    break

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        deadline = time.monotonic() + 180
        try:
            for prompt in (b'Senha local: ', b'Confirme a senha: '):
                seen = bytearray()
                while prompt not in seen:
                    remaining = deadline - time.monotonic()
                    require(remaining > 0, 'The private account CLI prompt timed out.')
                    try:
                        value = events.get(timeout=min(remaining, 1))
                    except queue.Empty:
                        continue
                    require(value, 'The private account CLI exited before requesting its password.')
                    seen.extend(value)
                    output.extend(value)
                process.stdin.write((self.password + '\n').encode('ascii'))
                process.stdin.flush()
            process.stdin.close()
            while True:
                remaining = deadline - time.monotonic()
                require(remaining > 0, 'The private account CLI completion timed out.')
                try:
                    value = events.get(timeout=min(remaining, 1))
                except queue.Empty:
                    continue
                if not value:
                    break
                output.extend(value)
            require(process.wait(timeout=5) == 0 and b'Conta local criada.' in output,
                    'The synthetic account CLI did not succeed.')
            require(self.password.encode('ascii') not in output, 'The account PTY must not echo passwords.')
        finally:
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
            reader.join(timeout=2)
            (self.temporary / 'account-cli.log').write_bytes(output)

    def port(self, target):
        output = self.run(self.compose('port', 'smoke-proxy', str(target)), 'proxy-port').stdout.decode().strip()
        match = re.fullmatch(r'127\.0\.0\.1:([0-9]+)', output)
        require(match and 0 < int(match[1]) < 65536, 'Only the proxy may publish random loopback ports.')
        return int(match[1])

    def container(self, service):
        value = self.run(self.compose('ps', '-q', service), 'container-id').stdout.decode().strip()
        require(re.fullmatch(r'[0-9a-f]{12,64}', value), f'The private {service} container is unavailable.')
        return value

    def isolation(self):
        expected = {resource['name'] for resource in self.config['networks'].values()}
        for service in ('database', 'backend', 'gateway', 'smoke-proxy'):
            details = json.loads(self.run(['docker', 'inspect', self.container(service)], 'inspect-container').stdout)[0]
            require(details['Config']['Labels'].get('com.docker.compose.project') == self.project,
                    'A container must belong exclusively to the smoke project.')
            require(set(details['NetworkSettings']['Networks']) <= expected,
                    'A container must not join shared Docker networks.')
            bindings = details['HostConfig'].get('PortBindings') or {}
            require(service == 'smoke-proxy' or not bindings, 'Application ports must not be published.')
            if service == 'smoke-proxy':
                require(bindings and all(binding['HostIp'] == '127.0.0.1'
                                         for values in bindings.values() for binding in values),
                        'The proxy must bind only loopback.')
            for mount in details.get('Mounts', []):
                if mount['Type'] == 'volume':
                    require(mount['Name'].startswith(self.project + '_'), 'A volume must belong to this project.')
        for kind, section in (('network', 'networks'), ('volume', 'volumes')):
            for resource in self.config[section].values():
                details = json.loads(self.run(['docker', kind, 'inspect', resource['name']],
                                             'inspect-' + kind).stdout)[0]
                require(details.get('Labels', {}).get('com.docker.compose.project') == self.project,
                        'Networks and volumes must carry the exclusive project label.')

    def request(self, path, expected, *, method='GET', headers=None, body=None, secure=True):
        outgoing = {'Host': HOST, **(headers or {})}
        if self.cookies:
            outgoing['Cookie'] = '; '.join(f'{key}={value}' for key, value in self.cookies.items())
        connection = (LocalHTTPSConnection(HOST, self.https_port, context=self.tls_context, timeout=20)
                      if secure else http.client.HTTPConnection('127.0.0.1', self.http_port, timeout=20))
        try:
            connection.request(method, path, body=body, headers=outgoing)
            response = connection.getresponse()
            content, received, status = response.read(), response.getheaders(), response.status
        finally:
            connection.close()
        require(status == expected, f'{method} {path} returned {status}; expected {expected}.')
        values = {}
        for key, value in received:
            values.setdefault(key.lower(), []).append(value)
            if key.lower() == 'set-cookie':
                cookie = SimpleCookie()
                cookie.load(value)
                for name, morsel in cookie.items():
                    if morsel['max-age'] == '0':
                        self.cookies.pop(name, None)
                    else:
                        self.cookies[name] = morsel.value
        self.log_number += 1
        (self.temporary / f'{self.log_number:03d}-http-response.json').write_text(
            json.dumps({'status': status, 'headers': received, 'body': content.decode('utf-8', 'replace')}),
            encoding='utf-8',
        )
        return content, values

    def refused_by_length(self, path, length):
        def refusals():
            logs = self.run(self.compose('logs', '--no-log-prefix', 'gateway'), 'gateway-log').stdout
            return logs.count(b' 413 ')

        before = refusals()
        try:
            self.request(path, 413, method='POST', body=bytes(length))
        except (OSError, http.client.HTTPException):
            pass  # The proxy may close while the body is still being sent; the gateway log decides.
        require(refusals() == before + 1, f'The gateway must refuse POST {path} by length.')

    def csrf(self):
        content, headers = self.request('/api/v1/auth/csrf', 200)
        token = json.loads(content)
        require(str(token.get('headerName', '')).lower() == 'x-csrf-token'
                and isinstance(token.get('token'), str) and len(token['token']) >= 16,
                'CSRF must expose its production token contract.')
        return token, headers

    def login(self, token, password, expected, headers=None):
        return self.request('/api/v1/auth/login', expected, method='POST',
                            headers={'Content-Type': 'application/x-www-form-urlencoded',
                                     token['headerName']: token['token'], **(headers or {})},
                            body=urlencode({'matricula': self.enrollment, 'password': password}))

    def verify(self):
        stage('verifying trusted HTTPS, production assets, CSRF and public boundaries')
        content, headers = self.request('/acesso', 200)
        require('text/html' in headers.get('content-type', [''])[0], 'The access page must serve HTML.')
        index = ProductionIndex()
        index.feed(content.decode('utf-8'))
        require(index.markers == ['production'] and index.styles and index.scripts
                and not index.inline_scripts and not index.print_styles,
                'The production index must include active external assets and the production marker.')
        page = content.decode('utf-8')
        require(f'content="https://{HOST}/og-image.png"' in page and '__SAGER_ORIGIN__' not in page,
                'The link preview must use the real origin, without a marker.')
        for key, value in (
            ('strict-transport-security', 'max-age=31536000'),
            ('x-content-type-options', 'nosniff'), ('referrer-policy', 'no-referrer'),
            ('cache-control', 'no-store'), ('permissions-policy', 'microphone=(self)'),
        ):
            require(headers.get(key) and all(value in item for item in headers[key]),
                    f'The gateway must serve its {key} security header.')
        csp = headers.get('content-security-policy', [''])[0]
        require(all(value in csp for value in ("default-src 'self'", "frame-ancestors 'none'",
                                               "object-src 'none'", "base-uri 'self'", "form-action 'self'",
                                               "media-src 'self' blob:"))
                and 'clicksign' not in csp, 'The gateway must serve its approved CSP.')
        for path, expected_type in ((index.styles[0], 'text/css'), (index.scripts[0], 'javascript')):
            parsed = urlsplit(path)
            require(not parsed.scheme and not parsed.netloc, 'Production assets must use the same origin.')
            asset, asset_headers = self.request('/' + parsed.path.lstrip('/'), 200)
            require(asset and expected_type in asset_headers.get('content-type', [''])[0],
                    'Production JS and CSS must serve their actual content types.')
            require(asset_headers.get('cache-control') == ['public, max-age=31536000, immutable']
                    and asset_headers.get('strict-transport-security')
                    and asset_headers.get('content-security-policy'),
                    'Hashed JS and CSS must be immutable and keep the security headers.')
        _, missing = self.request('/chunk-AAAAAAAA.js', 404)
        require(missing.get('cache-control') == ['no-store'], 'A missing hashed file must not be cached.')
        for path, expected_type in (
            ('/favicon.svg', 'image/svg+xml'), ('/favicon.ico', 'icon'),
            ('/apple-touch-icon.png', 'image/png'), ('/icon-192.png', 'image/png'),
            ('/icon-512.png', 'image/png'), ('/og-image.png', 'image/png'),
            ('/manifest.webmanifest', 'application/manifest+json'),
        ):
            asset, asset_headers = self.request(path, 200)
            require(asset and expected_type in asset_headers.get('content-type', [''])[0]
                    and asset_headers.get('content-security-policy')
                    and asset_headers.get('strict-transport-security')
                    and asset_headers.get('cache-control') == ['no-store'],
                    f'{path} must serve its type, the security headers and no-store.')
        self.request('/demonstracao', 404)
        self.request('/actuator/health/readiness', 404)
        # Fetch CSRF before any unauthenticated protected request can create a session.
        token, cookie_headers = self.csrf()
        require(cookie_headers.get('cache-control')
                and all('no-store' in value for value in cookie_headers['cache-control']),
                'API responses must never be cached.')
        session = [value for value in cookie_headers.get('set-cookie', [])
                   if value.startswith(('SESSION=', 'JSESSIONID='))]
        require(session and all({'secure', 'httponly', 'samesite=lax'} <=
                                {part.strip().lower() for part in value.split(';')[1:]} for value in session),
                'Production session cookies must be Secure, HttpOnly and SameSite=Lax.')
        self.request('/api/v1/auth/me', 401)
        failure, _ = self.request('/api/v1/auth/login', 403, method='POST', body='')
        require(json.loads(failure).get('code') == 'csrf_invalid', 'Login without CSRF must be rejected.')
        # The uploads reach the backend, which refuses them without CSRF; the webhook keeps 1 MiB.
        upload = '/api/v1/conversas/00000000-0000-0000-0000-000000000000/mensagens'
        self.request(upload, 403, method='POST', body=bytes(2 * 1024 * 1024))
        self.refused_by_length(upload, 12 * 1024 * 1024)
        self.request('/api/v1/saidas-longas/00000000-0000-0000-0000-000000000000/autorizacao/arquivos',
                     403, method='POST', body=bytes(2 * 1024 * 1024))
        self.refused_by_length('/api/v1/integracoes/whatsapp/webhook', 2 * 1024 * 1024)
        _, redirected = self.request('/acesso', 301, secure=False)
        require(redirected.get('location') == [f'https://{HOST}/acesso'], 'HTTP must redirect permanently to HTTPS.')
        self.login(token, self.password, 204)
        me, _ = self.request('/api/v1/auth/me', 200)
        require(json.loads(me).get('matricula') == self.enrollment and json.loads(me).get('perfis') == ['gestor'],
                'The synthetic CLI account must authenticate through production HTTPS.')
        stage('verifying forwarding-header spoofing and direct gateway rejection')
        token, _ = self.csrf()
        self.request('/api/v1/auth/logout', 204, method='POST',
                     headers={token['headerName']: token['token']})
        token, _ = self.csrf()
        forged = '203.0.113.77'
        self.login(token, 'Invalid!' + secrets.token_hex(20), 401,
                   {'X-Forwarded-For': forged, 'Forwarded': f'for={forged};proto=https',
                    'X-Forwarded-Proto': 'http'})
        digest = hmac.new(self.secret_values['login_rate_secret'].encode(),
                          ('IP:' + forged).encode(), hashlib.sha256).hexdigest()
        require(self.sql(f"SELECT count(*) = 0 FROM sager_login_rate_bucket WHERE key_hash = '{digest}';").stdout.strip() == b't',
                'Traefik must discard untrusted client forwarding headers.')
        require(self.sql('SELECT count(*) >= 1 FROM sager_login_rate_bucket;').stdout.strip() == b't',
                'The forwarded-header test must exercise the production login limiter.')
        direct = self.run(self.compose('exec', '-T', 'gateway', 'wget', '-S', '-O', '/dev/null',
                                      '--header', f'Host: {HOST}', '--header', 'X-Forwarded-Proto: https',
                                      '--header', f'X-Forwarded-For: {forged}',
                                      'http://127.0.0.1:8080/api/v1/auth/csrf'), 'direct-forged-gateway', check=False)
        require(direct.returncode != 0 and b'403 Forbidden' in direct.stderr,
                'The gateway must reject a direct caller even with forged forwarding headers.')
        token, _ = self.csrf()
        self.login(token, self.password, 204)
        self.persistence()

    def persistence(self):
        stage('verifying database, sessions and private files after container recreation')
        token = secrets.token_hex(24)
        marker = f'smoke-{self.project}.txt'
        command = self.compose('exec', '-T', 'backend', 'sh', '-eu', '-c',
                               f'cat > /data/documents/{marker}; cp /data/documents/{marker} /data/reports/{marker}')
        self.run(command, 'write-persistence-marker', data=token.encode('ascii'))
        names = {name: self.container(name) for name in ('database', 'backend', 'gateway')}
        self.run(self.compose('stop', 'gateway', 'backend'), 'stop-application')
        self.run(self.compose('up', '--no-build', '--pull', 'never', '--no-deps', '--force-recreate',
                              '--wait', '--wait-timeout', '120', 'database'), 'recreate-database', timeout=150)
        self.maintenance('initialize-runtime', 'initialize-after-recreation')
        self.run(self.compose('up', '--no-build', '--pull', 'never', '--force-recreate', '--wait',
                              '--wait-timeout', '240', 'backend', 'gateway'), 'recreate-application', timeout=270)
        for service, previous in names.items():
            require(self.container(service) != previous, 'Persistence must be checked after real container recreation.')
        me, _ = self.request('/api/v1/auth/me', 200)
        require(json.loads(me).get('matricula') == self.enrollment and json.loads(me).get('perfis') == ['gestor'],
                'The database session and account must survive recreation.')
        for folder in ('documents', 'reports'):
            result = self.run(self.compose('exec', '-T', 'backend', 'cat', f'/data/{folder}/{marker}'),
                              'read-persistence-marker')
            require(result.stdout == token.encode('ascii'), 'Private file volumes must survive recreation.')
        require(self.sql(RUNTIME_CHECK, runtime=True).stdout.strip() == b't',
                'Runtime privileges must remain restricted after recreation.')
        self.isolation()

    def cleanup(self):
        if self.started:
            stage('removing only the exclusive smoke project and its volumes')
            self.run(self.compose('down', '--volumes', '--remove-orphans', '--timeout', '10'),
                     'cleanup-project', timeout=120)
            for command in (['docker', 'ps', '-aq'], ['docker', 'volume', 'ls', '-q'],
                            ['docker', 'network', 'ls', '-q']):
                result = self.run(command + ['--filter', f'label=com.docker.compose.project={self.project}'],
                                  'cleanup-check')
                require(not result.stdout.strip(), 'A disposable Docker resource was not removed.')
        if self.temporary:
            temporary = self.temporary.resolve()
            marker = temporary / '.sager-smoke-owned'
            require(temporary.parent == Path(tempfile.gettempdir()).resolve()
                    and re.fullmatch(r'sager-coolify-smoke\.[A-Za-z0-9_-]+', temporary.name)
                    and not self.temporary.is_symlink() and marker.is_file()
                    and marker.read_text(encoding='ascii') == self.project,
                    'Temporary-directory cleanup ownership could not be verified.')
            # Windows read-only flags correspond to chmod(0444); clear only owned files.
            for file in temporary.rglob('*'):
                if file.is_file() and not file.is_symlink():
                    file.chmod(0o600)
            shutil.rmtree(temporary)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', action='store_true', help='Build all three application images from this checkout.')
    for name in ('backend', 'gateway', 'initializer'):
        parser.add_argument(f'--{name}-image', help=f'Use an existing local {name} image.')
    args = parser.parse_args(argv)
    if sys.version_info < (3, 10):
        parser.error('Python 3.10 or newer is required.')
    for name in ('backend_image', 'gateway_image', 'initializer_image'):
        value = getattr(args, name)
        if value and not IMAGE.fullmatch(value):
            parser.error('Image references may contain only Docker reference characters.')
        if not args.build and not value:
            parser.error('Provide all three existing images or use --build.')
    smoke = None
    result = 0
    started = time.monotonic()

    def interrupted(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupted)
    try:
        smoke = Smoke(args)
        smoke.prepare()
        smoke.images_ready()
        smoke.start()
        smoke.verify()
    except (SmokeError, OSError, ValueError, subprocess.TimeoutExpired, http.client.HTTPException) as error:
        # Never print subprocess logs, configuration, HTTP bodies, tokens or credentials.
        if isinstance(error, SmokeError):
            print(f'Coolify smoke failed: {error}', file=sys.stderr)
        else:
            print(f'Coolify smoke failed: {type(error).__name__}.', file=sys.stderr)
        result = 1
    except KeyboardInterrupt:
        print('Coolify smoke interrupted.', file=sys.stderr)
        result = 130
    finally:
        if smoke:
            try:
                smoke.cleanup()
            except (SmokeError, OSError, subprocess.TimeoutExpired):
                print('Coolify smoke cleanup failed; only its exclusive project needs operator inspection.', file=sys.stderr)
                result = 1
    if result == 0:
        stage(f'passed in {time.monotonic() - started:.1f}s; smoke containers, networks and volumes were removed')
    return result


if __name__ == '__main__':
    sys.exit(main())
