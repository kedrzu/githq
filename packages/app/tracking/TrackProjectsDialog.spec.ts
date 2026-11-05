import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, ref } from 'vue';

import { useCommands } from '@/commands/useCommands.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { answerTrackingCandidates } from '@/testing/answerTrackingCandidates.js';
import type { AnswerTrackingCandidatesOptions } from '@/testing/answerTrackingCandidates.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { PendingUntracks } from './PendingUntracks.js';
import { TrackingStore } from './TrackingStore.js';
import TrackProjectsDialog from './TrackProjectsDialog.vue';

/** How the dialog is opened. */
interface OpenParams {
    /** Tracked by the time it opens, as `owner/number`. */
    readonly tracked?: readonly string[];
    /** Pending untrack by the time it opens, as `owner/number`. */
    readonly pending?: readonly string[];
    readonly owner?: string;
    readonly search?: string;
    readonly github?: Partial<AnswerTrackingCandidatesOptions>;
    readonly screenKey?: () => void;
}

/** T22's projects: mlaine's own, fitloop's six (one closed), and acme-health, which can't list its projects. */
const PROJECTS: AnswerTrackingCandidatesOptions['projects'] = {
    mlaine: [{ title: 'tasklet Roadmap', number: 1, daysAgo: 1, items: 34 }],
    fitloop: [
        { title: 'Platform Q4', number: 12, daysAgo: 0.1, items: 128 },
        { title: 'Docs revamp', number: 9, daysAgo: 0.5, items: 12 },
        { title: 'Bug triage', number: 7, daysAgo: 1.2, items: 61 },
        { title: 'Mobile 2.0', number: 15, daysAgo: 2, items: 210 },
        { title: 'Hiring pipeline', number: 3, daysAgo: 21, items: 19 },
        { title: 'Q3 Launch', number: 11, daysAgo: 40, items: 88, closed: true },
    ],
};
/** What T22 tracks. */
const T22_TRACKED = ['mlaine/1', 'fitloop/12', 'fitloop/9'];

const dialog = () => page.getByRole('dialog', { name: 'Track projects' });
const filter = () => dialog().getByRole('textbox', { name: 'Filter projects' });
const trackButton = () => dialog().getByRole('button', { name: /^Track .*project/u });

