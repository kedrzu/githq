import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';

import { CommentDrafts } from './CommentDrafts.js';
import type { EditFailure } from './EditQueue.js';
import { EditQueue } from './EditQueue.js';
import EditToasts from './EditToasts.vue';

const ITEM_ID = 'PR_477';
const REFUSED_BODY = 'Shipping this behind the flag first.';

/** A comment posted from code review's conversation (not kept in the thread) that GitHub refused. */
const REFUSED_COMMENT: EditFailure = {
    id: 1,
    itemCount: 1,
    editCount: 1,
    failed: [
        {
            edit: {
                itemId: ITEM_ID,
                reference: 'fitloop/api#477',
                subject: { kind: 'comment', body: REFUSED_BODY },
                optimistic: { item: item => item },
            },
            reason: { kind: 'refused', message: 'Body is too long.' },
        },
    ],
    toast: true,
    at: 0,
};

/**
 * MB119: the label "docs" added to three issues from a phone's selection, refused for one of them: the toast names it
 * and why.
 */
const LABEL_PARTLY_REFUSED: EditFailure = {
    id: 2,
    itemCount: 3,
    editCount: 3,
    failed: [
        {
            edit: {
                itemId: 'I_1204',
                reference: 'fitloop/webapp#1204',
                subject: { kind: 'labelAdded', label: 'docs' },
                optimistic: { item: item => item },
            },
            reason: { kind: 'notAllowed' },
        },
    ],
    toast: true,
    at: 0,
};

/**
 * The toasts over a screen whose edit queue lists `failures`, the item's comment box holding `draft` and the items a
 * toast asked the list to select — shown beside them, as the user would read them. The comment drafts and the
 * navigation are the app's own.
 */
function withFailures(failures: readonly EditFailure[], draft: string): Decorator {
    return story =>
        defineComponent({
            setup() {
                const failuresRef = shallowRef(failures);
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(EditQueue, {
                    pending: [],
                    get failures() {
                        return failuresRef.value;
                    },
                    undone: new Map(),
                    submit: () => Promise.resolve({ failed: [] }),
                    settled: () => Promise.resolve(),
                    dismiss: id => (failuresRef.value = failuresRef.value.filter(failure => failure.id !== id)),
                    setToast: (id, toast) =>
                        (failuresRef.value = failuresRef.value.map(failure =>
                            failure.id === id ? { ...failure, toast } : failure,
                        )),
                });
                const drafts = container.resolve(CommentDrafts);
                drafts.set(ITEM_ID, draft);
                const navigation = container.resolve(ItemNavigation);
                provideContainer(container);
                // Once: a new story component on every render of the box would render again without end.
                const Story = story();
                return () =>
                    h('div', [
                        h('textarea', { 'aria-label': 'Comment box', readonly: true, value: drafts.get(ITEM_ID) }),
                        h('output', { 'aria-label': 'Asked to select' }, navigation.selectionRequest?.ids.join(' ')),
                        h(Story),
                    ]);
            },
        });
}

const meta = {
    component: EditToasts,
    // In the shell's toaster, as the app shows them.
    render: () => ({
        components: { EditToasts, Toaster },
        template: '<Toaster><EditToasts /></Toaster>',
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
} satisfies Meta<typeof EditToasts>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A comment from code review refused while something new was typed in its box: the toast offers it back. */
export const CommentRefusedBoxInUse: Story = {
    decorators: [withFailures([REFUSED_COMMENT], 'A new thought')],
};

/** A comment from code review refused, its box empty then: it went back there, so nothing is offered. */
export const CommentRefusedRestored: Story = {
    decorators: [withFailures([REFUSED_COMMENT], REFUSED_BODY)],
};

/**
 * Mobile D28, D48, MB119: a label added to three items selected on a phone, refused for one — on the phone's toaster,
 * above the command line: "Label docs added to 2 of 3", which failed and why, and "Select the failed item".
 */
export const PhoneLabelPartlyFailed: Story = {
    decorators: [withFailures([LABEL_PARTLY_REFUSED], '')],
    render: () => ({
        components: { EditToasts, Toaster },
        template: '<Toaster above-command-line><EditToasts /></Toaster>',
    }),
};
