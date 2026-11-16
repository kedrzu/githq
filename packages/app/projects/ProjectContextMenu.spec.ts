import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import Menu from '@/components/Menu.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT } from '@/testing/sampleProject.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import ProjectContextMenu from './ProjectContextMenu.vue';
import { ProjectStore } from './ProjectStore.js';
import type { Project } from './ProjectTypes.js';

/** Platform Q4 with ten saved views: the tenth has no key. */
const TEN_VIEWS: Project = {
    ...SAMPLE_PROJECT,
    views: Array.from({ length: 10 }, (_, index) => ({
        ...SAMPLE_VIEW_SPRINT,
        id: `PVTV_${index + 1}`,
        number: index + 1,
        name: `View ${index + 1}`,
    })),
};

test("the open project's menu lists its saved views on 1–9, the tenth without a key, the one shown checked, and no Open", async () => {
    await mount({ current: true, shownView: 'PVTV_2' });

    for (let number = 1; number <= 9; number++) {
        await expect
            .element(page.getByRole('menuitem', { name: `View ${number}`, exact: true }))
            .toHaveAttribute('aria-keyshortcuts', String(number));
    }
    await expect.element(page.getByRole('menuitem', { name: 'View 10' })).not.toHaveAttribute('aria-keyshortcuts');
    await expect.element(page.getByRole('menuitem', { name: 'View 2', exact: true })).toHaveAttribute('aria-current');
    await expect
        .element(page.getByRole('menuitem', { name: 'View 1', exact: true }))
        .not.toHaveAttribute('aria-current');
    await expect.element(page.getByRole('menuitem', { name: 'Open', exact: true })).not.toBeInTheDocument();
});

test("another project's menu shows no keys on its saved views, and picking one goes to it", async () => {
    const router = await mount({ current: false, shownView: null });

    for (let number = 1; number <= 10; number++) {
        await expect
            .element(page.getByRole('menuitem', { name: `View ${number}`, exact: true }))
            .not.toHaveAttribute('aria-keyshortcuts');
    }
    await userEvent.click(page.getByRole('menuitem', { name: 'View 3', exact: true }));
    await expect.poll(() => router.currentRoute.value.path).toBe('/orgs/skyline-labs/projects/2/views/3');
});

interface MountOptions {
    readonly current: boolean;
    readonly shownView: string | null;
}

/** The menu of {@link TEN_VIEWS}, tracked and read, opened. */
async function mount({ current, shownView }: MountOptions) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(PhoneLayout, createFixedPhoneLayout(false));
    // Signed in: the tracking is kept for a user.
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    tracking.track({ project: TEN_VIEWS });
    container.resolve(ProjectStore).setProject(TEN_VIEWS);

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
        defineComponent({
            render: () =>
                h(
                    Menu,
                    { label: 'Project' },
                    {
                        trigger: () => h('button', { type: 'button' }, 'Menu'),
                        default: () => h(ProjectContextMenu, { projectId: TEN_VIEWS.id, current, shownView }),
                    },
                ),
        }),
    );
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    await userEvent.click(page.getByRole('button', { name: 'Menu' }));
    return router;
}
