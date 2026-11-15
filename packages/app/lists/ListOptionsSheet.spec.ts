import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, shallowReactive } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import ProjectView from '@/projects/ProjectView.vue';
import type { ProjectViewOptions } from '@/projects/projectViewOptions.js';
import { getProjectViewChoices, getProjectViewDefaults } from '@/projects/projectViewOptions.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_PROJECT, SAMPLE_PROJECT_ENTRIES, SAMPLE_VIEW_SPRINT } from '@/testing/sampleProject.js';
import { sampleProjectView } from '@/testing/sampleProjectView.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';

import { ListViewOptionsStore } from './ListViewOptionsStore.js';
import { useListViewOptions } from './useListViewOptions.js';

/** The list's key on this device, as the page names a project view's. */
const LIST = 'test:sprint';

test('Group by in the sheet regroups the list behind it, kept on this device; Back to GitHub’s view resets it', async () => {
    const kept = mount();
    await expect.poll(groupNames).toEqual(['Todo', 'In progress', 'In review', 'Done']);

    const sheet = await openSheet();
    await expect.element(sheet.getByText('Changed on this device')).not.toBeInTheDocument();
    await userEvent.click(sheet.getByRole('group', { name: 'Group by' }).getByRole('button', { name: 'Priority' }));

    // The sheet stays up while the list behind follows.
    await expect.poll(groupNames).toEqual(['Urgent', 'High', 'Medium', 'Low']);
    expect(kept.get(LIST)).toEqual({ grouping: 'field:F_priority' });
    await expect.element(sheet.getByText('Changed on this device')).toBeVisible();

    await userEvent.click(sheet.getByRole('button', { name: "Back to GitHub's view" }));
    await expect.poll(groupNames).toEqual(['Todo', 'In progress', 'In review', 'Done']);
    expect(kept.has(LIST)).toBe(false);
    await expect.element(sheet.getByText('Changed on this device')).not.toBeInTheDocument();
});

test('a project’s order is one chip per key: tapped again it flips its direction', async () => {
    const kept = mount();
    const sorts = (await openSheet()).getByRole('group', { name: 'Sort by' });

    await expect.element(sorts.getByRole('button', { name: 'Priority ↑' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(sorts.getByRole('button', { name: 'Priority ↓' })).not.toBeInTheDocument();

    await userEvent.click(sorts.getByRole('button', { name: 'Priority ↑' }));
    expect(kept.get(LIST)).toEqual({ sort: 'field:F_priority:desc' });
    await expect.element(sorts.getByRole('button', { name: 'Priority ↓' })).toHaveAttribute('aria-pressed', 'true');

    // Another key starts its own way; the one left shows its name alone.
    await userEvent.click(sorts.getByRole('button', { name: 'Iteration' }));
    expect(kept.get(LIST)).toEqual({ sort: 'field:F_iteration:asc' });
    await expect.element(sorts.getByRole('button', { name: 'Priority', exact: true })).toBeVisible();
});

test('the × of the view’s filter clears it on this device', async () => {
    const kept = mount();
    const sheet = await openSheet();
    await expect.element(sheet.getByText('iteration:@current')).toBeVisible();

    await userEvent.click(sheet.getByRole('button', { name: 'Clear the filter on this device' }));
    expect(kept.get(LIST)).toEqual({ filter: '' });
    await expect.element(sheet.getByText('iteration:@current')).not.toBeInTheDocument();
    await expect.element(sheet.getByText('Changed on this device')).toBeVisible();
});

test('Done closes the sheet, and so does a tap above it', async () => {
    mount();
    await userEvent.click((await openSheet()).getByRole('button', { name: 'Done' }));
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();

    await openSheet();
    // Near the window's top, over the dimmed list: what is drawn there is the overlay.
    await userEvent.click(page.elementLocator(document.body), { position: { x: 20, y: 20 }, force: true });
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
});

async function openSheet() {
    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    const sheet = page.getByRole('dialog', { name: 'Current sprint' });
    await expect.element(sheet).toBeVisible();
    return sheet;
}

/** A project view on a phone whose options are kept as the page keeps them; returns what is kept on this device. */
function mount() {
    const kept = createKeptOptions();
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(PhoneLayout, createFixedPhoneLayout(true));
    container.set(ListViewOptionsStore, kept);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    document.body.append(host);

    const defaults = getProjectViewDefaults(SAMPLE_PROJECT, SAMPLE_VIEW_SPRINT).options;
    const app = createApp({
        setup() {
            const options = useListViewOptions({
                list: LIST,
                defaults,
                choices: getProjectViewChoices(SAMPLE_PROJECT, defaults),
            });
            return () =>
                h(ProjectView, {
                    ...sampleProjectView({
                        project: SAMPLE_PROJECT,
                        view: SAMPLE_VIEW_SPRINT,
                        entries: SAMPLE_PROJECT_ENTRIES,
                        options: options.options,
                    }),
                    modified: options.modified,
                    rowFieldId: 'F_status',
                    viewerLogin: SAMPLE_VIEWER.login,
                    now: SAMPLE_NOW,
                    'onUpdate:options': (value: ProjectViewOptions) => options.set(value),
                    onReset: () => options.reset(),
                    onClearFilter: () => options.set({ filter: '' }),
                });
        },
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

    return kept;
}

/** The list's groups, top to bottom. */
function groupNames() {
    return [...document.querySelectorAll('section[aria-label]')].map(section => section.getAttribute('aria-label'));
}

function createKeptOptions(): ListViewOptionsStore {
    const values = shallowReactive(new Map<string, unknown>());
    return {
        get: list => values.get(list),
        has: list => values.has(list),
        set: (list, value) => {
            if (value === null) {
                values.delete(list);
            } else {
                values.set(list, value);
            }
        },
    };
}
