import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, ref, shallowRef, Teleport, unref } from 'vue';
import type { Ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { COMMIT_REF_LIST_TARGET_ID } from '@/commits/CommitTypes.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';
import type { RepositoryLayout } from '@/settings/sync/SettingsDocument.js';
import type { Item } from '@/store/ItemTypes.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_REPOSITORY, SAMPLE_REPOSITORY_ITEMS } from '@/testing/sampleRepositoryItems.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { RepositoryListTexts, RepositoryState } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import { getSectionItemKind, isItemSection } from './RepositorySection.js';
import type { RepositoryItemSection, RepositorySection } from './RepositorySection.js';
import RepositoryView from './RepositoryView.vue';
import type { RepositoryGrouping } from './repositoryViewOptions.js';
import { REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';

type Options = ListViewOptions<RepositoryGrouping, ItemSort>;

const COLUMN_WIDTH_KEY = 'githq.panelWidth.repositoryColumn';

const TEXTS: RepositoryListTexts = {
    all: 'All',
    noMilestone: 'No milestone',
    noLabel: 'No label',
    unassigned: 'Unassigned',
    noType: 'No type',
    milestoneDetail: ({ closed, total }) => `${closed} of ${total} closed`,
};

test('J1 → J2: the issues grouped by milestone, then by issue type as a board from the toolbar', async () => {
    const view = mount();
    await expect.poll(groupNames).toEqual(['v4.2 — November', 'v4.3 — December', 'No milestone']);
    await expect.element(page.getByRole('region', { name: 'v4.2 — November' })).toHaveTextContent('1 of 4 closed');
    await expect.element(page.getByRole('listitem').filter({ hasText: '#1203' })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'Group: Milestone' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Issue type' }));
    await userEvent.click(page.getByRole('button', { name: 'Board' }));
    expect(view.options.value.issues).toMatchObject({ grouping: 'issueType', layout: 'board' });
    await expect.poll(groupNames).toEqual(['Bug', 'Feature', 'Task']);
});

test('D14: Issues and Pull requests are sections on 1 and 2, each counting its open items and with its own options; the title has no count', async () => {
    const view = mount();
    const sections = page.getByRole('group', { name: 'Sections' });
    await expect.element(sections.getByRole('button', { name: 'Issues 5' })).toHaveAttribute('aria-pressed', 'true');
    await expect
        .element(sections.getByRole('button', { name: 'Pull requests 1' }))
        .toHaveAttribute('aria-keyshortcuts', '2');
    await expect.element(sections.getByRole('button', { name: 'Issues 5' })).toHaveAttribute('aria-keyshortcuts', '1');
    await expect
        .element(sections.getByRole('button', { name: 'Commits', exact: true }))
        .toHaveAttribute('aria-keyshortcuts', '3');
    expect(sections.getByRole('button').elements()).toHaveLength(3);
    await expect.element(page.getByText(/\d open/)).not.toBeInTheDocument();
    await expect.element(page.getByRole('navigation', { name: 'Its issues live in' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Board' }));

    await userEvent.keyboard('2');
    expect(view.section.value).toBe('pullRequests');
    // Its own options: a list by milestone, with no issue type to group by and nothing to group by kind.
    await expect.poll(groupNames).toEqual(['No milestone']);
    await expect.element(page.getByRole('region', { name: 'No milestone' })).toHaveTextContent(/#1203/);
    await expect.element(page.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('navigation', { name: 'Its pull requests live in' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Group: Milestone' }));
    await expect.element(page.getByRole('menuitemradio', { name: 'Issue type' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('menuitemradio', { name: 'Label' })).toBeVisible();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('1');
    expect(view.section.value).toBe('issues');
    await expect.element(page.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(sections.getByRole('button', { name: /^Pull requests/ }));
    expect(view.section.value).toBe('pullRequests');
});

test('the order and the properties sit on the toolbar while they fit; on a narrow screen the properties move into Display', async () => {
    const view = mount();
    const row = page.getByRole('listitem').filter({ hasText: 'Calendar shows wrong timezone' });
    await expect.element(row.getByText('calendar', { exact: true })).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: /^Order:/ }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Title' }));
    expect(view.options.value.issues.sort).toBe('title');
    await userEvent.click(page.getByRole('button', { name: 'Properties' }));
    await userEvent.click(page.getByRole('dialog', { name: 'Properties' }).getByRole('button', { name: 'Labels' }));
    expect(view.options.value.issues.properties).not.toContain('labels');
    await expect.element(row.getByText('calendar', { exact: true })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    view.host.style.width = '960px';
    await expect.element(page.getByRole('button', { name: 'Properties' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    const display = page.getByRole('dialog', { name: 'Display' });
    await userEvent.click(display.getByRole('button', { name: 'Labels' }));
    expect(view.options.value.issues.properties).toContain('labels');
    await userEvent.keyboard('{Escape}');
});

test('the state stays on the toolbar longest; when even it does not fit, it is chosen in Display', async () => {
    const view = mount();
    await userEvent.click(page.getByRole('button', { name: 'Open', exact: true }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Closed', exact: true }));
    expect(view.state.value.issues).toBe('closed');

    view.host.style.width = '760px';
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Closed', exact: true })).toBeVisible();

    view.host.style.width = '560px';
    await expect.element(page.getByRole('button', { name: 'Closed', exact: true })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    const states = page.getByRole('dialog', { name: 'Display' }).getByRole('group', { name: 'State' });
    await userEvent.click(states.getByRole('button', { name: 'Open and closed' }));
    expect(view.state.value.issues).toBe('all');
});

test('J3, CH37: not tracked, it lists what concerns the user of the section, how many others are open on GitHub, and points to Settings, with no offer to track', async () => {
    const view = mount({ tracked: false, gitHubOpenCounts: { issues: 897, pullRequests: 1 } });
    const lines = page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` });

    await expect
        .element(lines)
        .toHaveTextContent(`githq only has what concerns you in ${SAMPLE_REPOSITORY}: 5 issues.`);
    // GitHub's 897 open issues less the 5 listed.
    await expect
        .element(lines)
        .toHaveTextContent(
            `githq has only the issues and pull requests of ${SAMPLE_REPOSITORY} that concern you; its other 892 open issues are on GitHub. Track it in Settings to have them all here.`,
        );
    // D20: the explanation is about the items; Commits needs no tracking.
    await expect.element(lines).toHaveTextContent("Its commits don't need tracking: 3 opens them in full.");
    await expect
        .element(lines.getByRole('link', { name: 'Settings' }))
        .toHaveAttribute('href', `/settings?q=${encodeURIComponent(SAMPLE_REPOSITORY)}`);
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
    // The same tabs, without counts.
    const sections = page.getByRole('group', { name: 'Sections' });
    await expect.element(sections.getByRole('button', { name: 'Issues', exact: true })).toBeVisible();

    await userEvent.click(sections.getByRole('button', { name: 'Pull requests', exact: true }));
    expect(view.section.value).toBe('pullRequests');
    await expect.element(page.getByRole('listitem').filter({ hasText: '#1203' })).toBeVisible();
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'Calendar shows wrong timezone' }))
        .not.toBeInTheDocument();
    await expect
        .element(lines)
        .toHaveTextContent(`githq only has what concerns you in ${SAMPLE_REPOSITORY}: 1 pull request.`);
    // Never negative: GitHub counts no more open pull requests than the one listed.
    await expect.element(lines).toHaveTextContent('none of its other pull requests is open on GitHub.');
    await expect.element(page.getByRole('button', { name: /^Track/ })).not.toBeInTheDocument();
});

test('CH37: not tracked, with nothing of the section concerning the user, it shows the empty group and says so of that section', async () => {
    mount({
        tracked: false,
        items: SAMPLE_REPOSITORY_ITEMS.filter(item => item.kind === 'pullRequest'),
        gitHubOpenCounts: { issues: 892, pullRequests: 40 },
    });
    const lines = page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` });

    await expect.element(page.getByRole('button', { name: 'Concerns you 0' })).toBeVisible();
    await expect.element(page.getByText('Nothing here.')).not.toBeInTheDocument();
    await expect.element(lines).toHaveTextContent(`No issue in ${SAMPLE_REPOSITORY} concerns you.`);
    await expect.element(lines).toHaveTextContent('its other 892 open issues are on GitHub.');
});

test('not tracked, while GitHub has not told how many items are open, the lines say it without a number', async () => {
    mount({ tracked: false });
    const lines = page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` });

    await expect
        .element(lines)
        .toHaveTextContent(
            `githq has only the issues and pull requests of ${SAMPLE_REPOSITORY} that concern you; its other open issues are on GitHub. Track it in Settings to have them all here.`,
        );
});

test("tracked, GitHub's counts of open items are not shown", async () => {
    mount({ gitHubOpenCounts: { issues: 897, pullRequests: 1 } });

    await expect.element(page.getByRole('button', { name: 'Issues 5' })).toBeVisible();
    await expect.element(page.getByText(/897|892/)).not.toBeInTheDocument();
});

test('D10, D11, CH3: Commits on 3 has none of the list tools, only the way to its history on GitHub, over the graph the page puts in', async () => {
    const view = mount();
    await userEvent.keyboard('3');
    expect(view.section.value).toBe('commits');

    await expect.element(page.getByText('The commit graph')).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Board' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Open', exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByRole('navigation', { name: 'Its issues live in' })).not.toBeInTheDocument();
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', `https://github.com/${SAMPLE_REPOSITORY}/commits`);
    // The tabs keep the items' counts; Commits has none.
    const sections = page.getByRole('group', { name: 'Sections' });
    await expect.element(sections.getByRole('button', { name: 'Issues 5' })).toBeVisible();
    await expect
        .element(sections.getByRole('button', { name: 'Commits', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');

    await userEvent.keyboard('1');
    expect(view.section.value).toBe('issues');
    await expect.element(page.getByText('The commit graph')).not.toBeInTheDocument();
});

test('D11, D20: not tracked, Commits shows in full, with the "not tracked" chip and none of the explanation about items', async () => {
    mount({ tracked: false, section: 'commits' });

    await expect.element(page.getByText('The commit graph')).toBeVisible();
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect
        .element(page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` }))
        .not.toBeInTheDocument();
    await expect.element(page.getByText('Concerns you')).not.toBeInTheDocument();
});

test("D14, CH4: in the column layout the sections and the projects are in the column, and the pane holds the section's name and its tools", async () => {
    const view = mount({ layout: 'column' });
    const sections = page.getByRole('group', { name: 'Sections' });
    const issues = sections.getByRole('button', { name: 'Issues 5' });

    await expect.element(issues).toHaveAttribute('aria-pressed', 'true');
    await expect.element(issues).toHaveAttribute('aria-keyshortcuts', '1');
    expect(issues.element().textContent).toContain('1');
    await expect
        .element(sections.getByRole('button', { name: 'Commits', exact: true }))
        .toHaveAttribute('aria-keyshortcuts', '3');
    await expect.element(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 2 })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Display' })).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', `https://github.com/${SAMPLE_REPOSITORY}`);

    const projects = page.getByRole('navigation', { name: 'Its issues live in' });
    await expect
        .element(projects.getByRole('link', { name: /Platform Q4/ }))
        .toHaveAttribute('href', '/orgs/acme/projects/1');
    await expect.element(projects.getByRole('link', { name: /Bug triage/ })).toHaveAttribute('target', '_blank');
    await expect.element(projects).toHaveTextContent('2 in no project');
    // The same projects are not drawn again over the list.
    expect(page.getByRole('navigation').elements()).toHaveLength(1);

    await userEvent.keyboard('2');
    expect(view.section.value).toBe('pullRequests');
    await expect
        .element(sections.getByRole('button', { name: /^Pull requests/ }))
        .toHaveAttribute('aria-pressed', 'true');
    await expect.element(page.getByRole('heading', { name: 'Pull requests', level: 1 })).toBeVisible();
    await expect.element(page.getByRole('navigation', { name: 'Its pull requests live in' })).toBeVisible();

    await userEvent.click(sections.getByRole('button', { name: 'Issues 5' }));
    expect(view.section.value).toBe('issues');
});

test('D14, CH6: in the column layout Commits has the plain header over the graph, the way to its history in the column, and the slot told where the list goes', async () => {
    mount({ layout: 'column', section: 'commits' });

    await expect.element(page.getByText('The commit graph')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Commits', level: 1 })).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', `https://github.com/${SAMPLE_REPOSITORY}/commits`);
    await expect.element(page.getByRole('button', { name: 'Branches and tags' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('navigation')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('target')).toHaveTextContent('column');
    expect(document.querySelector(`#${COMMIT_REF_LIST_TARGET_ID}`)).not.toBeNull();
});

test("D14, D20: not tracked, in the column layout the chip is in the column, and the pane has the section's name over what concerns the user", async () => {
    const view = mount({ layout: 'column', tracked: false });
    const sections = page.getByRole('group', { name: 'Sections' });

    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect.element(sections.getByRole('button', { name: 'Issues', exact: true })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).not.toBeInTheDocument();
    await expect.element(page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` })).toBeVisible();
    await expect.element(page.getByRole('navigation')).not.toBeInTheDocument();

    await userEvent.keyboard('3');
    expect(view.section.value).toBe('commits');
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
});

test('D14: in the column layout a long name is cut to the column, its GitHub icon still in it', async () => {
    const name = 'a-very-long-organisation-name/an-even-longer-repository-name';
    mount({ layout: 'column', nameWithOwner: name });
    const github = page.getByRole('link', { name: 'Open on GitHub' });
    const menu = page.getByRole('heading', { name, level: 2 });

    await expect.element(github).toBeVisible();
    const column = menu.element().closest('header')?.parentElement?.getBoundingClientRect();
    const icon = github.element().getBoundingClientRect();
    // The default 280 px, less the panel's border.
    expect(column?.width).toBe(279);
    expect(icon.right).toBeLessThanOrEqual(column?.right ?? 0);
    expect(menu.element().getBoundingClientRect().right).toBeLessThanOrEqual(icon.left);
});

test('D14: the pane stays mounted as the layout changes live, what it holds kept, and on Commits the list has its place in the column', async () => {
    const layout = ref<RepositoryLayout>('tabs');
    mount({ layout, section: 'commits' });
    const held = page.getByRole('textbox', { name: 'Held by the graph' });
    await userEvent.fill(held, 'kept');
    const element = held.element();

    layout.value = 'column';
    await expect.element(page.getByRole('heading', { name: 'Commits', level: 1 })).toBeVisible();
    await expect.element(page.getByTestId('target')).toHaveTextContent('column');
    expect(held.element()).toBe(element);
    await expect.element(held).toHaveValue('kept');
    await expect
        .poll(() => document.querySelector(`#${COMMIT_REF_LIST_TARGET_ID}`)?.textContent)
        .toBe('Branches and tags');

    layout.value = 'tabs';
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).toBeVisible();
    await expect.element(page.getByTestId('target')).toHaveTextContent('beside');
    expect(held.element()).toBe(element);
    await expect.element(held).toHaveValue('kept');
    await expect.element(page.getByRole('separator', { name: 'Resize the left column' })).not.toBeInTheDocument();
    expect(document.querySelector(`#${COMMIT_REF_LIST_TARGET_ID}`)).toBeNull();
    await expect.element(page.getByTestId('refList')).toBeVisible();
});

test('D14: the column is as wide on every section of the column layout, resized by its edge', async () => {
    const view = mount({ layout: 'column' });
    const edge = page.getByRole('separator', { name: 'Resize the left column' });
    const column = () => edge.element().previousElementSibling?.getBoundingClientRect().width;
    await expect.element(edge).toBeInTheDocument();
    await expect.poll(column).toBe(280);
    onTestFinished(() => window.localStorage.removeItem(COLUMN_WIDTH_KEY));

    edge.element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(column).toBe(200);
    await expect.poll(() => window.localStorage.getItem(COLUMN_WIDTH_KEY)).toBe('200');

    view.section.value = 'commits';
    await expect.element(page.getByTestId('target')).toHaveTextContent('column');
    expect(column()).toBe(200);
    expect(document.querySelector(`#${COMMIT_REF_LIST_TARGET_ID}`)).not.toBeNull();
});

test('D14: in the tabs layout the slot is told the list stays beside the graph, and there is no column', async () => {
    mount({ section: 'commits' });

    await expect.element(page.getByText('The commit graph')).toBeVisible();
    await expect.element(page.getByTestId('target')).toHaveTextContent('beside');
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).toBeVisible();
});

interface MountOptions {
    readonly tracked?: boolean;
    readonly items?: readonly Item[];
    readonly gitHubOpenCounts?: Readonly<Record<RepositoryItemSection, number>> | null;
    readonly section?: RepositorySection;
    /** A ref to change it while mounted. */
    readonly layout?: RepositoryLayout | Ref<RepositoryLayout>;
    readonly nameWithOwner?: string;
}

/**
 * Mounts a repository over the samples, building the section's list from the options and state each section holds,
 * as the page does.
 */
function mount({
    tracked = true,
    items = SAMPLE_REPOSITORY_ITEMS,
    gitHubOpenCounts = null,
    section: firstSection = 'issues',
    layout = 'tabs',
    nameWithOwner = SAMPLE_REPOSITORY,
}: MountOptions = {}) {
    const options = shallowRef<Record<RepositoryItemSection, Options>>({
        issues: REPOSITORY_VIEW_DEFAULTS,
        pullRequests: REPOSITORY_VIEW_DEFAULTS,
    });
    const section = ref<RepositorySection>(firstSection);
    const state = ref<Record<RepositoryItemSection, RepositoryState>>({ issues: 'open', pullRequests: 'open' });
    const view = { options, section, state };
    const open = items.filter(item => item.state === 'OPEN');
    const openCounts = {
        issues: open.filter(item => item.kind === 'issue').length,
        pullRequests: open.filter(item => item.kind === 'pullRequest').length,
    };

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    host.style.width = '1400px';
    document.body.append(host);

    const app = createApp({
        setup: () => () => {
            // On Commits the options and state are the issues' — not shown there.
            const listed = isItemSection(section.value) ? section.value : null;
            const shown = listed ?? 'issues';
            return h(
                RepositoryView,
                {
                    nameWithOwner,
                    isPrivate: true,
                    tracked,
                    list: listed
                        ? buildRepositoryList({
                              items,
                              state: 'open',
                              kind: getSectionItemKind(listed),
                              grouping: tracked ? options.value[listed].grouping : 'none',
                              sort: options.value[listed].sort,
                              texts: TEXTS,
                          })
                        : null,
                    openCounts,
                    gitHubOpenCounts,
                    layout: unref(layout),
                    projects: [
                        { id: 'PVT_q4', title: 'Platform Q4', count: 1, to: '/orgs/acme/projects/1', external: false },
                        {
                            id: 'PVT_triage',
                            title: 'Bug triage',
                            count: 1,
                            to: 'https://github.com/orgs/acme/projects/2',
                            external: true,
                        },
                    ],
                    withoutProject: 2,
                    viewerLogin: SAMPLE_VIEWER.login,
                    now: SAMPLE_NOW,
                    options: options.value[shown],
                    'onUpdate:options': (value: Options) => {
                        options.value = { ...options.value, [shown]: value };
                    },
                    state: state.value[shown],
                    'onUpdate:state': (value: RepositoryState) => {
                        state.value = { ...state.value, [shown]: value };
                    },
                    section: section.value,
                    'onUpdate:section': (value: RepositorySection) => {
                        section.value = value;
                    },
                },
                {
                    commits: ({ refListInColumn }: { readonly refListInColumn: boolean }) => [
                        h('p', 'The commit graph'),
                        h('p', { tid: 'target' }, refListInColumn ? 'column' : 'beside'),
                        h('input', { 'aria-label': 'Held by the graph' }),
                        // As the graph holds its list of branches and tags.
                        h(
                            Teleport,
                            {
                                to: refListInColumn ? `#${COMMIT_REF_LIST_TARGET_ID}` : undefined,
                                disabled: !refListInColumn,
                                defer: true,
                            },
                            h('p', { tid: 'refList' }, 'Branches and tags'),
                        ),
                    ],
                },
            );
        },
    });
    app.use(IocPlugin, { container });
    // The Settings link of an untracked repository is a `RouterLink`.
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
        }),
    );
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return Object.assign(view, { host });
}

/** The groups shown, top to bottom or left to right. */
function groupNames() {
    return [...document.querySelectorAll('main section, body section')]
        .map(section => section.getAttribute('aria-label'))
        .filter(name => name !== null && !name.startsWith('You'));
}
