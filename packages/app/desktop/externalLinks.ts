import type { BrowserShape } from '@/services/Browser.js';

/** Where the desktop app's pages outside the app go. */
export interface ExternalLinksOptions {
    /** An address of the app (`location.href`): an address on another host, or another scheme, leaves it. */
    readonly appUrl: string;
    /** Opens a web page outside the app — in the system browser. */
    open(url: string): void;
}

/**
 * The browser of the desktop app's one window: leaving the app for a page outside it, or opening one beside it, opens
 * that page with `open` instead, and the app stays where it is. The app's own addresses go the usual way.
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
 * Opens with `open` the web pages outside the app that links under `root` lead to — `target="_blank"` or not, a
 * primary or a middle click, whatever modifier is held: a page outside the app has nowhere else to open, as the
 * app's window never leaves the app. Links within the app, and to anything but a web page (`mailto:`), are left
 * alone, as is a click something has already handled.
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

/** Opens `url` with `open` when it is a web page outside the app; whether it did. */
function openIfExternal(url: string, options: ExternalLinksOptions) {
    const app = new URL(options.appUrl);
    const target = new URL(url, app);
    const external =
        (target.protocol === 'https:' || target.protocol === 'http:') &&
        (target.protocol !== app.protocol || target.host !== app.host);
    if (external) {
        options.open(target.href);
    }

    return external;
}
