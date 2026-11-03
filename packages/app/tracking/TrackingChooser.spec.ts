import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

import { EMPTY_CANDIDATES, sampleCandidateRepository, SAMPLE_CANDIDATES } from '@/testing/sampleTracking.js';

import * as stories from './TrackingChooser.stories.jsx';
import type { CandidateProject, CandidateRepository, TrackingCandidates } from './TrackingTypes.js';
import type { TrackingReference } from './utils/parseTrackingReference.js';

const {
    Choose,
    HiddenOrganisation,
    NothingToPick,
    NothingToPickWithSaving,
    SavingTicked,
    Picker,
    PickerNotRead,
    PickerReading,
    PickerSearching,
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

    await expect.element(page.getByRole('checkbox', { name: 'Save my settings to my GitHub account' })).toBeChecked();
    await expect.element(page.getByText('then creates mlaine/githq-settings', { exact: false })).toBeVisible();
    await expect.element(page.getByText('You can change this any time in Settings.', { exact: false })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Track these' }));
    expect(onTrack).toHaveBeenCalledOnce();
});

test('with nothing to pick, the saving choice sits above "Continue to My work"; the footer creates nothing unticked', async () => {
    await NothingToPickWithSaving.run();

    await expect
        .element(page.getByRole('checkbox', { name: 'Save my settings to my GitHub account' }))
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

/** The row of a repository, by its full name, as the text of its checkbox starts. */
function pickerRow(nameWithOwner: string) {
    const [owner, name] = nameWithOwner.split('/');
    return page.getByRole('checkbox', { name: new RegExp(`^${owner}/${name}(?: |$)`, 'u') });
}

/** The text of the row holding a repository's checkbox, its spaces plain (the translations keep a last word on its line). */
function rowText(nameWithOwner: string) {
    const text = pickerRow(nameWithOwner).element().closest('[data-tracking-row]')?.textContent ?? '';
    return text.replace(/\s/gu, ' ');
}

async function sleep(ms: number) {
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

test('T18: no heading, projects or footer; owners count tracked / all, leaving out what is tracked of anyone else', async () => {
    await Picker.run();

    await expect.element(page.getByRole('heading', { name: 'Which of these do you work on?' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: 'Projects' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Track these' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('radio', { name: /^All owners/ })).toHaveAccessibleName(/15 of\s327 tracked/);
    await expect.element(page.getByRole('radio', { name: /^kedrzu/ })).toHaveAccessibleName(/12 of\s12 tracked/);
    await expect.element(page.getByRole('radio', { name: /^skyline-labs/ })).toHaveAccessibleName(/3 of\s312 tracked/);
    await expect.element(page.getByRole('radio', { name: /^acme-health/ })).toHaveAccessibleName(/0 of\s3 tracked/);
});

test('T18: an owner with everything tracked folds to its header, and Show unfolds it with nothing to select', async () => {
    await Picker.run();

    await expect.element(page.getByText('your repositories · all 12 tracked')).toBeInTheDocument();
    await expect.element(pickerRow('kedrzu/githq')).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Show', exact: true }));
    await expect.element(pickerRow('kedrzu/githq')).toBeChecked();
    expect(rowText('kedrzu/githq')).toContain('tracked');
    await expect.element(page.getByRole('button', { name: 'Show', exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Select / }).first()).toHaveTextContent(/^Select all 3/u);
});

test('T18: the group says tracked and picked, shows all when folded; tracked rows stay in sight, one not read yet too, and "N more" is not said', async () => {
    await Picker.run();

    await expect.element(page.getByText('organisation · 3 of 312 tracked · 2 picked')).toBeInTheDocument();
    await expect.element(pickerRow('skyline-labs/webapp')).toBeChecked();
    await expect.element(pickerRow('skyline-labs/legacy-billing')).toBeChecked();
    await expect.element(page.getByText(/^\d+ more$/u)).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'Show all 312' }));
    await expect.element(pickerRow('skyline-labs/service-9')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Select all \d+/u }).first()).toBeInTheDocument();
});

test('T18: a tracked row keeps its grey tick and says "tracked": Space and a click do nothing, and it is not a pick', async () => {
    const onPick = vi.fn();
    await Picker.run({ args: { ...Picker.args, 'onUpdate:repositories': onPick } });
    const webapp = pickerRow('skyline-labs/webapp');

    expect(rowText('skyline-labs/webapp')).toContain('tracked');
    await expect.element(webapp).toHaveAttribute('aria-readonly', 'true');
    await userEvent.click(webapp);
    await expect.element(webapp).toBeChecked();
    webapp.element().focus();
    await userEvent.keyboard(' ');
    await expect.element(webapp).toBeChecked();
    await expect.element(webapp).toHaveFocus();
    expect(onPick).not.toHaveBeenCalled();
    await expect.element(page.getByText('organisation · 3 of 312 tracked · 2 picked')).toBeInTheDocument();
});

test('T18: a range, ⌘A and Select all skip what is tracked; Select none leaves it ticked', async () => {
    const picks = vi.fn();
    const web = ['skyline-labs/web-admin', 'skyline-labs/webhooks', 'skyline-labs/website'];
    await PickerSearching.run({ args: { ...PickerSearching.args, 'onUpdate:repositories': picks } });
    await expect.element(pickerRow('skyline-labs/webapp')).toBeChecked();

    // ⌘A in the filter.
    page.getByRole('textbox', { name: 'Filter repositories' }).element().focus();
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
    expect(picks).toHaveBeenLastCalledWith(web);
    await expect
        .element(page.getByText('organisation · 4 matches for “web” · 1 tracked · 3 picked'))
        .toBeInTheDocument();

    // Select none, over what can be picked: the tracked row keeps its tick.
    await userEvent.click(page.getByRole('button', { name: 'Select none' }));
    expect(picks).toHaveBeenLastCalledWith([]);
    await expect.element(pickerRow('skyline-labs/webapp')).toBeChecked();

    // Select all counts only those.
    await userEvent.click(page.getByRole('button', { name: 'Select all 3' }));
    expect(picks).toHaveBeenLastCalledWith(web);
    await userEvent.click(page.getByRole('button', { name: 'Select none' }));

    // A range across the tracked row.
    await userEvent.click(pickerRow('skyline-labs/web-admin'));
    await shiftClick(pickerRow('skyline-labs/website'));
    expect(picks).toHaveBeenLastCalledWith(web);
    await expect.element(pickerRow('skyline-labs/webapp')).toBeChecked();
});

test('T1: a search narrows every owner, and leaves out those it matches nothing of', async () => {
    await PickerSearching.run();

    await expect.element(page.getByText('organisation · 4 matches for “web” · 1 tracked')).toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'kedrzu' })).not.toBeInTheDocument();
    await expect.poll(repositoryNames).toEqual(['webapp', 'web-admin', 'webhooks', 'website']);
});

