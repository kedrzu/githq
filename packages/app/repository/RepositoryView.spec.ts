import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, ref, shallowRef, Teleport, unref } from 'vue';
import type { Ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { COMMIT_REF_LIST_TARGET_ID } from '@/commits/CommitTypes.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListEntry, ListViewOptions } from '@/lists/ListTypes.js';
import type { BrowsedStatus } from '@/repos/BrowsedRepositories.js';
import type { RepositoryLayout } from '@/settings/sync/SettingsDocument.js';
import type { Item } from '@/store/ItemTypes.js';
import { sampleIssue } from '@/testing/sampleItems.js';
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
    expect(sections.getByRole('button').elements()).toHaveLength(4);
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

    view.host.style.width = '1060px';
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

    view.host.style.width = '860px';
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Closed', exact: true })).toBeVisible();

    view.host.style.width = '560px';
    await expect.element(page.getByRole('button', { name: 'Closed', exact: true })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    const states = page.getByRole('dialog', { name: 'Display' }).getByRole('group', { name: 'State' });
    await userEvent.click(states.getByRole('button', { name: 'Open and closed' }));
    expect(view.state.value.issues).toBe('all');
});

test('J5: not tracked, the same toolbar and list as tracked, with the chip and how much is read, no counts on the tabs and no offer to track', async () => {
    const view = mount({ tracked: false, status: browsedStatus({ total: 3412, hasMore: true, cursor: 'c2' }) });

    await expect.poll(groupNames).toEqual(['v4.2 — November', 'v4.3 — December', 'No milestone']);
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect.element(page.getByText('5 of 3412', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Display' })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Open', exact: true }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Closed', exact: true }));
    expect(view.state.value.issues).toBe('closed');

    const sections = page.getByRole('group', { name: 'Sections' });
    await expect.element(sections.getByRole('button', { name: 'Issues', exact: true })).toBeVisible();
    // Its workflows are not read: no Workflows section.
    await expect.element(page.getByRole('button', { name: /^Workflows/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Track/ })).not.toBeInTheDocument();
});

test('the count never says fewer exist than are listed, and says nothing before GitHub has answered', async () => {
    const view = mount({ tracked: false, status: browsedStatus({ total: 3 }) });
    await expect.element(page.getByText('5 of 5', { exact: true })).toBeVisible();

    view.status.value = browsedStatus({ reading: true });
    await expect.element(page.getByText(/^\d+ of \d+$/)).not.toBeInTheDocument();
});

test('tracked, nothing says how much is read', async () => {
    mount();

    await expect.element(page.getByRole('button', { name: 'Issues 5' })).toBeVisible();
    await expect.element(page.getByText('not tracked', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText(/^\d+ of \d+$/)).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
});

test("a short list asks for the next page, again only as its position moves, and ends with GitHub's last page", async () => {
    const view = mount({ tracked: false, status: browsedStatus({ total: 50, hasMore: true, cursor: 'c2' }) });
    await expect.poll(() => view.readMore.mock.calls.length).toBe(1);

    // A read that moved nothing (refused, or on its way) does not ask again, however long the end stays in view.
    view.status.value = browsedStatus({ total: 50, hasMore: true, cursor: 'c2', reading: true });
    await expect.element(page.getByText('Reading more…', { exact: true })).toBeVisible();
    view.status.value = browsedStatus({ total: 50, hasMore: true, cursor: 'c2' });
    await expect.element(page.getByText('Reading more…', { exact: true })).not.toBeInTheDocument();
    await settle();
    expect(view.readMore).toHaveBeenCalledTimes(1);

    // A page read and the end still in reach: on.
    view.status.value = browsedStatus({ total: 50, hasMore: true, cursor: 'c3' });
    await expect.poll(() => view.readMore.mock.calls.length).toBe(2);

    view.status.value = browsedStatus({ total: 50 });
    await settle();
    expect(view.readMore).toHaveBeenCalledTimes(2);
});

test('a long list reads on only as its end comes in reach, by scrolling or walking it with j', async () => {
    const view = mount({
        tracked: false,
        items: manyIssues(60),
        hostHeight: '400px',
        status: browsedStatus({ total: 500, hasMore: true, cursor: 'c2' }),
    });
    await expect.element(page.getByText('60 of 500', { exact: true })).toBeVisible();
    await settle();
    expect(view.readMore).not.toHaveBeenCalled();

    for (const _row of manyIssues(60)) {
        await userEvent.keyboard('j');
    }

    await expect.poll(() => view.readMore.mock.calls.length).toBe(1);
});

test('reading stops while every group is collapsed: with no rows to scroll past, the end of the list says nothing', async () => {
    const view = mount({
        tracked: false,
        items: manyIssues(60),
        hostHeight: '400px',
        status: browsedStatus({ total: 500, hasMore: true, cursor: 'c2' }),
    });
    await expect.element(page.getByRole('button', { name: /^No milestone/ })).toBeVisible();
    await settle();

    await userEvent.click(page.getByRole('button', { name: /^No milestone/ }));

    await settle();
    expect(view.readMore).not.toHaveBeenCalled();
});

test('with a group collapsed, a page goes on reading only if it added rows on screen: a short list does not read the repository whole', async () => {
    const items = shallowRef<readonly Item[]>([...manyIssues(60), inMilestone('I_v1', 1)]);
    const view = mount({
        tracked: false,
        items,
        hostHeight: '400px',
        status: browsedStatus({ total: 500, hasMore: true, cursor: 'c2' }),
    });
    await expect.element(page.getByRole('button', { name: /^No milestone/ })).toBeVisible();
    await settle();
    expect(view.readMore).not.toHaveBeenCalled();

    // Collapsed, the list is short: its end comes in reach.
    await userEvent.click(page.getByRole('button', { name: /^No milestone/ }));
    await expect.poll(() => view.readMore.mock.calls.length).toBe(1);

    // A page gone wholly into the collapsed group: the end stays where it was, and nothing more is read.
    items.value = [...items.value, ...manyIssues(30, 60)];
    view.status.value = browsedStatus({ total: 500, hasMore: true, cursor: 'c3' });
    await settle();
    expect(view.readMore).toHaveBeenCalledTimes(1);

    // A page adding a row on screen, with the end still in reach: on.
    items.value = [...items.value, inMilestone('I_v2', 2)];
    view.status.value = browsedStatus({ total: 500, hasMore: true, cursor: 'c4' });
    await expect.poll(() => view.readMore.mock.calls.length).toBe(2);
});

test('in the list, "Read more" shows only while a group is collapsed, and one click asks one page', async () => {
    const view = mount({
        tracked: false,
        items: manyIssues(60),
        hostHeight: '400px',
        status: browsedStatus({ total: 500, hasMore: true, cursor: 'c2' }),
    });
    const group = page.getByRole('button', { name: /^No milestone/ });
    const readMore = page.getByRole('button', { name: 'Read more' });
    await expect.element(group).toBeVisible();
    await expect.element(readMore).not.toBeInTheDocument();

    // All collapsed: the end of the list is gone, and this is the only way on.
    await userEvent.click(group);
    await expect.element(readMore).toBeVisible();
    expect(view.readMore).not.toHaveBeenCalled();

    await userEvent.click(readMore);
    expect(view.readMore).toHaveBeenCalledTimes(1);

    view.status.value = browsedStatus({ total: 500, hasMore: true, cursor: 'c2', reading: true });
    await expect.element(page.getByRole('button', { name: 'Reading more…' })).toBeVisible();
    view.status.value = browsedStatus({ total: 500, hasMore: true, cursor: 'c3' });

    await userEvent.click(group);
    await expect.element(readMore).not.toBeInTheDocument();
});

test('with one group of several collapsed the button shows, and nothing more to read takes it away', async () => {
    const view = mount({
        tracked: false,
        items: [...manyIssues(60), inMilestone('I_v1', 1)],
        hostHeight: '400px',
        status: browsedStatus({ total: 500, hasMore: true, cursor: 'c2' }),
    });
    await userEvent.click(page.getByRole('button', { name: /^v1/ }));
    await expect.element(page.getByRole('button', { name: 'Read more' })).toBeVisible();

    view.status.value = browsedStatus({ total: 61 });
    await expect.element(page.getByRole('button', { name: /^Read/ })).not.toBeInTheDocument();
});

test('J6: on the board nothing reads by itself, one button reads the next page, and with no more there is none', async () => {
    const view = mount({
        tracked: false,
        status: browsedStatus({ total: 3412, hasMore: true, cursor: 'c2' }),
        canMove: () => true,
    });
    await userEvent.click(page.getByRole('button', { name: 'Board' }));
    // What the list asked before it was a board is not the board's.
    await settle();
    view.readMore.mockClear();
    await settle();
    expect(view.readMore).not.toHaveBeenCalled();
    // A row of a repository only browsed moves as a tracked one does.
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'Calendar shows wrong timezone' }))
        .toHaveAttribute('draggable', 'true');

    await userEvent.click(page.getByRole('button', { name: 'Read more' }));
    expect(view.readMore).toHaveBeenCalledTimes(1);

    view.status.value = browsedStatus({ total: 3412, hasMore: true, cursor: 'c2', reading: true });
    await expect.element(page.getByRole('button', { name: 'Reading more…' })).toBeVisible();

    view.status.value = browsedStatus({ total: 5 });
    await expect.element(page.getByRole('button', { name: /^Read/ })).not.toBeInTheDocument();
});

