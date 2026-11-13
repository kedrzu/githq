import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import type { Mock } from 'bun:test';

import worker from './worker.js';
import type { AnalyticsEngineDataPoint, WorkerEnv } from './WorkerEnv.js';

// GitHub is the system boundary: its answer to `releases/latest` is a stubbed global `fetch`.

const ORIGIN = 'https://githq.test';
const RELEASES = 'https://github.com/kedrzu/githq/releases';
const ENV: WorkerEnv = { ASSETS: { fetch: () => Promise.resolve(new Response('asset')) } };

let github: Mock<typeof fetch>;

beforeEach(() => {
    github = spyOn(globalThis, 'fetch');
});

afterEach(() => {
    mock.restore();
});

function githubRedirectsTo(location: string) {
    github.mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
}

function download(path: string, env: WorkerEnv = ENV) {
    return worker.fetch(new Request(`${ORIGIN}${path}`), env);
}

test.each([
    ['macos-silicon', 'githq_0.3.0_aarch64.dmg'],
    ['macos-intel', 'githq_0.3.0_x64.dmg'],
    ['windows', 'githq_0.3.0_x64-setup.exe'],
    ['linux-appimage', 'githq_0.3.0_amd64.AppImage'],
    ['linux-deb', 'githq_0.3.0_amd64.deb'],
])('/download/%s redirects to %s of the latest release', async (build, file) => {
    githubRedirectsTo(`${RELEASES}/tag/v0.3.0`);

    const response = await download(`/download/${build}`);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${RELEASES}/download/v0.3.0/${file}`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBe('githq_download=1; Path=/; Max-Age=60; SameSite=Lax; Secure');
    expect(github).toHaveBeenCalledTimes(1);
    const [url, init] = github.mock.calls[0]!;
    expect(url).toBe(`${RELEASES}/latest`);
    expect(init?.redirect).toBe('manual');
});

test('on http, as under `wrangler dev`, the cookie is not Secure', async () => {
    githubRedirectsTo(`${RELEASES}/tag/v0.3.0`);

    const response = await worker.fetch(new Request('http://localhost:8787/download/windows'), ENV);

    expect(response.headers.get('set-cookie')).toBe('githq_download=1; Path=/; Max-Age=60; SameSite=Lax');
});

test('an unknown build goes to the page with every build, without asking GitHub', async () => {
    const response = await download('/download/amiga');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/download`);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(github).not.toHaveBeenCalled();
});

test.each([
    ['GitHub has no latest release', () => github.mockResolvedValue(new Response('Not Found', { status: 404 }))],
    ['GitHub redirects somewhere else', () => githubRedirectsTo('https://github.com/login')],
    ['GitHub cannot be reached', () => github.mockRejectedValue(new TypeError('network'))],
])('when %s, the visitor lands on the latest release on GitHub', async (_, arrange) => {
    arrange();

    const response = await download('/download/windows');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${RELEASES}/latest`);
    expect(response.headers.get('set-cookie')).toBeNull();
});

test('counts a redirect to an installer, with the installer as the platform and nothing about the visitor', async () => {
    const usage = usageBinding();
    githubRedirectsTo(`${RELEASES}/tag/v0.3.0`);

    await worker.fetch(
        new Request(`${ORIGIN}/download/macos-silicon`, {
            headers: { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'Mozilla/5.0', 'cf-ipcountry': 'PL' },
        }),
        { ...ENV, USAGE: usage.binding },
    );

    const expected: AnalyticsEngineDataPoint[] = [
        { blobs: ['installer_download', '', 'macos-silicon'], doubles: [1], indexes: ['installer_download'] },
    ];
    expect(usage.points).toEqual(expected);
});

test('counts neither an unknown build nor the fallback to the release page', async () => {
    const usage = usageBinding();
    github.mockRejectedValue(new TypeError('network'));

    await download('/download/amiga', { ...ENV, USAGE: usage.binding });
    await download('/download/windows', { ...ENV, USAGE: usage.binding });

    expect(usage.points).toEqual([]);
});

test('answers the same with the binding, without it and when it throws', async () => {
    const throwing: WorkerEnv['USAGE'] = {
        writeDataPoint() {
            throw new Error('Analytics Engine is down');
        },
    };
    githubRedirectsTo(`${RELEASES}/tag/v0.3.0`);

    const answers: string[] = [];
    for (const env of [ENV, { ...ENV, USAGE: usageBinding().binding }, { ...ENV, USAGE: throwing }]) {
        const response = await download('/download/windows', env);
        answers.push(`${response.status} ${JSON.stringify([...response.headers])}`);
    }

    expect(answers[0]).toContain('githq_0.3.0_x64-setup.exe');
    expect(answers[1]).toBe(answers[0]);
    expect(answers[2]).toBe(answers[0]);
});

/** A fake Analytics Engine binding that keeps every data point written to it. */
function usageBinding() {
    const points: AnalyticsEngineDataPoint[] = [];
    const binding: WorkerEnv['USAGE'] = {
        writeDataPoint(point) {
            points.push(point);
        },
    };
    return { points, binding };
}