test('the picker starts on an owner it is told; one GitHub does not list leaves all owners', async () => {
    await Picker.run({ args: { ...Picker.args, initialOwner: 'skyline-labs' } });
    await expect.element(page.getByRole('radio', { name: /^skyline-labs/ })).toBeChecked();
    await expect.element(page.getByRole('heading', { name: 'kedrzu' })).not.toBeInTheDocument();

    await Picker.run({ args: { ...Picker.args, initialOwner: 'nuxt' } });
    await expect.element(page.getByRole('radio', { name: /^All owners/ })).toBeChecked();
});

test('never G10: with nothing to pick, the filter is there to look up', async () => {
    await Picker.run({ args: { ...Picker.args, candidates: EMPTY_CANDIDATES, tracked: [], repositories: [] } });

    await expect.element(page.getByRole('textbox', { name: 'Filter repositories' })).toBeInTheDocument();
    await expect
        .element(page.getByRole('heading', { name: "You don't have any repositories yet" }))
        .not.toBeInTheDocument();
});

test('while the lists are read it says so and looks nothing up; failed, it says so and a name is still looked up', async () => {
    const find = vi.fn(() => Promise.resolve(sampleCandidateRepository('rust-lang/rust', { ago: 60_000, open: 88 })));
    await PickerReading.run({ args: { ...PickerReading.args, find, filter: 'rust-lang/rust' } });
    await expect.element(page.getByRole('status')).toHaveTextContent('Reading your repositories…');
    await sleep(400);
    expect(find).not.toHaveBeenCalled();

    await PickerNotRead.run({ args: { ...PickerNotRead.args, find, filter: 'rust-lang/rust' } });
    await expect.element(page.getByRole('alert')).toHaveTextContent("GitHub didn't list your repositories.");
    await expect.element(pickerRow('rust-lang/rust')).not.toBeChecked();
    await expect.element(page.getByRole('heading', { name: 'rust-lang' })).toBeInTheDocument();
});

