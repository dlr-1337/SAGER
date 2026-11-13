#!/usr/bin/env bash
# Synthetic production smoke. Run on the Docker host; it creates and removes its own stack.
# Existing images: bash infra/production/smoke.sh --backend-image sager-backend:f7-final \
#                  --gateway-image sager-gateway:f7-final
# CI builds the same checkout: bash infra/production/smoke.sh --build
set +x
set -Eeuo pipefail
umask 077

fail() { printf 'Infrastructure smoke failed: %s\n' "$1" >&2; exit 1; }
stage() { printf 'Infrastructure smoke: %s\n' "$1"; }
usage() {
  printf '%s\n' 'Usage: bash infra/production/smoke.sh [--build] [--backend-image IMAGE --gateway-image IMAGE]'
  printf '%s\n' 'Creates only a fresh synthetic stack. Credentials, TLS keys and responses stay outside Git.'
}

build_images=0
backend_image=''
gateway_image=''
while (($#)); do
  case "$1" in
    --build) build_images=1; shift ;;
    --backend-image|--gateway-image)
      (($# >= 2)) || fail 'An image argument is missing.'
      [[ "$2" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]] || fail 'Invalid image reference.'
      if [[ "$1" == --backend-image ]]; then backend_image="$2"; else gateway_image="$2"; fi
      shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; fail 'Unknown argument.' ;;
  esac
done
if (( ! build_images )) && [[ -z "$backend_image" || -z "$gateway_image" ]]; then
  usage >&2
  fail 'Provide both existing images or use --build.'
fi

for command in docker openssl curl mktemp; do
  command -v "$command" >/dev/null || fail "Required command is unavailable: $command."
done
curl_tls_options=()
if [[ "$(curl --version)" == *Schannel* ]]; then
  # This private one-day CA has no CRL service; retain CA and hostname verification.
  curl_tls_options=(--ssl-revoke-best-effort)
fi
if command -v python >/dev/null && python -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
  python_command=python
elif command -v python3 >/dev/null && python3 -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
  python_command=python3
else
  fail 'Python 3.10 or newer is required.'
fi

# Git Bash paths must reach the native Docker CLI unchanged; Linux needs no conversion.
native_path() {
  if command -v cygpath >/dev/null; then cygpath -am "$1"; else printf '%s\n' "$1"; fi
}
root_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
source_compose="$(native_path "$root_dir/infra/production/compose.yml")"
docker compose version >/dev/null || fail 'Docker Compose v2 is required.'
docker info >/dev/null 2>&1 || fail 'The Docker daemon is unavailable.'
stack="sager-smoke-$($python_command -c 'import secrets; print(secrets.token_hex(12))')"
backend_image="${backend_image:-sager-backend:$stack}"
gateway_image="${gateway_image:-sager-gateway:$stack}"

# Refuse a collision before creating anything; cleanup must never adopt another project.
for resource in container volume network; do
  case "$resource" in
    container) existing="$(docker ps -aq --filter "label=com.docker.compose.project=$stack")" ;;
    volume) existing="$(docker volume ls -q --filter "label=com.docker.compose.project=$stack")" ;;
    network) existing="$(docker network ls -q --filter "label=com.docker.compose.project=$stack")" ;;
  esac
  [[ -z "$existing" ]] || fail 'The generated project name is already in use.'
done

