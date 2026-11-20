import { defineService } from '@nzyme/ioc/Service.js';
import { secretsProvider } from '@nzyme/secrets/commands/secretsProvider.js';
import { getSecretDefinitions } from '@nzyme/secrets/getSecretDefinitions.js';

import { GithqSecretStore } from '@githq/secrets/GithqSecretStore.js';
import * as secrets from '@githq/secrets/secrets.js';

/** The provider of the `secrets` commands: the declarations of `@githq/secrets` in its store. */
export const GithqSecrets = defineService({
    name: 'GithqSecrets',
    deps: { store: GithqSecretStore },
    setup: ({ store }) => secretsProvider({ secrets: getSecretDefinitions(secrets), store }),
});
