import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import Menu from '@/components/Menu.vue';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import RepositoryContextMenu from './RepositoryContextMenu.vue';

const WEB = 'acme/web';

test('a tracked repository offers its sections, with no "Open", and their keys 1–4 only as the open repository', async () => {
    await mount({ tracked: true, current: true });

    const sections = ['Issues', 'Pull requests', 'Commits', 'Workflows'];
    await expect.element(page.getByRole('menuitem', { name: 'Open', exact: true })).not.toBeInTheDocument();
    for (const [index, name] of sections.entries()) {
        await expect
            .element(page.getByRole('menuitem', { name }))
            .toHaveAttribute('aria-keyshortcuts', String(index + 1));
    }
});

test("another repository's menu shows no keys, and an untracked one no Workflows", async () => {
    await mount({ tracked: false, current: false });

    for (const name of ['Issues', 'Pull requests', 'Commits']) {
        await expect.element(page.getByRole('menuitem', { name })).not.toHaveAttribute('aria-keyshortcuts');
    }
    await expect.element(page.getByRole('menuitem', { name: 'Workflows' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('menuitem', { name: 'Commits' })).toBeVisible();
});

interface MountOptions {
    readonly tracked: boolean;
    readonly current: boolean;
}

/** The menu opened, over a real tracking store. */
async function mount({ tracked, current }: MountOptions) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(PhoneLayout, createFixedPhoneLayout(false));
    // Signed in: the tracking is kept for a user.
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    if (tracked) {
        tracking.choose({ repositories: [{ nameWithOwner: WEB, id: 'R_web' }], projects: [] });
    }

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
        defineComponent({
            render: () =>
                h(
                    Menu,
                    { label: 'Repository' },
                    {
                        trigger: () => h('button', { type: 'button' }, 'Menu'),
                        default: () => h(RepositoryContextMenu, { nameWithOwner: WEB, current }),
                    },
                ),
        }),
    );
    app.use(IocPlugin, { container });
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
        }),
    );
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    await userEvent.click(page.getByRole('button', { name: 'Menu' }));
}
