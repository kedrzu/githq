/**
 * The repo's secrets: the mapping, and the `secrets` commands of the `nzyme` binary (`bun nzyme secrets …`,
 * a plugin listed in the root `package.json`). How to use them: the `secrets` skill.
 */
import { bitwarden } from '@nzyme/bitwarden/bitwarden.js';
import type { NzymePlugin } from '@nzyme/cli-core/NzymePlugin.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { cached } from '@nzyme/secrets/cached.js';
import { defineSecretsCommands } from '@nzyme/secrets/commands/defineSecretsCommands.js';
import type { SecretsMapping } from '@nzyme/secrets/SecretsMapping.js';

const PROJECT_ID = '41fe22b4-53d3-4302-b97b-b4f601003c79';
/** Keeps this repo's login apart from the other repos' on this machine. */
const KEYCHAIN_SUFFIX = 'githq';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * githq's development credentials: the OAuth App "githq (dev)". Production's are Worker secrets on
 * Cloudflare, outside this mapping. The Bitwarden project is shared with other repos, so this repo's keys
 * carry the prefix `GITHQ_`.
 */
export const GithqSecrets = defineService<SecretsMapping>({
    name: 'GithqSecrets',
    setup() {
        return {
            store: cached(bitwarden({ project: PROJECT_ID, keychainSuffix: KEYCHAIN_SUFFIX }), { ttl: CACHE_TTL_MS }),
            secrets: {
                GITHUB_CLIENT_ID: 'GITHQ_GITHUB_CLIENT_ID',
                GITHUB_CLIENT_SECRET: 'GITHQ_GITHUB_CLIENT_SECRET',
                // The desktop build reads the same public client ID under its own name.
                GITHQ_GITHUB_CLIENT_ID: 'GITHQ_GITHUB_CLIENT_ID',
            },
        };
    },
});

export default { commands: defineSecretsCommands({ provider: GithqSecrets }) } satisfies NzymePlugin;
