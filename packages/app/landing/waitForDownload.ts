import { DESKTOP_DOWNLOAD_COOKIE } from '@githq/github/desktopInstallers.js';

/** How often the cookie is looked for, in milliseconds. */
const POLL_MS = 100;

/** The longest a download is shown as under way when the Worker's cookie never comes (GitHub slow or unreachable). */
const LONGEST_MS = 15_000;

/**
 * How long a download is shown as under way when the page can't read the Worker's cookie: the link is on another
 * origin, as from `nuxt dev`, a preview or a test. About what the redirects take.
 */
const BLIND_MS = 1500;

/** What {@link waitForDownload} reads of the page; `document` and its origin unless a test gives others. */
export interface DownloadPage {
    readonly origin: string;
    /** `document.cookie`: every cookie the page can read, `name=value` pairs joined by `; `. */
    readCookies(): string;
    /** Writes a cookie (`document.cookie = cookie`). */
    writeCookie(cookie: string): void;
}

const DOCUMENT_PAGE: DownloadPage = {
    get origin() {
        return window.location.origin;
    },
    readCookies: () => document.cookie,
    writeCookie: cookie => {
        document.cookie = cookie;
    },
};

/**
 * Resolves once the download behind `url`, a link to githq.dev's `/download/<build>` the visitor just followed, has
 * been handed to GitHub: the Worker's redirect to the installer sets {@link DESKTOP_DOWNLOAD_COOKIE}. A button returns
 * it from its `click` listener to spin until then (`useButton`); the browser shows the download from there on. The
 * browser itself tells a page nothing of a download, hence the cookie.
 */
export function waitForDownload(url: string, page: DownloadPage = DOCUMENT_PAGE): Promise<void> {
    if (new URL(url).origin !== page.origin) {
        return new Promise(resolve => {
            setTimeout(resolve, BLIND_MS);
        });
    }

    const { name, value } = DESKTOP_DOWNLOAD_COOKIE;
    const clear = () => page.writeCookie(`${name}=; Path=/; Max-Age=0`);
    // One left by an earlier download would end this one's wait at once.
    clear();

    return new Promise(resolve => {
        const started = Date.now();
        const timer = setInterval(() => {
            const handedOff = page
                .readCookies()
                .split(';')
                .some(pair => pair.trim() === `${name}=${value}`);
            if (handedOff || Date.now() - started >= LONGEST_MS) {
                clearInterval(timer);
                clear();
                resolve();
            }
        }, POLL_MS);
    });
}
