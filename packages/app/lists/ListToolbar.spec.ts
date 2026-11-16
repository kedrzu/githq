import { composeStories } from '@storybook/vue3';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { rowField } from '@/commands/definitions/index.js';
import { SquareKanban } from 'lucide-vue-next';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { narrowToolbar } from '@/testing/narrowToolbar.js';

import ListToolbar from './ListToolbar.vue';
import * as stories from './ListToolbar.stories.js';

const { Phone, PlainTitle, Tabs, TabsAsMenu, TitleMenu } = composeStories(stories);

test('with a menu, the title is a button that opens it', async () => {
    await TitleMenu.run();

    const title = page
        .getByRole('heading', { name: 'Platform Q4' })
        .getByRole('button', { name: 'Actions of Platform Q4' });
    await userEvent.click(title);
    await expect.element(page.getByRole('menu')).toHaveTextContent('Platform Q4 · fitloop');
    await expect.element(page.getByRole('menuitem', { name: 'Open on GitHub' })).toBeVisible();
});

test('without a menu, the title is plain text', async () => {
    await PlainTitle.run();

    await expect.element(page.getByRole('heading', { name: 'Platform Q4' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Platform Q4/ })).not.toBeInTheDocument();
});

test('on a phone it is the top bar: the title alone, the options in a sheet without properties or layout, and New issue runs what C runs', async () => {
    await Phone.run();

    await expect.element(page.getByRole('heading', { name: 'Platform Q4' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Actions of Platform Q4' })).not.toBeInTheDocument();
    await expect.element(page.getByText('Beside the title')).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Open places' })).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Display' }));
    const sheet = page.getByRole('dialog', { name: 'Platform Q4' });
    await expect.element(sheet.getByRole('group', { name: 'Group by' })).toBeVisible();
    for (const option of ['Properties', 'Layout']) {
        await expect.element(sheet.getByRole('group', { name: option })).not.toBeInTheDocument();
    }
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByTestId('new-issue')).toHaveTextContent('Not started');
    await userEvent.click(page.getByRole('button', { name: 'New issue' }));
    await expect.element(page.getByTestId('new-issue')).toHaveTextContent(/^Started$/);
});

test('a menu option naming a command is that command: its choices are the submenu and picking one chooses it, "none" too', () => {
    const choose = vi.fn();
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
        setup: () => () =>
            h(ListToolbar, {
                title: 'Platform Q4',
                groupings: [{ value: 'none', label: 'None' }],
                sorts: [{ value: 'updated', label: 'Updated' }],
                properties: [],
                options: { layout: 'list', grouping: 'none', sort: 'updated', properties: [] },
                extraOptions: [
                    {
                        kind: 'menu',
                        key: 'rowField',
                        label: 'Row field',
                        icon: SquareKanban,
                        title: 'Row field: Priority',
                        command: rowField,
                        choices: [
                            { value: 'F_priority', label: 'Priority' },
                            { value: 'none', label: 'None' },
                        ],
                        value: 'F_priority',
                        choose,
                    },
                    {
                        kind: 'menu',
                        key: 'plain',
                        label: 'Plain',
                        icon: SquareKanban,
                        title: 'Plain',
                        choices: [],
                        value: '',
                        choose: () => undefined,
                    },
                ],
            }),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    const commands = container.resolve(CommandRegistry).commands;
    expect(commands.filter(command => command.options !== undefined).map(command => command.id)).toEqual([
        'list.groupBy',
        'list.orderBy',
        'list.rowField',
        'list.showProperties',
    ]);
    const command = commands.find(candidate => candidate.id === 'list.rowField');
    expect(command?.title).toBe('Row field…');
    expect(command?.detail).toBe('Priority');
    const submenu = command?.options?.().options;
    expect(submenu?.map(option => [option.value, option.chosen])).toEqual([
        ['F_priority', true],
        ['none', false],
    ]);
    submenu?.find(option => option.value === 'none')?.pick();
    expect(choose).toHaveBeenCalledWith('none');
});

test('as it narrows the header gives way in steps — the options into Display by priority, the state last; then Display an icon; then the tabs one menu — and no control is ever drawn over the title and tabs', async () => {
    await Tabs.run();
    const frame = assertValue(document.querySelector<HTMLElement>('[tid="toolbar-frame"]'));

    const fits = await narrowToolbar(frame, widthsBetween(1200, 300));

    expect(fits.filter(fit => fit.overlaps.length > 0)).toEqual([]);
    const steps = fits.map(fit => fit.step);
    expect(steps).toEqual(steps.toSorted((a, b) => a - b));
    expect(new Set(steps)).toEqual(new Set([0, 1, 2]));
    expect(fits[0]?.options.length).toBe(5);
    for (const [index, fit] of fits.entries()) {
        // A step is taken only once every option has moved into Display.
        const before = fits[index - 1];
        if (before && fit.step > before.step) {
            expect(before.options).toEqual([]);
        }

        // What stays is the start of the order they stay in: the state, the layout, the grouping, the order, the properties.
        expect(fit.options.toSorted()).toEqual(STAYING.slice(0, fit.options.length).toSorted());
    }
});

test('folded, the tabs are one menu button showing the current section and Display an icon still named Display; its menu lists every section with its count and key, the current one marked', async () => {
    await TabsAsMenu.run();

    // Display is its icon by now, still named.
    await expect.element(page.getByRole('button', { name: 'Display' })).toHaveTextContent(/^$/);
    await userEvent.click(page.getByRole('button', { name: /Pull requests/, expanded: false }));
    const menu = page.getByRole('menu');
    await expect.element(menu.getByRole('menuitem', { name: /Pull requests/ })).toHaveAttribute('aria-current', 'true');
    await expect.element(menu.getByRole('menuitem', { name: /Issues/ })).toHaveAttribute('aria-keyshortcuts', '1');
    await expect.element(menu.getByRole('menuitem', { name: /Workflows/ })).toHaveTextContent(/Workflows\s*1/);
});

/** The order the view options stay on the toolbar in (`PRIORITY` in `ListToolbar`, the filters first). */
const STAYING = ['state', 'layout', 'grouping', 'sort', 'properties'];

function widthsBetween(from: number, to: number) {
    const widths: number[] = [];
    for (let width = from; width >= to; width -= 10) {
        widths.push(width);
    }

    return widths;
}
