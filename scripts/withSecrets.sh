#!/bin/sh
# Runs a development command with the secrets of `scripts/secrets.ts`, or without them when this
# machine cannot read the store: someone with no Bitwarden access still gets `bun run dev`, signing in with
# the dev-only token form. A name already set in the environment wins over the store.
if reason=$(bun nzyme secrets list 2>&1 >/dev/null); then
    exec bun nzyme secrets run -- "$@"
fi

reason=$(printf '%s\n' "$reason" | sed -n 's/.*Error: //p' | head -n 1)
echo "⚠️  Not using the secret store: ${reason:-a secret is missing, see \`bun nzyme secrets list\`}" >&2
exec "$@"
