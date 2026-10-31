import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, ref, shallowRef } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemSort } from '@/lists/ItemSort.js';
import type { ListViewOptions } from '@/lists/ListTypes.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_REPOSITORY, SAMPLE_REPOSITORY_ITEMS } from '@/testing/sampleRepositoryItems.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { RepositoryKind, RepositoryListTexts } from './buildRepositoryList.js';
import { buildRepositoryList } from './buildRepositoryList.js';
import RepositoryView from './RepositoryView.vue';
import type { RepositoryGrouping } from './repositoryViewOptions.js';
import { REPOSITORY_VIEW_DEFAULTS } from './repositoryViewOptions.js';

const TEXTS: RepositoryListTexts = {
    all: 'All',
    noMilestone: 'No milestone',
    noLabel: 'No label',
    unassigned: 'Unassigned',
    noType: 'No type',
    issues: 'Issues',
    pullRequests: 'Pull requests',
    milestoneDetail: ({ closed, total }) => `${closed} of ${total} closed`,
};

test('J1 → J2: grouped by milestone, then by issue type as a board from the toolbar; the kind tabs narrow it', async () => {
    const view = mount();
    await expect.poll(groupNames).toEqual(['v4.2 — November', 'v4.3 — December', 'No milestone']);
    await expect.element(page.getByRole('region', { name: 'v4.2 — November' })).toHaveTextContent('1 of 4 closed');

    await userEvent.click(page.getByRole('button', { name: 'Group: Milestone' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Issue type' }));
    await userEvent.click(page.getByRole('button', { name: 'Board' }));
    expect(view.options.value).toMatchObject({ grouping: 'issueType', layout: 'board' });
    await expect.poll(groupNames).toEqual(['Bug', 'Feature', 'Task', 'No type']);

    await userEvent.click(page.getByRole('button', { name: /Pull requests/ }));
    await expect.poll(groupNames).toEqual(['No type']);
    await expect.element(page.getByRole('region', { name: 'No type' })).toHaveTextContent(/#1203/);
});

test('the display options set the order and the properties rows show', async () => {
    const view = mount();
    const row = page.getByRole('listitem').filter({ hasText: 'Calendar shows wrong timezone' });
    await expect.element(row.getByText('calendar', { exact: true })).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    await userEvent.click(page.getByRole('button', { name: 'Labels' }));
    await userEvent.click(page.getByRole('button', { name: 'Title' }));
    expect(view.options.value.sort).toBe('title');
    expect(view.options.value.properties).not.toContain('labels');
    await expect.element(row.getByText('calendar', { exact: true })).not.toBeInTheDocument();
});

test('J3: not tracked, it lists what concerns the user and asks to be tracked', async () => {
    const view = mount({ tracked: false });

    await expect
        .element(page.getByRole('region', { name: `You're not tracking ${SAMPLE_REPOSITORY}` }))
        .toHaveTextContent(/only has what concerns you here: 6 items/);
    await expect.element(page.getByRole('button', { name: /^Group:/ })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: `Track ${SAMPLE_REPOSITORY}` }));
    expect(view.tracks).toBe(1);
});

interface MountOptions {
    readonly tracked?: boolean;
}

/** Mounts a tracked repository over the samples, building its list from the options it holds, as the page does. */
function mount({ tracked = true }: MountOptions = {}) {
    const options = shallowRef<ListViewOptions<RepositoryGrouping, ItemSort>>(REPOSITORY_VIEW_DEFAULTS);
    const kind = ref<RepositoryKind>('all');
    const view = { options, tracks: 0 };

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    document.body.append(host);

    const app = createApp({
        setup: () => () =>
            h(RepositoryView, {
                nameWithOwner: SAMPLE_REPOSITORY,
                isPrivate: true,
                tracked,
                list: buildRepositoryList({
                    items: SAMPLE_REPOSITORY_ITEMS,
                    state: 'open',
                    kind: kind.value,
                    grouping: tracked ? options.value.grouping : 'none',
                    sort: options.value.sort,
                    texts: TEXTS,
                }),
                openCount: 6,
                viewerLogin: SAMPLE_VIEWER.login,
                now: SAMPLE_NOW,
                options: options.value,
                'onUpdate:options': (value: ListViewOptions<RepositoryGrouping, ItemSort>) => {
                    options.value = value;
                },
                kind: kind.value,
                'onUpdate:kind': (value: RepositoryKind) => {
                    kind.value = value;
                },
                onTrack: () => view.tracks++,
            }),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return view;
}

/** The groups shown, top to bottom or left to right. */
function groupNames() {
    return [...document.querySelectorAll('main section, body section')]
        .map(section => section.getAttribute('aria-label'))
        .filter(name => name !== null && !name.startsWith('You'));
}
