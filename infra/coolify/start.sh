#!/usr/bin/env bash
# Coolify Custom Start command: bash infra/coolify/start.sh
# Build the maintenance images before calling this script. Do not run concurrently
# with recovery.py: the operator must serialize deployment and backup on the host.
set -Eeuo pipefail

fail() { printf '%s\n' "SAGER startup: $*" >&2; exit 1; }
script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repository_root="$(cd -- "$script_directory/../.." && pwd -P)"
manifest="$repository_root/compose.coolify.yml"
environment_file="$repository_root/.env"

case "${1:-}" in
  '') ;;
  --env-file)
    [[ $# -eq 2 && -n $2 ]] || fail 'Usage: start.sh [--env-file PATH]'
    environment_file="$2"
    ;;
  --help|-h)
    printf '%s\n' 'Usage: bash infra/coolify/start.sh [--env-file PATH]' \
      'Uses the root compose.coolify.yml and the runtime .env written by Coolify.'
    exit 0
    ;;
  *) fail 'Usage: start.sh [--env-file PATH]' ;;
esac
[[ -r $manifest && -r $environment_file ]] || fail 'Compose manifest or runtime env file missing.'
environment_file="$(cd -- "$(dirname -- "$environment_file")" && pwd -P)/$(basename -- "$environment_file")"
command -v docker >/dev/null || fail 'Docker CLI is required.'

# Parse only literal operational settings. Never execute a generated .env file.
# Exporting these values makes Compose interpolation and --project-name agree.
dotenv_value() {
  local key="$1" line raw value='' found=false
  local assignment_pattern="^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=(.*)$"
  local single_pattern="^'([^']*)'[[:space:]]*(#.*)?$"
  local double_pattern='^"([^"\\]*)"[[:space:]]*(#.*)?$'
  local plain_pattern="^([^[:space:]'\"\\\\]*)[[:space:]]*(#.*)?$"
  while IFS= read -r line || [[ -n $line ]]; do
    line="${line%$'\r'}"
    if [[ $line =~ $assignment_pattern ]]; then
      raw="${BASH_REMATCH[2]}"
      raw="${raw#"${raw%%[![:space:]]*}"}"
      if [[ $raw =~ $single_pattern || $raw =~ $double_pattern || $raw =~ $plain_pattern ]]; then
        value="${BASH_REMATCH[1]}"
      else
        fail "Use a literal value for $key in the runtime env file."
      fi
      [[ $value != *'$'* && $value != *'`'* ]] || fail "Use a literal value for $key."
      found=true
    fi
  done < "$environment_file"
  $found && printf '%s' "$value"
  return 0
}

load_setting() {
  local key="$1" fallback="${2:-}" value
  if [[ -v $key ]]; then value="${!key}"; else value="$(dotenv_value "$key")"; fi
  value="${value:-$fallback}"
  [[ -n $value ]] || fail "Required setting missing: $key."
  printf -v "$key" '%s' "$value"
  export "$key"
}
load_setting SAGER_STACK_NAME sager-homologacao
load_setting SAGER_PUBLIC_HOST
load_setting SAGER_SECRETS_DIR
load_setting SAGER_COOLIFY_APPLICATION_ID
[[ $SAGER_STACK_NAME =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Invalid Compose project name.'
[[ $SAGER_PUBLIC_HOST =~ ^[a-z0-9][a-z0-9.-]*[a-z0-9]$ && $SAGER_PUBLIC_HOST == *.* ]] \
  || fail 'Set a DNS hostname without a scheme, port or path.'
[[ $SAGER_SECRETS_DIR == /* ]] || fail 'SAGER_SECRETS_DIR must be an absolute host path.'
[[ $SAGER_COOLIFY_APPLICATION_ID =~ ^[1-9][0-9]*$ ]] \
  || fail 'SAGER_COOLIFY_APPLICATION_ID must be the existing numeric application ID.'

compose=(docker compose --project-name "$SAGER_STACK_NAME" \
  --project-directory "$repository_root" --env-file "$environment_file" -f "$manifest")
# Preflight has not entered maintenance: invalid settings/config preserve the
# existing runtime. Arm failure cleanup only after the target configuration is valid.
"${compose[@]}" config --quiet >/dev/null || fail 'Invalid Compose configuration.'

assert_runtime_stopped() {
  local ids states state
  local -a runtime_ids=()
  ids="$("${compose[@]}" ps --all --quiet gateway backend)" || return 1
  [[ -z $ids ]] && return 0
  while IFS= read -r id; do [[ -z $id ]] || runtime_ids+=("$id"); done <<< "$ids"
  states="$(docker inspect --format '{{.State.Status}}' "${runtime_ids[@]}")" || return 1
  while IFS= read -r state; do
    case "$state" in created|exited|dead) ;; *) return 1 ;; esac
  done <<< "$states"
}

on_exit() {
  local status="$?"
  trap - EXIT INT TERM
  if [[ $status -ne 0 ]]; then
    printf '%s\n' 'SAGER startup failed; stopping gateway and backend.' >&2
    "${compose[@]}" stop --timeout 30 gateway backend >/dev/null \
      || printf '%s\n' 'Runtime stop failed; operator intervention is required.' >&2
    assert_runtime_stopped \
      || printf '%s\n' 'Runtime is still active; operator intervention is required.' >&2
  fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '%s\n' 'SAGER startup: stopping runtime before schema maintenance.'
"${compose[@]}" stop --timeout 30 gateway backend
assert_runtime_stopped || fail 'Runtime must be stopped before migration.'
"${compose[@]}" up -d --no-build --wait --wait-timeout 120 database
"${compose[@]}" --profile maintenance run --rm -T --no-deps --pull never migrate
"${compose[@]}" --profile maintenance run --rm -T --no-deps --pull never initialize-runtime
"${compose[@]}" up -d --no-build --no-deps --pull never --wait --wait-timeout 240 backend
"${compose[@]}" up -d --no-build --no-deps --pull never --wait --wait-timeout 90 gateway
printf '%s\n' 'SAGER startup complete: database, backend and gateway are healthy.'
