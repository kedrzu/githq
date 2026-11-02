import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './MergePanel.stack.stories.js';

const {
    BeingMerged,
    BeingRead,
    ClosedInside,
    DraftInside,
    Held,
    HeadMoved,
    Incomplete,
    LineMoved,
    NeedsRebase,
    OneGoingNewCommit,
    OneGoingRefused,
    OneGoingUnknown,
    OneLands,
    PartlyMerged,
    PartwayFailure,
    Refused,
    WholeStack,
} = composeStories(stories);

test('SP40: the panel names every pull request that lands, each with its state, before the merge; the button counts', async () => {
    await WholeStack.run();

    await expect.element(panel()).toHaveTextContent('IndexedDB store for issues and pull requests');
    expect(page.getByTestId('stack-member').elements()).toHaveLength(3);
    for (const number of [310, 311, 312]) {
        await expect.element(member(number)).toHaveTextContent('Ready');
    }

    await expect.element(panel()).toHaveTextContent('All 3 land, first to last');
    await expect.element(primary('Squash and merge all 3')).toBeVisible();
});

test('SP41: ↑ and ↓ move the line, later ones stay open, and the button counts (D18)', async () => {
    await LineMoved.run();

    await expect.element(primary('Squash and merge all 4')).toBeVisible();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect.element(page.getByText('Stops here')).toBeVisible();
    await expect.element(member(1205)).toHaveTextContent('Stays open');
    await expect.element(member(1204)).toHaveTextContent('Ready');
    await expect.element(panel()).toHaveTextContent('2 land · 2 stay open');
    await expect.element(primary('Squash and merge 2 of 4')).toBeVisible();

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(primary('Squash and merge 3 of 4')).toBeVisible();
});

test('D11: with two or more there is no commit text, and none is sent — one merge goes to the top of the range, with its head', async () => {
    await LineMoved.run();

    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(panel().element().textContent).not.toContain('Commit');
    await expect.element(panel()).toHaveTextContent('each lands under its own title');
    await userEvent.keyboard('e');
    await expect.element(page.getByRole('textbox', { name: 'Commit title' })).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('{"request":{"method":"SQUASH"},"top":1204,"head":"head-oid","going":[1203,1204]}');
});

test('SP43: exactly one going is an ordinary merge, its commit text back', async () => {
    await OneLands.run();

    await expect.element(panel()).toHaveTextContent('Only #1203 · 3 stay open');
    await expect.element(panel()).toHaveTextContent('Swap the date picker component (#1203)');
    await expect.element(primary('Squash and merge')).toBeVisible();
    await userEvent.keyboard('e');
    await userEvent.fill(page.getByRole('textbox', { name: 'Commit title' }), 'Swap the picker');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('"title":"Swap the picker"');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[1203]');
});

test('SP51: ⌘↵ works before the read arrives — the copy knows who is in the stack (D7)', async () => {
    await BeingRead.run();

    await expect.element(panel()).toHaveTextContent('Reading');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[310,311,312]');
});

test('SP56: every one going reads being merged, none merged until GitHub says so; then all merged (D3)', async () => {
    await BeingMerged.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(panel()).toHaveTextContent('Being merged, all 3');
    for (const number of [310, 311, 312]) {
        await expect.element(member(number)).toHaveTextContent('Being merged');
        await expect.element(member(number)).not.toHaveTextContent('Merged');
    }

    document.querySelector<HTMLElement>('[tid="confirm"]')?.click();
    await expect.element(panel()).toHaveTextContent('Merged, all 3');
    for (const number of [310, 311, 312]) {
        await expect.element(member(number)).toHaveTextContent('Merged');
    }
});

test('SP45: held, the line sits at the last that can land, and who holds the rest is named', async () => {
    await Held.run();

    await expect.element(panel()).toHaveTextContent('2 of 4 can land');
    await expect.element(page.getByText('Can go up to here')).toBeVisible();
    await expect.element(member(1206)).toHaveTextContent('1 check failing');
    await expect.element(member(1207)).toHaveTextContent('Blocked');
    await expect.element(primary('Squash and merge 2 of 4')).toBeVisible();
});

test('SP46: needing a rebase, ⌘↵ opens GitHub, where "Rebase stack" is (D8, D21)', async () => {
    await NeedsRebase.run();

    await expect.element(panel()).toHaveTextContent('Needs rebase');
    await expect.element(panel()).toHaveTextContent("Nothing can merge until it's done");
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('Visit: https://github.com/fitloop/mobile/pull/97');
});

test('SP48: a closed one mid-stack — those before it can land, later ones are blocked, rebuilding is on GitHub', async () => {
    await ClosedInside.run();

    await expect.element(panel()).toHaveTextContent('#490 is closed');
    await expect.element(member(490)).toHaveTextContent('Closed');
    await expect.element(member(491)).toHaveTextContent('Blocked');
    await expect.element(panel()).toHaveTextContent("isn't in githq yet");
    await expect.element(primary('Squash and merge')).toBeVisible();
});

test('SP49: a draft inside holds the rest, and marking it ready is right there', async () => {
    await DraftInside.run();

    await expect.element(panel()).toHaveTextContent('#102 is a draft');
    await page.getByRole('button', { name: 'Mark #102 ready' }).click();
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: markReady');
});