temp_base="$(cd -- "${TMPDIR:-/tmp}" && pwd -P)"
temp_dir="$(mktemp -d "$temp_base/sager-smoke.XXXXXXXX")"
temp_dir="$(cd -- "$temp_dir" && pwd -P)"
manifest="$(native_path "$temp_dir/compose.json")"
stack_started=0
printf '%s\n' "$stack" > "$temp_dir/.sager-smoke-owned"
compose() { MSYS_NO_PATHCONV=1 docker compose --project-name "$stack" --file "$manifest" "$@"; }
cleanup() {
  local result=$?
  trap - EXIT INT TERM
  set +e
  if (( stack_started )); then
    if ! compose down --volumes --remove-orphans --timeout 10 >/dev/null 2>&1; then
      printf 'Infrastructure smoke: cleanup failed for exclusive stack %s.\n' "$stack" >&2
      result=1
    fi
  fi
  # The exact mktemp directory and ownership marker are required before recursive deletion.
  if [[ "$temp_dir" == "$temp_base"/sager-smoke.* && ! -L "$temp_dir" \
      && "${temp_dir##*/}" =~ ^sager-smoke\.[A-Za-z0-9]+$ \
      && -f "$temp_dir/.sager-smoke-owned" ]]; then
    rm -rf -- "$temp_dir" || result=1
  else
    printf 'Infrastructure smoke: temporary-directory cleanup was refused.\n' >&2
    result=1
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

stage 'preparing private synthetic credentials and a trusted test CA'
mkdir -- "$temp_dir/secrets" "$temp_dir/tls" "$temp_dir/ca"
root_native="$(native_path "$root_dir")"
temp_native="$(native_path "$temp_dir")"
"$python_command" - "$root_native" "$temp_native" <<'PY'
from pathlib import Path
import secrets
import sys

root, temporary = (Path(value).resolve() for value in sys.argv[1:])
if temporary.is_relative_to(root) or any((parent / '.git').exists() for parent in temporary.parents):
    raise SystemExit('Temporary secrets must be outside every Git checkout.')
values = set()
for name in ('db_owner_password', 'db_runtime_password', 'login_rate_secret',
             'waha_api_key', 'waha_webhook_hmac'):
    value = secrets.token_hex(32)
    while value in values:
        value = secrets.token_hex(32)
    values.add(value)
    target = temporary / 'secrets' / name
    target.write_text(value, encoding='ascii')
    # Synthetic only: the host parent is 0700; each nonroot container receives this file alone.
    target.chmod(0o444)
(temporary / 'ca' / 'server.ext').write_text(
    'subjectAltName=DNS:sager.example.test\n'
    'basicConstraints=critical,CA:FALSE\n'
    'keyUsage=critical,digitalSignature,keyEncipherment\n'
    'extendedKeyUsage=serverAuth\n', encoding='ascii')
PY
ca="$(native_path "$temp_dir/ca/ca.pem")"
ca_key="$(native_path "$temp_dir/ca/ca-key.pem")"
key="$(native_path "$temp_dir/tls/privkey.pem")"
csr="$(native_path "$temp_dir/ca/server.csr")"
certificate="$(native_path "$temp_dir/ca/server.pem")"
extensions="$(native_path "$temp_dir/ca/server.ext")"
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 1 \
  -keyout "$ca_key" -out "$ca" -subj '/CN=SAGER synthetic smoke CA' \
  -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  > "$temp_dir/certificate.log" 2>&1
MSYS_NO_PATHCONV=1 openssl req -new -newkey rsa:2048 -nodes -sha256 \
  -keyout "$key" -out "$csr" -subj '/CN=sager.example.test' \
  >> "$temp_dir/certificate.log" 2>&1
MSYS_NO_PATHCONV=1 openssl x509 -req -in "$csr" -CA "$ca" -CAkey "$ca_key" \
  -CAcreateserial -out "$certificate" -days 1 -sha256 -extfile "$extensions" \
  >> "$temp_dir/certificate.log" 2>&1
cat "$temp_dir/ca/server.pem" "$temp_dir/ca/ca.pem" > "$temp_dir/tls/fullchain.pem"
# Only the leaf key is mounted in the gateway; the CA signing key stays in the private host parent.
chmod 755 "$temp_dir/tls"
chmod 444 "$temp_dir/tls/privkey.pem" "$temp_dir/tls/fullchain.pem"

export SAGER_STACK_NAME="$stack" SAGER_PUBLIC_HOST='sager.example.test'
export SAGER_SECRETS_DIR="$(native_path "$temp_dir/secrets")"
export SAGER_TLS_DIR="$(native_path "$temp_dir/tls")"
export SAGER_BACKEND_IMAGE="$backend_image" SAGER_GATEWAY_IMAGE="$gateway_image"
export SAGER_HTTP_PORT=0 SAGER_HTTPS_PORT=0
# Render privately, then normalize only the smoke binding. No config/environment is printed.
MSYS_NO_PATHCONV=1 docker compose --project-name "$stack" --file "$source_compose" --profile maintenance \
  config --format json > "$temp_dir/compose-source.json"
"$python_command" - "$temp_native" "$stack" <<'PY'
import json
from pathlib import Path
import sys

temporary, stack = Path(sys.argv[1]), sys.argv[2]
config = json.loads((temporary / 'compose-source.json').read_text(encoding='utf-8'))
config['name'] = stack
required_services = {'database', 'migrate', 'initialize-runtime', 'backend', 'gateway'}
if not required_services <= config.get('services', {}).keys():
    raise SystemExit('Smoke requires migration and runtime-role services in its rendered manifest.')
for section in ('volumes', 'networks'):
    for resource in config.get(section, {}).values():
        if resource.get('external') or not resource.get('name', '').startswith(stack + '_'):
            raise SystemExit('Smoke refuses shared or external Compose resources.')
if any(service.get('container_name') for service in config['services'].values()):
    raise SystemExit('Smoke refuses fixed container names.')
config['services']['gateway']['ports'] = [
    {'target': 8443, 'host_ip': '127.0.0.1', 'protocol': 'tcp'}]
for name in ('database', 'backend'):
    if config['services'][name].get('ports'):
        raise SystemExit('Database and backend ports must stay private.')
(temporary / 'compose.json').write_text(json.dumps(config), encoding='utf-8')
PY
compose config --quiet

if (( build_images )); then
  stage 'building backend and gateway from this checkout'
  compose build backend gateway
else
  docker image inspect --format '{{.Id}}' "$backend_image" >/dev/null 2>&1 \
    || fail 'The requested backend image is unavailable; build it or use --build.'
  docker image inspect --format '{{.Id}}' "$gateway_image" >/dev/null 2>&1 \
    || fail 'The requested gateway image is unavailable; build it or use --build.'
fi

stage 'starting the isolated database, migration and runtime-role initialization'
stack_started=1
compose up --no-build --wait --wait-timeout 120 database
if ! compose --profile maintenance run --rm -T --no-deps --pull never migrate \
    > "$temp_dir/migration.log" 2>&1; then fail 'The isolated migration did not complete.'; fi
if ! compose --profile maintenance run --rm -T --no-deps --pull never initialize-runtime \
    > "$temp_dir/initialize.log" 2>&1; then fail 'Runtime-role initialization did not complete.'; fi

stage 'checking private database ports and effective runtime privileges'
container="$(compose ps -q database)"
[[ "$container" =~ ^[0-9a-f]{12,64}$ ]] || fail 'The isolated database container was not found.'
bindings="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")"
"$python_command" - "$bindings" <<'PY'
import json
import sys
if json.loads(sys.argv[1]) not in ({}, None):
    raise SystemExit('PostgreSQL must not publish host ports.')
