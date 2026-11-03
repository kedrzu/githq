import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';

import * as stories from './MergePanel.stories.js';

const {
    AlreadyMerged,
    AutoMergeInStack,
    AutoMergeNotForViewer,
    AutoMergeOffered,
    AutoMergeOn,
    AdminAutoMergeOn,
    AdminBeingMerged,
    AdminConflicts,
    AdminDraft,
    AdminInQueue,
    AdminReady,
    BypassAlone,
    BypassBehind,
    MergedBranchDeleted,
    MergedNothingToTake,
    UpdatingBranch,
    BypassBehindSending,
    BypassBesideAutoMerge,
    BypassBlockedUnnamed,
    BypassHeadMoved,
    BypassOnQueueBranch,
    BypassRebase,
    BypassRefused,
    BypassRequiredRunning,
    BypassSending,
    EmailMergeCommit,
    EmailOneAddress,
    EmailOnQueueBranch,
    EmailSentReopened,
    EmailSquashByAuthor,
    EmailSquashNotAuthor,
    InQueue,
    QueueLocked,
    QueueMergeable,
    QueueNoEstimate,
    QueueQueued,
    QueueReadChangesMethod,
    QueueReady,
    QueueUnmergeable,
    Behind,
    BehindRequiredFailed,
    BeingMerged,
    BeingRead,
    BeingReadNoMessage,
    BeingReadOptionalFailed,
    Conflicts,
    Draft,
    HeadMoved,
    Merged,
    MergeabilityUnknown,
    MergedMeanwhile,
    MethodGone,
    MethodNotAllowed,
    NoAnswer,
    NotAllowed,
    NotReached,
    NothingToOffer,
    OptionalFailed,
    OrganizationRestricted,
    OutcomeUnknown,
    Ready,
    Refused,
    RefusedReopened,
    RequiredFailed,
    RequiredRunning,
    Sending,
    SentReopened,
} = composeStories(stories);

test('PM8: ⌘↵ merges before the read arrives, with no commit text — GitHub writes its default (D6)', async () => {
    await BeingRead.run();

    await expect.element(panel()).toHaveTextContent('Reading');
    await expect.element(panel()).toHaveTextContent("GitHub's proposed message is on its way");
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
    await expect.element(panel()).not.toBeInTheDocument();
});

