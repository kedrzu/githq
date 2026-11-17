import { expect, test } from 'bun:test';

import { defineAppCommand } from './defineAppCommand.js';
import { findKeyConflicts, placesCollide } from './findKeyConflicts.js';

const title = () => 'Title';

test('places collide when they share one or are on screen together, in either order', () => {
    expect(placesCollide(['list'], ['list'])).toBe(true);
    expect(placesCollide(['app'], ['app'])).toBe(true);
    expect(placesCollide(['list'], ['item'])).toBe(true);
    expect(placesCollide(['item'], ['list'])).toBe(true);
    expect(placesCollide(['item'], ['app', 'list'])).toBe(true);
});

test('one key in places active together is a conflict; the letter case and other keys count', () => {
    const list = defineAppCommand({ id: 'list', title, key: 'O', places: ['list'] });
    const item = defineAppCommand({ id: 'item', title, key: 'o', places: ['item'] });
    const down = defineAppCommand({ id: 'down', title, key: 'J', otherKeys: ['ArrowDown'], places: ['item'] });
    const scroll = defineAppCommand({ id: 'scroll', title, key: 'ArrowDown', places: ['list'] });

    expect(findKeyConflicts([list, item, down, scroll])).toEqual([
        { key: 'O', first: list, second: item },
        { key: 'ArrowDown', first: down, second: scroll },
    ]);
});

test("a screen's key over the app's, a key in places never together and no key at all are no conflict", () => {
    const sidebar = defineAppCommand({ id: 'sidebar', title, key: 'Mod+B', places: ['app'] });
    const files = defineAppCommand({ id: 'files', title, key: 'Mod+B', places: ['list'] });
    const appMenu = defineAppCommand({ id: 'appMenu', title, places: ['app'] });
    const listMenu = defineAppCommand({ id: 'listMenu', title, places: ['app'] });

    expect(findKeyConflicts([sidebar, files, appMenu, listMenu])).toEqual([]);
});

test("a family's numbers are its keys", () => {
    const views = defineAppCommand({ id: 'views', title, numbers: { first: 1, last: 9 }, places: ['list'] });
    const third = defineAppCommand({ id: 'third', title, key: '3', places: ['item'] });

    expect(findKeyConflicts([views, third])).toEqual([{ key: '3', first: views, second: third }]);
});

test('two fixed definitions are no conflict, whatever their key; a configurable one on the same key is', () => {
    const uncheck = defineAppCommand({ id: 'uncheck', title, key: 'Escape', places: ['list'], configurable: false });
    const close = defineAppCommand({ id: 'close', title, key: 'Escape', places: ['item'], configurable: false });
    const custom = defineAppCommand({ id: 'custom', title, key: 'Escape', places: ['item'] });

    expect(findKeyConflicts([uncheck, close, custom])).toEqual([
        { key: 'Escape', first: uncheck, second: custom },
        { key: 'Escape', first: close, second: custom },
    ]);
});
