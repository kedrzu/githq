import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { WorkflowDispatchReason } from './utils/getDispatchReason.js';
import { WorkflowDispatch } from './WorkflowDispatch.js';
import type { WorkflowDispatchFailure, WorkflowDispatchStarted } from './WorkflowDispatch.js';
import WorkflowDispatchToast from './WorkflowDispatchToast.vue';

const ASKED = {
    nameWithOwner: 'fitloop/webapp',
    workflowName: 'Deploy',
    ref: 'main',
    inputs: { environment: 'production', version: '2.14.0', dry_run: false },
    at: 1,
};

/** The toasts over a screen whose dispatches say this. */
function withNews(started: WorkflowDispatchStarted | null, failure: WorkflowDispatchFailure | null): Decorator {
    return story =>
        defineComponent({
            setup() {
                const startedRef = shallowRef(started);
                const failureRef = shallowRef(failure);
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(WorkflowDispatch, {
                    get started() {
                        return startedRef.value;
                    },
                    get failure() {
                        return failureRef.value;
                    },
                    dispatch: () => Promise.resolve(),
                    dismissStarted: () => {
                        startedRef.value = null;
                    },
                    dismissFailure: () => {
                        failureRef.value = null;
                    },
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

function refused(reason: WorkflowDispatchReason): Decorator {
    return withNews(null, { ...ASKED, reason });
}

const meta = {
    component: WorkflowDispatchToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { WorkflowDispatchToast, Toaster },
        template: '<Toaster><WorkflowDispatchToast /></Toaster>',
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
} satisfies Meta<typeof WorkflowDispatchToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W39: Deploy started on main as run #4826, with Open; under it, where the app is — Open goes to the run's page. */
export const Started: Story = {
    decorators: [withNews({ ...ASKED, runId: 90_4826, runNumber: 4826 }, null)],
    render: () => ({
        components: { WorkflowDispatchToast, Toaster },
        template: '<p>At {{ $route.fullPath }}</p><Toaster><WorkflowDispatchToast /></Toaster>',
    }),
};

/** Started, but the run could not be read after: no number. */
export const StartedWithoutNumber: Story = {
    decorators: [withNews({ ...ASKED, runId: 90_4826, runNumber: null }, null)],
};

/** Refused, in GitHub's words: the ref's file has no workflow_dispatch. */
export const Refused: Story = {
    decorators: [refused({ kind: 'refused', message: "Workflow does not have 'workflow_dispatch' trigger" })],
};

/** Refused: the user's role can't. */
export const NoPermission: Story = { decorators: [refused({ kind: 'noPermission' })] };

/** G5: refused by an organisation that has not approved githq. */
export const OrganizationRestricted: Story = {
    decorators: [refused({ kind: 'organizationRestricted', organization: 'fitloop' })],
};