test('PM8: before the read, ⌘↵ merges when only a check not required failed — not auto-merge', async () => {
    await BeingReadOptionalFailed.run();

    await expect.element(panel()).toHaveTextContent('Ready to merge');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM8: the read arriving moves nothing above the commit — the method chips, the checks with their chevron and C are in place before it; the message opens below the title', async () => {
    await BeingRead.run();

    await expect.element(panel()).toHaveTextContent('Reading');
    await expect
        .element(page.getByRole('button', { name: 'Squash', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('button', { name: 'Show all checks' })).toBeDisabled();
    expect(panel().element().querySelector('footer')?.textContent).toContain('Checks');
    await expect.element(commitLoader()).toBeVisible();
    expect(commitMessage().element().textContent).toBe('');
    const before = measureRows();

    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(panel()).not.toHaveTextContent('Reading');
    await expect.element(panel()).toHaveTextContent('Retry Stripe webhook delivery on 5xx (#477)');
    await expect.element(page.getByRole('button', { name: 'Show all checks' })).toBeEnabled();
    await expect.element(commitLoader()).not.toBeInTheDocument();
    await expect.element(commitMessage()).toHaveTextContent(/^Fixes #468\./u);

    const after = measureRows();
    expect(after.above).toEqual(before.above);
    expect(after.footer.left).toBe(before.footer.left);
    expect(after.footer.width).toBe(before.footer.width);
    expect(after.footer.top).toBeGreaterThanOrEqual(after.commitBottom);
});

test('PM8: a proposal with no message — the loader goes and nothing opens', async () => {
    await BeingReadNoMessage.run();

    await expect.element(commitLoader()).toBeVisible();
    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(panel()).not.toHaveTextContent('Reading');
    await expect.element(commitLoader()).not.toBeInTheDocument();
    expect(commitMessage().element().textContent).toBe('');
    expect(commitMessage().element().getBoundingClientRect().height).toBe(0);
    expect(panel().element().textContent).not.toContain("GitHub's default message");
});

test('PM3d: E edits; Esc leaves the field keeping the edit, a second Esc closes; only the edited title is sent', async () => {
    await Ready.run();

    await userEvent.keyboard('e');
    const title = page.getByRole('textbox', { name: 'Commit title' });
    await expect.element(title).toHaveFocus();
    await userEvent.clear(title);
    await userEvent.type(title, 'Retry Stripe webhooks with a dead letter table');

    await userEvent.keyboard('{Escape}');
    await expect.element(title).not.toBeInTheDocument();
    await expect.element(panel()).toHaveTextContent('Retry Stripe webhooks with a dead letter table');
    await expect.element(panel()).toHaveTextContent('Edited');
    // The keys stay the panel's, out of the screen's reach below.
    expect(document.activeElement?.closest('[data-no-commands]')).not.toBeNull();
    expect(document.querySelector('[data-layer]')).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    await expect.element(panel()).not.toBeInTheDocument();
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('⌘↵ from the editor sends the edited title and leaves the untouched message to GitHub', async () => {
    await Ready.run();

    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ', with a dead letter table');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent(
            '{"method":"SQUASH","title":"Retry Stripe webhook delivery on 5xx (#477), with a dead letter table"}',
        );
});

test('1 2 3 switch the method, and the primary follows it', async () => {
    await Ready.run();

    await userEvent.keyboard('2');
    await expect.element(page.getByRole('button', { name: /^Merge commit/u })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(panel()).toHaveTextContent('Merge pull request #477 from fitloop/retry-stripe-5xx');

    await userEvent.keyboard('3');
    await expect.element(panel()).toHaveTextContent('one by one, with their own messages');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"REBASE"}');
});

test('PM9: a method the read takes away is never left chosen — the default takes over, said once', async () => {
    await MethodGone.run();

    await expect.element(panel()).toHaveTextContent('Merge commit');
    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();

    await expect.element(panel()).toHaveTextContent("Merge commit is gone: a ruleset on main doesn't allow it");
    await expect
        .element(page.getByRole('button', { name: 'Squash', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('button', { name: /^Merge commit/u })).not.toBeInTheDocument();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM25: refused at once, the panel stays with the edited text and GitHub’s reason; ⌘↵ tries again', async () => {
    await Refused.run();

    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ' now');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByRole('alert')).toHaveTextContent('Repository rule violations found');
    await expect.element(panel()).toHaveTextContent('GitHub refused the merge');
    await expect
        .element(page.getByRole('textbox', { name: 'Commit title' }))
        .toHaveValue('Retry Stripe webhook delivery on 5xx (#477) now');
    await expect.element(page.getByRole('button', { name: /Try again/u })).toBeEnabled();
    // Never read as merged, nor as being merged.
    await expect.element(panel()).not.toHaveTextContent('Being merged');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('{"method":"SQUASH","title":"Retry Stripe webhook delivery on 5xx (#477) now"}');
});

test('PM25, D15: reopened after a refusal, GitHub’s reason in its own words, and the text it was sent with given back', async () => {
    await RefusedReopened.run();

    await expect.element(panel()).toHaveTextContent('GitHub refused the mergeNothing was merged');
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
            'Repository rule violations found“At least 2 approving reviews are required by reviewers with write access.”',
        );
    await expect.element(panel().getByText('Edited', { exact: true })).toBeVisible();
    await expect
        .element(panel())
        .toHaveTextContent('Retry Stripe webhook delivery on 5xx, with a dead letter table (#477)');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('"title":"Retry Stripe webhook delivery on 5xx, with a dead letter table (#477)"');
});

test("G5: refused by an organisation that hasn't approved githq — said plainly, with the way to request access (A)", async () => {
    await OrganizationRestricted.run();

    const band = page.getByRole('alert');
    await expect
        .element(band)
        .toHaveTextContent(
            "fitloop hasn't approved githqgithq can read its public repositories but can't change anything there, merges included.",
        );
    await expect.element(band).not.toHaveTextContent('OAuth App access restrictions');
    const request = band.getByRole('link', { name: 'Request access on GitHub' });
    await expect.element(request).toHaveAttribute('aria-keyshortcuts', 'A');
    const approval = `${window.location.origin}/api/auth/approval`;
    await expect.element(request).toHaveAttribute('href', approval);

    await userEvent.keyboard('a');
    await expect.element(page.getByTestId('sent')).toHaveTextContent(`Visit: ${approval}`);
});

test('PM27: a new commit arrived — nothing merged, the new commit named, and the primary goes by its state', async () => {
    await HeadMoved.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(panel()).toHaveTextContent('A new commit arrived, so nothing was merged');
    await expect.element(page.getByRole('alert')).toHaveTextContent('dkim pushed 4f1c9e2');
    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(
            '“Handle empty billing response”. You asked to merge a91d03b, so GitHub cancelled the merge',
        );
    await expect
        .element(page.getByRole('link', { name: /See the new commit/u }))
        .toHaveAttribute(
            'href',
            `https://github.com/fitloop/api/pull/477/commits/4f1c9e2a7d3b5c6e8f9a0b1c2d3e4f5a6b7c8d9e`,
        );
    // Another merge now, of the new commit: not the same one tried again.
    await expect.element(page.getByRole('button', { name: /Try again/u })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Squash and merge/u })).toBeEnabled();
    await expect.element(panel()).not.toHaveTextContent('Being merged');

    await userEvent.keyboard('d');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent(
            'Visit: https://github.com/fitloop/api/pull/477/commits/4f1c9e2a7d3b5c6e8f9a0b1c2d3e4f5a6b7c8d9e',
        );
});

test('PM28: a method the rules, read late, don’t allow — the panel is on what they allow, the edit kept as its text', async () => {
    await MethodNotAllowed.run();

    await expect.element(page.getByRole('button', { name: /^Merge commit/u })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ' now');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"method":"MERGE"');

    await expect.element(panel()).toHaveTextContent("Merge commit isn't allowed on mainNothing was merged");
    await expect.element(page.getByRole('alert')).toHaveTextContent('A ruleset on main allows only Squash');
    await expect.element(page.getByRole('alert')).toHaveTextContent('Sent before the rules arrived.');
    // Said once, in the refusal: not again as the method gone (PM9).
    await expect.element(panel()).not.toHaveTextContent('is gone');
    await expect
        .element(page.getByRole('textbox', { name: 'Commit title' }))
        .toHaveValue('Merge pull request #477 from fitloop/retry-stripe-5xx now');

    await userEvent.keyboard('{Escape}');
    await expect.element(panel()).toHaveTextContent('MethodSquash');
    await expect.element(panel().getByText('Edited', { exact: true })).toBeVisible();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('{"method":"SQUASH","title":"Merge pull request #477 from fitloop/retry-stripe-5xx now"');
});

test('PM29: reopened with no answer in time — grey, neither merged nor failed, and no second merge on offer', async () => {
    await OutcomeUnknown.run();

    await expect
        .element(panel())
        .toHaveTextContent("Outcome not known yetGitHub hasn't answered · not shown as merged");
    await expect.element(page.getByRole('status')).toHaveTextContent('The next refresh will settle this');
    await expect.element(page.getByRole('status')).toHaveTextContent('then 2 minutes passed with no result');
    await expect.element(panel()).not.toHaveTextContent('Nothing was merged');
    await expect.element(panel()).not.toHaveTextContent('GitHub refused the merge');
    expect(page.getByRole('button', { name: /merge|try again/iu }).elements()).toEqual([]);

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    await expect
        .element(page.getByRole('link', { name: /Open on GitHub/u }))
        .toHaveAttribute('href', 'https://github.com/fitloop/api/pull/477');
    await userEvent.keyboard('o');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Visit: https://github.com/fitloop/api/pull/477');
});

test('PM4a: a required check that failed holds the merge — tagged and first, and ⌘↵ does nothing', async () => {
    await RequiredFailed.run();

    await expect.element(panel()).toHaveTextContent("Can't merge yetA required check failed");
    const rows = page.getByRole('listitem').elements();
    expect(rows.map(row => row.textContent)).toEqual([
        expect.stringMatching(/^ci \/ test \(node 20\)Required/u),
        expect.stringMatching(/^Vercel \/ preview.*doesn't stop the merge/u),
    ]);

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    await userEvent.keyboard('c');
    await expect.element(panel()).toHaveTextContent('Required · 5');
    await expect.element(panel()).toHaveTextContent('Others · 4');
    // D13: the full list says the same of the one that isn't required as the folded rows do.
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'Vercel / preview' }))
        .toHaveTextContent(/doesn't stop the merge/u);
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'ci / test (node 20)' }))
        .not.toHaveTextContent(/doesn't stop the merge/u);
});

