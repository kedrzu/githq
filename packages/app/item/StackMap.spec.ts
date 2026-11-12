import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import * as stories from './StackMap.stories.js';

const { PageTen, PagePartlyRead, PanelBeingMerged, PanelLastOpen, PanelReviewRequested, PanelTen, PanelTwo } =
    composeStories(stories);

/** The rows' buttons, top to bottom, by their accessible names. */
function getRowNames() {
    const list = page.getByRole('list', { name: 'Pull requests of the stack' }).element();
    return [...list.querySelectorAll('button')].map(button => button.textContent.replace(/\s+/gu, ' ').trim());
}

test('SP30: a stack of two shows both rows, this one marked, K on the one before, and what stops the stack', async () => {
    await PanelTwo.run();

    await expect.element(page.getByText('Draw the key glyphs', { exact: true }).first()).toBeVisible();
    // In a panel the stack bar names the stack and shows the places.
    expect(page.getByText('2 of 2').query()).toBeNull();
    const current = page.getByRole('button', { name: /#41/u });
    await expect.element(current).toHaveAttribute('aria-current', 'true');
    await expect.element(current).toHaveTextContent('Waiting for review');
    await expect.element(page.getByRole('button', { name: /#36/u })).toHaveAttribute('aria-keyshortcuts', 'K');
    await expect.element(page.getByText('Ready', { exact: true })).toBeVisible();
    await expect.element(page.getByText('#41 is waiting for review')).toBeVisible();
});

test('D25: a stack of ten in a panel shows every row, none folded, K and J right after the titles and the state at the far end', async () => {
    await PanelTen.run();

    expect(getRowNames().map(name => name.slice(0, 3))).toEqual(SYNC_ENGINE_STACK.map(pr => `#${pr.number}`));
    expect(document.body.textContent).not.toContain('earlier');
    await expect.element(page.getByText('#65 stops 4 later from landing')).toBeVisible();
    const next = page.getByRole('button', { name: /#66/u });
    await expect.element(next).toHaveAttribute('aria-keyshortcuts', 'J');
    await expect.element(page.getByRole('button', { name: /#64/u })).toHaveAttribute('aria-keyshortcuts', 'K');
    await expect.element(page.getByRole('button', { name: /#65/u })).toHaveTextContent('2 checks failing');

    // The key follows the title, the state ends the row.
    const row = next.element();
    const title = [...row.querySelectorAll('span')].find(span => span.textContent === SYNC_ENGINE_STACK[6]!.title);
    const key = row.querySelector('kbd');
    if (!title || !key) {
        throw new Error('The row has no title or no key.');
    }

    const [first, last] = [key.getBoundingClientRect(), title.getBoundingClientRect()];
    expect(first.left - last.right).toBeLessThan(16);
    expect(row.textContent.trim().endsWith('Waiting for review')).toBe(true);
});

test('SP36: on a page the stack of ten shows whole, merged ones included, without state in words', async () => {
    await PageTen.run();

    expect(getRowNames().map(name => name.slice(0, 3))).toEqual(SYNC_ENGINE_STACK.map(pr => `#${pr.number}`));
    expect(document.body.textContent).not.toContain('earlier');
    expect(document.body.textContent).not.toContain('Waiting for review');
});

test('a click on a row opens its pull request; one on the open one does nothing', async () => {
    await PanelTen.run();
    const { onOpen } = PanelTen.args;

    await page.getByRole('button', { name: /#66/u }).click();
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(SYNC_ENGINE_STACK[6]!.id);

    await page.getByRole('button', { name: /#65/u }).click();
    expect(onOpen).toHaveBeenCalledTimes(1);
});

test('a stack with one open pull request left reads "Ready"', async () => {
    await PanelLastOpen.run();

    await expect.element(page.getByText('Ready', { exact: true }).last()).toBeVisible();
    expect(document.body.textContent).not.toContain('All 1 ready');
});

test('while the copy is incomplete a merged row shows the merged icon, an open one the pale one', async () => {
    await PagePartlyRead.run();

    await expect.element(page.getByText('Still reading this stack')).toBeVisible();
    const merged = page.getByRole('button', { name: /#80/u }).element();
    const open = page.getByRole('button', { name: /#81/u }).element();
    expect(merged.querySelector('[class*="lucide-git-merge"]')).not.toBeNull();
    expect(open.querySelector('[class*="lucide-git-merge"]')).toBeNull();
});

test("on someone else's stack asking the viewer's review the map says what stops it, not the review", async () => {
    await PanelReviewRequested.run();

    await expect.element(page.getByText('#531 is waiting for review')).toBeVisible();
    expect(document.body.textContent).not.toContain('Your review on');
});

test('SP7: while the stack is being merged every row going says so, none reads merged, and the map says stacks take longer', async () => {
    await PanelBeingMerged.run();

    await expect.element(page.getByRole('button', { name: /#36/u })).toHaveTextContent('Being merged');
    await expect.element(page.getByRole('button', { name: /#41/u })).toHaveTextContent('Being merged');
    await expect.element(page.getByText('Stacks take longer · not merged yet')).toBeVisible();
    await expect.element(page.getByText('Merged', { exact: true })).not.toBeInTheDocument();
});
