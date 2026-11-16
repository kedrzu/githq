import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { Translator } from '@nzyme/i18n/Translator.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, test } from 'bun:test';
import { Github } from 'lucide-vue-next';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { bindCommand } from './bindCommand.js';
import { defineAppCommand } from './defineAppCommand.js';

const container = createContainer();
container.set(LanguageContext, () => APP_LANGUAGE);
const t = container.resolve(Translator);
const run = () => undefined;

const OPEN = defineAppCommand({
    id: 'open',
    title: () => 'Open on GitHub',
    icon: Github,
    key: 'O',
    keywords: [() => 'browser'],
    places: ['list', 'item'],
    priority: 2,
});

test('the definition gives what it is, the binding what it does there', () => {
    const when = () => true;

    expect(bindCommand(OPEN, { place: 'item', section: 'item', run, when, detail: '3 tabs' }, t)).toEqual({
        id: 'item.open',
        title: 'Open on GitHub',
        icon: Github,
        key: 'O',
        otherKeys: undefined,
        keywords: ['browser'],
        priority: 2,
        place: 'item',
        section: 'item',
        run,
        when,
        detail: '3 tabs',
    });
});

test("one place is the binding's to leave out; the defaults are priority 0 and a configurable key", () => {
    const sidebar = defineAppCommand({ id: 'sidebar', title: () => 'Sidebar', key: 'Mod+B', places: ['app'] });

    expect(sidebar.priority).toBe(0);
    expect(sidebar.configurable).toBe(true);
    expect(bindCommand(sidebar, { section: 'app', run }, t)).toMatchObject({ id: 'app.sidebar', place: 'app' });
});

test('a family gives a command on each number the binding takes, named by what it picks', () => {
    const views = defineAppCommand({
        id: 'view',
        title: () => 'Go to view 1–9',
        numbers: { first: 1, last: 9 },
        places: ['list'],
    });
    const names = ['Backlog', 'Board'];

    const commands = bindCommand(
        views,
        number => {
            const name = names[number - 1];
            return name === undefined ? null : { section: 'view', title: `Go to "${name}" view`, run };
        },
        t,
    );

    expect(views.configurable).toBe(false);
    expect(commands.map(({ id, key, title }) => ({ id, key, title }))).toEqual([
        { id: 'list.view.1', key: '1', title: 'Go to "Backlog" view' },
        { id: 'list.view.2', key: '2', title: 'Go to "Board" view' },
    ]);
});