test('PM4a, PM38: checks still running — the Checks line draws them as the opened item’s standing does', async () => {
    await RequiredRunning.run();

    await expect.element(panel()).toHaveTextContent("Can't merge yet");
    const label = [...panel().element().querySelectorAll('span')].find(span => span.textContent === 'Checks');
    expect(label?.parentElement?.querySelector('svg')?.classList.contains('lucide-loader')).toBe(true);
});

test("PM4a, PM38: a check that isn't required failed — the row's summary says a check fails, the panel reads ready and merges", async () => {
    await OptionalFailed.run();

    await expect.element(panel()).toHaveTextContent('Ready to mergeApproved · required checks passed');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM32a: sent and not answered yet, the panel stays as it was, its primary busy — it claims nothing of GitHub', async () => {
    await Sending.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
    await expect.element(panel()).toHaveTextContent('Ready to merge');
    await expect.element(panel()).not.toHaveTextContent('Being merged');
    await expect.element(panel()).not.toHaveTextContent('accepted');
    await expect.element(panel()).toHaveTextContent('Commit');
    await expect.element(page.getByRole('button', { name: /Squash and merge/u })).toHaveAttribute('aria-busy', 'true');
});

test('PM29: sent and no answer came back — the outcome is not known, never "nothing was merged", and no second merge on offer', async () => {
    await NoAnswer.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect
        .element(panel())
        .toHaveTextContent("Outcome not known yetGitHub hasn't answered · not shown as merged");
    await expect.element(page.getByRole('status')).toHaveTextContent('The next refresh will settle this');
    // Never accepted that GitHub said so: no time limit passed, the request itself went unanswered.
    await expect.element(page.getByRole('status')).toHaveTextContent("GitHub didn't answer the request");
    await expect.element(page.getByRole('status')).not.toHaveTextContent('accepted');
    await expect.element(panel()).not.toHaveTextContent('Nothing was merged');
    await expect.element(panel()).not.toHaveTextContent('GitHub refused the merge');
    expect(page.getByRole('button', { name: /merge|try again/iu }).elements()).toEqual([]);
});

