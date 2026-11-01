import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

import { sampleCandidateRepository, SAMPLE_CANDIDATES } from '@/testing/sampleTracking.js';

import * as stories from './TrackingChooser.stories.jsx';
import type { TrackingCandidates } from './TrackingTypes.js';

const { Choose, HiddenOrganisation, NothingToPick, NothingToPickWithSaving, SavingTicked } = composeStories(stories);

const ANY = { ago: 0, open: 0 };

/** Two owners, whose rows in the list's order rank differently; `skyline-labs` has more pages to read. */
const FILTERED: TrackingCandidates = {
    ...SAMPLE_CANDIDATES,
    repositories: {
        repositories: [
            sampleCandidateRepository('kedrzu/keynote', ANY),
            sampleCandidateRepository('kedrzu/note', ANY),
            sampleCandidateRepository('kedrzu/Żółty-theme', ANY),
            sampleCandidateRepository('kedrzu/nvim-tools-extras', ANY),
        ],
        totalCount: 4,
        nextCursor: null,
    },
    organizations: [
        {
            login: 'skyline-labs',
            avatarUrl: '',
            hiddenPrivate: false,
            repositories: {
                repositories: [
                    sampleCandidateRepository('skyline-labs/banknote', ANY),
                    sampleCandidateRepository('skyline-labs/notes', ANY),
                ],
                totalCount: 50,
                nextCursor: 'cursor-2',
            },
            projects: [],
        },
    ],
};

test('the own repositories fold after four, saying how many are chosen; an organisation shown in full reads more of its repositories when asked', async () => {
    const onLoadMore = vi.fn();
    await Choose.run({ args: { ...Choose.args, onLoadMore } });

    await expect.element(page.getByRole('checkbox', { name: /^kedrzu\/blog / })).toBeInTheDocument();
    await expect.element(page.getByRole('checkbox', { name: /^kedrzu\/notes / })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: '8 more of yours, all selected' }));
    await expect.element(page.getByRole('checkbox', { name: /^kedrzu\/nvim / })).toBeChecked();

    // skyline-labs's two chosen ones stay in sight beside its first four; its other 292 are read when asked for.
    await userEvent.click(page.getByRole('button', { name: 'Show all 312' }));
    await expect.element(page.getByRole('checkbox', { name: /^skyline-labs\/service-9 / })).toBeInTheDocument();
    expect(onLoadMore).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole('button', { name: 'Show more of the 292 others' }));
    expect(onLoadMore).toHaveBeenCalledWith('skyline-labs');
});

test('/ filters, ↓/↑ move between the matching rows and back to the filter, Space chooses, ⌘A chooses all that match, Esc clears, ⌘↵ tracks', async () => {
    const onTrack = vi.fn();
    const onLoadMore = vi.fn();
    await Choose.run({ args: { ...Choose.args, onTrack, onLoadMore } });
    const filter = page.getByRole('textbox', { name: 'Filter repositories' });
    const payments = page.getByRole('checkbox', { name: /^skyline-labs\/payments / });
    const worker = page.getByRole('checkbox', { name: /^skyline-labs\/payments-worker / });

    await userEvent.keyboard('/');
    await expect.element(filter).toHaveFocus();
    await userEvent.keyboard('pay');
    await expect.element(page.getByText('7 of 312 match “pay”')).toBeInTheDocument();
    // A filter looks through all of them: the rest are read.
    expect(onLoadMore).toHaveBeenCalledWith('skyline-labs');

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(payments).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(payments).toBeChecked();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(worker).toHaveFocus();
    await expect.element(worker).not.toBeChecked();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect.element(filter).toHaveFocus();

    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
    await expect.element(worker).toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: /^skyline-labs\/pay-e2e / })).toBeChecked();
    // Those the filter hid are left as they were.
    await userEvent.keyboard('{Escape}');
    await expect.element(filter).toHaveValue('');
    await expect.element(page.getByRole('checkbox', { name: /^skyline-labs\/mobile / })).not.toBeChecked();

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onTrack).toHaveBeenCalledOnce();
});

test("the user's own projects come first; an owner picked shows only theirs", async () => {
    await Choose.run();
    const projects = page.getByRole('region', { name: 'Projects' });

    await expect.element(projects.getByRole('checkbox').first()).toHaveAccessibleName(/^githq Roadmap/);
    await userEvent.click(page.getByRole('radio', { name: /^kedrzu / }));
    await expect.element(projects.getByRole('checkbox', { name: /^Platform Q4/ })).not.toBeInTheDocument();
    await expect.element(projects.getByRole('checkbox', { name: /^githq Roadmap/ })).toBeChecked();
});

