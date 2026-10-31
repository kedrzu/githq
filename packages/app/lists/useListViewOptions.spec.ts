import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { createApp, nextTick, shallowReactive, shallowRef } from 'vue';

import type { ListViewOptions } from './ListTypes.js';
import { ListViewOptionsStore } from './ListViewOptionsStore.js';
import type { ListViewChoices, ListViewOptionsViewModel } from './useListViewOptions.js';
import { useListViewOptions } from './useListViewOptions.js';

type Grouping = 'milestone' | 'status';
type Sort = 'title' | 'updated';

const DEFAULTS: ListViewOptions<Grouping, Sort> = {
    layout: 'list',
    grouping: 'milestone',
    sort: 'updated',
    properties: ['labels'],
};
const CHOICES: ListViewChoices<Grouping, Sort> = {
    groupings: ['milestone', 'status'],
    sorts: ['title', 'updated'],
    properties: ['labels', 'milestone'],
};

/** What the signed-in user keeps of the lists' options, in memory and reactive, as `ListViewOptionsStore` holds it. */
const kept = createKeptOptions();

test('a change is kept per list and read back; setting it back to the default is no change', () => {
    const first = mount('test:a');
    expect(first.view.modified).toBe(false);

    first.view.set({ layout: 'board', properties: ['milestone', 'labels'] });
    expect(first.view.options).toMatchObject({ layout: 'board', grouping: 'milestone' });
    expect(first.view.modified).toBe(true);

    // Another page of the same list reads it; another list does not.
    expect(mount('test:a').view.options.layout).toBe('board');
    expect(mount('test:b').view.options.layout).toBe('list');

    first.view.set({ layout: 'list', properties: ['labels'] });
    expect(first.view.modified).toBe(false);
    expect(kept.has('test:a')).toBe(false);
});

test('only what was changed is kept: a new default reaches the rest, and reset goes back to the defaults', async () => {
    const view = mount('test:c');
    view.view.set({ sort: 'title' });

    view.defaults.value = { ...DEFAULTS, grouping: 'status' };
    await nextTick();
    expect(view.view.options).toMatchObject({ grouping: 'status', sort: 'title' });

    view.view.reset();
    expect(view.view.options).toEqual({ ...DEFAULTS, grouping: 'status' });
    expect(view.view.modified).toBe(false);
});

test('what was kept and can no longer be chosen is dropped; something unreadable is ignored', () => {
    kept.set('test:d', { grouping: 'iteration', properties: ['labels', 7] });
    expect(mount('test:d').view.options).toEqual({ ...DEFAULTS, properties: ['labels'] });

    kept.set('test:e', 'not options');
    expect(mount('test:e').view.options).toEqual(DEFAULTS);
});

test('a view’s filter cleared here is a change kept like the others, until reset; a list without one takes none', () => {
    const view = mount('test:f');
    view.defaults.value = { ...DEFAULTS, filter: 'status:Blocked' };
    expect(view.view.options.filter).toBe('status:Blocked');

    view.view.set({ filter: '' });
    expect(view.view.options.filter).toBe('');
    expect(view.view.modified).toBe(true);

    view.view.reset();
    expect(view.view.options.filter).toBe('status:Blocked');
    expect(view.view.modified).toBe(false);

    kept.set('test:g', { filter: 'is:open' });
    expect(mount('test:g').view.options).toEqual(DEFAULTS);
});

/** Calls the composable in a mounted app, as a page does. */
function mount(list: string) {
    const defaults = shallowRef(DEFAULTS);
    let view: ListViewOptionsViewModel<Grouping, Sort> | undefined;

    const app = createApp({
        setup() {
            view = useListViewOptions({ list, defaults, choices: CHOICES });
            return () => null;
        },
    });
    const container = createContainer();
    container.set(ListViewOptionsStore, kept);
    app.use(IocPlugin, { container });
    app.mount(document.createElement('div'));
    onTestFinished(() => app.unmount());

    if (!view) {
        throw new Error('The composable did not run');
    }

    return { view, defaults };
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
