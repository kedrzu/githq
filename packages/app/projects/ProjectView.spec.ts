import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, shallowRef } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ListEntry, ListGroup, ListMove } from '@/lists/ListTypes.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import {
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_ENTRIES,
    SAMPLE_VIEW_BOARD,
    SAMPLE_VIEW_NEXT,
    SAMPLE_VIEW_SPRINT,
} from '@/testing/sampleProject.js';
import type { SampleProjectViewParams } from '@/testing/sampleProjectView.js';
import { sampleProjectView } from '@/testing/sampleProjectView.js';
import { sampleListStack, sampleStack } from '@/testing/sampleStacks.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import type { ProjectEntry, ProjectView as SavedView } from './ProjectTypes.js';
import ProjectView from './ProjectView.vue';
import type { ProjectViewOptions } from './projectViewOptions.js';

test('the saved views are tabs: the one shown is current, one changed here is marked, one GitHub answers has a cloud', async () => {
    mount(SAMPLE_VIEW_SPRINT, { modifiedViews: [2] });
    const tabs = page.getByRole('navigation', { name: 'Saved views' });

    await expect.element(tabs.getByRole('link', { name: 'Current sprint' })).toHaveAttribute('aria-current', 'page');
    await expect
        .element(tabs.getByRole('link', { name: 'Current sprint' }))
        .toHaveAttribute('href', '/orgs/skyline-labs/projects/2/views/1');
    await expect
        .element(tabs.getByRole('link', { name: /Board/ }).getByRole('img', { name: 'modified locally' }))
        .toBeVisible();
    await expect
        .element(tabs.getByRole('link', { name: /Next sprint/ }).getByRole('img', { name: 'answered by GitHub' }))
        .toBeVisible();
});

test('changing the grouping marks the view modified locally; Reset goes back to GitHub’s version', async () => {
    const view = mount(SAMPLE_VIEW_SPRINT);
    await expect.poll(groupNames).toEqual(['Todo', 'In progress', 'In review', 'Done']);
    await expect.element(page.getByText('Changed here')).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'Group: Status' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Priority' }));
    expect(view.options.value.grouping).toBe('field:F_priority');
    await expect.poll(groupNames).toEqual(['Urgent', 'High', 'Medium', 'Low']);
    await expect.element(page.getByText('Changed here')).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Reset' }));
    expect(view.resets).toBe(1);
    await expect.poll(groupNames).toEqual(['Todo', 'In progress', 'In review', 'Done']);
});

test('on the board a card is dragged into another column, or moved with ⇧→: the field is set', async () => {
    const view = mount(SAMPLE_VIEW_BOARD, { canMove: true });
    const card = page
        .getByRole('region', { name: 'Todo' })
        .getByRole('listitem')
        .filter({ hasText: 'Crash on Android' });

    drag(card.element(), page.getByRole('region', { name: 'Done' }).element());
    expect(view.moves.at(-1)).toEqual({ ids: ['I_91'], from: 'opt_todo', to: 'opt_done' });

    await userEvent.click(card);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(view.moves.at(-1)).toEqual({ ids: ['I_91'], from: 'opt_todo', to: 'opt_progress' });
});

test('a draft is written at the bottom of a column, with its value', async () => {
    const view = mount(SAMPLE_VIEW_BOARD);
    await userEvent.click(page.getByRole('button', { name: 'New draft in In review' }));
    await userEvent.keyboard('Write the runbook{Enter}');
    expect(view.drafts).toEqual([['Write the runbook', 'opt_review']]);
    await expect.element(page.getByRole('textbox', { name: 'New draft issue in In review' })).toHaveValue('');
});

