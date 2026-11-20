import { bitwarden } from '@nzyme/bitwarden/bitwarden.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { cached } from '@nzyme/secrets/cached.js';

import { GITHQ_ENV } from './githqEnv.js';

const PROJECT_ID = '41fe22b4-53d3-4302-b97b-b4f601003c79';
/** Keeps this repo's login apart from the other repos' on this machine. */
const KEYCHAIN_SUFFIX = 'githq';
const CACHE_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * The store of the secrets in `secrets.ts`, in Bitwarden. The project is shared with other repos, so this repo's keys
 * carry the prefix `GITHQ_` and the environment ({@link GITHQ_ENV}): `GITHQ_DEV_`, `GITHQ_PROD_`, `GITHQ_STATS_`.
 */
export const GithqSecretStore = defineService({
    name: 'GithqSecretStore',
    deps: { env: GITHQ_ENV },
    setup: ({ env }) =>
        cached(
            bitwarden({
                project: PROJECT_ID,
                prefix: `GITHQ_${env.toUpperCase()}_`,
                keychainSuffix: KEYCHAIN_SUFFIX,
            }),
            { ttl: CACHE_TTL_MS },
        ),
});