PY
runtime_script='export PGPASSWORD="$(cat /run/secrets/db_runtime_password)"; exec psql --no-psqlrc --no-password --host=database --username=sager_runtime --dbname=sager --tuples-only --no-align --set=ON_ERROR_STOP=1'
if ! privileges="$(compose --profile maintenance run --rm -T --no-deps --pull never --entrypoint sh \
    initialize-runtime -eu -c "$runtime_script" 2> "$temp_dir/privileges.log" <<'SQL'
SELECT current_user = 'sager_runtime'
  AND NOT (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls
           FROM pg_roles WHERE rolname = current_user)
  AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
  AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'UPDATE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'DELETE')
  AND NOT has_table_privilege(current_user, 'public.sager_audit_event', 'TRUNCATE')
  AND has_table_privilege(current_user, 'public.sager_audit_event', 'SELECT')
  AND has_table_privilege(current_user, 'public.sager_audit_event', 'INSERT');
SQL
)"; then fail 'The runtime privilege query did not complete.'; fi
[[ "$privileges" == t ]] || fail 'The runtime role has unexpected privileges.'

stage 'starting backend with readiness checks and the HTTPS gateway'
compose up --no-build --pull never --wait --wait-timeout 240 backend gateway
endpoint="$(compose port gateway 8443)"
[[ "$endpoint" =~ ^127\.0\.0\.1:([0-9]+)$ ]] || fail 'The gateway must bind only an allocated loopback port.'
https_port="${BASH_REMATCH[1]}"
base_url="https://sager.example.test:$https_port"
cookies="$(native_path "$temp_dir/cookies.txt")"
curl_request() {
  local name="$1" path="$2" expected="$3" code
  shift 3
  code="$(curl --silent --show-error --noproxy '*' --connect-timeout 5 --max-time 20 \
    "${curl_tls_options[@]}" \
    --cacert "$ca" --resolve "sager.example.test:$https_port:127.0.0.1" \
    --cookie "$cookies" --cookie-jar "$cookies" \
    --dump-header "$(native_path "$temp_dir/$name.headers")" \
    --output "$(native_path "$temp_dir/$name.body")" --write-out '%{http_code}' \
    "$@" "$base_url$path")" || fail "The HTTPS request did not complete: $path."
  [[ "$code" == "$expected" ]] || fail "Unexpected HTTP status for $path: expected $expected."
}
stage 'verifying HTTPS, production marker, CSRF, cookies and public boundaries'
curl_request index / 200 --retry 5 --retry-connrefused --retry-delay 1 --retry-max-time 15
curl_request demo /demonstracao 404
curl_request csrf /api/v1/auth/csrf 200
curl_request principal /api/v1/auth/me 401
curl_request unprotected-write /api/v1/auth/login 403 --request POST --data ''
curl_request actuator /actuator/health/readiness 404
for asset in favicon.svg favicon.ico apple-touch-icon.png icon-192.png icon-512.png og-image.png manifest.webmanifest; do
  curl_request "$asset" "/$asset" 200