test('D12: GitHub out of reach before anything was sent: says so, not that the outcome isn’t known, and ⌘↵ tries again', async () => {
    await NotReached.run();

    await expect.element(panel()).toHaveTextContent('Not sentNothing was merged');
    await expect.element(panel()).toHaveTextContent("GitHub couldn't be reached");
    await expect.element(panel()).not.toHaveTextContent('Outcome not known');
    await expect.element(page.getByRole('button', { name: /^Try again/u })).toBeVisible();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"method":"SQUASH"');
});

test('PM30: sent for a pull request merged already — GitHub says merged at once, and the panel stays and says so, not how this merge landed', async () => {
    await AlreadyMerged.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    // The answer's time is not the merge's: no age, only the commit GitHub names.
    await expect.element(panel()).toHaveTextContent('Already mergedGitHub says it merged · 6dcb09b');
    await expect.element(panel()).not.toHaveTextContent('just now');
    await expect.element(panel()).not.toHaveTextContent('Squashed into main');
    expect(page.getByRole('button', { name: /merge/iu }).elements()).toEqual([]);
});

test('D15: reopened once a copy read since says what GitHub holds — no refusal said, the text it was sent with given back', async () => {
    await SentReopened.run();

    await expect.element(panel()).toHaveTextContent('Ready to merge');
    await expect.element(panel()).not.toHaveTextContent('GitHub refused the merge');
    await expect.element(panel().getByText('Edited', { exact: true })).toBeVisible();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('"title":"Retry Stripe webhook delivery on 5xx, with a dead letter table (#477)"');
});

test('PM24: reopened while being merged, it says so and offers nothing to repeat', async () => {
    await BeingMerged.run();

    await expect.element(panel()).toHaveTextContent('Being merged');
    // The method it was sent with, from the merge on its way; the commit text sent is not kept.
    await expect.element(panel()).toHaveTextContent('MethodSquash');
    await expect.element(panel()).not.toHaveTextContent('Commit');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    expect(page.getByRole('button', { name: /merge/iu }).elements()).toEqual([]);
});