test('the project’s row field sits on the toolbar while it fits, otherwise in Display, chosen right there; kept on this device only', async () => {
    const view = mount(SAMPLE_VIEW_SPRINT);
    await userEvent.click(page.getByRole('button', { name: 'Row field: Status' }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Priority' }));
    expect(view.rowFields).toEqual(['F_priority']);

    view.host.style.width = '640px';
    await expect.element(page.getByRole('button', { name: 'Row field: Status' })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    await expect.element(page.getByText('View settings are saved on this device only')).toBeVisible();
    // Its choices sit in Display itself — no second menu to open.
    await expect.element(page.getByRole('button', { name: 'Row field: Status' })).not.toBeInTheDocument();
    const rowField = page.getByRole('dialog', { name: 'Display' }).getByRole('group', { name: /in other lists$/ });
    await userEvent.click(rowField.getByRole('button', { name: 'Priority' }));
    expect(view.rowFields).toEqual(['F_priority', 'F_priority']);
});

test('K6: until GitHub answers a view githq can’t evaluate, it waits — no item is listed', async () => {
    mount(SAMPLE_VIEW_NEXT);
    await expect.element(page.getByRole('heading', { name: 'GitHub is answering this view' })).toBeVisible();
    await expect.element(page.getByText('no:linked-pull-requests', { exact: true })).toBeVisible();
    expect(document.querySelectorAll('[data-entry-key]')).toHaveLength(0);
});

test('D15: a stack’s entry shows the field values all its pull requests share, “+N” for the fields where they differ', async () => {
    const pullRequests = sampleStack({ id: 'S_picker', number: 1300, members: [{}, {}] });
    const nested: ListEntry<ProjectEntry>[] = pullRequests.map((content, index) => ({
        key: `opt_progress:${content.id}`,
        id: content.id,
        value: {
            item: {
                itemId: `PVTI_${content.id}`,
                projectId: 'PVT_q4',
                contentId: content.id,
                draft: null,
                values: {
                    F_priority: { kind: 'singleSelect', optionId: 'opt_high', name: 'High', color: 'ORANGE' },
                    F_estimate: { kind: 'number', number: 3 + index },
                },
                updatedAt: content.updatedAt,
                isArchived: false,
            },
            content,
        },
    }));
    const stack = sampleListStack(pullRequests);
    mount(SAMPLE_VIEW_SPRINT, {
        groups: [
            {
                key: 'opt_progress',
                label: 'In progress',
                arrived: true,
                droppable: true,
                rows: [
                    {
                        key: 'opt_progress:stack',
                        id: `stack:${stack.id}`,
                        value: assertValue(nested[0]).value,
                        nested,
                        stack,
                    },
                ],
            },
        ],
    });

    const entry = page.getByRole('listitem').filter({ hasText: 'Part 1 of S_picker' });
    await expect.element(entry.getByTitle('Priority: High')).toBeVisible();
    await expect.element(entry.getByTitle(/Story points/)).not.toBeInTheDocument();
    await expect.element(entry.getByText('+1', { exact: true })).toBeVisible();
});

interface MountOptions {
    readonly modifiedViews?: SampleProjectViewParams['modifiedViews'];
    readonly canMove?: boolean;
    /** The groups shown in place of those built from the sample project's items. */
    readonly groups?: readonly ListGroup<ProjectEntry>[];
}

/** Mounts the sample project on a saved view, rebuilding the groups from the options it holds, as the page does. */
function mount(saved: SavedView, { modifiedViews = [], canMove = false, groups }: MountOptions = {}) {
    const initial = sampleProjectView({ project: SAMPLE_PROJECT, view: saved, entries: SAMPLE_PROJECT_ENTRIES });
    const options = shallowRef<ProjectViewOptions>(initial.options);
    const view = {
        options,
        resets: 0,
        moves: [] as ListMove[],
        drafts: [] as [string, string | null][],
        rowFields: [] as (string | null)[],
    };

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    host.style.width = '1400px';
    document.body.append(host);

    const app = createApp({
        setup: () => () =>
            h(ProjectView, {
                ...sampleProjectView({
                    project: SAMPLE_PROJECT,
                    view: saved,
                    entries: SAMPLE_PROJECT_ENTRIES,
                    options: options.value,
                    modifiedViews,
                }),
                ...(groups && { groups }),
                modified: options.value !== initial.options,
                rowFieldId: 'F_status',
                viewerLogin: SAMPLE_VIEWER.login,
                now: SAMPLE_NOW,
                canMove: () => canMove,
                'onUpdate:options': (value: ProjectViewOptions) => {
                    options.value = value;
                },
                'onUpdate:rowFieldId': (value: string | null) => view.rowFields.push(value),
                onReset: () => {
                    view.resets++;
                    options.value = initial.options;
                },
                onMove: (move: ListMove) => view.moves.push(move),
                onAddDraft: (title: string, group: string | null) => view.drafts.push([title, group]),
            }),
    });
    app.use(IocPlugin, { container });
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
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
    return [...document.querySelectorAll('section')].map(section => section.getAttribute('aria-label'));
}

/** Native drag and drop of `card` onto `column`, as the browser fires it. */
function drag(card: Element, column: Element) {
    const dataTransfer = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    column.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
}
