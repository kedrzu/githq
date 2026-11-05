import { describe, expect, test } from 'bun:test';

import { detectDesktopSystem } from './desktopBuilds.js';

const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('detectDesktopSystem', () => {
    test.each([
        ['a Mac', MAC, 0, 'macos'],
        [
            'Windows',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
            0,
            'windows',
        ],
        ['Linux', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36', 0, 'linux'],
        ['an iPad, which says it is a Mac', MAC, 5, null],
        [
            'an iPhone, whose address says "like Mac OS X"',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1',
            5,
            null,
        ],
        [
            'Android, which says it is Linux',
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
            5,
            null,
        ],
        [
            'a Chromebook, which has no build',
            'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
            0,
            null,
        ],
        ['anything else', 'SomeBot/1.0', 0, null],
    ])('%s', (_what, userAgent, maxTouchPoints, system) => {
        expect(detectDesktopSystem({ userAgent, maxTouchPoints })).toBe(
            system as ReturnType<typeof detectDesktopSystem>,
        );
    });
});
