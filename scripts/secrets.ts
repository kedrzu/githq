/**
 * The repo's secrets: the mapping, and the `secrets` commands of the `nzyme` binary (`bun nzyme secrets …`,
 * a plugin listed in the root `package.json`). How to use them: the `secrets` skill.
 */
import { bitwarden } from '@nzyme/bitwarden/bitwarden.js';
import type { NzymePlugin } from '@nzyme/cli-core/NzymePlugin.js';
import { defineEnvVariable } from '@nzyme/ioc/defineEnvVariable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { cached } from '@nzyme/secrets/cached.js';
import { defineSecretsCommands } from '@nzyme/secrets/commands/defineSecretsCommands.js';
import type { SecretsMapping } from '@nzyme/secrets/SecretsMapping.js';

const PROJECT_ID = '41fe22b4-53d3-4302-b97b-b4f601003c79';
/** Keeps this repo's login apart from the other repos' on this machine. */
const KEYCHAIN_SUFFIX = 'githq';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;

/** Which OAuth App's secret to read: `dev` or `prod`. */
const GITHQ_ENV = defineEnvVariable('GITHQ_ENV', { default: 'dev' });

/**
 * The OAuth Apps' client secrets, `dev` by default; their client IDs are public, in
 * `packages/github/src/oauthClientIds.json`. The Bitwarden project is shared with other repos, so this repo's keys
 * carry the prefix `GITHQ_`, and the suffix names the environment.
 */
export const GithqSecrets = defineService({
    name: 'GithqSecrets',
    deps: { env: GITHQ_ENV },
    setup({ env }): SecretsMapping {
        return {
            store: cached(bitwarden({ project: PROJECT_ID, keychainSuffix: KEYCHAIN_SUFFIX }), { ttl: CACHE_TTL_MS }),
            secrets: {
                GITHUB_CLIENT_SECRET: `GITHQ_GITHUB_CLIENT_SECRET_${env.toUpperCase()}`,
                // Production only, so that `bun run dev` never holds the key that signs updates.
                ...(env === 'prod' && {
                    TAURI_SIGNING_PRIVATE_KEY: 'GITHQ_TAURI_SIGNING_PRIVATE_KEY_PROD',
                    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: 'GITHQ_TAURI_SIGNING_PRIVATE_KEY_PASSWORD_PROD',
                }),
            },
        };
    },
});

export default { commands: defineSecretsCommands({ provider: GithqSecrets }) } satisfies NzymePlugin;
