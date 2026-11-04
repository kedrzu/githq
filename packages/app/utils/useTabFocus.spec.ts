import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { assert } from '@nzyme/utils/assert.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { useCommands } from '@/commands/useCommands.js';
import Dialog from '@/components/Dialog.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import ListView from '@/lists/ListView.vue';
import type { ListEntry, ListGroup } from '@/lists/ListTypes.js';
import { Browser } from '@/services/Browser.js';
import Sidebar from '@/shell/Sidebar.vue';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { useTabFocus } from './useTabFocus.js';

// The sidebar, a toolbar's controls and a list together, as a screen has them: what is proved is whose the keys are.

const GROUPS: readonly ListGroup<string>[] = [
    {
        key: 'todo',
        label: 'todo',
        arrived: true,
        droppable: false,
        rows: ['a1', 'a2', 'a3'].map(id => ({ key: id, id, value: id, nested: [] })),
    },
];

const toolbarButton = () => page.getByRole('button', { name: 'Toolbar button' });
const myWorkLink = () => page.getByRole('link', { name: /^My work/u });
const focusedLink = () => (document.activeElement instanceof HTMLAnchorElement ? document.activeElement : null);
const selectedRow = () => document.querySelector('[aria-current="true"]')?.textContent?.trim() ?? null;

test('↓ moves from a sidebar link Tab reached to the next link, the list staying put; Enter activates the link', async () => {
    const { router } = mountScreen();
    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a1');

    await tabTo(myWorkLink().element());
    await expect.element(myWorkLink()).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    const next = focusedLink();
    expect(next).not.toBe(myWorkLink().element());
    expect(next?.hasAttribute('data-tab-focus')).toBe(true);
    expect(myWorkLink().element().hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('{ArrowUp}');
    await expect.element(myWorkLink()).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}j');
    expect(focusedLink()).toBe(next);
    expect(selectedRow()).toBe('a1');

    await userEvent.keyboard('{Enter}');
    await expect.poll(() => router.currentRoute.value.path).toBe(next?.getAttribute('href'));
    expect(selectedRow()).toBe('a1');
});

test('one Escape on a sidebar link gives the keys back to the list; the checked items stay checked', async () => {
    const { checkedIds } = mountScreen();
    await userEvent.keyboard('jxj');
    await expect.poll(selectedRow).toBe('a2');
    expect(checkedIds.value).toEqual(['a1']);

    await tabTo(myWorkLink().element());
    await userEvent.keyboard('j');
    expect(selectedRow()).toBe('a2');

    await userEvent.keyboard('{Escape}');
    await expect.element(myWorkLink()).not.toHaveFocus();
    expect(checkedIds.value).toEqual(['a1']);

    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a3');
    expect(checkedIds.value).toEqual(['a1']);

    // The hold is gone: Escape is the list's again.
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => checkedIds.value).toEqual([]);
});

test('a button Tab reached keeps Enter and Space, and the list keeps x and o from it; ↓ moves nothing there', async () => {
    const { checkedIds, opened, clicked } = mountScreen();
    await userEvent.keyboard('j');
    await tabTo(toolbarButton().element());

    await userEvent.keyboard('xjk{ArrowDown}o');
    expect(checkedIds.value).toEqual([]);
    expect(selectedRow()).toBe('a1');
    expect(document.activeElement).toBe(toolbarButton().element());

    await userEvent.keyboard('{Enter} ');
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(opened).toEqual([]);
});

test('after a click on a button the list has the keys: j moves and takes the focus off it, Enter opens the row', async () => {
    const { opened, clicked } = mountScreen();

    await userEvent.click(toolbarButton());
    clicked.mockClear();
    expect(document.activeElement).toBe(toolbarButton().element());
    expect(toolbarButton().element().hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a1');
    await expect.element(toolbarButton()).not.toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(opened).toEqual(['a1']);
    expect(clicked).not.toHaveBeenCalled();
});

test('a click on a button Tab reached gives the keys back: j moves the list', async () => {
    mountScreen();

    await tabTo(toolbarButton().element());
    expect(toolbarButton().element().hasAttribute('data-tab-focus')).toBe(true);

    await userEvent.click(toolbarButton());
    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a1');
});

test('focus the app places holds nothing: after a Tab that moved no focus, or with a click in between', async () => {
    mountScreen();
    const button = document.querySelector('button[type="button"][data-toolbar]');
    assert(button instanceof HTMLElement);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }));
    button.focus();
    expect(button.hasAttribute('data-tab-focus')).toBe(false);
    button.blur();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    window.dispatchEvent(new PointerEvent('pointerdown'));
    button.focus();
    expect(button.hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a1');
});

