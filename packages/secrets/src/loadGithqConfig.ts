import { envSource } from '@nzyme/config/envSource.js';
import { loadConfig } from '@nzyme/config/loadConfig.js';
import type { Container } from '@nzyme/ioc/Container.js';
import { secretsSource } from '@nzyme/secrets/secretsSource.js';

import { GithqSecretStore } from './GithqSecretStore.js';

/**
 * Installs the container's config for a Bun script: the environment variables, then the secrets of
 * {@link GithqSecretStore}, so a variable set in the shell wins over the store. Code then resolves a secret of
 * `secrets.ts` through the container. In CI the job's environment carries the values and the store is not read.
 */
export async function loadGithqConfig(container: Container): Promise<void> {
    await loadConfig(
        container,
        process.env.CI ? [envSource()] : [envSource(), secretsSource(container.resolve(GithqSecretStore))],
    );
}
