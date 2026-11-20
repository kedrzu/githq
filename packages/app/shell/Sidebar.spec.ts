import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { formatAriaKeyShortcuts } from '@/commands/formatAriaKeyShortcuts.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import type { SidebarMovePlace } from './Sidebar.vue';
import * as stories from './Sidebar.stories.js';

const {
    BrokenWorkflowsNew,
    BrokenWorkflowsPartlyKnown,
    BrokenWorkflowsScreenOpen,
    BrokenWorkflowsSettled,
    Collapsed,
    CollapsedBrokenWorkflowsNew,
    CollapsedBrokenWorkflowsSettled,
    CollapsedManyProjects,
    CollapsedNoProjects,
    CollapsedNothingTracked,
    CollapsedOnProject,
    CollapsedTrackedMenu,
    Downloading,
    Expanded,
    LongLists,
    NoProjects,
    NoRepositories,
    NothingTracked,
    OnProject,
    OnRepository,
    PhoneOnProject,
    PhoneOnRepository,
    PhoneOnRepositoryAnimated,
    Reordering,
    SomeCountsArriving,
    SyncStopped,
    CollapsedSyncStopped,
    TrackedMenu,
    WindowControlsCollapsed,
    WindowControlsOverflowing,
    WorkflowsNotKnownYet,
} = composeStories(stories);

const NOTHING_TRACKED_NOTE = 'Repositories and projects you track appear here.';

test("the open repository is current on its own row, with nothing under it: its sections are the header's tabs", async () => {
    await OnRepository.run();

    await expect.element(placeRow('skyline-labs/portal')).toHaveAttribute('aria-current', 'page');
    expect(placeItem('skyline-labs/portal').querySelector('ul')).toBeNull();
    expect(document.querySelectorAll('nav [aria-current="page"]')).toHaveLength(1);
});

test("the open project is current on its own row, with nothing under it: its saved views are the header's tabs", async () => {
    await OnProject.run();

    await expect.element(placeRow('Platform Q4')).toHaveAttribute('aria-current', 'page');
    expect(placeItem('Platform Q4').querySelector('ul')).toBeNull();
});

test('on a phone the open repository shows its sections with their counts, the current one marked instead of its row', async () => {
    await PhoneOnRepository.run();

    const rows = subRows('skyline-labs/portal');
    await expect.element(rows.getByRole('link').nth(0)).toHaveTextContent(/^Issues\s*118$/u);
    await expect.element(rows.getByRole('link').nth(1)).toHaveTextContent(/^Pull requests\s*24$/u);
    expect(rows.getByRole('link').elements()).toHaveLength(4);
    await expect.element(rows.getByRole('link', { name: 'Pull requests' })).toHaveAttribute('aria-current', 'page');
    // Exactly one current row in the whole panel.
    expect(document.querySelectorAll('nav [aria-current="page"]')).toHaveLength(1);
});

test("on a phone the open project shows its saved views: no counts, a cloud on GitHub's, a dot on the one changed here", async () => {
    await PhoneOnProject.run();

    const rows = subRows('Platform Q4');
    expect(
        rows
            .getByRole('link')
            .elements()
            .map(link => link.textContent?.trim()),
    ).toEqual(['Current sprint', 'Backlog', 'Next sprint', 'By assignee', 'Bugs']);
    await expect.element(rows.getByRole('link', { name: 'Current sprint' })).toHaveAttribute('aria-current', 'page');
    await expect.element(rows.getByRole('link', { name: 'Current sprint modified locally' })).toBeInTheDocument();
    await expect.element(rows.getByRole('link', { name: 'answered by GitHub Next sprint' })).toBeInTheDocument();
    expect(document.querySelectorAll('nav [aria-current="page"]')).toHaveLength(1);
});

test('with the animations off the rows appear as they are, in no Reveal', async () => {
    await PhoneOnRepository.run();

    expect(subRows('skyline-labs/portal').element().parentElement?.tagName).toBe('LI');
});

