import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

import {
    EMPTY_CANDIDATES,
    sampleCandidateProject,
    sampleCandidateRepository,
    SAMPLE_CANDIDATES,
} from '@/testing/sampleTracking.js';

import * as stories from './TrackingChooser.stories.jsx';
import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

const {
    Choose,
    HiddenOrganisation,
    NothingToPick,
    NothingToPickWithSaving,
    SavingTicked,
    Settings,
    SettingsReading,
    SettingsSearching,
} = composeStories(stories);

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

test('busy, ⌘↵ and "Track these" do nothing, and "Only my repositories" shows as disabled but keeps its focus', async () => {
    const onTrack = vi.fn();
    await Choose.run({ args: { ...Choose.args, busy: true, onTrack } });

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    await userEvent.click(page.getByRole('button', { name: 'Track these' }));
    expect(onTrack).not.toHaveBeenCalled();

    const onlyMine = page.getByRole('button', { name: 'Only my repositories' });
    await expect.element(onlyMine).toHaveAttribute('aria-disabled', 'true');
    onlyMine.element().focus();
    await expect.element(onlyMine).toHaveFocus();
});

type Found = CandidateProject | CandidateRepository | null;

const filterField = () => page.getByRole('textbox', { name: 'Filter repositories' });
const pending = () => page.getByRole('region', { name: 'Changes to save' });

/** The row of a repository, by its full name, as the text of its checkbox starts. */
function settingsRow(nameWithOwner: string) {
    const [owner, name] = nameWithOwner.split('/');
    return page.getByRole('checkbox', { name: new RegExp(`^${owner}/${name}(?: |$)`, 'u') });
}

/** How many rows a repository has: one, or none. */
function rowCount(nameWithOwner: string) {
    return settingsRow(nameWithOwner).elements().length;
}

/** The text of the row holding a repository's checkbox, its spaces plain (the translations keep a last word on its line). */
function rowText(nameWithOwner: string) {
    const text = settingsRow(nameWithOwner).element().closest('[data-tracking-row]')?.textContent ?? '';
    return text.replace(/\s/gu, ' ');
}

