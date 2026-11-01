import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import * as stories from './Sidebar.stories.js';

const {
    Collapsed,
    CollapsedNoProjects,
    CollapsedNothingTracked,
    CollapsedOnProject,
    CollapsedTrackedMenu,
    Expanded,
    LongLists,
    LongLogin,
    NoProjects,
    NoRepositories,
    NothingTracked,
    OnRepositoryIssues,
    TrackedMenu,
} = composeStories(stories);

const NOTHING_TRACKED_NOTE = 'Repositories and projects you track appear here.';

test("a tracked repository's row is current on any of its lists, not only on its own address", async () => {
    await OnRepositoryIssues.run();

    await expect.element(page.getByRole('link', { name: /^kedrzu\/githq/ })).toHaveAttribute('aria-current', 'page');
    await expect.element(page.getByRole('link', { name: /^kedrzu\/skills/ })).not.toHaveAttribute('aria-current');
});

test('a private repository has a lock instead of the repository icon', async () => {
    await Expanded.run();

    const portal = page.getByRole('link', { name: /^sigma-clinic\/portal/ }).element();
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
        .toHaveAttribute('aria-keyshortcuts', '[');
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

test('a long login ends in an ellipsis, the chevron still in the row', async () => {
    await LongLogin.run();

    const login = page.getByText(/^a-very-long-login/u).element();
    const nav = page.getByRole('navigation', { name: 'Sidebar' }).element();
    const chevron = nav.querySelector('.lucide-chevron-up');
    expect(login.scrollWidth).toBeGreaterThan(login.clientWidth);
    expect(getComputedStyle(login).textOverflow).toBe('ellipsis');
    expect(chevron?.getBoundingClientRect().right).toBeLessThanOrEqual(nav.getBoundingClientRect().right);
});

test('the user menu opens upwards with who is signed in, Settings and its key, and Sign out', async () => {
    const onSignOut = vi.fn();
    await Expanded.run({ args: { ...Expanded.args, onSignOut } });

    await userEvent.click(page.getByRole('button', { name: /^Account:/u }));
    const menu = page.getByRole('menu');
    await expect.element(menu).toHaveAttribute('data-side', 'top');
    await expect.element(menu).toHaveTextContent(`Signed in as ${SAMPLE_VIEWER.login}`);
    await expect.element(menu.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('aria-keyshortcuts', ',');
    await expect.element(menu.getByRole('menuitem', { name: 'Settings' })).toHaveTextContent(',');
    await expect.element(menu.getByRole('separator')).toBeInTheDocument();
    expect(menu.getByRole('menuitem').elements()).toHaveLength(2);

    await userEvent.click(menu.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
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
        .toHaveAttribute('href', '/orgs/sigma-clinic/projects/3');
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
