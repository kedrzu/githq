import type { BrowserShape } from '@/services/Browser.js';

/** Where the desktop app's pages outside the app go. */
export interface ExternalLinksOptions {
    /** An address of the app (`location.href`): an address on another host, or another scheme, leaves it. */
    readonly appUrl: string;
    /** Opens a web page outside the app — in the system browser. */
    open(url: string): void;
    /**
     * Opens an address of the app itself — the path, query and hash of a githq.dev page (`/acme/web/issues/12?x=1#c`) —
     * in the window, through the app's router.
     */
    openInApp(address: string): void;
}

/** The hosts of githq's own pages on the web: the desktop app shows them itself, but for the docs. */
const GITHQ_HOSTS: readonly string[] = ['githq.dev', 'www.githq.dev'];

/** The docs on githq.dev (`/docs`, `/docs/…`): a site of their own, not in the desktop app, so the system browser's. */
const DOCS_PATH = /^\/docs(?:\/|$)/u;

/**
 * The browser of the desktop app's one window: leaving the app for a page outside it, or opening one beside it, opens
 * that page with `open` instead, and the app stays where it is. A githq.dev page is the app's own: it opens in the
 * window with `openInApp` — but for the docs (`/docs/…`), which are not in the app and go with `open`. The app's own
 * addresses go the usual way.
 */
export function withExternalLinks(browser: BrowserShape, options: ExternalLinksOptions): BrowserShape {
    return {
        ...browser,
        navigate: url => {
            if (!openIfExternal(url, options)) {
                browser.navigate(url);
            }
        },
        replaceLocation: url => {
            if (!openIfExternal(url, options)) {
                browser.replaceLocation(url);
            }
        },
        openInNewTab: url => {
            if (!openIfExternal(url, options)) {
                browser.openInNewTab(url);
            }
        },
    };
}

/**
 * Opens with `open` (a githq.dev page with `openInApp`, but for the docs) the web pages outside the app that links
 * under `root` lead to — `target="_blank"` or not, a primary or a middle click, whatever modifier is held: a page
 * outside the app has nowhere else to open, as the app's window never leaves the app. Links within the app, and to
 * anything but a web page (`mailto:`), are left alone, as is a click something has already handled.
 */
export function interceptExternalLinks(root: EventTarget, options: ExternalLinksOptions) {
    // Capturing: before any handler of the link itself, so none can let the window follow it.
    root.addEventListener('click', onClick, { capture: true });
    root.addEventListener('auxclick', onClick, { capture: true });

    function onClick(event: Event) {
        if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button > 1) {
            return;
        }

        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (link instanceof HTMLAnchorElement && openIfExternal(link.href, options)) {
            event.preventDefault();
        }
    }
}

/**
 * Opens `url` with `open`, or `openInApp` for a githq.dev page other than the docs, when it is a web page outside the
 * app; whether it did.
 */
function openIfExternal(url: string, options: ExternalLinksOptions) {
    const app = new URL(options.appUrl);
    const target = new URL(url, app);
    if (target.protocol === 'https:' && GITHQ_HOSTS.includes(target.hostname) && !DOCS_PATH.test(target.pathname)) {
        options.openInApp(`${target.pathname}${target.search}${target.hash}`);
        return true;
    }

    const external =
        (target.protocol === 'https:' || target.protocol === 'http:') &&
        (target.protocol !== app.protocol || target.host !== app.host);
    if (external) {
        options.open(target.href);
    }

    return external;
}