test("T22: its title, description and width; the owners' tracked / all, the hidden one's – / – in amber; the filter, sort and note", async () => {
    await open({ tracked: T22_TRACKED });

    // `\s`: the translations keep short words with the next one by no-break spaces.
    await expect
        .element(dialog())
        .toHaveAccessibleDescription(
            /^What\syou\stick\sis\scopied\sinto\sthis\sbrowser,\swith\severy\sitem\sit\sholds,\sand\skept\sin\ssync\sfrom\snow\son\.$/u,
        );
    expect(dialog().element().getBoundingClientRect().width).toBe(1040);

    await expect.element(owner('All owners')).toHaveAccessibleName(/^All\sowners\s3\sof\s7\stracked$/u);
    await expect.element(owner('All owners')).toHaveTextContent('3 / 7');
    await expect.element(owner('mlaine')).toHaveTextContent('1 / 1');
    await expect.element(owner('fitloop')).toHaveTextContent('2 / 6');
    await expect.element(owner('acme-health')).toHaveTextContent('– / –');
    await expect.element(owner('acme-health')).toHaveAccessibleName(/^acme-health\sprojects\scan't\sbe\slisted$/u);
    const hiddenCount = owner('acme-health').getByText('– / –').element();
    const plainCount = owner('fitloop').getByText('2 / 6').element();
    expect(getComputedStyle(hiddenCount).color).not.toBe(getComputedStyle(plainCount).color);

    await expect.element(filter()).toHaveAttribute('placeholder', 'Filter 7 projects…');
    await expect.element(dialog().getByText('Recently updated')).toBeVisible();
    await expect
        .element(dialog().getByText(/A\stracked\sproject\sbrings\sall\sits\sitems/u))
        .toHaveTextContent(
            /including\sthose\sin\srepositories\syou\sdon't\strack\.\sIts\sviews,\sfields\sand\siterations\scome\salong\.$/u,
        );
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');
    await expect.element(trackButton()).toBeDisabled();
    await expect.element(trackButton()).toHaveTextContent('Track projects');
});

test('T22: projects by owner, newest update first; a fully tracked owner folds to its header; tracked rows fixed; closed ones behind Show closed', async () => {
    await open({ tracked: T22_TRACKED });

    await expect.element(groupDetail(/^your\sprojects\s·\sall\s1\stracked$/u)).toBeVisible();
    await expect.element(row('tasklet Roadmap')).not.toBeInTheDocument();
    await expect.element(groupDetail(/^organisation\s·\s2\sof\s6\stracked$/u)).toBeVisible();
    await expect.element(groupDetail(/^organisation\s·\sprojects\shidden$/u)).toBeVisible();
    await expect
        .element(dialog().getByText(/acme-health\shasn't\sapproved\sgithq,\sso\sits\sprojects\scan't\sbe\slisted\./u))
        .toBeVisible();

    // The label wraps the box: what names the checkbox.
    const titles = [...dialog().getByRole('checkbox').elements()].map(element =>
        element.closest('label')?.textContent?.replace(/\s+/gu, ' ').trim(),
    );
    expect(titles).toEqual([
        'Platform Q4 #12',
        'Docs revamp #9',
        'Bug triage #7',
        'Mobile 2.0 #15',
        'Hiring pipeline #3',
    ]);

    for (const title of ['Platform Q4', 'Docs revamp']) {
        await expect.element(row(title)).toBeChecked();
        await expect.element(row(title)).toHaveAttribute('aria-readonly', 'true');
        expect(await rowText(title)).toMatch(/tracked$/u);
    }

    expect(await rowText('Bug triage')).toMatch(/^Bug\striage\s*#7\s*61\sitems\s*updated\s1d\sago$/u);
    await expect.element(row('Bug triage')).not.toBeChecked();
    // A tracked one can't be unticked.
    await userEvent.click(row('Platform Q4'));
    await expect.element(row('Platform Q4')).toBeChecked();
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');

    await expect.element(dialog().getByText(/1\sclosed\sproject\shidden:\sQ3\sLaunch\s\(#11\)/u)).toBeVisible();
    await expect.element(row('Q3 Launch')).not.toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Show closed' }));
    await expect.element(row('Q3 Launch')).toBeInTheDocument();

    await userEvent.click(dialog().getByRole('button', { name: 'Show', exact: true }));
    await expect.element(row('tasklet Roadmap')).toHaveAttribute('aria-readonly', 'true');
});

test('the footer names the pick; tracking is one write, after the others, and it closes', async () => {
    const { tracking } = await open({ tracked: T22_TRACKED });

    await userEvent.click(row('Bug triage'));
    await expect.element(dialog()).toHaveTextContent('1 picked: fitloop/Bug triage');
    await expect.element(groupDetail(/^organisation\s·\s2\sof\s6\stracked\s·\s1\spicked$/u)).toBeVisible();
    await expect.element(trackButton()).toHaveTextContent('Track 1 project');

    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });
    await userEvent.click(trackButton());

    expect(writes).toBe(1);
    expect(trackedTitles(tracking)).toEqual(['tasklet Roadmap', 'Platform Q4', 'Docs revamp', 'Bug triage']);
    await expect.element(dialog()).not.toBeInTheDocument();
});

test('Select all, ⌘A and a Shift+click range pick only what can be picked: never a tracked one', async () => {
    await open({ tracked: ['fitloop/9'] });
    // mlaine's comes first.
    const selectAll = () =>
        dialog()
            .getByRole('button', { name: /^Select (?:all|none)$/u })
            .nth(1);

    await expect.element(selectAll()).toHaveTextContent('Select all');
    await userEvent.click(selectAll());
    await expect
        .element(dialog())
        .toHaveTextContent(
            '4 picked: fitloop/Platform Q4, fitloop/Bug triage, fitloop/Mobile 2.0, fitloop/Hiring pipeline',
        );
    await expect.element(selectAll()).toHaveTextContent('Select none');
    await userEvent.click(selectAll());
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');

    // Over Docs revamp, tracked.
    await userEvent.click(row('Platform Q4'));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(row('Bug triage'));
    await userEvent.keyboard('{/Shift}');
    await expect.element(dialog()).toHaveTextContent('2 picked: fitloop/Platform Q4, fitloop/Bug triage');
    await userEvent.click(selectAll());
    await userEvent.click(selectAll());

    await userEvent.fill(filter(), 'r');
    await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}');
    const summary = dialog().getByText(/\d picked: /u);
    await expect.element(summary).toHaveTextContent(/Platform Q4/u);
    await expect.element(summary).not.toHaveTextContent(/Docs revamp/u);
});

test('one being untracked counts as not tracked: picked and tracked, its untrack is taken back, with no write', async () => {
    const { tracking, pending } = await open({ tracked: T22_TRACKED, pending: ['fitloop/12'] });
    const target = { kind: 'project', id: 'PVT_fitloop_12' } as const;

    await expect.element(owner('fitloop')).toHaveTextContent('1 / 6');
    await expect.element(row('Platform Q4')).not.toBeChecked();
    await expect.element(row('Platform Q4')).not.toHaveAttribute('aria-readonly');
    await userEvent.click(row('Platform Q4'));
    await expect.element(dialog()).toHaveTextContent('1 picked: fitloop/Platform Q4');

    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });
    await userEvent.click(trackButton());

    expect(pending.isPending(target)).toBe(false);
    expect(writes).toBe(0);
    expect(trackedTitles(tracking)).toEqual(['tasklet Roadmap', 'Platform Q4', 'Docs revamp']);
});

