import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { WorkflowRerunReason } from './utils/getRerunReason.js';
import WorkflowRerunToast from './WorkflowRerunToast.vue';
import { WorkflowRunStore } from './WorkflowRunStore.js';
import type { WorkflowRerunFailure } from './WorkflowRunStore.js';

/** The toast over a screen whose store holds a re-run that failed for `reason`. */
function withReason(reason: WorkflowRerunReason): Decorator {
    return story =>
        defineComponent({
            setup() {
                const failure = shallowRef<WorkflowRerunFailure | null>({
                    nameWithOwner: 'fitloop/webapp',
                    runId: 4821,
                    workflowName: 'Deploy',
                    runNumber: 4821,
                    reason,
                    toast: true,
                    at: 1,
                });
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(WorkflowRunStore, {
                    pageFreshness: null,
                    setPageFreshness: () => undefined,
                    get rerunFailure() {
                        return failure.value;
                    },
                    setRerunToast: toast => {
                        failure.value = failure.value && { ...failure.value, toast };
                    },
                    dismissRerunFailure: () => {
                        failure.value = null;
                    },
                    rerun: () => undefined,
                    getRun: () => ({ run: null, status: 'loading', httpStatus: null }),
                    getJobs: () => ({ jobs: [], status: 'loading', httpStatus: null, checkedAt: null }),
                    refresh: () => undefined,
                    getLog: () => ({ status: 'loading' }),
                    retry: () => undefined,
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

const meta = {
    component: WorkflowRerunToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { WorkflowRerunToast, Toaster },
        template: '<Toaster><WorkflowRerunToast /></Toaster>',
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
} satisfies Meta<typeof WorkflowRerunToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** W4l: refused, the user's role can't. */
export const NoPermission: Story = { decorators: [withReason({ kind: 'noPermission' })] };

/** W4l: refused, about a month past the run. */
export const TooOld: Story = { decorators: [withReason({ kind: 'tooOld' })] };

/** W4l: refused, already running: nothing to see on GitHub, the page follows it. */
export const AlreadyRunning: Story = { decorators: [withReason({ kind: 'alreadyRunning' })] };

/** Not a refusal: no answer. */
export const Unreachable: Story = { decorators: [withReason({ kind: 'unreachable' })] };

/** Not a refusal: GitHub failed on its side. */
export const ServerError: Story = { decorators: [withReason({ kind: 'serverError', status: 502 })] };

/** G5: refused by an organisation that has not approved githq. */
export const OrganizationRestricted: Story = {
    decorators: [withReason({ kind: 'organizationRestricted', organization: 'fitloop' })],
};
