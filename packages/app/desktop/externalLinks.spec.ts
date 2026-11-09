import { createContainer } from '@nzyme/ioc/Container.js';
import { expect, onTestFinished, test } from 'vitest';

import type { BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';

import { interceptExternalLinks, withExternalLinks } from './externalLinks.js';
import type { ExternalLinksOptions } from './externalLinks.js';

// The desktop app's window on macOS (`tauri://localhost`); in-app addresses are those of its host and scheme.
const APP_URL = 'tauri://localhost/my-work';

test('leaving the app or opening a page beside it opens a page outside the app in the system browser; the app keeps its route', () => {
    const { browser, opened, inApp } = setupBrowser();

    browser.navigate('https://github.com/login/device');
    browser.replaceLocation('https://github.com/acme');
    browser.openInNewTab('https://github.com/acme/portal/pull/7/files');

    expect(opened).toEqual([
        'https://github.com/login/device',
        'https://github.com/acme',
        'https://github.com/acme/portal/pull/7/files',
    ]);
    expect(inApp).toEqual([]);
});

test("the app's own addresses go the usual way", () => {
    const { browser, opened, inApp } = setupBrowser();

    browser.navigate('/api/auth/authorize?state=abc');
    browser.replaceLocation('tauri://localhost/sign-in');
    browser.openInNewTab('/acme/portal/issues/1');

    expect(opened).toEqual([]);
    expect(inApp).toEqual([
        'navigate /api/auth/authorize?state=abc',
        'replaceLocation tauri://localhost/sign-in',
        'openInNewTab /acme/portal/issues/1',
    ]);
});

test('a click on a link leaving the app opens it in the system browser — new tab or not, any modifier, a middle click — and the window stays', () => {
    const { root, opened, clicks } = setupLinks();
    const blank = addLink(root, 'https://github.com/octocat', '_blank');
    const plain = addLink(root, 'https://docs.github.com/');
    const http = addLink(root, 'http://example.com/');
    const inner = document.createElement('span');
    inner.textContent = 'nested';
    addLink(root, 'https://github.com/acme').append(inner);

    blank.click();
    plain.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    http.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    inner.click();

    expect(opened).toEqual([
        'https://github.com/octocat',
        'https://docs.github.com/',
        'http://example.com/',
        'https://github.com/acme',
    ]);
    // Every one of them kept from the window.
    expect(clicks).toEqual([true, true, true, true]);
});

test('a githq.dev address — navigated to, replaced or opened beside — opens in the app by its path, query and hash, not in the system browser', () => {
    const { browser, opened, inApp, inAppLinks } = setupBrowser();

    browser.navigate('https://githq.dev/acme/web/issues/12');
    browser.replaceLocation('https://www.githq.dev/acme/web/pull/7/files?x=1#diff');
    browser.openInNewTab('https://githq.dev/');
    // Not githq's page: another host, a look-alike, or not https.
    browser.navigate('https://githq.dev.example.com/acme');
    browser.navigate('http://githq.dev/acme');

    expect(inAppLinks).toEqual(['/acme/web/issues/12', '/acme/web/pull/7/files?x=1#diff', '/']);
    expect(opened).toEqual(['https://githq.dev.example.com/acme', 'http://githq.dev/acme']);
    expect(inApp).toEqual([]);
});

test('a click on a githq.dev link opens it in the app and keeps it from the window', () => {
    const { root, opened, clicks, inApp } = setupLinks();
    const link = addLink(root, 'https://githq.dev/acme/web/issues/12?tab=1#top', '_blank');

    link.click();

    expect(inApp).toEqual(['/acme/web/issues/12?tab=1#top']);
    expect(opened).toEqual([]);
    expect(clicks).toEqual([true]);
});

test('the docs on githq.dev — navigated to, replaced or opened beside — open in the system browser, not in the app', () => {
    const { browser, opened, inApp, inAppLinks } = setupBrowser();

    browser.openInNewTab('https://githq.dev/docs/');
    browser.navigate('https://githq.dev/docs');
    browser.replaceLocation('https://www.githq.dev/docs/getting-started/sign-in.html?x=1#token');
    // Only the docs: a path that merely starts the same is the app's.
    browser.navigate('https://githq.dev/docsy/web/issues/1');

    expect(opened).toEqual([
        'https://githq.dev/docs/',
        'https://githq.dev/docs',
        'https://www.githq.dev/docs/getting-started/sign-in.html?x=1#token',
    ]);
    expect(inAppLinks).toEqual(['/docsy/web/issues/1']);
    expect(inApp).toEqual([]);
});

test('a click on a link to the docs on githq.dev opens it in the system browser and keeps it from the window', () => {
    const { root, opened, clicks, inApp } = setupLinks();
    const link = addLink(root, 'https://githq.dev/docs/using-githq/');

    link.click();

    expect(opened).toEqual(['https://githq.dev/docs/using-githq/']);
    expect(inApp).toEqual([]);
    expect(clicks).toEqual([true]);
});

test('links within the app, to anything but a web page, a right click and a click already handled are left alone', () => {
    const { root, opened, clicks } = setupLinks();
    const inApp = addLink(root, '/acme/portal/issues/1');
    const mail = addLink(root, 'mailto:octocat@example.com');
    const external = addLink(root, 'https://github.com/octocat');
    const handled = addLink(root, 'https://github.com/hubot');
    // Handled on its way down, before the interceptor sees it.
    const handle = (event: Event) => {
        if (event.target === handled) {
            event.preventDefault();
        }
    };
    document.body.addEventListener('click', handle, { capture: true });
    onTestFinished(() => document.body.removeEventListener('click', handle, { capture: true }));

    inApp.click();
    mail.click();
    external.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 2 }));
    handled.click();

    expect(opened).toEqual([]);
    // Nothing kept from the window by the interceptor; the handled click by its handler.
    expect(clicks).toEqual([false, false, false, true]);
});

function setupBrowser() {
    const opened: string[] = [];
    const inApp: string[] = [];
    const real = createContainer().resolve(Browser);
    const underlying: BrowserShape = {
        ...real,
        navigate: url => inApp.push(`navigate ${url}`),
        replaceLocation: url => inApp.push(`replaceLocation ${url}`),
        openInNewTab: url => inApp.push(`openInNewTab ${url}`),
    };
    const inAppLinks: string[] = [];
    const browser = withExternalLinks(underlying, {
        appUrl: APP_URL,
        open: url => opened.push(url),
        openInApp: address => inAppLinks.push(address),
    });
    return { browser, opened, inApp, inAppLinks };
}

/**
 * A part of the page whose links leaving the app are intercepted. What every click left of the link is recorded —
 * whether it was kept from the window — and then the click is stopped, so the test page never goes anywhere.
 */
function setupLinks() {
    const opened: string[] = [];
    const clicks: boolean[] = [];
    const root = document.createElement('div');
    document.body.append(root);
    onTestFinished(() => root.remove());

    // The test page stands for the app: its links resolve against it, as the app's resolve against the window's.
    const inApp: string[] = [];
    const options: ExternalLinksOptions = {
        appUrl: window.location.href,
        open: url => opened.push(url),
        openInApp: address => inApp.push(address),
    };
    interceptExternalLinks(root, options);
    for (const type of ['click', 'auxclick']) {
        root.addEventListener(type, event => {
            clicks.push(event.defaultPrevented);
            event.preventDefault();
        });
    }

    return { root, opened, clicks, inApp };
}

function addLink(root: HTMLElement, href: string, target?: string) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = href;
    if (target !== undefined) {
        link.target = target;
    }

    root.append(link);
    return link;
}
