import {
    DESKTOP_DOWNLOAD_COOKIE,
    DESKTOP_INSTALLERS,
    DESKTOP_INSTALLER_PATH,
    GITHQ_RELEASES_URL,
    getDesktopInstallerAssetUrl,
} from '@githq/github/desktopInstallers.js';
import type { DesktopInstaller } from '@githq/github/desktopInstallers.js';

import { recordUsage } from './usage.js';
import type { WorkerEnv } from './WorkerEnv.js';

/** The prefix of every installer link, `/download/`. */
export const DOWNLOAD_PREFIX = `${DESKTOP_INSTALLER_PATH}/`;

/** GitHub's address of the latest Stable release; it redirects to the release's tag (`…/releases/tag/v0.3.0`). */
const LATEST_RELEASE_URL = `${GITHQ_RELEASES_URL}/latest`;

/**
 * How long Cloudflare keeps GitHub's answer to {@link LATEST_RELEASE_URL}: a newly published release reaches the links
 * within this many seconds, and GitHub is asked at most this often per location.
 */
const CACHE_SECONDS = 300;

/** `fetch`'s options in a Worker: `cf` steers Cloudflare's cache of the subrequest. */
interface WorkerRequestInit extends RequestInit {
    cf?: { cacheEverything?: boolean; cacheTtlByStatus?: Record<string, number> };
}

function isInstaller(name: string): name is DesktopInstaller {
    return Object.hasOwn(DESKTOP_INSTALLERS, name);
}

/** The version of the latest Stable release, read from where GitHub redirects its `latest`; `null` if it can't tell. */
async function readLatestVersion(): Promise<string | null> {
    const init: WorkerRequestInit = {
        redirect: 'manual',
        cf: { cacheEverything: true, cacheTtlByStatus: { '300-399': CACHE_SECONDS } },
    };
    try {
        const response = await fetch(LATEST_RELEASE_URL, init);
        const match = /\/releases\/tag\/v(\d+\.\d+\.\d+[\w.+-]*)$/.exec(response.headers.get('location') ?? '');
        return match?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * A redirect no browser keeps: each click has to reach the Worker again, so that the redirect to an installer sets
 * {@link DESKTOP_DOWNLOAD_COOKIE} every time.
 */
function redirect(location: string, headers: Record<string, string> = {}): Response {
    return new Response(null, {
        status: 302,
        headers: { Location: location, 'Cache-Control': 'no-store', ...headers },
    });
}

/** {@link DESKTOP_DOWNLOAD_COOKIE} as a `Set-Cookie` header; `Secure` only on https, so that `wrangler dev` can set it. */
function downloadCookie(request: Request): string {
    const { name, value, maxAgeSeconds } = DESKTOP_DOWNLOAD_COOKIE;
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

/**
 * `/download/<build>`: a redirect to that installer in the latest Stable release, a file with the version in its name,
 * so that a release needs no copies under fixed names, with {@link DESKTOP_DOWNLOAD_COOKIE} for the page that sent the
 * visitor. An unknown build goes to `/download`, the page with every build; when GitHub can't say which release is the
 * latest, the visitor lands on that release's page on GitHub instead. Only the redirect to an installer is counted
 * (`usage.ts`); a download has no opt-out, since no app is there to carry one.
 */
export async function serveDownload(request: Request, env: WorkerEnv): Promise<Response> {
    const name = new URL(request.url).pathname.slice(DOWNLOAD_PREFIX.length);
    if (!isInstaller(name)) {
        return redirect(new URL(DESKTOP_INSTALLER_PATH, request.url).href);
    }
    const version = await readLatestVersion();
    if (!version) {
        return redirect(LATEST_RELEASE_URL);
    }
    recordUsage(env, 'installer_download', { client: '', platform: name });
    return redirect(getDesktopInstallerAssetUrl(name, version), { 'Set-Cookie': downloadCookie(request) });
}
