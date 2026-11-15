import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { expect, waitFor, within } from 'storybook/test';
import { defineComponent, h, shallowRef } from 'vue';

import { ItemEditor } from '@/edits/ItemEditor.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { D1_ISSUE_DETAIL } from '@/testing/sampleItemDetails.js';
import { D1_ITEMS, SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_PORTAL_METADATA } from '@/testing/sampleRepositories.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import ItemContextMenu from './ItemContextMenu.vue';
import { ITEM_PROPERTIES } from './ItemProperty.js';
import ItemRow from './ItemRow.vue';
import type { ListContextMenuProps, ListEntry, ListGroup } from './ListTypes.js';
import ListView from './ListView.vue';

/** My work's assigned issues and pull requests, a row of each kind; only I_1187 is in a project. */
const ROWS: readonly Item[] = ['I_1187', 'PR_1203', 'I_12', 'I_9'].map(id => {
    const item = D1_ITEMS.find(candidate => candidate.id === id);
    if (!item) {
        throw new Error(`The sample work needs ${id}.`);
    }

    return item;
});

/** What a row is drawn from, of what the list gives it. */
interface RowSlotProps {
    readonly entry: ListEntry<Item>;
}

// No `component`: Storybook's types can't take a generic component; the stories render it themselves.
const meta = { render: () => renderList() } satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * MB114, mobile D27: an issue's row swiped left on a phone — Status (it is in a project), Assign and Close at its right
 * end, the row slid by as much.
 */
export const PhoneIssueSwipedOpen: Story = {
    play: async ({ canvasElement }) => {
        await swipeOpen(canvasElement, 'I_1187');
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('button', { name: 'Status' })).toBeVisible();
        await expect(canvas.getByRole('button', { name: 'Assign' })).toBeVisible();
        await expect(canvas.getByRole('button', { name: 'Close' })).toBeVisible();
    },
};

/** Mobile D27: a pull request's row in no project — Assign and Close, no Status. */
export const PhonePullRequestSwipedOpen: Story = {
    play: async ({ canvasElement }) => {
        await swipeOpen(canvasElement, 'PR_1203');
        const canvas = within(canvasElement);
        await expect(canvas.getByRole('button', { name: 'Assign' })).toBeVisible();
        await expect(canvas.queryByRole('button', { name: 'Status' })).toBeNull();
    },
};

/**
 * The list on a phone over the real local copy holding {@link ROWS}, the repositories' people known and I_1187 in its
 * projects, drawn once the copy holds them: a row's actions are the items'.
 */
function renderList() {
    return defineComponent({
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            container.set(Browser, createSignedInBrowser());
            container.set(PhoneLayout, createFixedPhoneLayout(true));
            setIndexedDbPersistence(container);
            container.set(RepositoryStore, {
                get: name => ({ ...SAMPLE_PORTAL_METADATA, nameWithOwner: name }),
                viewerProjects: null,
                ensure: name => Promise.resolve({ ...SAMPLE_PORTAL_METADATA, nameWithOwner: name }),
                ensureViewerProjects: () => Promise.resolve(null),
                complete: metadata => Promise.resolve(metadata),
            });
            const editor = container.resolve(ItemEditor);
            container.set(ItemEditor, {
                ...editor,
                getPlaces: item => (item.id === 'I_1187' ? [...D1_ISSUE_DETAIL.projects] : []),
            });
            provideContainer(container);

            const store = container.resolve(ItemStore);
            const ready = shallowRef(false);
            void fill();
            const group: ListGroup<Item> = {
                key: 'assigned',
                label: 'Assigned to me',
                arrived: true,
                droppable: false,
                rows: ROWS.map(item => ({ key: item.id, id: item.id, value: item, nested: [] })),
            };

            return () =>
                h('div', { style: 'display: flex; height: 100vh' }, [
                    ready.value
                        ? h(
                              ListView<Item>,
                              { groups: [group], layout: 'list' },
                              {
                                  row: ({ entry }: RowSlotProps) =>
                                      h(ItemRow, {
                                          item: entry.value,
                                          properties: ITEM_PROPERTIES,
                                          viewerLogin: SAMPLE_VIEWER.login,
                                          now: SAMPLE_NOW,
                                      }),
                                  // A list: no cards.
                                  card: () => null,
                                  // The row's actions are its context menu's: a list without one has none.
                                  contextMenu: ({ ids, open }: ListContextMenuProps) =>
                                      h(ItemContextMenu, { ids, onOpen: open }),
                              },
                          )
                        : null,
                ]);

            async function fill() {
                await store.ready();
                store.upsertMany([...ROWS]);
                ready.value = true;
            }
        },
    });
}

/** Swipes the row of `id` left by touch, a frame between its steps as a finger moves, until its actions show. */
async function swipeOpen(canvasElement: HTMLElement, id: string) {
    const row = await waitFor(() => {
        const found = canvasElement.querySelector(`[data-entry-key="${id}"]`);
        if (!(found instanceof HTMLElement)) {
            throw new TypeError(`No row ${id} yet.`);
        }

        return found;
    });
    const box = row.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const init = {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientY: box.top + box.height / 2,
    };
    row.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));
    for (let step = 1; step <= 6; step++) {
        row.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x - step * 40 }));
        await new Promise(requestAnimationFrame);
    }

    row.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x - 240 }));
    await waitFor(() => expect(row.style.translate).toMatch(/^-\d+px/u));
}