test('an organisation hiding its private repositories says so in its group, and explains how to request approval on GitHub', async () => {
    await HiddenOrganisation.run();

    const panel = page.getByRole('region', { name: 'acme-health hides its private data from githq' });
    await expect.element(panel).toBeInTheDocument();
    const link = panel.getByRole('link', { name: 'Request approval on GitHub' });
    await expect.element(link).toHaveAttribute('href', `${window.location.origin}/api/auth/approval`);
    await expect.element(link).toHaveAttribute('target', '_blank');
    await expect.element(page.getByText('Visible meanwhile')).toBeInTheDocument();
    await expect.element(page.getByRole('checkbox', { name: /^acme-health\/fhir-tools / })).not.toBeChecked();
});

test('with nothing to pick, ⌘↵ goes on to My work', async () => {
    const onTrack = vi.fn();
    await NothingToPick.run({ args: { ...NothingToPick.args, onTrack } });

    await expect
        .element(page.getByRole('heading', { name: "You don't have any repositories yet" }))
        .toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onTrack).toHaveBeenCalledOnce();
});

test('typed text ranks the rows within each owner, whose order stays; ⌘A and the counts follow the rows shown', async () => {
    const onLoadMore = vi.fn();
    await Choose.run({ args: { ...Choose.args, candidates: FILTERED, repositories: [], projects: [], onLoadMore } });

    await userEvent.keyboard('/note');
    await expect.poll(repositoryNames).toEqual(['note', 'keynote', 'notes', 'banknote']);
    await expect.element(page.getByText('2 of 4 match “note”')).toBeInTheDocument();
    await expect.element(page.getByText('2 of 50 match “note”')).toBeInTheDocument();
    // A filter still looks through all of an owner's repositories.
    expect(onLoadMore).toHaveBeenCalledWith('skyline-labs');

    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
    for (const name of ['note', 'keynote', 'notes', 'banknote']) {
        await expect.element(repositoryRow(name)).toBeChecked();
    }

    await userEvent.keyboard('{Escape}');
    await expect.element(repositoryRow('Żółty-theme')).not.toBeChecked();
});

test('words in another order and a name without its diacritics find the same row; scattered letters do not', async () => {
    await Choose.run({ args: { ...Choose.args, candidates: FILTERED, repositories: [], projects: [] } });

    await userEvent.keyboard('/zolty');
    await expect.poll(repositoryNames).toEqual(['Żółty-theme']);

    await userEvent.keyboard('{Escape}theme zolty');
    await expect.poll(repositoryNames).toEqual(['Żółty-theme']);

    // Its letters in order, but not its words: nothing to find, nothing for ⌘A to choose.
    await userEvent.keyboard('{Escape}nvx');
    await expect.poll(repositoryNames).toEqual([]);
    await expect.element(page.getByText('0 of 4 match “nvx”')).toBeInTheDocument();
});

test('Shift+click chooses the rows shown from the last one clicked to it, down, up and across owners', async () => {
    await Choose.run({ args: { ...Choose.args, candidates: FILTERED, repositories: [], projects: [] } });

    await userEvent.click(repositoryRow('keynote'));
    await shiftClick(repositoryRow('Żółty-theme'));
    await expect.poll(chosenNames).toEqual(['keynote', 'note', 'Żółty-theme']);
    expect(window.getSelection()?.isCollapsed ?? true).toBe(true);

    // Up, from skyline-labs into the user's own.
    await userEvent.click(repositoryRow('notes'));
    await shiftClick(repositoryRow('nvim-tools-extras'));
    await expect
        .poll(chosenNames)
        .toEqual(['keynote', 'note', 'Żółty-theme', 'nvim-tools-extras', 'banknote', 'notes']);
});