test('the first page on its way shows the list arriving, not that there is nothing', async () => {
    mount({ tracked: false, items: [], arriving: true, status: browsedStatus({ reading: true }) });

    await expect.element(page.getByText(/Still arriving/)).toBeVisible();
    await expect.element(page.getByText('Nothing here', { exact: true })).not.toBeInTheDocument();
});

test('J7: GitHub does not show it: the name, the chip and the way to GitHub, none of the list or its tools', async () => {
    mount({ tracked: false, items: [], status: browsedStatus({ notShown: true }) });

    await expect.element(page.getByRole('heading', { name: 'GitHub does not show this repository' })).toBeVisible();
    await expect
        .element(page.getByText('It may be private or gone, or this name may be wrong.', { exact: true }))
        .toBeVisible();
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).toBeVisible();
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', `https://github.com/${SAMPLE_REPOSITORY}`);
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('group', { name: 'Sections' })).not.toBeInTheDocument();
});

test('Workflows comes fourth, on 4, with the broken count, a dash until known, and shows its own body under a toolbar without view options', async () => {
    const view = mount({ workflowCount: 2 });
    const tabs = page.getByRole('group', { name: 'Sections' }).getByRole('button');
    await expect
        .poll(() => tabs.elements().map(tab => tab.textContent?.trim()))
        .toEqual(['Issues5', 'Pull requests1', 'Commits', 'Workflows2']);

    await userEvent.keyboard('4');
    expect(view.section.value).toBe('workflows');
    await expect.element(page.getByText('The workflows body')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Display' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
    await expect.poll(groupNames).toEqual([]);

    view.workflowCount.value = 'unknown';
    await expect.element(page.getByRole('button', { name: /^Workflows/ })).toHaveTextContent('Workflows–');
    view.workflowCount.value = null;
    await expect.element(page.getByRole('button', { name: /^Workflows/ })).toHaveTextContent(/^Workflows$/);
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

test('D11, D20: not tracked, Commits shows in full, with the "not tracked" chip and none of the reading of items', async () => {
    mount({ tracked: false, section: 'commits' });

    await expect.element(page.getByText('The commit graph')).toBeVisible();
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Read/ })).not.toBeInTheDocument();
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

test("D14, D20: not tracked, in the column layout the chip is in the column, and the pane has the section's name, its tools and the count", async () => {
    const view = mount({ layout: 'column', tracked: false, status: browsedStatus({ total: 3412 }) });
    const sections = page.getByRole('group', { name: 'Sections' });

    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    expect(page.getByText('not tracked', { exact: true }).elements()).toHaveLength(1);
    await expect.element(sections.getByRole('button', { name: 'Issues', exact: true })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Group: Milestone' })).toBeVisible();
    await expect.element(page.getByText('5 of 3412', { exact: true })).toBeVisible();

    await userEvent.keyboard('3');
    expect(view.section.value).toBe('commits');
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
});

test('J7 in the column layout: the name of the section over what GitHub does not show, the sections staying in the column', async () => {
    mount({ layout: 'column', tracked: false, items: [], status: browsedStatus({ notShown: true }) });

    await expect.element(page.getByRole('heading', { name: 'Issues', level: 1 })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'GitHub does not show this repository' })).toBeVisible();
    await expect.element(page.getByRole('group', { name: 'Sections' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();
});

test('D14: in the column layout a long name is cut to the column, its GitHub icon still in it', async () => {
    const name = 'a-very-long-organisation-name/an-even-longer-repository-name';
    mount({ layout: 'column', nameWithOwner: name });
    const github = page.getByRole('link', { name: 'Open on GitHub' });
    const menu = page.getByRole('heading', { name, level: 2 });

    await expect.element(github).toBeVisible();
    const column = menu.element().closest('[class*="repositoryColumn_head"]')?.parentElement?.getBoundingClientRect();
    const icon = github.element().getBoundingClientRect();
    // The default 280 px, less the panel's border.
    expect(column?.width).toBe(279);
    expect(icon.right).toBeLessThanOrEqual(column?.right ?? 0);
    expect(menu.element().getBoundingClientRect().right).toBeLessThanOrEqual(icon.left);
});

test('D14: in the column layout Workflows has its name over its body, the way to it on GitHub in the column', async () => {
    mount({ layout: 'column', section: 'workflows', workflowCount: 2 });

    await expect.element(page.getByText('The workflows body')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', `https://github.com/${SAMPLE_REPOSITORY}/actions`);
    await expect.element(page.getByRole('button', { name: 'Display' })).not.toBeInTheDocument();
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

test("the sections are the command menu's repository group, each once on its key 1–4 with an icon", () => {
    const { container } = mount();
    const commands = container
        .resolve(CommandRegistry)
        .commands.filter(command => command.id.startsWith('repository.section.'));

    expect(commands.map(command => [command.id, command.section, command.key, command.menu])).toEqual([
        ['repository.section.issues', 'repository', '1', undefined],
        ['repository.section.pullRequests', 'repository', '2', undefined],
        ['repository.section.commits', 'repository', '3', undefined],
        ['repository.section.workflows', 'repository', '4', undefined],
    ]);
    expect(commands.every(command => command.icon !== undefined)).toBe(true);
});

interface MountOptions {
    readonly tracked?: boolean;
    /** A ref to change them while mounted. */
    readonly items?: readonly Item[] | Ref<readonly Item[]>;
    /** As the page tells it; `view.status` changes it while mounted. */
    readonly status?: BrowsedStatus | null;
    /** The list is told GitHub has not answered yet, as the page tells it. */
    readonly arriving?: boolean;
    readonly canMove?: (entry: ListEntry<Item>, from: string, to: string) => boolean;
    readonly hostHeight?: string;
    readonly section?: RepositorySection;
    /** A ref to change it while mounted. */
    readonly layout?: RepositoryLayout | Ref<RepositoryLayout>;
    readonly nameWithOwner?: string;
    readonly workflowCount?: number | 'unknown' | null;
}

/**
 * Mounts a repository over the samples, building the section's list from the options and state each section holds,
 * as the page does.
 */
function mount({
    tracked = true,
    items = SAMPLE_REPOSITORY_ITEMS,
    status = null,
    arriving = false,
    canMove,
    hostHeight = '100vh',
    section: firstSection = 'issues',
    layout = 'tabs',
    nameWithOwner = SAMPLE_REPOSITORY,
    workflowCount = null,
}: MountOptions = {}) {
    const options = shallowRef<Record<RepositoryItemSection, Options>>({
        issues: REPOSITORY_VIEW_DEFAULTS,
        pullRequests: REPOSITORY_VIEW_DEFAULTS,
    });
    const section = ref<RepositorySection>(firstSection);
    const state = ref<Record<RepositoryItemSection, RepositoryState>>({ issues: 'open', pullRequests: 'open' });
    const workflowCountRef = ref(workflowCount);
    const statusRef = shallowRef(status);
    const readMore = vi.fn();
    const view = { options, section, state, workflowCount: workflowCountRef, status: statusRef, readMore };
    const open = unref(items).filter(item => item.state === 'OPEN');
    const openCounts = {
        issues: open.filter(item => item.kind === 'issue').length,
        pullRequests: open.filter(item => item.kind === 'pullRequest').length,
    };

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = hostHeight;
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
                              items: unref(items),
                              state: 'open',
                              kind: getSectionItemKind(listed),
                              grouping: options.value[listed].grouping,
                              sort: options.value[listed].sort,
                              texts: TEXTS,
                              arriving,
                          })
                        : null,
                    openCounts,
                    status: statusRef.value,
                    onReadMore: readMore,
                    canMove,
                    layout: unref(layout),
                    workflowCount: workflowCountRef.value,
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
                    workflows: () => h('p', 'The workflows body'),
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
    // The way to a tracked project is a `RouterLink`.
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

    return Object.assign(view, { host, container });
}

function browsedStatus(status: Partial<BrowsedStatus>): BrowsedStatus {
    return { reading: false, total: null, hasMore: false, cursor: null, notShown: false, settledName: null, ...status };
}

/** More issues than fit the window, whichever of the list's order. */
function manyIssues(count: number, first = 0): readonly Item[] {
    return Array.from({ length: count }, (_, index) => ({
        ...sampleIssue(`I_${first + index}`),
        number: 2000 + first + index,
    }));
}

function inMilestone(id: string, number: number): Item {
    return { ...sampleIssue(id), number, milestone: { title: 'v1', dueOn: null } };
}

/** Long enough for an observer that was going to speak to have spoken. */
async function settle() {
    await new Promise(resolve => {
        setTimeout(resolve, 150);
    });
}

/** The groups shown, top to bottom or left to right. */
function groupNames() {
    return [...document.querySelectorAll('main section, body section')]
        .map(section => section.getAttribute('aria-label'))
        .filter(name => name !== null && !name.startsWith('You'));
}
