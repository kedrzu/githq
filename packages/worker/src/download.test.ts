import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import type { Mock } from 'bun:test';

import worker from './worker.js';
import type { WorkerEnv } from './WorkerEnv.js';

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

function download(path: string) {
    return worker.fetch(new Request(`${ORIGIN}${path}`), ENV);
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
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(github).toHaveBeenCalledTimes(1);
    const [url, init] = github.mock.calls[0]!;
    expect(url).toBe(`${RELEASES}/latest`);
    expect(init?.redirect).toBe('manual');
});

test('an unknown build goes to the page with every build, without asking GitHub', async () => {
    const response = await download('/download/amiga');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/download`);
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
    expect(response.headers.get('cache-control')).toBe('no-cache');
});
