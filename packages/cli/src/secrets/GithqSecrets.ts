import { bitwarden } from '@nzyme/bitwarden/bitwarden.js';
import { defineEnvVariable } from '@nzyme/ioc/defineEnvVariable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { cached } from '@nzyme/secrets/cached.js';
import { secretsProvider } from '@nzyme/secrets/commands/secretsProvider.js';
import { getSecretDefinitions } from '@nzyme/secrets/getSecretDefinitions.js';

import * as secrets from './secrets.js';

const PROJECT_ID = '41fe22b4-53d3-4302-b97b-b4f601003c79';
/** Keeps this repo's login apart from the other repos' on this machine. */
const KEYCHAIN_SUFFIX = 'githq';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;

/** Which secrets to read: `dev` (default), `prod`, or `stats` for the usage statistics script alone. */
const GITHQ_ENV = defineEnvVariable('GITHQ_ENV', { default: 'dev' });

/**
 * The secrets of `secrets.ts` in Bitwarden. The project is shared with other repos, so this repo's keys carry the
 * prefix `GITHQ_` and the environment: `GITHQ_DEV_`, `GITHQ_PROD_`, `GITHQ_STATS_`.
 */
export const GithqSecrets = defineService({
    name: 'GithqSecrets',
    deps: { env: GITHQ_ENV },
    setup: ({ env }) =>
        secretsProvider({
            secrets: getSecretDefinitions(secrets),
            store: cached(
                bitwarden({
                    project: PROJECT_ID,
                    prefix: `GITHQ_${env.toUpperCase()}_`,
                    keychainSuffix: KEYCHAIN_SUFFIX,
                }),
                { ttl: CACHE_TTL_MS },
            ),
        }),
});
