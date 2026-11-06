import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { PendingUntracks } from './PendingUntracks.js';
import type { PendingUntrack } from './PendingUntracks.js';
import type { TrackedTarget } from './TrackingTypes.js';
import { getTrackedKey } from './utils/getTrackedKey.js';
import UntrackToast from './UntrackToast.vue';

/** The toasts over a screen with `entries` being untracked, oldest first; Undo and closing take one away. */
function withPending(entries: readonly PendingUntrack[]): Decorator {
    return story =>
        defineComponent({
            setup() {
                const pending = shallowRef(entries);
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(PendingUntracks, {
                    repositories: [],
                    projects: [],
                    get entries() {
                        return pending.value;
                    },
                    isPending: target => pending.value.some(entry => isSame(entry.target, target)),
                    untrack: () => undefined,
                    undo: forget,
                    commit: forget,
                });
                provideContainer(container);
                return () => h(story());

                function forget(target: TrackedTarget) {
                    pending.value = pending.value.filter(entry => !isSame(entry.target, target));
                }
            },
        });
}

function isSame(a: TrackedTarget, b: TrackedTarget) {
    return getTrackedKey(a) === getTrackedKey(b);
}

const meta = {
    component: UntrackToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { UntrackToast, Toaster },
        template: '<Toaster><UntrackToast /></Toaster>',
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
} satisfies Meta<typeof UntrackToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T20: a repository untracked, with Undo (⌘Z) while its long time runs. */
export const Repository: Story = {
    decorators: [withPending([{ target: { kind: 'repository', nameWithOwner: 'fitloop/api' }, label: 'fitloop/api' }])],
};

/** T20: two untracked one after the other: a toast each, the newest at the bottom with the key. */
export const Two: Story = {
    decorators: [
        withPending([
            { target: { kind: 'repository', nameWithOwner: 'fitloop/api' }, label: 'fitloop/api' },
            { target: { kind: 'project', id: 'PVT_1' }, label: 'Roadmap' },
        ]),
    ],
};
