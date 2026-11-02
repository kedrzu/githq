import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, h, shallowRef } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import type { SelectionSpan } from './getSelectionSpan.js';
import SelectionActions from './SelectionActions.vue';

const PULL_REQUESTS = Array.from({ length: 9 }, (_, index) => samplePullRequest(`PR_${index + 1}`));

test('SP28: with stacks among them, the bar counts the pull requests and the entries and rows they span', async () => {
    const view = await mount(PULL_REQUESTS, { entries: 3, rows: 1 });
    const toolbar = page.getByRole('toolbar', { name: 'Selected items' });

    await expect.element(toolbar).toHaveTextContent('9 pull requests selected, in 3 entries and 1 row');
    // The command menu's chip counts pull requests too: edits apply to them.
    expect(view.registry.subject?.label).toBe('9 pull requests');

    // Every one in entries: no rows to name.
    view.span.value = { entries: 1, rows: 0 };
    await expect.element(toolbar).toHaveTextContent('9 pull requests selected, in 1 entry');
});

test('with an issue among them they are items; without a stack the count stands alone', async () => {
    const view = await mount([...PULL_REQUESTS.slice(0, 3), sampleIssue('I_1')], { entries: 1, rows: 1 });
    const toolbar = page.getByRole('toolbar', { name: 'Selected items' });

    await expect.element(toolbar).toHaveTextContent('4 items selected, in 1 entry and 1 row');
    expect(view.registry.subject?.label).toBe('4 items');

    view.span.value = { entries: 0, rows: 4 };
    await expect.element(toolbar).toHaveTextContent(/^4 selected/);
});

/** The bar over `items`, all selected, spanning `span` in the list. */
async function mount(items: readonly Item[], initial: SelectionSpan) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    // Nothing reaches GitHub: the pickers' options stay loading.
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany(items);

    const span = shallowRef(initial);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
        setup: () => () => h(SelectionActions, { ids: items.map(item => item.id), span: span.value }),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { span, registry: container.resolve(CommandRegistry) };
}
