import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { MergeContext } from '@/merge/MergeContext.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';

/** Approved, every check passed: "approved · ready to merge". */
const READY = findPullRequest('PR_477');

test('ready to merge, a pull request the viewer may merge is followed by "Merge ⇧M", which opens the merge panel', async () => {
    const opened: string[] = [];
    mount(READY, { canMerge: id => id === READY.id, open: id => opened.push(id) });

    const merge = page.getByRole('button', { name: /^Merge/ });
    await expect.element(merge).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).not.toBeInTheDocument();
    await userEvent.click(merge);
    expect(opened).toEqual([READY.id]);
});

test('ready to merge, one the viewer may not merge is followed by "Open on GitHub O"', async () => {
    mount(READY, { canMerge: () => false, open: () => undefined });

    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).toHaveAttribute('aria-keyshortcuts', 'O');
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

test('PM37: being merged, the row says so where the status sits and keeps the open icon — never merged until GitHub says so', async () => {
    mount({ ...READY, merging: true }, { canMerge: () => false, open: () => undefined });

    await expect.element(page.getByText('Being merged')).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).not.toBeInTheDocument();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();

    // Merged: purple, as a merged row reads.
    mount({ ...READY, merged: true, state: 'MERGED' }, null);
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).toBeVisible();
});

/** The row of `item`, every property shown, under the screen's merging (none for `null`). */
function mount(item: Item, merging: MergeContext | null) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
        setup: () => {
            if (merging) {
                provideContext(MergeContext, merging);
            }

            return () =>
                h(ItemRow, { item, properties: ITEM_PROPERTIES, viewerLogin: SAMPLE_VIEWER.login, now: SAMPLE_NOW });
        },
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
}

function findPullRequest(id: string): PullRequestItem {
    const item = assertValue(D1_ITEMS.find(candidate => candidate.id === id));
    if (item.kind !== 'pullRequest') {
        throw new Error(`${id} is not a pull request`);
    }

    return item;
}