test('SP50: an incomplete copy never reads ready, and ⌘↵ does nothing (D7)', async () => {
    await Incomplete.run();

    await expect.element(panel()).toHaveTextContent('Still reading this stack');
    await expect.element(panel()).toHaveTextContent('2 more not in githq yet');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP60, SP59: after a partway failure nothing is known until the stack is read again, then what is true per pull request', async () => {
    await PartwayFailure.run();

    await expect.element(panel()).toHaveTextContent('GitHub refused part of it');
    for (const number of [488, 489, 490, 491]) {
        await expect.element(member(number)).toHaveTextContent('Not known yet');
    }

    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(panel()).toHaveTextContent('Merge stopped at #489');
    await expect.element(panel()).toHaveTextContent('1 landed, 3 still open');
    await expect.element(member(488)).toHaveTextContent('Merged');
    await expect.element(member(489)).toHaveTextContent('Refused');
    await expect.element(member(490)).toHaveTextContent('Still open');
    await expect.element(panel()).toHaveTextContent('Required status check "export-e2e" is failing.');
});

test("SP61: refused at once — GitHub's words, nothing merged", async () => {
    await Refused.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(panel()).toHaveTextContent('GitHub refused it');
    await expect.element(panel()).toHaveTextContent('Nothing was merged');
    await expect.element(panel()).toHaveTextContent('This stack must be rebased before it can be merged.');
});

test('SP62: a new commit on one going — nothing merged, and which one has it', async () => {
    await HeadMoved.run();

    await expect.element(panel()).toHaveTextContent('Not merged: #1204 has a new commit');
    await expect.element(member(1203)).toHaveTextContent('Not merged');
    await expect.element(member(1204)).toHaveTextContent('New commit');
    await expect.element(member(1205)).toHaveTextContent('Still open');
});

test("SC2, PM25: one going from a panel opened on a later one — refused, the merge's own ending speaks, and ⌘↵ tries again", async () => {
    await OneGoingRefused.run();

    await expect.element(primary('Squash and merge 2 of 4')).toBeVisible();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(panel()).toHaveTextContent('GitHub refused the merge');
    await expect.element(panel()).toHaveTextContent('Nothing was merged');
    await expect.element(panel()).toHaveTextContent('Required status check "export-e2e" is failing.');
    await expect.element(primary('Try again')).toBeVisible();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[1203]');
});

test("SC2, PM29: one going from a panel opened on a later one — no answer, grey, and ⌘↵ doesn't merge again", async () => {
    await OneGoingUnknown.run();

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(panel()).toHaveTextContent('Outcome not known yet');
    await expect.element(panel()).toHaveTextContent('The next refresh will settle this');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SC2, PM27: one going from a panel opened on a later one — a new commit, said, and nothing reads ready', async () => {
    await OneGoingNewCommit.run();

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(panel()).toHaveTextContent('A new commit arrived, so nothing was merged');
    await expect.element(panel()).not.toHaveTextContent('Ready to merge');
    await expect.element(panel()).toHaveTextContent('See the new commit');
});

test('SS2, SP40: both hints show, and C shows the checks of the first open one, saying whose', async () => {
    await WholeStack.run();

    await expect.element(footer()).toHaveTextContent('Stop earlier');
    await expect.element(footer()).toHaveTextContent('Checks');
    await expect.element(panel()).not.toHaveTextContent("#310's checks");

    await userEvent.keyboard('c');
    await expect.element(panel()).toHaveTextContent("#310's checks");
    await expect.element(panel()).not.toHaveTextContent('each lands under its own title');
    await expect.element(footer()).toHaveTextContent('Fold');

    await userEvent.keyboard('c');
    await expect.element(panel()).not.toHaveTextContent("#310's checks");
    await expect.element(panel()).toHaveTextContent('each lands under its own title');
});

test('SS2, SP45: held, C shows the checks of the one holding the rest', async () => {
    await Held.run();

    await expect.element(footer()).toHaveTextContent('Checks');
    await userEvent.keyboard('c');
    await expect.element(panel()).toHaveTextContent("#1206's checks");
});

test('SS3, SP58: partly merged, GitHub checking those left — nothing to merge yet, the button says what will', async () => {
    await PartlyMerged.run();

    await expect.element(panel()).toHaveTextContent('Not ready yet');
    await expect.element(panel()).toHaveTextContent('1 landed · GitHub is checking the 2 left');
    await expect.element(member(480)).toHaveTextContent('Merged');
    await expect.element(member(481)).toHaveTextContent('Fresh checks running');
    await expect.element(member(482)).toHaveTextContent('Fresh checks running');
    await expect.element(footer()).toHaveTextContent('Stop earlier');
    await expect.element(footer()).not.toHaveTextContent('Checks');
    await expect.element(primary('Squash and merge 2')).toBeDisabled();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

function panel() {
    return page.getByRole('dialog');
}

function footer() {
    return page.getByRole('contentinfo');
}

function member(number: number) {
    return page.getByTestId('stack-member').filter({ hasText: `#${number}` });
}

function primary(name: string) {
    return page.getByRole('button', { name, exact: true });
}