test("a row's own button holds nothing, the list's keys go on from it; a control around the rows holds them", async () => {
    mountScreen();
    const groupToggle = page.getByRole('button', { name: /^todo/u });
    const rowButton = page.getByRole('button', { name: 'Act on a1' });

    await tabTo(groupToggle.element());
    expect(groupToggle.element().hasAttribute('data-tab-focus')).toBe(true);
    await userEvent.keyboard('j');
    expect(selectedRow()).toBe(null);

    await tabTo(rowButton.element());
    expect(rowButton.element().hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('j');
    await expect.poll(selectedRow).toBe('a1');
});

test("from a held control the app's keys and a view's own run, those acting on a subject do not", async () => {
    const { run } = mountScreen();
    await tabTo(toolbarButton().element());

    await userEvent.keyboard('[[?c');
    await userEvent.keyboard('{Shift>}V{/Shift}');
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await userEvent.keyboard('ae');
    await userEvent.keyboard('u');
    expect(run.mock.calls.map(([id]) => id)).toEqual([
        'app.sidebar',
        'app.help',
        'app.new',
        'view.layout',
        'app.commandMenu',
    ]);

    // The same keys, off the control: they all do.
    await userEvent.keyboard('{Escape}');
    run.mockClear();
    await userEvent.keyboard('aeu');
    expect(run.mock.calls.map(([id]) => id)).toEqual(['selection.assign', 'item.edit', 'list.rowAction']);
});

test('a field is never held: Escape and typing there stay its own', async () => {
    mountScreen();
    const field = page.getByRole('textbox', { name: 'A field' });

    await tabTo(field.element());
    expect(field.element().hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('jk');
    await expect.element(field).toHaveValue('jk');
    expect(selectedRow()).toBe(null);

    await userEvent.keyboard('{Escape}');
    await expect.element(field).toHaveFocus();
});

test('a dialog keeps its keys: Tab in it holds nothing, and Escape closes it at once', async () => {
    const { dialogOpen } = mountScreen();
    dialogOpen.value = true;
    const inside = page.getByRole('button', { name: 'In the dialog', exact: true });
    await expect.element(inside).toHaveFocus();

    await userEvent.tab();
    const next = page.getByRole('button', { name: 'Next in the dialog' });
    await expect.element(next).toHaveFocus();
    expect(next.element().hasAttribute('data-tab-focus')).toBe(false);

    await userEvent.keyboard('{Escape}');
    await expect.poll(() => dialogOpen.value).toBe(false);
});

test("with a layer open a held control's Escape stays the layer's", async () => {
    mountScreen();
    await tabTo(toolbarButton().element());

    const layer = document.createElement('div');
    layer.setAttribute('data-layer', '');
    document.body.append(layer);
    onTestFinished(() => layer.remove());

    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(toolbarButton().element());

    layer.remove();
    await userEvent.keyboard('{Escape}');
    await expect.element(toolbarButton()).not.toHaveFocus();
});

async function tabTo(element: Element) {
    for (let tabs = 0; tabs < 40 && document.activeElement !== element; tabs++) {
        await userEvent.tab();
    }

    expect(document.activeElement).toBe(element);
}

function mountScreen() {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const selectedId = ref<string | null>(null);
    const checkedIds = ref<readonly string[]>([]);
    const dialogOpen = ref(false);
    const opened: string[] = [];
    const clicked = vi.fn();
    const run = vi.fn<(id: string) => void>();

    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({
        setup() {
            useTabFocus();
            useCommands(() => COMMANDS.map(command => ({ ...command, run: () => run(command.id) })));

            return () => [
                h(Sidebar, { viewer: SAMPLE_VIEWER }),
                h('button', { type: 'button', 'data-toolbar': '', onClick: clicked }, 'Toolbar button'),
                h('input', { 'aria-label': 'A field' }),
                h(
                    ListView<string>,
                    {
                        groups: GROUPS,
                        layout: 'list',
                        selectedId: selectedId.value,
                        'onUpdate:selectedId': (value: string | null) => {
                            selectedId.value = value;
                        },
                        checkedIds: checkedIds.value,
                        'onUpdate:checkedIds': (value: readonly string[]) => {
                            checkedIds.value = value;
                        },
                        onOpen: (id: string) => opened.push(id),
                    },
                    {
                        row: ({ entry }: { entry: ListEntry<string> }) => [
                            h('span', entry.value),
                            h('button', { type: 'button', 'aria-label': `Act on ${entry.value}` }),
                        ],
                        card: () => null,
                    },
                ),
                h(
                    Dialog,
                    {
                        title: 'A dialog',
                        open: dialogOpen.value,
                        'onUpdate:open': (value: boolean) => {
                            dialogOpen.value = value;
                        },
                    },
                    {
                        default: () => [
                            h('button', { type: 'button' }, 'In the dialog'),
                            h('button', { type: 'button' }, 'Next in the dialog'),
                        ],
                    },
                ),
            ];
        },
    });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { router, checkedIds, dialogOpen, opened, clicked, run };
}

/** One action of each kind whose key a held control runs or holds back. */
const COMMANDS: readonly Command[] = [
    { id: 'app.sidebar', title: 'Sidebar', section: 'app', key: '[' },
    { id: 'app.help', title: 'Help', section: 'app', key: '?' },
    { id: 'app.new', title: 'New issue', section: 'app', key: 'C' },
    { id: 'app.commandMenu', title: 'Command menu', section: 'app', key: 'Mod+K' },
    { id: 'view.layout', title: 'Layout', section: 'view', key: 'Shift+V' },
    { id: 'selection.assign', title: 'Assign', section: 'selection', key: 'A' },
    { id: 'item.edit', title: 'Edit', section: 'item', key: 'E' },
    { id: 'list.rowAction', title: 'Row action', section: 'view', key: 'U', actsOnRow: true },
];
