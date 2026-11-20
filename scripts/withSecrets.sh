#!/bin/sh
# Runs a development command with the secrets declared in `packages/cli/src/secrets/secrets.ts`, or without them
# when this machine cannot read the store or a secret is missing there: someone with no Bitwarden access still gets
# `bun run dev`, signing in with the dev-only token form. A name already set in the environment wins over the store.
if ! listed=$(bun githq secrets list 2>&1); then
    reason=$(printf '%s\n' "$listed" | sed -n 's/.*Error: //p' | head -n 1)
    echo "⚠️  Not using the secret store: ${reason:-it cannot be read, see \`bun secrets list\`}" >&2
    exec "$@"
fi

# `secrets list` prints `<NAME>  missing` for a declared secret no store holds, and `secrets run` would start nothing.
missing=$(printf '%s\n' "$listed" | sed -n 's/^\([A-Z0-9_]*\)  missing$/\1/p' | tr '\n' ' ')
if [ -n "$missing" ]; then
    echo "⚠️  Not using the secret store, it lacks ${missing}(see \`bun secrets list\`)" >&2
    exec "$@"
fi

exec bun githq secrets run -- "$@"
