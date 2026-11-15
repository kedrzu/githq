import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatTime } from '@/utils/formatTime.js';

import * as l from './useWorkflowRerunTexts.loc.js';
import type { WorkflowAction } from './utils/getRerunReason.js';
import type { WorkflowRerunFailure } from './WorkflowRunStore.js';

/** The words of a re-run, a cancel or a workflow turned off or on that failed (actions W4l). */
export interface WorkflowRerunTexts {
    /** Its toast's title: "Deploy #4821 wasn't re-run: no permission". */
    title(failure: WorkflowRerunFailure): string;
    /** What happened, for its toast. */
    detail(failure: WorkflowRerunFailure): string;
    /** The status bar's segment: "Re-run refused by GitHub"; what wasn't a refusal says so. */
    segment(failure: WorkflowRerunFailure): string;
}

/** The words of an action on a workflow or its run that failed, in the app's language. */
export function useWorkflowRerunTexts(): WorkflowRerunTexts {
    const t = useTranslate();

    return { title, detail, segment };

    function title(failure: WorkflowRerunFailure) {
        const { reason } = failure;
        const plain = getNotDone(failure);
        switch (reason.kind) {
            case 'noPermission':
                return withWhy(plain, t(l.whyNoPermission));
            case 'tooOld':
                return withWhy(plain, t(l.whyTooOld));
            case 'alreadyRunning':
                return withWhy(plain, t(l.whyAlreadyRunning));
            case 'alreadyFinished':
                return withWhy(plain, t(l.whyAlreadyFinished));
            case 'organizationRestricted':
                return withWhy(plain, t(l.whyOrganizationRestricted, { organization: reason.organization }));
            case 'refused':
                return plain;
            case 'unreachable':
                return withWhy(plain, t(l.whyUnreachable));
            case 'serverError':
                return withWhy(plain, t(l.whyServerError));
            case 'allowance':
                return withWhy(plain, t(l.whyAllowance));
            default:
                return assertNever(reason);
        }
    }

    function detail({ reason, nameWithOwner, action, target }: WorkflowRerunFailure) {
        const ofRun = target.kind === 'run';
        switch (reason.kind) {
            case 'noPermission':
                return t(l.detailNoPermission, {
                    repository: nameWithOwner,
                    ability: getAbility(action),
                    outcome: getOutcome(action),
                });
            case 'tooOld':
                return t(l.detailTooOld);
            case 'alreadyRunning':
                return t(l.detailAlreadyRunning);
            case 'alreadyFinished':
                return t(l.detailAlreadyFinished);
            case 'organizationRestricted':
                return t(l.detailOrganizationRestricted, { organization: reason.organization });
            case 'refused':
                return t(l.detailRefused, { message: reason.message.replace(/\.$/u, ''), outcome: getOutcome(action) });
            case 'unreachable':
                return t(l.detailUnreachable, { thing: ofRun ? t(l.theRun) : t(l.theWorkflow) });
            case 'serverError':
                return t(l.detailServerError, {
                    status: reason.status,
                    thing: ofRun ? t(l.theRunStart) : t(l.theWorkflowStart),
                });
            case 'allowance':
                return isRerun(action)
                    ? t(l.detailAllowance, { time: formatTime(reason.until) })
                    : t(l.detailAllowanceNotSent, { time: formatTime(reason.until) });
            default:
                return assertNever(reason);
        }
    }

    function segment({ reason, action }: WorkflowRerunFailure) {
        const name = getActionName(action);
        switch (reason.kind) {
            case 'noPermission':
            case 'tooOld':
            case 'alreadyRunning':
            case 'alreadyFinished':
            case 'organizationRestricted':
            case 'refused':
                return t(l.segmentRefused, { action: name });
            case 'unreachable':
                return t(l.segmentUnreachable, { action: name });
            case 'serverError':
                return t(l.segmentServerError, { action: name, status: reason.status });
            case 'allowance':
                return t(l.segmentAllowance, { action: name });
            default:
                return assertNever(reason);
        }
    }

    function withWhy(plain: string, why: string) {
        return t(l.titleWithWhy, { title: plain, why });
    }

    /** "Deploy #4821 wasn't re-run". */
    function getNotDone({ action, target }: WorkflowRerunFailure) {
        let subject: string;
        if (target.kind === 'workflow') {
            subject = target.workflowName;
        } else if (target.workflowName === null) {
            subject = t(l.runOfNoName, { number: target.runNumber });
        } else {
            subject = t(l.run, { workflow: target.workflowName, number: target.runNumber });
        }

        switch (action) {
            case 'rerunFailed':
            case 'rerunAll':
            case 'rerunJob':
                return t(l.notRerun, { subject });
            case 'cancel':
                return t(l.notCancelled, { subject });
            case 'disable':
                return t(l.notDisabled, { subject });
            case 'enable':
                return t(l.notEnabled, { subject });
            default:
                return assertNever(action);
        }
    }

    function getAbility(action: WorkflowAction) {
        switch (action) {
            case 'rerunFailed':
            case 'rerunAll':
            case 'rerunJob':
                return t(l.canRun);
            case 'cancel':
                return t(l.canCancel);
            case 'disable':
            case 'enable':
                return t(l.canToggle);
            default:
                return assertNever(action);
        }
    }

    function getOutcome(action: WorkflowAction) {
        switch (action) {
            case 'rerunFailed':
                return t(l.outcomeRerunFailed);
            case 'rerunAll':
            case 'rerunJob':
                return t(l.outcomeRerun);
            case 'cancel':
                return t(l.outcomeCancel);
            case 'disable':
                return t(l.outcomeDisable);
            case 'enable':
                return t(l.outcomeEnable);
            default:
                return assertNever(action);
        }
    }

    function getActionName(action: WorkflowAction) {
        switch (action) {
            case 'rerunFailed':
            case 'rerunAll':
            case 'rerunJob':
                return t(l.actionRerun);
            case 'cancel':
                return t(l.actionCancel);
            case 'disable':
                return t(l.actionDisable);
            case 'enable':
                return t(l.actionEnable);
            default:
                return assertNever(action);
        }
    }
}

/** A re-run starts runs; the other actions start nothing. */
function isRerun(action: WorkflowAction) {
    switch (action) {
        case 'rerunFailed':
        case 'rerunAll':
        case 'rerunJob':
            return true;
        case 'cancel':
        case 'disable':
        case 'enable':
            return false;
        default:
            return assertNever(action);
    }
}
