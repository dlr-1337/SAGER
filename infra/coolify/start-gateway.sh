#!/bin/sh
set -eu
umask 077

fail() { echo "$1" >&2; exit 2; }

# A hostname is used in both server_name and an escaped Host-header regex.
if ! printf '%s\n' "${SAGER_PUBLIC_HOST:-}" | awk '
  NR != 1 { exit 1 }
  length($0) > 253 || length($0) == 0 { exit 1 }
  /^[0-9.]+$/ { exit 1 }
  {
    n = split($0, labels, "."); if (n < 2) exit 1;
    for (i = 1; i <= n; i++) {
      if (length(labels[i]) > 63 || labels[i] !~ /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/) exit 1;
    }
  }
'; then fail 'SAGER_PUBLIC_HOST must be a valid DNS hostname.'; fi

runtime_dir=$(mktemp -d /tmp/sager-coolify.XXXXXX)
trap 'rm -rf "$runtime_dir"' EXIT HUP INT TERM

# Resolve only the named Coolify proxy through Docker embedded DNS. No CIDR,
# environment-supplied IP list, external resolver or fallback is trusted.
if ! timeout 5 nslookup coolify-proxy 127.0.0.11 > "$runtime_dir/dns.txt" 2>&1; then
  fail 'Docker DNS could not resolve coolify-proxy.'
fi
if ! awk '
  $1 == "Name:" { answer = ($2 == "coolify-proxy" && NF == 2); next }
  answer && $1 == "Address:" { if (NF != 2) exit 1; print $2 }
' "$runtime_dir/dns.txt" > "$runtime_dir/addresses.txt"; then
  fail 'Docker DNS returned an invalid proxy address.'
fi

# Check each token before writing nginx syntax. Reject unspecified, loopback,
# multicast, CIDR, scoped IPv6 and malformed IPv4/IPv6 values.
if ! awk '
  function ipv4(ip, a, n, i) {
    n = split(ip, a, "."); if (n != 4) return 0;
    for (i = 1; i <= 4; i++) {
      if (a[i] !~ /^[0-9][0-9]?[0-9]?$/ || (length(a[i]) > 1 && substr(a[i], 1, 1) == "0") || a[i] + 0 > 255) return 0;
    }
    return a[1] + 0 > 0 && a[1] + 0 != 127 && a[1] + 0 < 224;
  }
  function hex(s, i, value) {
    value = 0; for (i = 1; i <= length(s); i++) value = value * 16 + index("0123456789abcdef", substr(tolower(s), i, 1)) - 1;
    return value;
  }
  function groups(s, a, n, i) {
    if (s == "") return 0;
    n = split(s, a, ":"); for (i = 1; i <= n; i++) if (a[i] !~ /^[a-fA-F0-9]+$/ || length(a[i]) > 4) return -1;
    return n;
  }
  function ipv6(ip, halves, left, right, all, n, l, r, i, j, zeros, sum, tail, last) {
    if (ip !~ /^[a-fA-F0-9:.]+$/ || index(ip, ":") == 0) return 0;
    if (index(ip, ".") > 0) {
      last = 0; for (i = 1; i <= length(ip); i++) if (substr(ip, i, 1) == ":") last = i;
      tail = substr(ip, last + 1); if (!ipv4(tail)) return 0;
      ip = substr(ip, 1, last) "1:1";
    }
    n = split(ip, halves, "::");
    if (n > 2) return 0;
    l = groups(halves[1], left); r = n == 2 ? groups(halves[2], right) : 0;
    if (l < 0 || r < 0 || (n == 1 && l != 8) || (n == 2 && l + r >= 8)) return 0;
    zeros = n == 2 ? 8 - l - r : 0;
    j = 0; for (i = 1; i <= l; i++) all[++j] = hex(left[i]);
    for (i = 1; i <= zeros; i++) all[++j] = 0;
    for (i = 1; i <= r; i++) all[++j] = hex(right[i]);
    if (all[1] >= 65280) return 0;
    sum = 0; for (i = 1; i <= 7; i++) sum += all[i];
    return sum > 0 || all[8] > 1;
  }
  {
    if (NF != 1 || (!ipv4($0) && !ipv6($0))) exit 1;
    if (!seen[tolower($0)]++) { print tolower($0); count++ }
  }
  END { if (count == 0) exit 1 }
' "$runtime_dir/addresses.txt" > "$runtime_dir/validated.txt"; then
  fail 'Docker DNS must return valid unicast proxy IP addresses.'
fi

awk '{ print $0 " 1;" }' "$runtime_dir/validated.txt" > "$runtime_dir/peers.conf"
awk '{ print "set_real_ip_from " $0 ";" }' "$runtime_dir/validated.txt" > "$runtime_dir/realip.conf"
export SAGER_COOLIFY_PEERS_FILE="$runtime_dir/peers.conf"
export SAGER_COOLIFY_REALIP_FILE="$runtime_dir/realip.conf"
SAGER_PUBLIC_HOST_REGEX=$(printf '%s' "$SAGER_PUBLIC_HOST" | sed 's/\./\\./g')
export SAGER_PUBLIC_HOST_REGEX
envsubst '${SAGER_PUBLIC_HOST} ${SAGER_PUBLIC_HOST_REGEX} ${SAGER_COOLIFY_PEERS_FILE} ${SAGER_COOLIFY_REALIP_FILE}' < /etc/nginx/nginx.conf.template > "$runtime_dir/nginx.conf"
nginx -t -c "$runtime_dir/nginx.conf"
exec nginx -c "$runtime_dir/nginx.conf" -g 'daemon off;'
