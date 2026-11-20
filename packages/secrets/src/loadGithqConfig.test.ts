import { afterEach, beforeEach, expect, test } from 'bun:test';

import { createContainer } from '@nzyme/ioc/Container.js';
import type { SecretStore } from '@nzyme/secrets/SecretStore.js';

import { GithqSecretStore } from './GithqSecretStore.js';
import { loadGithqConfig } from './loadGithqConfig.js';
import { CLOUDFLARE_ANALYTICS_TOKEN, GITHUB_CLIENT_SECRET } from './secrets.js';

const VARIABLES = ['CI', 'GITHUB_CLIENT_SECRET', 'CLOUDFLARE_ANALYTICS_TOKEN'] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = Object.fromEntries(VARIABLES.map(name => [name, process.env[name]]));
    for (const name of VARIABLES) {
        delete process.env[name];
    }
});

afterEach(() => {
    for (const name of VARIABLES) {
        const value = saved[name];
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }
});

function containerWithStore(entries: Record<string, string>) {
    const store: SecretStore = {
        id: 'fake',
        readAll: () => Promise.resolve(new Map(Object.entries(entries))),
        write: () => Promise.resolve(),
    };
    const container = createContainer();
    container.set(GithqSecretStore, store);
    return container;
}

test('resolves a secret from the store, and an environment variable wins over it', async () => {
    process.env.GITHUB_CLIENT_SECRET = 'from-the-environment';
    const container = containerWithStore({
        GITHUB_CLIENT_SECRET: 'from-the-store',
        CLOUDFLARE_ANALYTICS_TOKEN: 'stored-token',
    });

    await loadGithqConfig(container);

    expect(container.resolve(GITHUB_CLIENT_SECRET)).toBe('from-the-environment');
    expect(container.resolve(CLOUDFLARE_ANALYTICS_TOKEN)).toBe('stored-token');
});

test('in CI reads the environment only, never the store', async () => {
    process.env.CI = 'true';
    const container = containerWithStore({ CLOUDFLARE_ANALYTICS_TOKEN: 'stored-token' });

    await loadGithqConfig(container);

    expect(() => container.resolve(CLOUDFLARE_ANALYTICS_TOKEN)).toThrow('CLOUDFLARE_ANALYTICS_TOKEN is not set');
});
