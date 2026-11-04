import { composeStories } from '@storybook/vue3';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { SquareKanban } from 'lucide-vue-next';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import ListToolbar from './ListToolbar.vue';
import * as stories from './ListToolbar.stories.js';

const { PlainTitle, TitleMenu } = composeStories(stories);

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

test('a menu option with a command title is a command of its own: its choices are the submenu and picking one chooses it, "none" too', () => {
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
                        commandTitle: 'Row field…',
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
    expect(commands.map(command => command.id)).toContain('view.rowField');
    expect(commands.map(command => command.id)).not.toContain('view.plain');
    const command = commands.find(candidate => candidate.id === 'view.rowField');
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
