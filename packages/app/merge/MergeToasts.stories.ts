import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import { provideContext } from '@nzyme/vue-utils/context.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import type { EditFailure } from '@/edits/EditQueue.js';
import { EditQueue } from '@/edits/EditQueue.js';
import type { Edit } from '@/edits/EditTypes.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { MergeContext } from './MergeContext.js';
import type { MergeConfirmation } from './MergePanelStore.js';
import { MergePanelStore } from './MergePanelStore.js';
import MergeToasts from './MergeToasts.vue';

const PR: PullRequestItem = {
    ...samplePullRequest('PR_477'),
    url: 'https://github.com/fitloop/api/pull/477',
    number: 477,
    repository: { nameWithOwner: 'fitloop/api', owner: 'fitloop', isPrivate: true, viewerPermission: 'WRITE' },
};
const REFERENCE = 'fitloop/api#477';

/** The merge of {@link PR}, as the edit queue lists it once it failed. */
const MERGE_EDIT: Edit = {
    itemId: PR.id,
    reference: REFERENCE,
    subject: { kind: 'merged' },
    optimistic: { item: item => item },
};

/** PM35: GitHub refused the merge after the user moved on. */
const REFUSED: EditFailure = {
    id: 1,
    itemCount: 1,
    editCount: 1,
    failed: [
        {
            edit: MERGE_EDIT,
            reason: {
                kind: 'refused',
                message: 'At least 2 approving reviews are required by reviewers with write access.',
            },
        },
    ],
    toast: true,
    at: 0,
};

/** G5: refused by an organisation that restricts third-party apps and has not approved githq. */
const RESTRICTED: EditFailure = {
    ...REFUSED,
    failed: [{ edit: MERGE_EDIT, reason: { kind: 'organizationRestricted', organization: 'fitloop' } }],
};

/** PM34: GitHub confirmed the merge after the user moved on. */
const CONFIRMED: MergeConfirmation = { id: 1, itemId: PR.id, reference: REFERENCE, base: 'main' };

/** SS4: a stack's merge of three confirmed after the user moved on: how many, not only the top one. */
const CONFIRMED_STACK: MergeConfirmation = {
    ...CONFIRMED,
    stack: { repository: 'fitloop/api', count: 3 },
};

/**
 * The toasts over a screen whose edit queue lists `failures` and whose merge panel store lists `confirmations`: the
 * stores the toasts read are replaced by ones holding just that, and the screen may open the merge panel (`⌥M`).
 */
function withMerges(failures: readonly EditFailure[], confirmations: readonly MergeConfirmation[]): Decorator {
    return story =>
        defineComponent({
            setup() {
                const failuresRef = shallowRef(failures);
                const confirmationsRef = shallowRef(confirmations);
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
                container.set(MergePanelStore, {
                    itemId: null,
                    stack: null,
                    opening: 0,
                    get confirmations() {
                        return confirmationsRef.value;
                    },
                    unanswered: [],
                    open: () => undefined,
                    close: () => undefined,
                    merge: () => Promise.resolve({ kind: 'accepted' }),
                    getRecord: () => null,
                    findRecordHolder: () => null,
                    getSent: () => null,
                    getQueued: () => [],
                    noteQueued: () => undefined,
                    noteHeadCommit: () => undefined,
                    forget: () => undefined,
                    dismissConfirmation: id =>
                        (confirmationsRef.value = confirmationsRef.value.filter(
                            confirmation => confirmation.id !== id,
                        )),
                });
                container.set(ItemDetailStore, {
                    ready: () => Promise.resolve(),
                    get: () => undefined,
                    getItem: id => (id === PR.id ? PR : undefined),
                    getFreshness: () => ({ kind: 'partial' }),
                    ensure: () => Promise.resolve(),
                    readAgain: () => Promise.resolve(),
                    loadOlderComments: () => Promise.resolve(),
                    needsFetch: () => false,
                    fetchDetails: () => Promise.resolve([]),
                    update: () => undefined,
                });
                provideContainer(container);
                provideContext(MergeContext, { canOpen: () => true, open: () => undefined, getRecord: () => null });
                return () => h(story());
            },
        });
}

const meta = {
    component: MergeToasts,
    // In the shell's toaster, as the app shows them.
    render: () => ({
        components: { MergeToasts, Toaster },
        template: '<Toaster><MergeToasts /></Toaster>',
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
} satisfies Meta<typeof MergeToasts>;

export default meta;

type Story = StoryObj<typeof meta>;

/** PM35: a merge GitHub refused after the user moved on — it stays, and ⌥M leads back to its merge panel. */
export const Refused: Story = { decorators: [withMerges([REFUSED], [])] };

/** G5: refused by an organisation that hasn't approved githq — said plainly, with the way to request access. */
export const OrganizationRestricted: Story = { decorators: [withMerges([RESTRICTED], [])] };

/** PM34: a merge GitHub confirmed after the user moved on — quiet, and gone by itself. */
export const Confirmed: Story = { decorators: [withMerges([], [CONFIRMED])] };

/** SS4: a stack's merge GitHub confirmed after the user moved on: how many landed, and where. */
export const ConfirmedStack: Story = { decorators: [withMerges([], [CONFIRMED_STACK])] };
