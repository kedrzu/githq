import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';

import * as stories from './MergePanel.stack.stories.js';

const {
    BeingMerged,
    BeingRead,
    BypassFirst,
    BypassNotTheSecond,
    InQueue,
    QueueOneGoing,
    QueueSome,
    QueueWhole,
    ThrownOutAfterOneLanded,
    ThrownOutEntryGone,
    ThrownOutLast,
    ThrownOutUnmergeable,
    ClosedInside,
    DraftInside,
    Held,
    Incomplete,
    LineMoved,
    MethodNotAllowed,
    NeedsRebase,
    NoAnswer,
    OneGoingMergeabilityUnknown,
    OneGoingNewCommit,
    OneGoingRefused,
    OneGoingUnknown,
    OneLands,
    OpenedElsewhere,
    PartlyMerged,
    PartwayFailure,
    PushedToLower,
    Refused,
    TopHeadMoved,
    TopHeadMovedNamed,
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

test('SP45: moved past the one holding the rest, nothing is on offer and ⌘↵ sends nothing', async () => {
    await Held.run();

    await userEvent.keyboard('{ArrowDown}{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(panel()).toHaveTextContent('2 of 4 can land');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP48: a closed one mid-stack — those before it can land, later ones are blocked, rebuilding is on GitHub', async () => {
    await ClosedInside.run();

    await expect.element(panel()).toHaveTextContent('#490 is closed');
    await expect.element(member(490)).toHaveTextContent('Closed');
    await expect.element(member(491)).toHaveTextContent('Blocked');
    await expect.element(panel()).toHaveTextContent("isn't in githq yet");
    await expect.element(primary('Squash and merge')).toBeVisible();
});

test('SP48: moved past a closed one, ⌘↵ sends nothing', async () => {
    await ClosedInside.run();

    await userEvent.keyboard('{ArrowDown}{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(member(491)).toHaveTextContent('Blocked');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP49: a draft inside holds the rest, and marking it ready is right there', async () => {
    await DraftInside.run();

    await expect.element(panel()).toHaveTextContent('#102 is a draft');
    await page.getByRole('button', { name: 'Mark #102 ready' }).click();
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: markReady');
});

test('SP49: ⌘K is the key of marking the draft ready, shown on its button', async () => {
    await DraftInside.run();

    await expect
        .element(page.getByRole('button', { name: 'Mark #102 ready' }))
        .toHaveAttribute('aria-keyshortcuts', formatAriaKeyShortcuts('Mod+K'));
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: markReady');
});

test('SP49: moved past the draft, ⌘↵ marks it ready, the button naming it', async () => {
    await DraftInside.run();

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(primary('Mark #102 ready')).toBeVisible();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: markReady');
});

test('SP41: ⌘K marks nothing where no draft holds the rest', async () => {
    await WholeStack.run();

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP50: an incomplete copy never reads ready, and ⌘↵ does nothing (D7)', async () => {
    await Incomplete.run();

    await expect.element(panel()).toHaveTextContent('Still reading this stack');
    await expect.element(panel()).toHaveTextContent('2 more not in githq yet');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP60, SP59: refused, nothing is known until the stack is read again; then a member that landed reads Merged, and where it stopped', async () => {
    await PartwayFailure.run();

    await expect.element(panel()).toHaveTextContent('Outcome not known yet');
    await expect.element(panel()).toHaveTextContent("GitHub refused it · what landed isn't read yet");
    await expect.element(panel()).toHaveTextContent('Required status check "export-e2e" is failing.');
    await expect.element(panel()).not.toHaveTextContent('Nothing was merged');
    await expect.element(footer().getByRole('button', { name: 'Close' })).toBeVisible();
    expect(footer().getByText('Close').elements()).toHaveLength(1);
    for (const number of [488, 489, 490, 491]) {
        await expect.element(member(number)).toHaveTextContent('Ready');
        await expect.element(member(number)).not.toHaveTextContent('Merged');
        await expect.element(member(number)).not.toHaveTextContent('lands');
    }

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(panel()).toHaveTextContent('Merge stopped at #489');
    await expect.element(panel()).toHaveTextContent('1 landed, 3 still open');
    await expect.element(member(488)).toHaveTextContent('Merged');
    await expect.element(member(489)).not.toHaveTextContent('Merged');
    // Those left were rewritten onto what landed: no new commit of anyone's, GitHub's words stay.
    await expect.element(panel()).toHaveTextContent('Required status check "export-e2e" is failing.');
    await expect.element(panel()).not.toHaveTextContent('new commit');
    await expect.element(page.getByRole('link', { name: '#489 on GitHub' })).toBeVisible();
});

test('SP60: no answer — not known, the rows as the copy has them, nothing moves, and ⌘↵ is not offered', async () => {
    await NoAnswer.run();

    await expect.element(panel()).toHaveTextContent('Outcome not known yet');
    await expect.element(panel()).toHaveTextContent("GitHub hasn't answered · not shown as merged");
    await expect.element(panel()).toHaveTextContent('The next refresh will settle this');
    await expect.element(member(488)).toHaveTextContent('Ready');
    await expect.element(footer()).not.toHaveTextContent('Stop earlier');
    await expect.element(footer()).not.toHaveTextContent('Squash and merge');
    // The Close button says Esc itself: no hint beside it.
    await expect.element(footer().getByRole('button', { name: 'Close' })).toBeVisible();
    expect(footer().getByText('Close').elements()).toHaveLength(1);

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}{ArrowUp}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test("SP61: refused at once — GitHub's words, nothing merged, and ⌘↵ tries the range again", async () => {
    await Refused.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(panel()).toHaveTextContent('GitHub refused it');
    await expect.element(panel()).toHaveTextContent('Nothing was merged');
    await expect.element(panel()).toHaveTextContent('This stack must be rebased before it can be merged.');
    await expect.element(member(310)).toHaveTextContent('Ready');
    await expect.element(primary('Try again')).toBeVisible();

    // The top of the merge, a key away.
    await expect.element(page.getByRole('link', { name: 'Open on GitHub' })).toBeVisible();
    await userEvent.keyboard('o');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('Visit: https://github.com/mlaine/tasklet/pull/312');
});

test('SP62, D21, SP47: a push to a lower one — GitHub refused it, which one has the new commit, and the way on is the rebase', async () => {
    await PushedToLower.run();

    await expect.element(panel()).toHaveTextContent('GitHub refused it');
    await expect.element(panel()).toHaveTextContent('Nothing was merged');
    await expect.element(panel()).toHaveTextContent('#94 has a new commit');
    await expect.element(panel()).toHaveTextContent('This stack must be rebased before it can be merged.');
    await expect.element(member(95)).toHaveTextContent('Needs rebase');
    await expect.element(footer()).toHaveTextContent('Rebase stack on GitHub');
    await expect.element(page.getByRole('link', { name: 'Open on GitHub' })).toBeVisible();
});

test('PM27: the top of the range moved — the new commit, as for any merge', async () => {
    await TopHeadMoved.run();

    await expect.element(panel()).toHaveTextContent('A new commit arrived, so nothing was merged');
    await expect.element(panel()).toHaveTextContent('See the new commit');
    await expect.element(primary('Squash and merge all 4')).toBeVisible();
});

test('PM27: a push to the top of the range names who pushed it and what, from the read of the top', async () => {
    await TopHeadMovedNamed.run();

    await expect.element(panel()).toHaveTextContent('monalisa pushed head-oi');
    await expect.element(panel()).toHaveTextContent('“Drop the old export format”');
});

test("PM28: a stack's merge refused for a method the rules don't allow says so, as any merge's", async () => {
    await MethodNotAllowed.run();

    await expect.element(panel()).toHaveTextContent('Merge commit');
    await expect.element(panel()).toHaveTextContent('Nothing was merged');
    await expect.element(panel()).not.toHaveTextContent('Merge commits are not allowed.');
});

test('D11: the record of a refused merge of the whole stack speaks in a panel opened on a member under its top', async () => {
    await OpenedElsewhere.run();

    await expect.element(panel()).toHaveTextContent('GitHub refused it');
    await expect.element(panel()).toHaveTextContent('Required status check "export-e2e" is failing.');
    // Not the range sent: another merge, until the line is back where it was.
    await expect.element(primary('Squash and merge 2 of 4')).toBeVisible();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect.element(primary('Try again')).toBeVisible();
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

test("SC2, PM29: one going from a panel opened on a later one — no answer, grey wherever the line is, and ⌘↵ doesn't merge again", async () => {
    await OneGoingUnknown.run();

    for (const key of ['', '{ArrowUp}', '{ArrowDown}{ArrowDown}']) {
        if (key) {
            await userEvent.keyboard(key);
        }

        await expect.element(panel()).toHaveTextContent('Outcome not known yet');
        await expect.element(panel()).toHaveTextContent('The next refresh will settle this');
        await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
        await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    }
});

test('D18, PM22: one going while GitHub works out whether it merges reads as any merge, and ⌘↵ sends it', async () => {
    await OneGoingMergeabilityUnknown.run();

    await expect.element(panel()).toHaveTextContent('Not known yet');
    await expect.element(panel()).not.toHaveTextContent('Not ready yet');
    await expect.element(primary('Squash and merge')).toBeEnabled();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[1203]');
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

test('SP53: all enter as one group — set by the queue, no text; ⌘↵ sends the top with no method chosen, and no jump', async () => {
    await QueueWhole.run();

    await expect.element(panel()).toHaveTextContent('Ready for the queue');
    await expect.element(panel()).toHaveTextContent('All 3 enter as one group');
    await expect.element(panel()).toHaveTextContent('Set by the queue');
    await expect.element(panel()).toHaveTextContent('each its own commit');
    expect(page.getByRole('button', { name: 'Squash', exact: true }).elements()).toHaveLength(0);
    expect(page.getByRole('button', { name: /Jump/u }).elements()).toHaveLength(0);
    await expect.element(primary('Add all 3 to the queue')).toBeVisible();

    await userEvent.keyboard('e');
    expect(page.getByRole('textbox', { name: 'Commit title' }).elements()).toHaveLength(0);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"top":1214');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[1212,1213,1214]');
});

test('SP53: the line moved, those going enter and the rest stay open', async () => {
    await QueueSome.run();

    await expect.element(panel()).toHaveTextContent('2 enter as one group · 1 stay open');
    await expect.element(primary('Add 2 of 3 to the queue')).toBeVisible();
});

test('SP53: with exactly one going still no method to choose, no text — and no email line, in a stack', async () => {
    await QueueOneGoing.run();

    await expect.element(panel()).toHaveTextContent('Ready for the queue');
    await expect.element(panel()).toHaveTextContent('Set by the queue');
    await expect.element(panel()).not.toHaveTextContent('Written by the queue');
    await expect.element(panel()).not.toHaveTextContent('Email');
    await expect.element(primary('Add to queue')).toBeVisible();
});

test('SP54: in the queue the group shares one position; no primary, nothing to bypass, ⌘↵ does nothing', async () => {
    await InQueue.run();

    await expect.element(panel()).toHaveTextContent('In the queue');
    await expect.element(panel()).toHaveTextContent('2nd · waiting for checks');
    for (const number of [1212, 1213, 1214]) {
        await expect.element(member(number)).toHaveTextContent('2nd · waiting for checks');
    }

    await expect.element(panel()).not.toHaveTextContent('past these requirements');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('SP54: UNMERGEABLE — it names the one, the later ones left with it, no reason made up; nothing to add again yet', async () => {
    await ThrownOutUnmergeable.run();

    await expect.element(panel()).toHaveTextContent('Out of the queue');
    await expect.element(panel()).toHaveTextContent('#1212 was thrown out, the later ones left with it');
    await expect.element(member(1212)).toHaveTextContent('Thrown out of the queue');
    await expect.element(member(1213)).toHaveTextContent('Left with it');
    await expect.element(panel()).not.toHaveTextContent('Checks failed');
    await expect.element(primary('Add again')).toBeDisabled();
});

test('SP54: the entry gone with it still open — ⌘↵ adds again, O goes to the one thrown out', async () => {
    await ThrownOutEntryGone.run();

    await expect.element(panel()).toHaveTextContent('#1212 was thrown out, the later ones left with it');
    await expect.element(footer()).toHaveTextContent('#1212 on GitHub');
    await userEvent.keyboard('o');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('Visit: https://github.com/fitloop/webapp/pull/1212');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"going":[1212,1213,1214]');
});

test('SP54: those that went through read merged; the thrown out one is the first still open', async () => {
    await ThrownOutAfterOneLanded.run();

    await expect.element(member(1212)).toHaveTextContent('Merged');
    await expect.element(panel()).toHaveTextContent('#1213 was thrown out, the later ones left with it');
    await expect.element(member(1214)).toHaveTextContent('Left with it');
});

test('SP54: the last one thrown out has no later ones to speak of', async () => {
    await ThrownOutLast.run();

    await expect.element(panel()).toHaveTextContent('#1214 was thrown out');
    await expect.element(panel()).not.toHaveTextContent('later ones');
});

test('SP55: the line speaks of the first alone, ⌥⌘↵ lands exactly that one; ⌘↵ never does', async () => {
    await BypassFirst.run();

    await expect.element(panel()).toHaveTextContent('You may merge #1203 past these requirements');
    await expect
        .element(panel())
        .toHaveTextContent(
            'Skips a required review. Only the first open pull request of a stack can go past them, so this lands one.',
        );
    await expect.element(panel()).toHaveTextContent('Commits as your default, m.laine@fitloop.dev');
    await expect.element(page.getByRole('button', { name: /^Bypass rules and merge #1203/u })).toBeVisible();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('Bypass: {"request":{"method":"SQUASH","bypassRules":true},"to":1203}');
});

test('SP55: the first ready and a later one holding the rest — bypass can’t reach it, so no line', async () => {
    await BypassNotTheSecond.run();

    await expect.element(panel()).not.toHaveTextContent('past these requirements');
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).not.toHaveTextContent('Bypass');
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