test('Esc closes without asking, and the picks are gone on opening again', async () => {
    const { tracking, setOpen } = await open({ tracked: [] });

    await userEvent.click(row('Bug triage'));
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog()).not.toBeInTheDocument();
    expect(trackedTitles(tracking)).toEqual([]);

    setOpen(true);
    await expect.element(dialog()).toHaveTextContent('Nothing picked yet');
    await expect.element(row('Bug triage')).not.toBeChecked();
});

test("J and K and the arrows move from the moment it opens, Space ticks, / filters, ⌘↵ tracks; the screen's keys don't run", async () => {
    const screenKey = vi.fn();
    const { tracking } = await open({ tracked: [], screenKey });

    await userEvent.keyboard('j');
    await expect.element(row('tasklet Roadmap')).toHaveFocus();
    await userEvent.keyboard('j');
    await expect.element(row('Platform Q4')).toHaveFocus();
    await userEvent.keyboard('k');
    await expect.element(row('tasklet Roadmap')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await expect.element(row('Docs revamp')).toHaveFocus();
    await userEvent.keyboard(' ');
    await expect.element(row('Docs revamp')).toBeChecked();

    for (const key of ['a', '1', '{Backspace}']) {
        await userEvent.keyboard(key);
    }

    expect(screenKey).not.toHaveBeenCalled();

    await userEvent.keyboard('/');
    await expect.element(filter()).toHaveFocus();
    await userEvent.keyboard('j');
    await expect.element(filter()).toHaveValue('j');
    await userEvent.keyboard('{Backspace}');

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');
    expect(trackedTitles(tracking)).toEqual(['Docs revamp']);
    await expect.element(dialog()).not.toBeInTheDocument();
});

test('⌘↵ with nothing picked neither tracks nor closes', async () => {
    const { tracking } = await open({ tracked: [] });
    let writes = 0;
    tracking.onLocalChange(() => {
        writes += 1;
    });

    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(writes).toBe(0);
    await expect.element(dialog()).toBeInTheDocument();
});

test('it opens on an owner (Track more); the hidden one explains itself', async () => {
    await open({ tracked: [], owner: 'fitloop' });

    await expect.element(owner('fitloop')).toBeChecked();
    await expect.element(dialog().getByRole('heading', { name: 'mlaine', exact: true })).not.toBeInTheDocument();
    await expect.element(row('Bug triage')).toBeInTheDocument();

    await userEvent.click(owner('All owners'));
    await userEvent.click(dialog().getByRole('button', { name: 'Why, and how to fix' }));
    await expect.element(owner('acme-health')).toBeChecked();
    await expect
        .element(dialog().getByRole('region', { name: 'acme-health hides its private data from githq' }))
        .toBeVisible();
});

test("it opens with a search (`?q=`): someone else's project is looked up by its address, picked and tracked", async () => {
    const { tracking } = await open({
        tracked: ['fitloop/12'],
        search: 'https://github.com/orgs/vitejs/projects/4',
        github: { projectLookups: { vitejs: [{ title: 'Vite 7', number: 4, items: 40 }] } },
    });

    await expect.element(filter()).toHaveValue('https://github.com/orgs/vitejs/projects/4');
    await expect.element(dialog().getByRole('heading', { name: 'vitejs', exact: true })).toBeInTheDocument();
    await userEvent.click(row('Vite 7'));
    await expect.element(dialog()).toHaveTextContent('1 picked: vitejs/Vite 7');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(trackedTitles(tracking)).toEqual(['Platform Q4', 'Vite 7']);
});

test('`owner/number` looks a project up too; one listed is just shown', async () => {
    const { tracking } = await open({
        tracked: [],
        github: { projectLookups: { vitejs: [{ title: 'Vite 7', number: 4, items: 40 }] } },
    });

    await userEvent.fill(filter(), 'fitloop/7');
    await expect.element(row('Bug triage')).toBeInTheDocument();
    await expect.element(row('Mobile 2.0')).not.toBeInTheDocument();

    await userEvent.fill(filter(), 'nobody/5');
    await expect.element(dialog().getByText(/Nothing\syou\scan\ssee\smatches/u)).toBeVisible();

    await userEvent.fill(filter(), 'vitejs/4');
    await userEvent.click(row('Vite 7'));
    await userEvent.click(trackButton());
    expect(trackedTitles(tracking)).toEqual(['Vite 7']);
});

function trackedTitles(tracking: TrackingStore) {
    return tracking.projects.map(project => project.title);
}

function owner(login: string) {
    return dialog()
        .getByRole('radiogroup', { name: 'Owners' })
        .getByRole('radio', { name: new RegExp(`^${login}\\s`, 'u') });
}

/** A group's detail beside its owner's name ("organisation · 2 of 6 tracked"). */
function groupDetail(text: RegExp) {
    return dialog().getByText(text);
}

function row(title: string) {
    return dialog().getByRole('checkbox', { name: new RegExp(`^${title}\\s*#`, 'u') });
}

/** All a row says, once it shows. */
async function rowText(title: string) {
    await expect.element(row(title)).toBeInTheDocument();
    return row(title).element().closest('[data-tracking-row]')?.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
}

/**
 * The dialog open over a real tracking store, GitHub offering T22's projects, on a screen whose own keys (`A`, `1`,
 * ⌫) report to `screenKey`.
 */
async function open(params: OpenParams) {
    // A desktop window: the dialog is 1040 wide, and narrower in a narrower one.
    await page.viewport(1440, 900);
    const github: AnswerTrackingCandidatesOptions = {
        login: 'mlaine',
        repositories: { names: ['mlaine/tasklet'] },
        organizations: { fitloop: { names: ['fitloop/webapp'] } },
        projects: PROJECTS,
        hidingOrganizations: ['acme-health'],
        ...params.github,
    };
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser(answerTrackingCandidates(github)));
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    const pending = container.resolve(PendingUntracks);
    await tracking.ready();
    for (const reference of params.tracked ?? []) {
        const [login = '', number = ''] = reference.split('/');
        const project = PROJECTS?.[login]?.find(candidate => candidate.number === Number(number));
        tracking.track({
            project: {
                id: `PVT_${login}_${number}`,
                owner: login,
                ownerKind: login === 'mlaine' ? 'user' : 'org',
                number: Number(number),
                title: project?.title ?? reference,
            },
        });
    }

    for (const reference of params.pending ?? []) {
        const [login = '', number = ''] = reference.split('/');
        pending.untrack({ kind: 'project', id: `PVT_${login}_${number}` }, reference);
    }

    const opened = ref(true);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(
        defineComponent({
            setup() {
                useCommands(() =>
                    ['A', '1', 'Backspace'].map(key => ({
                        id: `screen.${key}`,
                        title: key,
                        section: 'view',
                        key,
                        run: () => params.screenKey?.(),
                    })),
                );
                return () =>
                    h(TrackProjectsDialog, {
                        open: opened.value,
                        owner: params.owner,
                        search: params.search,
                        'onUpdate:open': value => {
                            opened.value = value;
                        },
                    });
            },
        }),
    );
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    if (!params.search) {
        await expect.element(row('Bug triage')).toBeInTheDocument();
    }

    return {
        tracking,
        pending,
        setOpen: (value: boolean) => {
            opened.value = value;
        },
    };
}