test("`?q=`: someone else's repository is looked up and offered; ticked, it is picked and handed on", async () => {
    const rust = sampleCandidateRepository('rust-lang/rust', { ago: 7_200_000, open: 88 });
    const find = vi.fn(() => Promise.resolve(rust));
    const onFound = vi.fn();
    await PickerSearching.run({
        args: { ...PickerSearching.args, filter: 'rust-lang/rust', find, onFound },
    });

    await expect.element(pickerRow('rust-lang/rust')).not.toBeChecked();
    expect(find).toHaveBeenCalledWith({ kind: 'repository', owner: 'rust-lang', name: 'rust' });
    expect(rowText('rust-lang/rust')).toContain('88 open');
    await userEvent.click(pickerRow('rust-lang/rust'));
    expect(onFound).toHaveBeenCalledWith(rust);
    await expect.element(page.getByText('1 match for “rust-lang/rust” · 1 picked')).toBeInTheDocument();
});

test("someone else's repository already tracked looks up to a fixed tick; one listed is not looked up", async () => {
    const vite = sampleCandidateRepository('vitejs/vite', { ago: 60_000, open: 5 });
    const find = vi.fn(() => Promise.resolve(vite));
    const onFound = vi.fn();
    await Picker.run({ args: { ...Picker.args, filter: 'vitejs/vite', find, onFound } });

    await expect.element(pickerRow('vitejs/vite')).toBeChecked();
    await expect.element(pickerRow('vitejs/vite')).toHaveAttribute('aria-readonly', 'true');
    await userEvent.click(pickerRow('vitejs/vite'));
    expect(onFound).not.toHaveBeenCalled();

    const listed = vi.fn(() => Promise.resolve(null));
    await Picker.run({ args: { ...Picker.args, filter: 'skyline-labs/portal', find: listed } });
    await expect.element(pickerRow('skyline-labs/portal')).toBeInTheDocument();
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
    await Picker.run({ args: { ...Picker.args, find } });

    // Typed through: only what settled is asked for.
    await userEvent.keyboard('/first/one');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    expect(find).toHaveBeenCalledWith({ kind: 'repository', owner: 'first', name: 'one' });

    await userEvent.keyboard('{Escape}second/two');
    await vi.waitFor(() => expect(find).toHaveBeenCalledTimes(2));

    answers.get('second')?.(sampleCandidateRepository('second/two', { ago: 60_000, open: 1 }));
    await expect.element(pickerRow('second/two')).toBeInTheDocument();

    answers.get('first')?.(sampleCandidateRepository('first/one', { ago: 60_000, open: 1 }));
    await sleep(50);
    await expect.element(pickerRow('second/two')).toBeInTheDocument();
    await expect.element(pickerRow('first/one')).not.toBeInTheDocument();
});

test('not found: the line says nothing matches', async () => {
    await Picker.run({ args: { ...Picker.args, filter: 'nobody/nothing' } });

    await expect.element(page.getByText('Nothing you can see matches “nobody/nothing”.')).toBeInTheDocument();
});

test('the filter counts what it looks through: one repository, or many', async () => {
    const single: TrackingCandidates = {
        ...EMPTY_CANDIDATES,
        repositories: {
            repositories: [sampleCandidateRepository('kedrzu/githq', ANY)],
            totalCount: 1,
            nextCursor: null,
        },
    };
    await Choose.run({ args: { ...Choose.args, candidates: single } });
    const filter = page.getByRole('textbox', { name: 'Filter repositories' });
    await expect.element(filter).toHaveAttribute('placeholder', expect.stringMatching(/^Filter 1\srepository…$/u));

    await Choose.run();
    await expect.element(filter).toHaveAttribute('placeholder', expect.stringMatching(/^Filter 327\srepositories…$/u));
});
