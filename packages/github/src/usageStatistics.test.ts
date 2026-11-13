import { runInNewContext } from 'node:vm';

import { expect, test } from 'bun:test';

import {
    CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    getBeaconLoaderScript,
    USAGE_STATISTICS_OFF_KEY,
    USAGE_STATISTICS_OFF_VALUE,
} from './usageStatistics.js';

interface FakeScript {
    src?: string;
    defer?: boolean;
    attributes: Record<string, string>;
    setAttribute(name: string, value: string): void;
}

interface RunOptions {
    hostname: string;
    storage: 'empty' | 'off' | 'throws';
    spa: boolean;
}

test('loads the beacon with the token and spa flag on githq.dev when statistics are not off', () => {
    const appended = runLoader({ hostname: 'githq.dev', storage: 'empty', spa: false });

    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(appended[0]?.defer).toBe(true);
    expect(JSON.parse(appended[0]?.attributes['data-cf-beacon'] ?? '')).toEqual({
        token: CLOUDFLARE_WEB_ANALYTICS_TOKEN,
        spa: false,
    });
});

test('passes spa: true through for the docs site', () => {
    const appended = runLoader({ hostname: 'githq.dev', storage: 'empty', spa: true });

    expect(JSON.parse(appended[0]?.attributes['data-cf-beacon'] ?? '')).toEqual({
        token: CLOUDFLARE_WEB_ANALYTICS_TOKEN,
        spa: true,
    });
});

test('loads nothing when the opt-out flag is set', () => {
    expect(runLoader({ hostname: 'githq.dev', storage: 'off', spa: false })).toEqual([]);
});

test('loads nothing on a host other than githq.dev', () => {
    expect(runLoader({ hostname: 'localhost', storage: 'empty', spa: false })).toEqual([]);
    expect(runLoader({ hostname: 'preview.githq.dev', storage: 'empty', spa: false })).toEqual([]);
});

test('does not throw and loads nothing when localStorage throws', () => {
    expect(runLoader({ hostname: 'githq.dev', storage: 'throws', spa: false })).toEqual([]);
});

function runLoader({ hostname, storage, spa }: RunOptions): FakeScript[] {
    const appended: FakeScript[] = [];
    const document = {
        head: {
            appendChild(element: FakeScript) {
                appended.push(element);
            },
        },
        createElement(): FakeScript {
            const attributes: Record<string, string> = {};
            return {
                attributes,
                setAttribute(name, value) {
                    attributes[name] = value;
                },
            };
        },
    };
    const localStorage = {
        getItem(key: string): string | null {
            if (storage === 'throws') {
                throw new Error('SecurityError');
            }
            return storage === 'off' && key === USAGE_STATISTICS_OFF_KEY ? USAGE_STATISTICS_OFF_VALUE : null;
        },
    };

    runInNewContext(getBeaconLoaderScript({ spa }), { document, location: { hostname }, localStorage });
    return appended;
}
