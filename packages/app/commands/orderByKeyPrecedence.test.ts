import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { Translator } from '@nzyme/i18n/Translator.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, test } from 'bun:test';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { bindCommand } from './bindCommand.js';
import type { Command } from './CommandTypes.js';
import { undo } from './definitions/index.js';
import { orderByKeyPrecedence } from './orderByKeyPrecedence.js';

const container = createContainer();
container.set(LanguageContext, () => APP_LANGUAGE);
const t = container.resolve(Translator);
const run = () => undefined;

test('without places the sections decide, and of one section the one registered first', () => {
    const app: Command = { id: 'app', title: 'App', section: 'app', key: 'O', run };
    const view: Command = { id: 'view', title: 'View', section: 'view', key: 'O', run };
    const item: Command = { id: 'item', title: 'Item', section: 'item', key: 'O', run };
    const otherItem: Command = { id: 'otherItem', title: 'Other item', section: 'item', key: 'O', run };
    const selection: Command = { id: 'selection', title: 'Selection', section: 'selection', key: 'O', run };

    expect(ids(orderByKeyPrecedence([app, view, item, otherItem, selection]))).toEqual([
        'selection',
        'item',
        'otherItem',
        'view',
        'app',
    ]);
});

test("the keeper of places on screen together takes the key, whatever the other's section", () => {
    const item: Command = { id: 'item', title: 'Item', section: 'item', place: 'item', key: 'O', run };
    const list: Command = { id: 'list', title: 'List', section: 'view', place: 'list', key: 'O', run };

    expect(ids(orderByKeyPrecedence([item, list]))).toEqual(['list', 'item']);
});

test('any screen place takes a key before the app, whatever the sections', () => {
    const app: Command = { id: 'app', title: 'App', section: 'selection', place: 'app', key: 'Mod+B', run };
    const item: Command = { id: 'item', title: 'Item', section: 'app', place: 'item', key: 'Mod+B', run };

    expect(ids(orderByKeyPrecedence([app, item]))).toEqual(['item', 'app']);
});

test("an item open beside a repository's Workflows section leaves it J; beside the draft reviews it keeps ⇧S", () => {
    const workflows: Command = { id: 'workflows', title: 'Next', section: 'view', place: 'workflows', key: 'J', run };
    const itemNext: Command = { id: 'itemNext', title: 'Next', section: 'item', place: 'item', key: 'J', run };
    const drafts: Command = {
        id: 'drafts',
        title: 'Submit',
        section: 'view',
        place: 'draftReviews',
        key: 'Shift+S',
        run,
    };
    const itemSubmit: Command = {
        id: 'itemSubmit',
        title: 'Submit',
        section: 'item',
        place: 'item',
        key: 'Shift+S',
        run,
    };

    expect(ids(orderByKeyPrecedence([itemNext, workflows]))).toEqual(['workflows', 'itemNext']);
    expect(ids(orderByKeyPrecedence([drafts, itemSubmit]))).toEqual(['itemSubmit', 'drafts']);
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

function ids(commands: readonly Command[]) {
    return commands.map(command => command.id);
}