test('with the animations on the rows slide open in a Reveal', async () => {
    await PhoneOnRepositoryAnimated.run();

    const revealed = subRows('skyline-labs/portal').element();
    expect(revealed.parentElement?.tagName).not.toBe('LI');
    const wrapper = revealed.closest('li > div');
    expect(wrapper && getComputedStyle(wrapper).transitionProperty).toContain('height');
});

test('on a phone the open place starts expanded; tapping a place shows or hides its rows without going anywhere', async () => {
    await PhoneOnRepository.run();

    const portal = page.getByRole('button', { name: /^skyline-labs\/portal/u });
    await expect.element(portal).toHaveAttribute('aria-expanded', 'true');
    await expect
        .element(subRows('skyline-labs/portal').getByRole('link', { name: /^Commits/u }))
        .toHaveAttribute('href', 'https://github.com/skyline-labs/portal/commits');
    await expect
        .element(subRows('skyline-labs/portal').getByRole('link', { name: /^Workflows/u }))
        .toHaveAccessibleName(/^Workflows\s+opens on\sgithub\.com$/u);

    const githq = page.getByRole('button', { name: /^kedrzu\/githq/u });
    await userEvent.click(githq);
    await expect.element(githq).toHaveAttribute('aria-expanded', 'true');
    await expect.element(portal).toHaveAttribute('aria-expanded', 'false');
    expect(placeItem('skyline-labs/portal').querySelector('ul')).toBeNull();
    // Not the open place: none of its rows is current; the open one's row is again.
    expect(subRows('kedrzu/githq').element().querySelector('[aria-current]')).toBeNull();
    await expect.element(portal).toHaveAttribute('aria-current', 'page');

    await userEvent.click(githq);
    expect(placeItem('kedrzu/githq').querySelector('ul')).toBeNull();
});

test('a private repository has a lock instead of the repository icon', async () => {
    await Expanded.run();

    const portal = page.getByRole('link', { name: /^skyline-labs\/portal/ }).element();
    const githq = page.getByRole('link', { name: /^kedrzu\/githq/ }).element();
    expect(portal.querySelector('.lucide-lock')).not.toBeNull();
    expect(githq.querySelector('.lucide-lock')).toBeNull();
    expect(githq.querySelector('.lucide-book-marked')).not.toBeNull();
});