done
[[ "$(<"$temp_dir/index.body")" =~ (main-[A-Za-z0-9_-]{8}\.js) ]] || fail 'The index must reference a hashed main script.'
curl_request main-script "/${BASH_REMATCH[1]}" 200
curl_request missing-chunk /chunk-AAAAAAAA.js 404
head -c 2097152 /dev/zero > "$temp_dir/2m.bin"
head -c 12582912 /dev/zero > "$temp_dir/12m.bin"
# The uploads reach the backend, which refuses them without CSRF, while the webhook keeps 1 MiB.
upload_route=/api/v1/conversas/00000000-0000-0000-0000-000000000000/mensagens
curl_request upload-allowed "$upload_route" 403 --request POST --data-binary "@$(native_path "$temp_dir/2m.bin")"
curl_request upload-too-large "$upload_route" 413 --request POST --data-binary "@$(native_path "$temp_dir/12m.bin")"
curl_request attachment-allowed /api/v1/saidas-longas/00000000-0000-0000-0000-000000000000/autorizacao/arquivos 403 \
  --request POST --data-binary "@$(native_path "$temp_dir/2m.bin")"
curl_request webhook-limit /api/v1/integracoes/whatsapp/webhook 413 --request POST --data-binary "@$(native_path "$temp_dir/2m.bin")"
"$python_command" - "$temp_native" <<'PY'
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

