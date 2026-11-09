import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import CloseToasts from './CloseToasts.vue';
import { ItemEditor } from './ItemEditor.js';
import type { UndoableClose } from './ItemEditor.js';

const NOTHING = () => Promise.resolve({ failed: [] });

function withCloses(closes: readonly UndoableClose[]): Decorator {
    return story =>
        defineComponent({
            setup() {
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                const closesRef = shallowRef(closes);
                container.set(ItemEditor, {
                    get closes() {
                        return closesRef.value;
                    },
                    getPermissions: () => {
                        throw new Error('not edited in these stories');
                    },
                    getPlaces: () => [],
                    edit: NOTHING,
                    retryComment: NOTHING,
                    undoClose: id => {
                        closesRef.value = closesRef.value.filter(close => close.id !== id);
                        return NOTHING();
                    },
                    forgetClose: id => {
                        closesRef.value = closesRef.value.filter(close => close.id !== id);
                    },
                    addDraftIssue: NOTHING,
                    setDraftField: NOTHING,
                    createIssue: () => Promise.resolve({ created: false, failed: [] }),
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

const meta = {
    component: CloseToasts,
    // In the shell's toaster, as the app shows them.
    render: () => ({
        components: { CloseToasts, Toaster },
        template: '<Toaster><CloseToasts /></Toaster>',
    }),
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts an empty, focusable focus guard on each side of it (as in Toast's
                // stories): axe flags them; they hide nothing, and every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof CloseToasts>;

export default meta;

type Story = StoryObj<typeof meta>;

/** D29: one item closed: named, with Undo. */
export const One: Story = {
    decorators: [withCloses([{ id: 1, targets: [{ itemId: 'PR_477', reference: 'fitloop/api#477' }] }])],
};

/** D29: a selection closed in one action: how many, one Undo for them all. */
export const Several: Story = {
    decorators: [
        withCloses([
            {
                id: 1,
                targets: [
                    { itemId: 'I_1', reference: 'fitloop/api#1' },
                    { itemId: 'I_2', reference: 'fitloop/api#2' },
                    { itemId: 'I_3', reference: 'fitloop/api#3' },
                ],
            },
        ]),
    ],
};
