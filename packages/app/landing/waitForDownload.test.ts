import { afterEach, beforeEach, expect, jest, test } from 'bun:test';

import { waitForDownload } from './waitForDownload.js';
import type { DownloadPage } from './waitForDownload.js';

const LINK = 'https://githq.dev/download/windows';
const CLEARED = 'githq_download=; Path=/; Max-Age=0';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

/** A page on `origin` whose cookies are `cookies`, recording what it writes. */
function createPage(origin = 'https://githq.dev') {
    const page: DownloadPage & { cookies: string; written: string[] } = {
        origin,
        cookies: 'githq_signed_in=1',
        written: [],
        readCookies: () => page.cookies,
        writeCookie: cookie => page.written.push(cookie),
    };
    return page;
}

/** Whether `promise` has settled, after the timers advance by `ms`. */
async function settledAfter(promise: Promise<void>, ms: number) {
    let settled = false;
    void promise.then(() => (settled = true));
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    return settled;
}

test('spins until the Worker sets its cookie, clearing one left from before and the one it read', async () => {
    const page = createPage();
    const download = waitForDownload(LINK, page);
    expect(page.written).toEqual([CLEARED]);

    expect(await settledAfter(download, 1500)).toBe(false);
    page.cookies = 'githq_signed_in=1; githq_download=1';
    expect(await settledAfter(download, 100)).toBe(true);
    expect(page.written[1]).toBe(CLEARED);
});

test('spins for at least a second, however soon the cookie comes', async () => {
    const page = createPage();
    const download = waitForDownload(LINK, page);
    page.cookies = 'githq_download=1';

    expect(await settledAfter(download, 900)).toBe(false);
    expect(await settledAfter(download, 100)).toBe(true);
});

test('another cookie of a similar name does not end it', async () => {
    const page = createPage();
    page.cookies = 'githq_download=0; xgithq_download=1';

    expect(await settledAfter(waitForDownload(LINK, page), 1000)).toBe(false);
});

test('gives up after 15 seconds without the cookie', async () => {
    const download = waitForDownload(LINK, createPage());

    expect(await settledAfter(download, 14_900)).toBe(false);
    expect(await settledAfter(download, 100)).toBe(true);
});

test('on another origin, where the cookie cannot be read, spins for a moment and touches no cookie', async () => {
    const page = createPage('http://localhost:8787');
    const download = waitForDownload(LINK, page);

    expect(await settledAfter(download, 1400)).toBe(false);
    expect(await settledAfter(download, 100)).toBe(true);
    expect(page.written).toEqual([]);
});