test('Shift+click on a chosen row unchooses the range; Shift+Space does it from the keyboard', async () => {
    await Choose.run({
        args: {
            ...Choose.args,
            candidates: FILTERED,
            repositories: [
                'kedrzu/keynote',
                'kedrzu/note',
                'kedrzu/Żółty-theme',
                'kedrzu/nvim-tools-extras',
                'skyline-labs/banknote',
            ],
            projects: [],
        },
    });

    await userEvent.click(repositoryRow('note'));
    await shiftClick(repositoryRow('nvim-tools-extras'));
    await expect.poll(chosenNames).toEqual(['keynote', 'banknote']);

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(repositoryRow('banknote')).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect.element(repositoryRow('note')).toHaveFocus();
    await userEvent.keyboard('{Shift>} {/Shift}');
    await expect.poll(chosenNames).toEqual(['keynote', 'note', 'Żółty-theme', 'nvim-tools-extras', 'banknote']);
});

test('under a filter a range takes only the matching rows; a new filter starts without an anchor', async () => {
    await Choose.run({ args: { ...Choose.args, candidates: FILTERED, repositories: [], projects: [] } });

    await userEvent.keyboard('/note');
    await expect.poll(repositoryNames).toEqual(['note', 'keynote', 'notes', 'banknote']);
    await userEvent.click(repositoryRow('keynote'));
    await shiftClick(repositoryRow('banknote'));
    await userEvent.keyboard('/{Escape}');
    // Żółty-theme and nvim-tools-extras sit between them, filtered out: left as they were.
    await expect.poll(chosenNames).toEqual(['keynote', 'banknote', 'notes']);

    // The filter cleared, keynote no longer anchors a range: note stays unchosen.
    await shiftClick(repositoryRow('Żółty-theme'));
    await expect.poll(chosenNames).toEqual(['keynote', 'Żółty-theme', 'banknote', 'notes']);
});

test("a range stays within its list: the projects' anchor is their own", async () => {
    await Choose.run({ args: { ...Choose.args, repositories: [], projects: [] } });
    const projects = page.getByRole('region', { name: 'Projects' });

    await userEvent.click(projects.getByRole('checkbox', { name: /^githq Roadmap/ }));
    await userEvent.click(page.getByRole('checkbox', { name: /^kedrzu\/githq / }));
    await shiftClick(projects.getByRole('checkbox', { name: /^Bug triage/ }));
    await expect.element(projects.getByRole('checkbox', { name: /^Platform Q4/ })).toBeChecked();
    await expect.element(projects.getByRole('checkbox', { name: /^Bug triage/ })).toBeChecked();
    await expect.element(projects.getByRole('checkbox', { name: /^Docs revamp/ })).not.toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: /^kedrzu\/skills / })).not.toBeChecked();
});

/** The rows of the repositories' column, in order, by the name after the owner. */
function repositoryNames() {
    return page
        .getByRole('region', { name: 'Repositories' })
        .getByRole('checkbox')
        .elements()
        .map(row => /\/(.+?)\s*(?:public|private)/iu.exec(row.closest('[data-tracking-row]')?.textContent ?? '')?.[1]);
}

function repositoryRow(name: string) {
    return page.getByRole('checkbox', { name: new RegExp(`/${name} `, 'u') });
}

/** The chosen rows of the repositories' column, in order, by the name after the owner. */
function chosenNames() {
    return page
        .getByRole('region', { name: 'Repositories' })
        .getByRole('checkbox', { checked: true })
        .elements()
        .map(row => /\/(.+?)\s*(?:public|private)/iu.exec(row.closest('[data-tracking-row]')?.textContent ?? '')?.[1]);
}

async function shiftClick(row: Locator) {
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(row);
    await userEvent.keyboard('{/Shift}');
}

test('the saving choice sits above the footer; ticked, the footer says "Track these" then creates the repository', async () => {
    const onTrack = vi.fn();
    await SavingTicked.run({ args: { ...SavingTicked.args, onTrack } });

    await expect.element(page.getByRole('checkbox', { name: 'Save what I track to my GitHub account' })).toBeChecked();
    await expect.element(page.getByText('then creates mlaine/githq-settings', { exact: false })).toBeVisible();
    await expect.element(page.getByText('You can change this any time in Settings.', { exact: false })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Track these' }));
    expect(onTrack).toHaveBeenCalledOnce();
});

test('with nothing to pick, the saving choice sits above "Continue to My work"; the footer creates nothing unticked', async () => {
    await NothingToPickWithSaving.run();

    await expect
        .element(page.getByRole('checkbox', { name: 'Save what I track to my GitHub account' }))
        .not.toBeChecked();
    await expect.element(page.getByText('then creates', { exact: false })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Continue to My work' })).toBeVisible();
});
