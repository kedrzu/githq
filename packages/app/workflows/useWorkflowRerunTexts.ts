import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatTime } from '@/utils/formatTime.js';

import * as l from './useWorkflowRerunTexts.loc.js';
import type { WorkflowRerunFailure } from './WorkflowRunStore.js';

/** The words of a re-run that failed (actions W4l). */
export interface WorkflowRerunTexts {
    /** Its toast's title: "Deploy #4821 wasn't re-run: no permission". */
    title(failure: WorkflowRerunFailure): string;
    /** What happened, for its toast. */
    detail(failure: WorkflowRerunFailure): string;
    /** The status bar's segment: "Re-run refused by GitHub"; what wasn't a refusal says so. */
    segment(failure: WorkflowRerunFailure): string;
}

/** The words of a re-run that failed, in the app's language. */
export function useWorkflowRerunTexts(): WorkflowRerunTexts {
    const t = useTranslate();

    return { title, detail, segment };

    function title(failure: WorkflowRerunFailure) {
        const { reason } = failure;
        const run =
            failure.workflowName === null
                ? t(l.runOfNoName, { number: failure.runNumber })
                : t(l.run, { workflow: failure.workflowName, number: failure.runNumber });
        switch (reason.kind) {
            case 'noPermission':
                return t(l.titleNoPermission, { run });
            case 'tooOld':
                return t(l.titleTooOld, { run });
            case 'alreadyRunning':
                return t(l.titleAlreadyRunning, { run });
            case 'organizationRestricted':
                return t(l.titleOrganizationRestricted, { run, organization: reason.organization });
            case 'refused':
                return t(l.titleRefused, { run });
            case 'unreachable':
                return t(l.titleUnreachable, { run });
            case 'serverError':
                return t(l.titleServerError, { run });
            case 'allowance':
                return t(l.titleAllowance, { run });
            default:
                return assertNever(reason);
        }
    }

    function detail({ reason, nameWithOwner }: WorkflowRerunFailure) {
        switch (reason.kind) {
            case 'noPermission':
                return t(l.detailNoPermission, { repository: nameWithOwner });
            case 'tooOld':
                return t(l.detailTooOld);
            case 'alreadyRunning':
                return t(l.detailAlreadyRunning);
            case 'organizationRestricted':
                return t(l.detailOrganizationRestricted, { organization: reason.organization });
            case 'refused':
                return t(l.detailRefused, { message: reason.message.replace(/\.$/u, '') });
            case 'unreachable':
                return t(l.detailUnreachable);
            case 'serverError':
                return t(l.detailServerError, { status: reason.status });
            case 'allowance':
                return t(l.detailAllowance, { time: formatTime(reason.until) });
            default:
                return assertNever(reason);
        }
    }

    function segment({ reason }: WorkflowRerunFailure) {
        switch (reason.kind) {
            case 'noPermission':
            case 'tooOld':
            case 'alreadyRunning':
            case 'organizationRestricted':
            case 'refused':
                return t(l.segmentRefused);
            case 'unreachable':
                return t(l.segmentUnreachable);
            case 'serverError':
                return t(l.segmentServerError, { status: reason.status });
            case 'allowance':
                return t(l.segmentAllowance);
            default:
                return assertNever(reason);
        }
    }
}
