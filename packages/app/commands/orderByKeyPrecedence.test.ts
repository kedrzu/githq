import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { Translator } from '@nzyme/i18n/Translator.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, test } from 'bun:test';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { bindCommand } from './bindCommand.js';
import type { BoundCommand, CommandPlace, CommandSection } from './CommandTypes.js';
import { defineAppCommand } from './defineAppCommand.js';
import { undo } from './definitions/index.js';
import { orderByKeyPrecedence } from './orderByKeyPrecedence.js';

const container = createContainer();
container.set(LanguageContext, () => APP_LANGUAGE);
const t = container.resolve(Translator);
const run = () => undefined;

test('of one place the sections decide, and of one section the one registered first', () => {
    const app = command('app', 'list', 'app');
    const view = command('view', 'list', 'view');
    const item = command('item', 'list', 'item');
    const otherItem = command('otherItem', 'list', 'item');
    const selection = command('selection', 'list', 'selection');

    expect(ids(orderByKeyPrecedence([app, view, item, otherItem, selection]))).toEqual([
        'list.selection',
        'list.item',
        'list.otherItem',
        'list.view',
        'list.app',
    ]);
});

test("the keeper of places on screen together takes the key, whatever the other's section", () => {
    expect(ids(orderByKeyPrecedence([command('item', 'item', 'item'), command('list', 'list', 'view')]))).toEqual([
        'list.list',
        'item.item',
    ]);
});

test('any screen place takes a key before the app, whatever the sections', () => {
    expect(ids(orderByKeyPrecedence([command('app', 'app', 'selection'), command('item', 'item', 'app')]))).toEqual([
        'item.item',
        'app.app',
    ]);
});

test("an item open beside a repository's Workflows section leaves it J; beside the draft reviews it keeps ⇧S", () => {
    const workflows = command('next', 'workflows', 'view');
    const itemNext = command('next', 'item', 'item');
    const drafts = command('submit', 'draftReviews', 'view');
    const itemSubmit = command('submit', 'item', 'item');

    expect(ids(orderByKeyPrecedence([itemNext, workflows]))).toEqual(['workflows.next', 'item.next']);
    expect(ids(orderByKeyPrecedence([drafts, itemSubmit]))).toEqual(['item.submit', 'draftReviews.submit']);
});

test("⌘Z in a review restores the discarded comment, not a shell toast's Undo shown with it", () => {
    const undoClose = bindCommand(undo, { place: 'app', title: 'Undo close', section: 'app', menu: false, run }, t);
    const restore = bindCommand(
        undo,
        { place: 'review', title: 'Restore the discarded comment', section: 'view', menu: false, run },
        t,
    );

    expect(ids(orderByKeyPrecedence([undoClose, restore]))).toEqual(['review.undo', 'app.undo']);
});

function ids(commands: readonly BoundCommand[]) {
    return commands.map(bound => bound.id);
}

/** A command on a test definition offered in `place`: all of them on one key. */
function command(id: string, place: CommandPlace, section: CommandSection) {
    const definition = defineAppCommand({ id, title: () => id, key: 'O', places: [place] });
    return bindCommand(definition, { section, run }, t);
}