temporary = Path(sys.argv[1])
class ProductionIndex(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []
        self.normal_stylesheets = 0
        self.print_stylesheets = 0
        self.inline_scripts = 0
        self.noscript_depth = 0
    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'noscript':
            self.noscript_depth += 1
        if self.noscript_depth:
            return
        if tag == 'meta' and attributes.get('name') == 'sager-environment':
            self.values.append(attributes.get('content'))
        if tag == 'link' and 'stylesheet' in (attributes.get('rel') or '').lower().split():
            media = (attributes.get('media') or '').strip().lower()
            if media == 'print':
                self.print_stylesheets += 1
            elif (media in ('', 'all', 'screen') and (attributes.get('href') or '').strip()
                  and 'disabled' not in attributes):
                self.normal_stylesheets += 1
        if tag == 'script' and not (attributes.get('src') or '').strip():
            kind = (attributes.get('type') or '').split(';', 1)[0].strip().lower()
            if (kind in ('', 'module', 'importmap', 'speculationrules')
                    or re.fullmatch(r'(?:application|text)/(?:x-)?(?:java|ecma)script', kind)
                    or re.fullmatch(r'text/javascript1\.[0-5]', kind)
                    or kind in ('text/jscript', 'text/livescript')):
                self.inline_scripts += 1
    def handle_endtag(self, tag):
        if tag == 'noscript' and self.noscript_depth:
            self.noscript_depth -= 1
def require_production_index(content):
    index = ProductionIndex()
    index.feed(content)
    if index.values != ['production']:
        raise SystemExit('The served index must declare only the production environment.')
    if index.print_stylesheets:
        raise SystemExit('Production stylesheets must not depend on print-media activation.')
    if not index.normal_stylesheets:
        raise SystemExit('The production index must include an active stylesheet link.')
    if index.inline_scripts:
        raise SystemExit('The production index must not contain executable inline scripts.')

index_body = (temporary / 'index.body').read_text(encoding='utf-8')
require_production_index(index_body)
if 'content="https://sager.example.test/og-image.png"' not in index_body or '__SAGER_ORIGIN__' in index_body:
    raise SystemExit('The link preview must use the real origin, without a marker.')
csrf = json.loads((temporary / 'csrf.body').read_text(encoding='utf-8'))
if (str(csrf.get('headerName', '')).lower() != 'x-csrf-token'
        or not isinstance(csrf.get('token'), str) or len(csrf['token']) < 16):
    raise SystemExit('The CSRF endpoint did not confirm its canonical token contract.')
all_headers = {}
brand_assets = {'favicon.svg': 'image/svg+xml', 'favicon.ico': 'icon', 'apple-touch-icon.png': 'image/png',
                'icon-192.png': 'image/png', 'icon-512.png': 'image/png', 'og-image.png': 'image/png',
                'manifest.webmanifest': 'application/manifest+json'}
immutable = 'public, max-age=31536000, immutable'
for name in ('index', 'demo', 'csrf', 'principal', 'unprotected-write', 'actuator', 'main-script', 'missing-chunk',
             *brand_assets):
    headers = {}
    for line in (temporary / (name + '.headers')).read_text(encoding='iso-8859-1').splitlines():
        if ':' in line:
            key, value = line.split(':', 1)
            headers.setdefault(key.lower(), []).append(value.strip())
    all_headers[name] = headers
    if name in brand_assets and brand_assets[name] not in headers.get('content-type', [''])[0]:
        raise SystemExit(f'{name} must serve its actual content type.')
    required = {
        'strict-transport-security': lambda value: bool(re.search(r'(?:^|;)\s*max-age=31536000\s*(?:;|$)', value)),
        'x-content-type-options': lambda value: value.lower() == 'nosniff',
        'referrer-policy': lambda value: value.lower() == 'no-referrer',
        # Only the hashed main script is immutable; a missing hashed file stays no-store.
        'cache-control': (lambda value: value == immutable) if name == 'main-script'
                         else (lambda value: 'no-store' in value.lower()),
        'permissions-policy': lambda value: value == 'camera=(), microphone=(self), geolocation=()',
        'content-security-policy': lambda value: all(directive in value for directive in (
            "default-src 'self'", "frame-ancestors 'none'", "object-src 'none'",
            "base-uri 'self'", "form-action 'self'", "media-src 'self' blob:"))
            and 'clicksign' not in value,
    }
    for key, check in required.items():
        if not headers.get(key) or not all(check(value) for value in headers[key]):
            raise SystemExit(f'A security header is absent or invalid: {name} / {key}.')
session_cookies = []
for value in all_headers['csrf'].get('set-cookie', []):
    parts = [part.strip() for part in value.split(';')]
    if parts[0].split('=', 1)[0] in ('SESSION', 'JSESSIONID'):
        session_cookies.append({part.lower() for part in parts[1:]})
if not session_cookies or any(not {'secure', 'httponly', 'samesite=lax'} <= cookie
                              for cookie in session_cookies):
    raise SystemExit('Session cookies must be Secure, HttpOnly and SameSite=Lax.')
failure = json.loads((temporary / 'unprotected-write.body').read_text(encoding='utf-8'))
if failure.get('code') != 'csrf_invalid':
    raise SystemExit('The write without CSRF must fail through the CSRF protection.')
PY
stage 'passed; removing only this synthetic stack and its private temporary files'
