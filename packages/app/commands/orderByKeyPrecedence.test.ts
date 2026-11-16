import { expect, test } from 'bun:test';

import type { Command } from './CommandTypes.js';
import { orderByKeyPrecedence } from './orderByKeyPrecedence.js';

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

function ids(commands: readonly Command[]) {
    return commands.map(command => command.id);
}
