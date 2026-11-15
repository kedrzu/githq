import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { SAMPLE_WORKFLOW_ITEMS } from '@/testing/sampleWorkflowItems.js';

import * as stories from './WorkflowView.stories.js';

const { FullScreen, InPanel, NarrowDetails, NarrowFiltered } = composeStories(stories);

const DETAILS_WIDTH_KEY = 'githq.panelWidth.workflowDetails';
const RUNS = SAMPLE_WORKFLOW_ITEMS.deploy.runs.runs;
const details = page.getByRole('region', { name: 'Details' });
const edge = page.getByRole('separator', { name: 'Resize the details' });

beforeEach(async () => {
    window.localStorage.removeItem(DETAILS_WIDTH_KEY);
    await page.viewport(1600, 900);
});

test('two columns: the details at the right, 400 px by default, their edge moving them from 320 to 640 px, kept on the device', async () => {
    await FullScreen.run();
    await expect.poll(columnWidth).toBe(400);
    edge.element().focus();

    // Each press moves a tenth of the 1,400 px split; the column is on the right, so → narrows it.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await expect.poll(columnWidth).toBe(640);
    await expect.poll(() => window.localStorage.getItem(DETAILS_WIDTH_KEY)).toBe('640');

    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    await expect.poll(columnWidth).toBe(320);
    await expect.poll(() => window.localStorage.getItem(DETAILS_WIDTH_KEY)).toBe('320');
});

test('narrower than two columns, the tabs: the one chosen is carried over to the next workflow opened', async () => {
    await NarrowFiltered.run();
    await userEvent.click(page.getByRole('button', { name: 'Details' }));
    await expect.element(details).toBeVisible();

    // Another workflow opens, in a view of its own: still on Details.
    await NarrowDetails.run({ args: { ...NarrowDetails.args, offerRun: false } });
    await expect.element(page.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(details).toBeVisible();
    await expect.element(page.getByRole('region', { name: 'Runs' })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: /^Runs/u }));
    await expect.element(page.getByRole('region', { name: 'Runs' })).toBeVisible();
});

test('full screen: j/k walk the runs and Enter opens the selected one, ⇧J/⇧K step to the next workflow, F opens the latest failure', async () => {
    await FullScreen.run();
    const { onOpenRun, onNext, onPrevious } = FullScreen.args;

    await userEvent.keyboard('jjk');
    await userEvent.keyboard('{Enter}');
    expect(onOpenRun).toHaveBeenLastCalledWith(RUNS[1]);

    await userEvent.keyboard('{Shift>}J{/Shift}');
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Shift>}K{/Shift}');
    expect(onPrevious).toHaveBeenCalledTimes(1);
    // ⇧J moved no run.
    await userEvent.keyboard('{Enter}');
    expect(onOpenRun).toHaveBeenLastCalledWith(RUNS[1]);

    await userEvent.keyboard('f');
    expect(onOpenRun).toHaveBeenLastCalledWith(RUNS.find(run => run.conclusion === 'failure'));
});

test('in the panel the list beside it keeps j/k and Enter: no run is selected or opened, and F is the list’s', async () => {
    await InPanel.run();
    const { onOpenRun, onNext } = InPanel.args;

    await userEvent.keyboard('jj');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('f');
    expect(onOpenRun).not.toHaveBeenCalled();
    expect(document.querySelector('[data-run-key][aria-current]')).toBeNull();

    // ⇧J still steps to the next workflow.
    await userEvent.keyboard('{Shift>}J{/Shift}');
    expect(onNext).toHaveBeenCalledTimes(1);
});

/** The details' column's width: the splitter's panel around them. */
function columnWidth() {
    return details.element().parentElement?.parentElement?.getBoundingClientRect().width;
}
