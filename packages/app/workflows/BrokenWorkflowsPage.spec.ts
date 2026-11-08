import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { sampleStoredWorkflows } from '@/testing/sampleWorkflows.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import BrokenWorkflowsPage from './BrokenWorkflowsPage.vue';
import { WorkflowStore } from './WorkflowStore.js';

const WEB = 'acme/web';

test('opening the screen polls the workflows at once', async () => {
    const { poll } = await open();

    expect(poll).toHaveBeenCalledTimes(1);
});

test("Enter opens the selected workflow's latest failed run on its page in githq", async () => {
    const { store, router } = await open();
    const stored = sampleStoredWorkflows({
        nameWithOwner: WEB,
        workflows: [{ id: 7, name: 'Deploy', runs: [{ conclusion: 'failure', ago: '3h' }] }],
    });
    store.set(assertValue(stored));

    await expect.element(page.getByRole('button', { name: 'Deploy' })).toBeVisible();
    await userEvent.keyboard('{Enter}');

    await expect.poll(() => router.currentRoute.value.path).toBe(`/${WEB}/actions/runs/7001`);
});

/** The screen, tracking one repository, signed in, with GitHub answering nothing and no timer going off. */
async function open() {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Clock, {
        now: () => Date.now(),
        schedule: () => () => {},
    });
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    tracking.choose({ repositories: [{ nameWithOwner: WEB, id: 'R_web' }], projects: [] });
    const store = container.resolve(WorkflowStore);
    await store.ready();
    const sync = container.resolve(SyncEngine);
    const poll = vi.spyOn(sync, 'pollNow').mockImplementation(() => Promise.resolve());

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ setup: () => () => h(BrokenWorkflowsPage) });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
    });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { store, poll, router };
}