test('PM26: merged from here, it says how it landed — no checks, nothing to do but close', async () => {
    await Merged.run();

    await expect.element(panel()).toHaveTextContent('MergedSquashed into main as 6dcb09b · just now');
    await expect.element(panel()).not.toHaveTextContent('Checks');
    await expect.element(panel()).toHaveTextContent('Close');
    expect(page.getByRole('button', { name: /merge/iu }).elements()).toEqual([]);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('found merged meanwhile, it reads merged without the method or the commit GitHub did not say — not that the viewer cannot merge here', async () => {
    await MergedMeanwhile.run();

    await expect.element(panel()).toHaveTextContent('MergedInto main · 1 minute ago');
    await expect.element(panel()).not.toHaveTextContent("You can't merge in this repository");
    expect(page.getByRole('button', { name: /merge/iu }).elements()).toEqual([]);
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('without write access the primary says the viewer cannot merge in this repository', async () => {
    await NotAllowed.run();

    await expect.element(page.getByRole('button', { name: "You can't merge in this repository" })).toBeDisabled();
});

test('PM13, D12: not met with nothing to offer — the panel says why, the reviews beside the checks; the primary is off and ⌘↵ does nothing', async () => {
    await NothingToOffer.run();

    await expect.element(panel()).toHaveTextContent("Can't merge yetChanges requested · a required check failed");
    await expect.element(panel()).toHaveTextContent('ReviewsChanges requested by sofiab1 approval · dkim');
    await expect.element(panel()).toHaveTextContent('Checks1 required failed, 8 passed');
    await expect.element(page.getByRole('button', { name: "Can't merge yet" })).toBeDisabled();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test("PM19, D12: conflicts — ⌘↵ goes to GitHub's editor, and the primary is a link that leaves; nothing to merge with", async () => {
    await Conflicts.run();

    await expect.element(panel()).toHaveTextContent("Can't mergeConflicts with main");
    await expect.element(panel()).toHaveTextContent("ConflictsWith main. Resolved in GitHub's editor");
    await expect.element(panel()).not.toHaveTextContent('Method');
    const resolve = page.getByRole('link', { name: /^Resolve on GitHub/u });
    await expect.element(resolve).toHaveAttribute('href', 'https://github.com/fitloop/api/pull/477/conflicts');
    await expect.element(resolve).toHaveAttribute('target', '_blank');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: resolveConflicts');
});

test('PM20, D12: behind and up to date required — ⌘↵ updates the branch, never merges; the panel stays, and merging comes back when GitHub says so', async () => {
    await Behind.run();

    await expect.element(panel()).toHaveTextContent('Behind mainmain requires being up to date');
    await expect.element(panel()).toHaveTextContent('BranchBehind main');
    await expect.element(panel()).toHaveTextContent('All 9 passed, will run again');
    await expect.element(panel()).toHaveTextContent('Retry Stripe webhook delivery on 5xx (#477)');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch MERGE');
    await expect.element(panel()).toHaveTextContent('Updating the branch');
    await expect.element(page.getByRole('button', { name: /^Update branch/u })).toHaveAttribute('aria-busy', 'true');
    // Pressed again while it is on its way, nothing more is asked.
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch MERGE');

    document.querySelector<HTMLElement>('[tid="stepped"]')?.click();
    await expect.element(panel()).toHaveTextContent('Ready to merge');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM21, D12: a draft — ⌘↵ marks it ready for review; the method and the text wait until it is', async () => {
    await Draft.run();

    await expect.element(panel()).toHaveTextContent('DraftMark it ready for review first');
    await expect.element(panel()).not.toHaveTextContent('Method');
    await expect.element(panel()).not.toHaveTextContent('Commit');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: markReady');
    await expect
        .element(page.getByRole('button', { name: /^Mark ready for review/u }))
        .toHaveAttribute('aria-busy', 'true');

    document.querySelector<HTMLElement>('[tid="stepped"]')?.click();
    await expect.element(panel()).toHaveTextContent('Ready to merge');
    await expect.element(panel()).toHaveTextContent('Method');
});

test('PM22, D12: mergeability not known yet — no red, GitHub is computing, and ⌘↵ still merges: GitHub enforces it', async () => {
    await MergeabilityUnknown.run();

    await expect.element(panel()).toHaveTextContent('Not known yetGitHub is still checking for conflicts');
    await expect.element(panel()).toHaveTextContent('GitHub is computing');
    await expect.element(panel()).toHaveTextContent('ConflictsNot known yet');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM10, D12: not met and auto-merge allowed — ⌘↵ turns it on with the method chosen, and no text unless edited', async () => {
    await AutoMergeOffered.run();

    await expect.element(panel()).toHaveTextContent("Can't merge yet");
    await expect.element(panel()).toHaveTextContent('Merges by itself when these are met');
    await expect.element(page.getByRole('button', { name: /Enable auto-merge/ })).toBeVisible();
    await userEvent.keyboard('2');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect.element(page.getByTestId('sent')).toHaveTextContent('Enable: {"method":"MERGE"}');
});

test('PM10: an edited title goes with it, and only what was edited', async () => {
    await AutoMergeOffered.run();

    await userEvent.keyboard('e');
    const title = page.getByRole('textbox', { name: 'Commit title' });
    await expect.element(title).toHaveFocus();
    await userEvent.fill(title, 'A better title');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('Enable: {"method":"SQUASH","title":"A better title"}');
});

test('auto-merge is not offered to a viewer GitHub says may not enable it', async () => {
    await AutoMergeNotForViewer.run();

    await expect.element(page.getByRole('button', { name: /Enable auto-merge/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('never auto-merge on a stacked pull request, though viewerCanEnableAutoMerge reads true', async () => {
    await AutoMergeInStack.run();

    await expect.element(page.getByRole('button', { name: /Enable auto-merge/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});

test('PM11: auto-merge on — who and how, the text GitHub holds and not editable; no merge offered, ⌘↵ turns it off', async () => {
    await AutoMergeOn.run();

    await expect.element(panel()).toHaveTextContent('Auto-merge is onSquash · enabled by mlaine 12 minutes ago');
    await expect.element(panel()).toHaveTextContent('Retry Stripe webhook delivery, chosen when it went on (#477)');
    await expect.element(panel()).toHaveTextContent('The message chosen when it went on.');
    await expect.element(page.getByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Squash and merge/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Turn off auto-merge/ })).toBeVisible();
    expect(panel().element().querySelectorAll('footer button')).toHaveLength(1);
    await userEvent.keyboard('e');
    await expect.element(page.getByRole('textbox', { name: 'Commit title' })).not.toBeInTheDocument();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: disableAutoMerge');
});

test("PM14: ready on a queue branch — the method and text are the queue's, E is off, and ⌘↵ adds it as a merge, not a jump", async () => {
    await QueueReady.run();

    await expect.element(panel()).toHaveTextContent('Ready for the queue');
    await expect.element(panel()).toHaveTextContent('Squashset by the queue');
    await expect.element(panel()).toHaveTextContent("Written by the queue. Text can't be set here");
    await expect.element(panel()).toHaveTextContent('Jumping rebuilds those in progress');
    await expect.element(page.getByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    await userEvent.keyboard('e');
    await expect.element(page.getByRole('textbox', { name: 'Commit title' })).not.toBeInTheDocument();

    const add = page.getByRole('button', { name: /Add to queue/ });
    await expect.element(add).toHaveAttribute('aria-keyshortcuts', formatAriaKeyShortcuts('Mod+Enter'));
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"SQUASH"}');
});

test('PM14, D12: ⇧⌘↵ jumps the queue, and nothing else does', async () => {
    await QueueReady.run();

    await expect.element(page.getByRole('button', { name: /Jump the queue/ })).toBeVisible();
    await userEvent.keyboard('{Shift>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Step: jumpQueue');
});

test("PM9: the read changing a queue branch's method says nothing — it was never chosen", async () => {
    await QueueReadChangesMethod.run();

    await expect.element(panel()).toHaveTextContent('Squash');
    document.querySelector<HTMLElement>('[tid="arrive"]')?.click();
    await expect.element(panel()).toHaveTextContent('Rebaseset by the queue');
    await expect.element(panel()).not.toHaveTextContent("isn't allowed");
    await expect.element(panel()).not.toHaveTextContent('Now on');
    expect(document.querySelector('[role="status"]')).toBeNull();
});

test('PM15: in the queue — where, its state and who added it; no merge offered and ⌘↵ does nothing; ⇧Q takes it out', async () => {
    await InQueue.run();

    await expect.element(panel()).toHaveTextContent('In the queue3rd · waiting for checks · about 12 min');
    await expect.element(panel()).toHaveTextContent("Position3rd in main's queue");
    await expect.element(panel()).toHaveTextContent('StateWaiting for checksadded by mlaine 9 minutes ago');
    await expect.element(page.getByRole('button', { name: /Squash and merge/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /Add to queue/ })).not.toBeInTheDocument();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    const out = page.getByRole('button', { name: /Take out of queue/ });
    await expect.element(out).toHaveAttribute('aria-keyshortcuts', 'Shift+Q');
    await userEvent.keyboard('{Shift>}Q{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: dequeue');
});

test("PM16: each of GitHub's queue states on one line of the verdict, with no estimate when GitHub gives none", async () => {
    await QueueQueued.run();
    await expect.element(panel()).toHaveTextContent('In the queue5th · queued · about 40 min');
});

test('PM16: no estimate when GitHub gives none', async () => {
    await QueueNoEstimate.run();
    await expect.element(panel()).toHaveTextContent('In the queue3rd · waiting for checksPosition');
});

test('PM16: mergeable, first — merging next', async () => {
    await QueueMergeable.run();
    await expect.element(panel()).toHaveTextContent('In the queue1st · mergeable · merging next');
});

test('PM16: locked for merging', async () => {
    await QueueLocked.run();
    await expect.element(panel()).toHaveTextContent('In the queue1st · locked for merging');
});

test("PM16: unmergeable — in the queue, won't merge", async () => {
    await QueueUnmergeable.run();
    await expect.element(panel()).toHaveTextContent("In the queue, won't merge2nd · unmergeable");
});

test('PM12a, D12: ⌥⌘↵ sends bypass_rules and the method chosen; ⌘↵ never bypasses — here it turns auto-merge on', async () => {
    await BypassBesideAutoMerge.run();

    await expect.element(panel()).toHaveTextContent('You may merge past these requirements');
    await expect.element(panel()).toHaveTextContent('Skips ci / test (node 20) and a required review');
    await expect.element(panel()).toHaveTextContent('Commits as your default, m.laine@fitloop.dev');
    await expect.element(page.getByRole('button', { name: /^Bypass rules and merge/u })).toBeVisible();
    expect(panel().element().querySelector('footer')?.textContent).toContain('Enable auto-merge');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Enable: {"method":"SQUASH"}');
});

test('D12: with nothing else to do ⌘↵ still does nothing past the rules; ⌥⌘↵ alone sends it, with the text edited', async () => {
    await BypassAlone.run();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    await expect.element(page.getByRole('button', { name: "Can't merge yet", exact: true })).toBeDisabled();

    await userEvent.keyboard('e');
    await userEvent.type(page.getByRole('textbox', { name: 'Commit title' }), ', past the rules');
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent(
            'Bypass: {"method":"SQUASH","title":"Retry Stripe webhook delivery on 5xx (#477), past the rules","bypassRules":true}',
        );
});

test('PM12a: a required check still running is skipped by name, and with no default known it says so', async () => {
    await BypassRequiredRunning.run();

    await expect.element(panel()).toHaveTextContent('Skips ci / lint');
    await expect.element(panel()).toHaveTextContent('Commits as your default email');
});

test('PM12a: behind is what it skips; ⌘↵ stays updating the branch', async () => {
    await BypassBehind.run();

    await expect.element(panel()).toHaveTextContent('Skips being up to date with main');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch MERGE');
});

test('PM12a: blocked for what nothing read names — it says GitHub holds it, and invents no reason', async () => {
    await BypassBlockedUnnamed.run();

    await expect.element(panel()).toHaveTextContent('Skips what GitHub says still holds it');
});

test('PM12a: a rebase makes no commit of its own, so the line names no email', async () => {
    await BypassRebase.run();

    await expect.element(panel()).toHaveTextContent('You may merge past these requirements');
    await expect.element(panel()).not.toHaveTextContent('Commits as your default');
});

test('on a queue branch bypass goes outside the queue and says so; the method it sends is the queue’s', async () => {
    await BypassOnQueueBranch.run();

    await expect.element(panel()).toHaveTextContent('Merges directly, outside the queue.');
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Bypass: {"method":"SQUASH","bypassRules":true}');
});

test('PM32a: sent, its own button is busy and nothing is said of the primary; a second chord sends nothing', async () => {
    await BypassSending.run();

    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect
        .element(page.getByRole('button', { name: /^Bypass rules and merge/u }))
        .toHaveAttribute('aria-busy', 'true');
    await expect.element(page.getByRole('button', { name: "Can't merge yet", exact: true })).toBeDisabled();
});

test('PM12a: on a red outline, with no red ground, hovered or not (D12)', async () => {
    await BypassAlone.run();

    const button = page.getByRole('button', { name: /^Bypass rules and merge/u });
    await expect.element(button).toBeVisible();
    expect(getComputedStyle(button.element()).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await userEvent.hover(button);
    expect(getComputedStyle(button.element()).backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

test('D12: the head moved with the panel open: no bypass of a commit nobody saw until it is read, and ⌥⌘↵ sends nothing meanwhile', async () => {
    await BypassHeadMoved.run();
    const button = page.getByRole('button', { name: /^Bypass rules and merge/u });
    await expect.element(button).toBeVisible();

    document.querySelector<HTMLElement>('[tid="stepped"]')?.click();

    await expect.element(panel()).not.toHaveTextContent('You may merge past these requirements');
    expect(button.elements()).toEqual([]);
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');

    document.querySelector<HTMLElement>('[tid="readAgain"]')?.click();

    await expect.element(button).toBeVisible();
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Bypass: ');
});

test('PM12a, PM20: while a bypass is sent, ⌘↵ and the button don’t take the step', async () => {
    await BypassBehindSending.run();

    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Bypass: ');

    await expect.element(page.getByRole('button', { name: /^Update branch/u })).toBeDisabled();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Bypass: ');
});

test('PM25: refused, GitHub’s words show, the line stays and ⌘↵ still doesn’t bypass', async () => {
    await BypassRefused.run();

    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(panel()).toHaveTextContent('Repository rule violations found');
    await expect.element(panel()).toHaveTextContent('You may merge past these requirements');
});

test.each([
    ['without viewerCanMergeAsAdmin', RequiredFailed],
    ['ready by itself', AdminReady],
    ['already in the queue', AdminInQueue],
    ['under auto-merge', AdminAutoMergeOn],
    ['being merged', AdminBeingMerged],
    ['a draft', AdminDraft],
    ['with conflicts', AdminConflicts],
])('no bypass %s: no line, and ⌥⌘↵ sends nothing', async (_, story) => {
    await story.run();

    await expect.element(panel()).not.toHaveTextContent('past these requirements');
    await userEvent.keyboard('{Alt>}{ControlOrMeta>}{Enter}{/ControlOrMeta}{/Alt}');
    await expect.element(page.getByTestId('sent')).not.toHaveTextContent('Bypass');
});

test('PM6: a squash by the author starts on the default, sends no email; Y moves on, and only then one goes', async () => {
    await EmailSquashByAuthor.run();

    await expect.element(panel()).toHaveTextContent('m.laine@fitloop.dev');
    await expect.element(panel()).toHaveTextContent('2 more');
    await userEvent.keyboard('y');
    await expect.element(panel()).toHaveTextContent('mikko@laine.fi');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect
        .element(page.getByTestId('sent'))
        .toHaveTextContent('{"method":"SQUASH","authorEmail":"mikko@laine.fi"}');
});

test('PM6: back on the default after the last address, none goes; the method leaving for a rebase takes the line and the email', async () => {
    await EmailSquashByAuthor.run();

    await userEvent.keyboard('yyy');
    await expect.element(panel()).toHaveTextContent('m.laine@fitloop.dev');
    await userEvent.keyboard('y');
    await userEvent.keyboard('3');
    await expect.element(panel()).not.toHaveTextContent('Email');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('{"method":"REBASE"}');
});

test('PM6: a merge commit offers it to anyone with several addresses; a squash by someone else does not', async () => {
    await EmailMergeCommit.run();
    await expect.element(panel()).toHaveTextContent('m.laine@fitloop.dev');

    await userEvent.keyboard('1');
    await expect.element(panel()).not.toHaveTextContent('m.laine@fitloop.dev');
});

test.each([
    ['a squash by someone other than the author', EmailSquashNotAuthor],
    ['a single address', EmailOneAddress],
    ['a queue branch', EmailOnQueueBranch],
])('without a choice the line does not exist: %s', async (_, story) => {
    await story.run();

    await expect.element(panel()).not.toHaveTextContent('Email');
    await userEvent.keyboard('y');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).not.toHaveTextContent('authorEmail');
});

test('D15: reopened, it starts on the address its last merge was sent with', async () => {
    await EmailSentReopened.run();

    await expect.element(panel()).toHaveTextContent('mikko@laine.fi');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('"authorEmail":"mikko@laine.fi"');
});

function panel() {
    return page.getByRole('dialog', { name: 'Merge fitloop/api#477' });
}

function commitLoader() {
    return page.getByTestId('commit-loader');
}

/** The `Reveal` the commit's message opens in. */
function commitMessage() {
    return page.getByTestId('commit-message');
}

/**
 * Where the panel's rows sit: each line of how it lands above the commit and the checks' row in full; the footer only
 * across and below the commit, which may grow as its message opens.
 */
function measureRows() {
    const root = panel().element();
    const lines = [...root.querySelectorAll('dl > div')];
    const commit = lines.at(-1);
    const above = [
        ...lines.slice(0, -1),
        page.getByRole('button', { name: 'Show all checks' }).element().parentElement,
    ].map(row => {
        const box = row?.getBoundingClientRect();
        return box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null;
    });
    const footer = root.querySelector('footer')?.getBoundingClientRect();
    if (!commit || !footer) {
        throw new Error('The panel has no commit row or no footer');
    }

    return {
        above,
        commitBottom: commit.getBoundingClientRect().bottom,
        footer: { top: footer.top, left: footer.left, width: footer.width },
    };
}

test('PM20: `U` updates the branch by a merge as ⌘↵ does, and `⇧U` beside "Behind" by a rebase', async () => {
    await Behind.run();

    await expect.element(page.getByRole('button', { name: /^Update by rebase/u })).toBeVisible();
    await userEvent.keyboard('{Shift>}u{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch REBASE');
});

test('PM20: updating by `⇧U`, the primary is the busy "Update branch", as by `U`', async () => {
    await Behind.run();

    await userEvent.keyboard('{Shift>}u{/Shift}');
    await expect.element(panel()).toHaveTextContent('Updating the branch');
    await expect.element(page.getByRole('button', { name: /^Update branch/u })).toHaveAttribute('aria-busy', 'true');
});

test('PM20: behind with a required check failed, `U` and `⇧U` still update, and ⌘↵ stays off', async () => {
    await BehindRequiredFailed.run();

    await expect.element(panel()).toHaveTextContent('BranchBehind main');
    await expect.element(page.getByRole('button', { name: /^Update by rebase/u })).toBeVisible();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
    await userEvent.keyboard('u');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch MERGE');
});

test('PM20: `U` is the step of updating, too', async () => {
    await Behind.run();

    await userEvent.keyboard('u');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: updateBranch MERGE');
});

test('PM40: while it updates, "Update by rebase" is gone', async () => {
    await UpdatingBranch.run();

    await expect.element(page.getByRole('button', { name: /^Update by rebase/u })).not.toBeInTheDocument();
});

test('PM26: merged, its branch is still there — `⇧D` deletes it, and `⇧Z` reverts', async () => {
    await Merged.run();

    await expect.element(panel()).toHaveTextContent('still there');
    await expect.element(page.getByRole('button', { name: /^Delete branch/u })).toBeVisible();
    await userEvent.keyboard('{Shift>}d{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: deleteBranch');
});

test('PM26: `⇧Z` is "Revert"', async () => {
    await Merged.run();

    await expect.element(page.getByRole('button', { name: /^Revert/u })).toBeVisible();
    await userEvent.keyboard('{Shift>}z{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: revert');
});

test('PM26b: deleted by the repository, it says so, and the same key restores it', async () => {
    await MergedBranchDeleted.run();

    await expect.element(panel()).toHaveTextContent('deleted by the repository');
    await userEvent.keyboard('{Shift>}d{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Command: restoreBranch');
});

test('merged, with nothing it may take, it offers nothing destructive: a key does nothing', async () => {
    await MergedNothingToTake.run();

    await expect.element(page.getByRole('button', { name: /^Restore branch/u })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Revert/u })).not.toBeInTheDocument();
    await userEvent.keyboard('{Shift>}z{/Shift}');
    await expect.element(page.getByTestId('sent')).toHaveTextContent('Nothing sent');
});
