import { RuntimeConfig } from '@nzyme/config/RuntimeConfig.js';
import type { Container } from '@nzyme/ioc/Container.js';
import type { SecretDefinition } from '@nzyme/secrets/defineSecret.js';

/**
 * The secret's value in the container's config document, or `undefined` when the document lacks it — for code that
 * runs without the secret on purpose (the Worker answers `not_configured` without `GITHUB_CLIENT_SECRET`). Everywhere
 * else, `container.resolve(SECRET)` fails naming the missing secret.
 */
export function resolveOptionalSecret(container: Container, secret: SecretDefinition): string | undefined {
    const value = container.resolve(RuntimeConfig)[secret.name];
    return typeof value === 'string' ? value : undefined;
}