async function sleep(ms: number) {
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

test('G8: ticks are what is tracked; rows say how they stand or what saving will do; counts say "tracked"', async () => {
    await Settings.run();

    await expect.element(page.getByRole('heading', { name: 'Which of these do you work on?' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Track these' })).not.toBeInTheDocument();
    await expect.element(page.getByText('your repositories · 11 of 12 tracked')).toBeInTheDocument();
    await expect.element(page.getByText('organisation · 6 of 312 tracked')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: '8 more of yours, all tracked' })).toBeInTheDocument();
    await expect.element(page.getByText('2 of 6 tracked')).toBeInTheDocument();

    expect(rowText('kedrzu/githq')).toContain('synced 14s ago');
    expect(rowText('kedrzu/blog')).toContain('will be untracked');
    expect(rowText('skyline-labs/mobile')).toContain('will be tracked');
    expect(rowText('skyline-labs/api')).toContain('downloading 412 of 1,180');
    expect(rowText('skyline-labs/payments')).toContain('active 1h ago');
    expect(rowText('acme-health/records')).toContain('Not shown to githq');
    expect(rowText('vitejs/vite')).toContain('checked every 5 min');
    await expect
        .element(page.getByRole('checkbox', { name: /^Tauri roadmap/ }))
        .toHaveAccessibleName(/GitHub refuses its changes/);

    // Untracking one more: the group's action and its count follow the ticks.
    await expect.element(page.getByRole('button', { name: 'Track all' }).first()).toBeInTheDocument();
    await userEvent.click(settingsRow('kedrzu/blog'));
    await expect.element(page.getByText('your repositories · 12 of 12 tracked')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Untrack all' }).first()).toBeInTheDocument();
});

test('the bar names the changes and saves them with ⌘↵; it is gone, and ⌘↵ does nothing, with nothing staged', async () => {
    const onSave = vi.fn();
    await Settings.run({ args: { ...Settings.args, onSave } });

    await expect
        .element(pending())
        .toHaveTextContent('2 changes · start tracking skyline-labs/mobile · stop tracking kedrzu/blog');
    await expect.element(pending()).toHaveTextContent('Untracking deletes the copy in this browser.');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(onSave).toHaveBeenCalledOnce();
    await userEvent.click(pending().getByRole('button', { name: 'Save 2 changes' }));
    expect(onSave).toHaveBeenCalledTimes(2);

    // Only tracking: no word about deleting; many: the first few named, then how many more.
    await userEvent.click(settingsRow('kedrzu/blog'));
    await expect.element(pending()).toHaveTextContent('1 change · start tracking skyline-labs/mobile');
    await expect.element(pending()).not.toHaveTextContent('Untracking');
    await expect.element(pending().getByRole('button', { name: 'Save 1 change' })).toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Show all 312' }));
    for (const name of ['skyline-labs/payments', 'skyline-labs/payments-worker', 'skyline-labs/service-1']) {
        await userEvent.click(settingsRow(name));
    }

    await expect
        .element(pending())
        .toHaveTextContent(
            '4 changes · start tracking skyline-labs/mobile, skyline-labs/payments, skyline-labs/payments-worker · +1 more',
        );

    const unstaged = vi.fn();
    await SettingsSearching.run({ args: { ...SettingsSearching.args, onSave: unstaged } });
    await expect.element(page.getByRole('region', { name: 'Changes to save' })).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(unstaged).not.toHaveBeenCalled();
});

test('Esc clears the filter first, then discards; not while a layer is open, nor when something else took it', async () => {
    const onDiscard = vi.fn();
    await Settings.run({ args: { ...Settings.args, onDiscard } });

    await userEvent.keyboard('/pay');
    await userEvent.keyboard('{Escape}');
    await expect.element(filterField()).toHaveValue('');
    expect(onDiscard).not.toHaveBeenCalled();

    const layer = document.createElement('div');
    layer.dataset.layer = '';
    document.body.append(layer);
    await userEvent.keyboard('{Escape}');
    layer.remove();
    expect(onDiscard).not.toHaveBeenCalled();

    const takeEscape = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener('keydown', takeEscape, { capture: true });
    await userEvent.keyboard('{Escape}');
    window.removeEventListener('keydown', takeEscape, { capture: true });
    expect(onDiscard).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onDiscard).toHaveBeenCalledOnce();
    await expect.element(settingsRow('kedrzu/blog')).toBeChecked();
    await expect.element(settingsRow('skyline-labs/mobile')).not.toBeChecked();
    await expect.element(pending()).not.toBeInTheDocument();
});

test('what is tracked shows once, wherever it is: under its owner before its page is read and after, else "Elsewhere"', async () => {
    const onLoadMore = vi.fn();
    await Settings.run({ args: { ...Settings.args, onLoadMore } });

    // On a page not read yet: under skyline-labs, said so, and once.
    await expect.element(settingsRow('skyline-labs/legacy-billing')).toBeChecked();
    expect(rowCount('skyline-labs/legacy-billing')).toBe(1);
    expect(rowText('skyline-labs/legacy-billing')).toContain('not read yet');
    // Someone else's: under "Elsewhere"; one GitHub no longer shows: under its owner.
    await expect.element(page.getByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument();
    await expect.element(page.getByText('tracked from other owners')).toBeInTheDocument();
    await expect.element(settingsRow('vitejs/vite')).toBeChecked();
    await expect.element(settingsRow('acme-health/records')).toBeChecked();
    await expect.element(page.getByRole('checkbox', { name: /^Tauri roadmap/ })).toBeChecked();

    // Its page arrives: still one row, now with what GitHub tells.
    await userEvent.click(page.getByRole('button', { name: 'Show all 312' }));
    await userEvent.click(page.getByRole('button', { name: /^Show more of the/ }));
    expect(onLoadMore).toHaveBeenCalledWith('skyline-labs');
    await expect.poll(() => rowText('skyline-labs/legacy-billing')).toContain('3 open');
    expect(rowCount('skyline-labs/legacy-billing')).toBe(1);

    // Unticked, it says what saving will do.
    await userEvent.click(settingsRow('vitejs/vite'));
    expect(rowText('vitejs/vite')).toContain('will be untracked');
    await expect.element(pending()).toHaveTextContent('stop tracking kedrzu/blog, vitejs/vite');
});

test('while the lists are read, what is tracked shows by owner and can be unticked; failed, it still does', async () => {
    await SettingsReading.run();

    await expect.element(page.getByRole('status')).toHaveTextContent('Reading your repositories…');
    await expect.element(page.getByRole('heading', { name: 'skyline-labs' })).toBeInTheDocument();
    await expect.element(settingsRow('kedrzu/githq')).toBeChecked();
    expect(rowCount('skyline-labs/api')).toBe(1);
    expect(rowText('skyline-labs/api')).toContain('downloading 412 of 1,180');
    await userEvent.click(settingsRow('kedrzu/githq'));
    await expect.element(pending()).toHaveTextContent('1 change · stop tracking kedrzu/githq');
    await expect.element(page.getByRole('checkbox', { name: /^githq Roadmap/ })).toBeChecked();

    await SettingsReading.run({ args: { ...SettingsReading.args, reading: false } });
    await expect.element(page.getByText('Reading your repositories…')).not.toBeInTheDocument();
    await expect.element(settingsRow('skyline-labs/portal')).toBeChecked();
});

test('the settings form never offers G10, even with nothing to pick', async () => {
    await Settings.run({
        args: {
            ...Settings.args,
            candidates: EMPTY_CANDIDATES,
            tracked: { repositories: [], projects: [] },
            repositories: [],
            projects: [],
        },
    });

    await expect.element(filterField()).toBeInTheDocument();
    await expect
        .element(page.getByRole('heading', { name: "You don't have any repositories yet" }))
        .not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Continue to My work' })).not.toBeInTheDocument();
});

test('T1: a search narrows every owner, tracked and not alike, and the group says how many of the matches are tracked', async () => {
    await SettingsSearching.run();

    await expect.element(page.getByText('organisation · 4 matches for “web” · 2 tracked')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'kedrzu' })).not.toBeInTheDocument();
    await expect.poll(repositoryNames).toEqual(['webapp', 'web-admin', 'webhooks', 'website']);
    await expect.element(settingsRow('skyline-labs/webapp')).toBeChecked();
    await expect.element(settingsRow('skyline-labs/webhooks')).not.toBeChecked();

    await userEvent.click(page.getByRole('button', { name: 'Track all' }));
    await expect.element(settingsRow('skyline-labs/website')).toBeChecked();
    await expect.element(page.getByText('organisation · 4 matches for “web” · 4 tracked')).toBeInTheDocument();
});

test("`?q=`: someone else's repository is looked up and offered; ticked, it will be tracked and is handed on", async () => {
    const vite = sampleCandidateRepository('rust-lang/rust', { ago: 7_200_000, open: 88 });
    const find = vi.fn(() => Promise.resolve(vite));
    const onFound = vi.fn();
    await Settings.run({ args: { ...Settings.args, initialSearch: 'rust-lang/rust', find, onFound } });

    await expect.element(settingsRow('rust-lang/rust')).not.toBeChecked();
    expect(find).toHaveBeenCalledWith({ kind: 'repository', owner: 'rust-lang', name: 'rust' });
    expect(rowText('rust-lang/rust')).toContain('88 open');
    await userEvent.click(settingsRow('rust-lang/rust'));
    expect(onFound).toHaveBeenCalledWith(vite);
    expect(rowText('rust-lang/rust')).toContain('will be tracked');
});

test("a project's address is looked up and offered; one already listed is not looked up", async () => {
    const project = sampleCandidateProject('Roadmap', 'vuejs', 7, 9);
    const find = vi.fn(() => Promise.resolve(project));
    await Settings.run({
        args: { ...Settings.args, find, initialSearch: 'https://github.com/orgs/vuejs/projects/7/views/1' },
    });
    const projects = page.getByRole('region', { name: 'Projects' });
    await expect.element(projects.getByRole('checkbox', { name: /^Roadmap/ })).not.toBeChecked();
    expect(find).toHaveBeenCalledWith({ kind: 'project', owner: 'vuejs', ownerKind: 'org', number: 7 });
    expect(find).toHaveBeenCalledTimes(1);

    const listed = vi.fn(() => Promise.resolve(null));
    await Settings.run({
        args: { ...Settings.args, find: listed, initialSearch: 'https://github.com/orgs/skyline-labs/projects/3' },
    });
    await expect.element(projects.getByRole('checkbox', { name: /^Bug triage/ })).toBeInTheDocument();
    await sleep(400);
    expect(listed).not.toHaveBeenCalled();
});

test('lookups cannot race: one per settled input, and a stale answer never replaces the current one', async () => {
    const answers = new Map<string, (found: Found) => void>();
    const find = vi.fn(
        (reference: TrackingReference) =>
            new Promise<Found>(resolve => {
                answers.set(reference.owner, resolve);
            }),
    );
    await Settings.run({ args: { ...Settings.args, find } });

    // Typed through: only what settled is asked for.
    await userEvent.keyboard('/first/one');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    expect(find).toHaveBeenCalledWith({ kind: 'repository', owner: 'first', name: 'one' });

    // Esc clears the filter, and discards nothing.
    await userEvent.keyboard('{Escape}second/two');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(2));

    answers.get('second')?.(sampleCandidateRepository('second/two', { ago: 60_000, open: 1 }));
    await expect.element(settingsRow('second/two')).toBeInTheDocument();

    answers.get('first')?.(sampleCandidateRepository('first/one', { ago: 60_000, open: 1 }));
    await sleep(50);
    await expect.element(settingsRow('second/two')).toBeInTheDocument();
    await expect.element(settingsRow('first/one')).not.toBeInTheDocument();
});

test('not found: the line says nothing matches', async () => {
    await Settings.run({ args: { ...Settings.args, initialSearch: 'nobody/nothing' } });

    await expect.element(page.getByText('Nothing you can see matches “nobody/nothing”.')).toBeInTheDocument();
});
