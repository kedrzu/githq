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
import type { MergeRecord, SentMerge } from '@/merge/MergeTypes.js';
import type { Item, PullRequestItem } from '@/store/ItemTypes.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { ITEM_PROPERTIES } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';

/** Approved, every check passed: "approved · ready to merge". */
const READY = findPullRequest('PR_477');
/** A merge sent from the panel, with GitHub's text. */
const SENT: SentMerge = { request: { method: 'SQUASH' }, edited: null, head: 'head-oid' };

test('ready to merge, a pull request the viewer may merge is followed by "Merge ⇧M", which opens the merge panel', async () => {
    const opened: string[] = [];
    mount(READY, { canOpen: id => id === READY.id, open: id => opened.push(id), getRecord: () => null });

    const merge = page.getByRole('button', { name: /^Merge/ });
    await expect.element(merge).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).not.toBeInTheDocument();
    await userEvent.click(merge);
    expect(opened).toEqual([READY.id]);
});

test('ready to merge, one the viewer may not merge is followed by "Open on GitHub O"', async () => {
    mount(READY, { canOpen: () => false, open: () => undefined, getRecord: () => null });

    await expect.element(page.getByRole('link', { name: /Open on GitHub/ })).toHaveAttribute('aria-keyshortcuts', 'O');
    await expect.element(page.getByRole('button', { name: /^Merge/ })).not.toBeInTheDocument();
});

test('PM37: being merged, the row says so where the status sits and keeps the open icon — never merged until GitHub says so', async () => {
    mount({ ...READY, merging: 'SQUASH' }, { canOpen: () => false, open: () => undefined, getRecord: () => null });

    await expect.element(page.getByText('Being merged · not merged yet')).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).not.toBeInTheDocument();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();

    // Merged: purple, as a merged row reads, and since when.
    const closedAt = new Date(SAMPLE_NOW - 5 * 60_000).toISOString();
    mount({ ...READY, merged: true, state: 'MERGED', closedAt }, null);
    await expect.element(page.getByRole('img', { name: 'Merged pull request' })).toBeVisible();
    await expect.element(page.getByText('Merged · 5m')).toBeVisible();
});

test('PM37: a merge refused says so on line two, followed by "Back to the merge ⇧M" for the row\'s own pull request', async () => {
    const opened: string[] = [];
    const record: MergeRecord = { kind: 'refused', sent: SENT, reason: { kind: 'refused', message: 'Rules.' } };
    mount(READY, { canOpen: () => true, open: id => opened.push(id), getRecord: () => record });

    await expect.element(page.getByText('Merge refused')).toBeVisible();
    await expect.element(page.getByText('approved · ready to merge')).not.toBeInTheDocument();
    const back = page.getByRole('button', { name: /^Back to the merge/ });
    await expect.element(back).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    await userEvent.click(back);
    expect(opened).toEqual([READY.id]);
});

test('PM37: refused for a new commit, the row says nothing merged and who pushed it', async () => {
    const commit = { oid: 'new-head', headline: 'Handle an empty answer', author: 'dkim' };
    const record: MergeRecord = { kind: 'headMoved', sent: SENT, head: 'new-head', commit };
    mount(READY, { canOpen: () => true, open: () => undefined, getRecord: () => record });

    await expect.element(page.getByText('Not merged · new commit from dkim')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Back to the merge/ })).toBeVisible();
});

test('PM36, PM37: no answer in time, the row is grey — neither merged nor refused — with nothing to send again', async () => {
    const record: MergeRecord = { kind: 'unknown', sent: SENT };
    mount(READY, { canOpen: () => true, open: () => undefined, getRecord: () => record });

    await expect.element(page.getByText('Merge sent · outcome not known yet')).toBeVisible();
    await expect.element(page.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /merge/i })).not.toBeInTheDocument();
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
