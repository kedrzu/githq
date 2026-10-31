import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import type { PromiseWrapper } from '@nzyme/utils/createPromise.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { TokenVault } from '@/auth/TokenVault.js';
import type { TokenVaultShape } from '@/auth/TokenVault.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';

import DesktopSignInPage from './DesktopSignInPage.vue';
import type { DeviceCode, DeviceGrant } from './NativeBridge.js';
import { NativeBridge } from './NativeBridge.js';

const VIEWER = { login: 'octocat', name: null, avatarUrl: 'https://avatars.test/octocat' };
const CODE: DeviceCode = { userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresIn: 900 };

test('leaving the page abandons the attempt: a token approved afterwards is not accepted', async () => {
    const { leave, auth, vault, finishes } = mount();

    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    await expect.element(page.getByText(CODE.userCode)).toBeVisible();

    leave();
    finishes[0]?.resolve({ token: 'gho_octocat', scope: 'repo,project,read:org' });
    await new Promise(resolve => {
        setTimeout(resolve, 20);
    });

    expect(auth.signedIn).toBe(false);
    expect(vault.read()).toBeNull();
});

test('"Copy code and open GitHub" copies the code and opens GitHub\'s page', async () => {
    const { opened } = mount();
    // The test browser may not write to the system clipboard.
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    onTestFinished(() => copy.mockRestore());

    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    await userEvent.click(page.getByRole('button', { name: 'Copy code and open GitHub' }));

    await expect.poll(() => opened).toEqual([CODE.verificationUri]);
    expect(copy).toHaveBeenCalledWith(CODE.userCode);
});

/**
 * The page in an app of its own, signed out, with the native side faked and a GitHub that names the owner of any
 * token; the token is kept in memory and pages opened beside the app are only recorded.
 */
function mount() {
    const finishes: PromiseWrapper<DeviceGrant>[] = [];
    const opened: string[] = [];
    const stored = new Map<string, string>();
    let token: string | null = null;

    const container = createContainer();
    const browser: BrowserShape = {
        ...createContainer().resolve(Browser),
        fetch: () => Promise.resolve(Response.json({ data: { viewer: VIEWER } })),
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem: (key, value) => {
                stored.set(key, value);
            },
            removeItem: key => {
                stored.delete(key);
            },
            key: index => [...stored.keys()][index] ?? null,
            get length() {
                return stored.size;
            },
        },
        openInNewTab: url => {
            opened.push(url);
        },
    };
    const vault: TokenVaultShape = {
        persistent: true,
        read: () => token,
        write: value => {
            token = value;
        },
        remove: () => {
            token = null;
        },
        onChange: () => {},
    };
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, browser);
    container.set(TokenVault, vault);
    container.set(NativeBridge, {
        loadToken: () => Promise.reject(new Error('Not expected')),
        saveToken: () => Promise.reject(new Error('Not expected')),
        deleteToken: () => Promise.reject(new Error('Not expected')),
        openExternal: () => Promise.reject(new Error('Not expected')),
        startDeviceSignIn: () => Promise.resolve(CODE),
        finishDeviceSignIn: () => {
            const finish = createPromise<DeviceGrant>();
            finishes.push(finish);
            return finish.promise;
        },
    });

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(DesktopSignInPage, { signedOut: false });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(leave);

    return {
        /** Leaves the page, as navigating away does. */
        leave,
        finishes,
        opened,
        auth: container.resolve(AuthStore),
        vault,
    };

    function leave() {
        if (host.isConnected) {
            app.unmount();
            host.remove();
        }
    }
}
