import { expect, test } from 'bun:test';

import { getUsageClient } from './usage.js';
import type { UsageClient } from './usage.js';

test.each<[string, Record<string, string>, UsageClient]>([
    ['no Origin', {}, 'web'],
    ['the Worker’s own origin', { origin: 'https://githq.test' }, 'web'],
    ['the desktop webview’s origin', { origin: 'tauri://localhost' }, 'desktop'],
    ['another site’s origin', { origin: 'https://githq.test.evil' }, 'desktop'],
])('a request with %s comes from the %s client', (_, headers, client) => {
    expect(getUsageClient(new Request('https://githq.test/api/auth/revoke', { headers }))).toBe(client);
});
