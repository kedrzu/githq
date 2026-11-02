import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import * as stories from './StackMap.stories.js';

const { ModalTen, PanelFolded, PanelTen, PanelTwo } = composeStories(stories);

/** The rows' buttons, top to bottom, by their accessible names. */
function getRowNames() {
    const list = page.getByRole('list', { name: 'Pull requests of the stack' }).element();
    return [...list.querySelectorAll('button')].map(button => button.textContent.replace(/\s+/gu, ' ').trim());
}

test('SP30: a stack of two shows both rows, this one marked, K on the one before, and what stops the stack', async () => {
    await PanelTwo.run();

    await expect.element(page.getByText('Draw the key glyphs', { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText('2 of 2')).toBeVisible();
    const current = page.getByRole('button', { name: /#41/u });
    await expect.element(current).toHaveAttribute('aria-current', 'true');
    await expect.element(current).toHaveTextContent('Waiting for review');
    await expect.element(page.getByRole('button', { name: /#36/u })).toHaveAttribute('aria-keyshortcuts', 'K');
    await expect.element(page.getByText('Ready', { exact: true })).toBeVisible();
    await expect.element(page.getByText('#41 is waiting for review')).toBeVisible();
});

test('SP31: a stack of ten in a panel shows a window of six lines, the rest folded into lines saying what they hold', async () => {
    await PanelTen.run();

    expect(getRowNames().map(name => name.slice(0, 3))).toEqual(['#64', '#65', '#66', '#67']);
    await expect.element(page.getByText('4 earlier · 2 landed, 2 ready')).toBeVisible();
    await expect.element(page.getByText('2 later', { exact: true })).toBeVisible();
    await expect.element(page.getByText('6 of 10')).toBeVisible();
    await expect.element(page.getByText('#65 stops 4 later from landing')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /#66/u })).toHaveAttribute('aria-keyshortcuts', 'J');
    await expect.element(page.getByRole('button', { name: /#65/u })).toHaveTextContent('2 checks failing');
});

test('SP34: in a modal the stack of ten shows whole, merged ones included, without state in words', async () => {
    await ModalTen.run();

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

test('SP32: folded, the map is one line — place, what blocks, the neighbours — and a click unfolds it', async () => {
    await PanelFolded.run();
    const { onUnfold } = PanelFolded.args;

    expect(page.getByRole('list', { name: 'Pull requests of the stack' }).query()).toBeNull();
    const strip = page.getByRole('button', { name: /^Show the stack: 6 of 10 #65 blocks 4 later/u });
    await expect.element(strip).toHaveTextContent(/#64.*K.*J.*#66/u);

    await strip.click();
    expect(onUnfold).toHaveBeenCalledTimes(1);
});
