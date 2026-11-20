import { defineEnvVariable } from '@nzyme/ioc/defineEnvVariable.js';

/**
 * Which secrets to read: `dev` (default), `prod`, or `stats` for the usage statistics script alone. Picks the store's
 * prefix (`GithqSecretStore`); `secrets.ts` reads the same variable to say which secrets apply.
 */
export const GITHQ_ENV = defineEnvVariable('GITHQ_ENV', { default: 'dev' });