test('right-clicking a tracked repository opens its menu, under its name', async () => {
    await TrackedMenu.run();

    await userEvent.click(page.getByRole('link', { name: /^kedrzu\/skills/ }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toHaveTextContent('kedrzu/skills');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('right-clicking a tracked project opens its menu', async () => {
    await TrackedMenu.run();

    await userEvent.click(page.getByRole('link', { name: /^githq Roadmap/ }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toHaveTextContent('PVT_2');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('the logo and the collapse button head the sidebar, the user ends it, and nothing offers to track', async () => {
    await Expanded.run();

    const nav = page.getByRole('navigation', { name: 'Sidebar' });
    await expect.element(nav.getByRole('img', { name: 'githq' })).toBeVisible();
    await expect
        .element(nav.getByRole('button', { name: 'Collapse sidebar' }))
        .toHaveAttribute('aria-keyshortcuts', formatAriaKeyShortcuts('Mod+B'));
    expect(nav.getByRole('link', { name: /track/iu }).elements()).toHaveLength(0);
    expect(nav.getByRole('button', { name: /track/iu }).elements()).toHaveLength(0);

    const links = nav.getByRole('link').elements();
    const user = nav.getByRole('button', { name: /^Account:/u }).element();
    expect(links.at(-1)?.compareDocumentPosition(user)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

test('no tracked project: no Projects section', async () => {
    await NoProjects.run();
    await expect.element(page.getByRole('heading', { name: 'Repositories' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Projects' })).not.toBeInTheDocument();
    await expect.element(page.getByText(NOTHING_TRACKED_NOTE)).not.toBeInTheDocument();
});

test('no tracked repository: no Repositories section', async () => {
    await NoRepositories.run();
    await expect.element(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Repositories' })).not.toBeInTheDocument();
    await expect.element(page.getByText(NOTHING_TRACKED_NOTE)).not.toBeInTheDocument();
});

test('nothing tracked: a note and a link to Settings where the lists would be', async () => {
    await NothingTracked.run();

    await expect.element(page.getByText(NOTHING_TRACKED_NOTE)).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    await expect.element(page.getByRole('heading', { name: 'Projects' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'Repositories' })).not.toBeInTheDocument();
});

test('long lists scroll, with the user at the bottom of the window all along', async () => {
    await LongLists.run();

    const user = page.getByRole('button', { name: /^Account:/u }).element();
    const last = page.getByRole('link', { name: /^kedrzu\/repository-59/u }).element();
    expect(last.getBoundingClientRect().top).toBeGreaterThan(window.innerHeight);
    expect(user.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);

    last.scrollIntoView();
    await expect.poll(() => last.getBoundingClientRect().bottom).toBeLessThanOrEqual(user.getBoundingClientRect().top);
    expect(user.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
});

test('the user menu opens upwards with who is signed in, Settings and its key, Documentation, and Sign out', async () => {
    const onSignOut = vi.fn();
    await Expanded.run({ args: { ...Expanded.args, onSignOut } });

    await userEvent.click(page.getByRole('button', { name: /^Account:/u }));
    const menu = page.getByRole('menu');
    await expect.element(menu).toHaveAttribute('data-side', 'top');
    await expect.element(menu).toHaveTextContent(`Signed in as ${SAMPLE_VIEWER.login}`);
    await expect.element(menu.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('aria-keyshortcuts', ',');
    await expect.element(menu.getByRole('menuitem', { name: 'Settings' })).toHaveTextContent(',');
    await expect.element(menu.getByRole('separator')).toBeInTheDocument();
    const items = menu.getByRole('menuitem');
    expect(items.elements()).toHaveLength(3);
    await expect.element(items.nth(1)).toHaveAccessibleName('Documentation');

    await userEvent.click(menu.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
});

test('"Documentation" in the user menu opens the docs in a new tab, the app staying where it is', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    onTestFinished(() => open.mockRestore());
    await Expanded.run();

    await userEvent.click(page.getByRole('button', { name: /^Account:/u }));
    await userEvent.click(page.getByRole('menu').getByRole('menuitem', { name: 'Documentation' }));

    // The web build's: `/docs/`, beside the app.
    expect(open).toHaveBeenCalledExactlyOnceWith('/docs/', '_blank', 'noopener,noreferrer');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test.each([
    ['expanded', SyncStopped],
    ['on the rail', CollapsedSyncStopped],
])(
    'syncing stopped, %s: a dot on the avatar, and Settings says so, shows no key and opens Sync settings',
    async (_, story) => {
        await story.run();

        const account = page.getByRole('button', { name: `Account: ${SAMPLE_VIEWER.login} · syncing stopped` });
        await expect.element(account).toBeVisible();
        await userEvent.click(account);
        const settings = page.getByRole('menuitem', { name: /^Settings/u });
        await expect.element(settings).toHaveTextContent('Syncing stopped');
        // `,` opens plain Settings, not where this row leads.
        await expect.element(settings).not.toHaveAttribute('aria-keyshortcuts');
        await expect.element(settings).not.toHaveTextContent(',');

        await userEvent.click(settings);
        await expect
            .poll(() => document.querySelector('[data-route]')?.getAttribute('data-route'))
            .toBe('/settings?tab=sync');
    },
);

test('syncing not stopped: no dot, and Settings opens Settings', async () => {
    await Expanded.run();

    const account = page.getByRole('button', { name: `Account: ${SAMPLE_VIEWER.login}`, exact: true });
    await userEvent.click(account);
    await expect.element(page.getByRole('menuitem', { name: 'Settings' })).not.toHaveTextContent('Syncing stopped');
});

test('on the rail the user menu opens to the right', async () => {
    await Collapsed.run();

    await userEvent.click(page.getByRole('button', { name: /^Account:/u }));
    await expect.element(page.getByRole('menu')).toHaveAttribute('data-side', 'right');
    await expect.element(page.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
});

test('the rail: the logo on top, the user at the very bottom, a mark for each project, no way to track', async () => {
    await Collapsed.run();

    const nav = page.getByRole('navigation', { name: 'Sidebar' });
    await expect.element(nav.getByRole('img', { name: 'githq' })).toBeVisible();
    await expect.element(nav.getByRole('link', { name: 'Platform Q4' })).toHaveTextContent('PQ');
    await expect.element(nav.getByRole('link', { name: 'githq Roadmap' })).toHaveTextContent('GR');
    await expect.element(nav.getByRole('link', { name: 'Docs revamp' })).toHaveTextContent('DR');
    await expect
        .element(nav.getByRole('link', { name: 'Docs revamp' }))
        .toHaveAttribute('href', '/orgs/skyline-labs/projects/3');
    expect(nav.getByRole('separator').elements()).toHaveLength(2);
    expect(nav.getByRole('link', { name: /track|settings/iu }).elements()).toHaveLength(0);

    const navBox = nav.element().getBoundingClientRect();
    const user = nav
        .getByRole('button', { name: /^Account:/u })
        .element()
        .getBoundingClientRect();
    expect(navBox.bottom - user.bottom).toBeLessThanOrEqual(12);
    expect(nav.getByRole('link').elements().at(-1)?.getBoundingClientRect().bottom).toBeLessThanOrEqual(user.top);
});

test("a project's mark is current on its page", async () => {
    await CollapsedOnProject.run();

    const nav = page.getByRole('navigation', { name: 'Sidebar' });
    await expect.element(nav.getByRole('link', { name: 'githq Roadmap' })).toHaveAttribute('aria-current', 'page');
    await expect.element(nav.getByRole('link', { name: 'Platform Q4' })).not.toHaveAttribute('aria-current');
});

test("right-clicking a project's mark opens the same menu as its row", async () => {
    await CollapsedTrackedMenu.run();

    await userEvent.click(page.getByRole('link', { name: 'githq Roadmap' }), { button: 'right' });
    await expect.element(page.getByRole('menu')).toHaveTextContent('PVT_2');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('a single word is marked with its first two letters', async () => {
    await Collapsed.run({
        args: {
            ...Collapsed.args,
            tracked: {
                projects: [
                    {
                        key: 'project:1',
                        label: 'docs',
                        to: '/orgs/kedrzu/projects/1',
                        target: { kind: 'project', id: 'PVT_1' },
                        status: { kind: 'count', count: 1 },
                    },
                ],
                repositories: [],
            },
        },
    });

    await expect.element(page.getByRole('link', { name: 'docs' })).toHaveTextContent('DO');
});

test('the rail with no tracked project has no marks and no divider for them, and no Settings', async () => {
    await CollapsedNoProjects.run();

    const nav = page.getByRole('navigation', { name: 'Sidebar' });
    expect(nav.getByRole('separator').elements()).toHaveLength(1);
    await expect.element(nav.getByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
});

test('the rail with nothing tracked has the Settings icon', async () => {
    await CollapsedNothingTracked.run();

    const nav = page.getByRole('navigation', { name: 'Sidebar' });
    await expect.element(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(nav.getByRole('separator').elements()).toHaveLength(1);
});

test('many marks scroll on the rail, the logo and the way to expand staying in view', async () => {
    await CollapsedManyProjects.run();

    const last = page.getByRole('link', { name: 'Project 59' }).element();
    last.scrollIntoView();

    const expand = page.getByRole('button', { name: 'Expand sidebar' }).element();
    const logo = page.getByRole('img', { name: 'githq' }).element();
    await expect.poll(() => last.getBoundingClientRect().top).toBeGreaterThan(expand.getBoundingClientRect().bottom);
    expect(logo.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
});

test.each([
    ['expanded', Expanded],
    ['on the rail', Collapsed],
])('%s without window controls over it, nothing of the sidebar moves the window', async (_, story) => {
    await story.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    expect(sidebar.querySelector('[data-tauri-drag-region]')).toBeNull();
    expect(getComputedStyle(sidebar).paddingTop).toBe('12px');
});

test('the strip for the window controls holds its height and its place, and items go under it, as the lists scroll', async () => {
    await WindowControlsOverflowing.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    const strip = sidebar.querySelector('[data-tauri-drag-region]');
    if (!strip) {
        throw new Error('No strip for the window controls');
    }

    expect(strip.getBoundingClientRect().height).toBe(36);
    // As wide as the sidebar, to its edges: all of the top moves the window.
    expect(strip.getBoundingClientRect().width).toBe(sidebar.clientWidth);

    const { top, left } = sidebar.getBoundingClientRect();
    expect(strip.getBoundingClientRect().top).toBe(top);

    const last = page.getByRole('link', { name: /^kedrzu\/repository-59/u }).element();
    last.scrollIntoView();
    await expect.poll(() => last.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(strip.getBoundingClientRect().top).toBe(top);
    expect(strip.getBoundingClientRect().height).toBe(36);
    // What is under the window controls is the strip, not an item scrolled there.
    expect(document.elementFromPoint(left + 20, top + 18)).toBe(strip);
});

test('on the rail the strip reaches across it, for all of the top to move the window', async () => {
    await WindowControlsCollapsed.run();

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' }).element();
    const strip = sidebar.querySelector('[data-tauri-drag-region]');
    expect(strip?.getBoundingClientRect().width).toBe(sidebar.clientWidth);
    expect(strip?.getBoundingClientRect().height).toBe(36);
});

const RED = 'rgb(248, 81, 73)';
const RED_QUIET = 'rgb(172, 77, 82)';

const brokenWorkflows = () => page.getByRole('link', { name: /^Broken workflows/u });
/** The marker on a repository's icon: `new`, `settled`, `unread`; `null` with none. */
const markerOf = (name: string) =>
    page
        .getByRole('link', { name: new RegExp(`^${name.replace('/', '\\/')}`, 'u') })
        .element()
        .querySelector('[tid="workflow-marker"]')
        ?.getAttribute('data-marker') ?? null;

test('W1: with nothing known broken there is no "Broken workflows" entry, on the sidebar or the rail', async () => {
    await Expanded.run();
    await expect.element(brokenWorkflows()).not.toBeInTheDocument();

    await WorkflowsNotKnownYet.run();
    await expect.element(brokenWorkflows()).not.toBeInTheDocument();

    await Collapsed.run();
    await expect.element(brokenWorkflows()).not.toBeInTheDocument();
});

test('W1: a new break — the entry after Mentioned, a red dot and a red count, to the broken workflows', async () => {
    await BrokenWorkflowsNew.run();

    const entry = brokenWorkflows();
    await expect.element(entry).toHaveAccessibleName('Broken workflows 3');
    await expect.element(entry).toHaveAttribute('href', '/dashboard/workflows');
    const mentioned = page.getByRole('link', { name: /^Mentioned/u }).element();
    expect(mentioned.compareDocumentPosition(entry.element())).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const spans = entry.element().querySelectorAll('span');
    expect(getComputedStyle(spans[spans.length - 1] as Element).color).toBe(RED);
    expect(getComputedStyle(spans[spans.length - 2] as Element).backgroundColor).toBe(RED);
});

test('W1: settled — a quiet dot and the count in ordinary grey; "1+" while partly known', async () => {
    await BrokenWorkflowsSettled.run();
    const spans = brokenWorkflows().element().querySelectorAll('span');
    expect(getComputedStyle(spans[spans.length - 2] as Element).backgroundColor).toBe(RED_QUIET);
    expect(getComputedStyle(spans[spans.length - 1] as Element).color).not.toBe(RED);

    await BrokenWorkflowsPartlyKnown.run();
    await expect.element(brokenWorkflows()).toHaveAccessibleName('Broken workflows 1+');
});

test('W2b: on its own screen the entry shows with nothing broken, current, with no dot', async () => {
    await BrokenWorkflowsScreenOpen.run();

    const entry = brokenWorkflows();
    await expect.element(entry).toHaveAccessibleName('Broken workflows 0');
    await expect.element(entry).toHaveAttribute('aria-current', 'page');
    expect(entry.element().querySelectorAll('span')).toHaveLength(2);
});

test("W1: a repository's marker sits on its icon — bright, quiet or a hollow ring — and its count stays", async () => {
    await BrokenWorkflowsNew.run();

    expect(markerOf('kedrzu/githq')).toBe('settled');
    expect(markerOf('kedrzu/skills')).toBeNull();
    expect(markerOf('skyline-labs/portal')).toBe('new');
    await expect
        .element(page.getByRole('link', { name: /^skyline-labs\/portal/u }))
        .toHaveAccessibleName('skyline-labs/portal · workflows broken 142');
    await expect.element(page.getByRole('link', { name: /^kedrzu\/skills/u })).toHaveAccessibleName('kedrzu/skills 7');

    await BrokenWorkflowsPartlyKnown.run();
    expect(markerOf('skyline-labs/portal')).toBe('unread');
    await expect
        .element(page.getByRole('link', { name: /^skyline-labs\/portal/u }))
        .toHaveAccessibleName('skyline-labs/portal 142');
});

test('W1: on the rail the entry has a badge — filled red for a new break, outlined once settled', async () => {
    await CollapsedBrokenWorkflowsNew.run();

    let entry = page.getByRole('link', { name: 'Broken workflows, 3' });
    await expect.element(entry).toBeVisible();
    let badge = entry.element().querySelector('span');
    expect(badge?.textContent).toBe('3');
    expect(getComputedStyle(badge as Element).backgroundColor).toBe(RED);

    await CollapsedBrokenWorkflowsSettled.run();
    entry = page.getByRole('link', { name: 'Broken workflows, 1+' });
    badge = entry.element().querySelector('span');
    expect(badge?.textContent).toBe('1+');
    expect(getComputedStyle(badge as Element).backgroundColor).not.toBe(RED);
});

test('first run and loading D4: an entry still downloading shows nothing where its count goes — no percentage, no "waiting"', async () => {
    await Downloading.run();

    await expect.element(page.getByRole('link', { name: /^kedrzu\/githq/ })).toHaveTextContent(/18$/);
    await expect.element(page.getByRole('link', { name: 'skyline-labs/portal', exact: true })).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'skyline-labs/api', exact: true })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^acme-health\/vault/ })).toHaveTextContent(/hidden$/);
});

test('D14: a group of my work counts once its search is in; the others and the total stay blank until every group is', async () => {
    await SomeCountsArriving.run();

    await expect.element(page.getByRole('link', { name: /^Review requested 2$/ })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^My\spull requests 3$/ })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^Assigned to\sme$/ })).toBeVisible();
    await expect.element(page.getByRole('link', { name: /^My\swork$/ })).toBeVisible();
});

/** The sample repositories' addresses, in the order they are given. */
const REPOSITORY_ADDRESSES = ['/kedrzu/githq', '/kedrzu/skills', '/skyline-labs/portal', '/skyline-labs/api'];

test('a repository dragged down lands after the row it took the place of; the list stays as given, and the drag goes nowhere', async () => {
    const onMove = vi.fn();
    await Reordering.run({ args: { ...Reordering.args, onMove } });

    await dragRow('kedrzu/githq', 'skyline-labs/portal');

    const target: TrackedTarget = { kind: 'repository', nameWithOwner: 'kedrzu/githq' };
    const place: SidebarMovePlace = {
        anchor: { kind: 'repository', nameWithOwner: 'skyline-labs/portal' },
        side: 'after',
    };
    expect(onMove).toHaveBeenCalledExactlyOnceWith(target, place);
    // Nothing reordered the props: Vue's order, not Sortable's, is on the page.
    expect(placeAddresses('Repositories')).toEqual(REPOSITORY_ADDRESSES);
    // The router would have moved by the next frame.
    await new Promise(requestAnimationFrame);
    expect(document.querySelector('[data-route]')?.getAttribute('data-route')).toBe('/');
});

test('a repository dragged up lands before the row it took the place of', async () => {
    const onMove = vi.fn();
    await Reordering.run({ args: { ...Reordering.args, onMove } });

    await dragRow('skyline-labs/api', 'kedrzu/skills');

    const target: TrackedTarget = { kind: 'repository', nameWithOwner: 'skyline-labs/api' };
    const place: SidebarMovePlace = { anchor: { kind: 'repository', nameWithOwner: 'kedrzu/skills' }, side: 'before' };
    expect(onMove).toHaveBeenCalledExactlyOnceWith(target, place);
    expect(placeAddresses('Repositories')).toEqual(REPOSITORY_ADDRESSES);
});

test('a project dragged up lands before the project it took the place of', async () => {
    const onMove = vi.fn();
    await Reordering.run({ args: { ...Reordering.args, onMove } });

    await dragRow('Docs revamp', 'Platform Q4');

    const target: TrackedTarget = { kind: 'project', id: 'PVT_3' };
    const place: SidebarMovePlace = { anchor: { kind: 'project', id: 'PVT_1' }, side: 'before' };
    expect(onMove).toHaveBeenCalledExactlyOnceWith(target, place);
});

test('a project is not dropped among the repositories', async () => {
    const onMove = vi.fn();
    await Reordering.run({ args: { ...Reordering.args, onMove } });

    await dragRow('Docs revamp', 'kedrzu/skills');

    expect(onMove).not.toHaveBeenCalled();
    expect(placeAddresses('Projects')).toEqual([
        '/orgs/skyline-labs/projects/1',
        '/orgs/kedrzu/projects/2',
        '/orgs/skyline-labs/projects/3',
    ]);
    expect(placeAddresses('Repositories')).toEqual(REPOSITORY_ADDRESSES);
});

test('a click on a tracked place, without a drag, goes to it', async () => {
    const onMove = vi.fn();
    await Reordering.run({ args: { ...Reordering.args, onMove } });

    await userEvent.click(placeRow('kedrzu/skills'));

    await expect.poll(() => document.querySelector('[data-route]')?.getAttribute('data-route')).toBe('/kedrzu/skills');
    expect(onMove).not.toHaveBeenCalled();
});

/** A tracked place's own row, by its name. */
function placeRow(name: string) {
    return page
        .getByRole('navigation', { name: 'Sidebar' })
        .getByRole('link', { name: new RegExp(`^${name}`, 'u') })
        .or(
            page
                .getByRole('navigation', { name: 'Sidebar' })
                .getByRole('button', { name: new RegExp(`^${name}`, 'u') }),
        );
}

/** The list item of a tracked place, holding its row and the rows under it. */
function placeItem(name: string) {
    const item = placeRow(name).element().closest('li');
    if (!item) {
        throw new Error(`No list item for ${name}`);
    }

    return item;
}

/** The rows under a tracked place. */
function subRows(name: string) {
    return page.elementLocator(placeItem(name)).getByRole('list');
}

/** Where the places under a section's heading go, in the page's order. */
function placeAddresses(heading: string) {
    const list = page.getByRole('heading', { name: heading }).element().nextElementSibling;
    return [...(list?.querySelectorAll(':scope > li') ?? [])].map(item =>
        item.querySelector('a')?.getAttribute('href'),
    );
}

/**
 * Drags a place's row onto another's, as a mouse does with Sortable's own pointer dragging: a frame between steps, a
 * pause over the target for Sortable to see it there, and on release the mouse's own `mouseup` (which Sortable drops on)
 * and the click the browser sends after it.
 */
async function dragRow(name: string, onto: string) {
    const source = placeRow(name).element();
    const from = source.getBoundingClientRect();
    const to = placeRow(onto).element().getBoundingClientRect();
    const x = from.left + from.width / 2;
    const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
    source.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x, clientY: from.top + from.height / 2 }));
    for (let step = 1; step <= 10; step++) {
        const y = from.top + from.height / 2 + ((to.top - from.top) * step) / 10;
        document.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x, clientY: y }));
        await wait(20);
    }

    await wait(150);
    const end = { ...init, clientX: x, clientY: to.top + to.height / 2 };
    document.dispatchEvent(new PointerEvent('pointerup', end));
    document.dispatchEvent(new MouseEvent('mouseup', end));
    source.dispatchEvent(new MouseEvent('click', end));
}

function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
