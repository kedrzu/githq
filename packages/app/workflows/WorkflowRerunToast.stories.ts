import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { WorkflowAction, WorkflowRerunReason } from './utils/getRerunReason.js';
import WorkflowRerunToast from './WorkflowRerunToast.vue';
import { WorkflowRunStore } from './WorkflowRunStore.js';
import type { WorkflowActionTarget, WorkflowRerunFailure } from './WorkflowRunStore.js';

const RUN: WorkflowActionTarget = { kind: 'run', runId: 4821, workflowName: 'Deploy', runNumber: 4821 };
const WORKFLOW: WorkflowActionTarget = {
    kind: 'workflow',
    workflowName: 'Deploy',
    url: 'https://github.com/fitloop/webapp/blob/main/.github/workflows/deploy.yml',
};

/** The toast over a screen whose store holds a re-run of the failed jobs, or `action`, that failed for `reason`. */
function withReason(
    reason: WorkflowRerunReason,
    action: WorkflowAction = 'rerunFailed',
    target: WorkflowActionTarget = RUN,
): Decorator {
    return story =>
        defineComponent({
            setup() {
                const failure = shallowRef<WorkflowRerunFailure | null>({
                    nameWithOwner: 'fitloop/webapp',
                    action,
                    target,
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
                    rerunAll: () => undefined,
                    rerunJob: () => undefined,
                    cancel: () => undefined,
                    setEnabled: () => undefined,
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

/** A cancel GitHub refused, the run having finished: nothing to see on GitHub, githq follows it. */
export const CancelAlreadyFinished: Story = { decorators: [withReason({ kind: 'alreadyFinished' }, 'cancel')] };

/** A workflow GitHub did not disable for the user's role: the way to the workflow on GitHub. */
export const DisableNoPermission: Story = {
    decorators: [withReason({ kind: 'noPermission' }, 'disable', WORKFLOW)],
};
