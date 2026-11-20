import { afterEach, expect, mock, spyOn, test } from 'bun:test';

import { CLOUDFLARE_ANALYTICS_TOKEN } from '@githq/secrets/secrets.js';
import { RuntimeConfig } from '@nzyme/config/RuntimeConfig.js';
import { createContainer } from '@nzyme/ioc/Container.js';

import { readUsageStats } from './stats.js';

afterEach(() => {
    mock.restore();
});

test('asks Analytics Engine with the token resolved through the container', async () => {
    const analytics = spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({
            data: [{ day: '2026-11-19 00:00:00', event: 'token_created', client: 'web', platform: '', total: 3.4 }],
        }),
    );
    const container = createContainer();
    container.set(RuntimeConfig, { [CLOUDFLARE_ANALYTICS_TOKEN.name]: 'fake-analytics-token' });

    const rows = await readUsageStats(container);

    expect(rows).toEqual([{ day: '2026-11-19', event: 'token_created', client: 'web', platform: '', total: '3' }]);
    const [url, init] = analytics.mock.calls[0] ?? [];
    expect(url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/8626d3c4b429e16b14d1b4e1bb4df29f/analytics_engine/sql',
    );
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fake-analytics-token');
});

test('fails naming the secret when the container holds no token', async () => {
    const container = createContainer();
    container.set(RuntimeConfig, {});

    await expect(readUsageStats(container)).rejects.toThrow('CLOUDFLARE_ANALYTICS_TOKEN is not set');
});
