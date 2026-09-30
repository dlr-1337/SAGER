#!/bin/sh
set -eu
case "${SAGER_PUBLIC_HOST:-}" in
  ''|*[!a-zA-Z0-9.-]*|.*|*.) echo 'SAGER_PUBLIC_HOST must be a DNS hostname.' >&2; exit 2 ;;
esac
test -r /run/tls/fullchain.pem && test -r /run/tls/privkey.pem
envsubst '${SAGER_PUBLIC_HOST}' < /etc/nginx/nginx.conf.template > /tmp/nginx.conf
nginx -t -c /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
