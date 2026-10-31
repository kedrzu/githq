import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { parseRepositoryName } from '@/utils/parseRepositoryName.js';

import type { EditFailure, FailedEdit } from './EditQueue.js';
import type { Edit, EditFailureReason, EditSubject } from './EditTypes.js';
import * as l from './useEditTexts.loc.js';

/** The words of the user's edits — toasts (K1, K2), the status bar (D15), a row's "undone". */
export interface EditTexts {
    /** A failure's toast title. */
    failureTitle(failure: EditFailure): string;
    /** What happened, for its toast. */
    failureDetail(failure: EditFailure): string;
    /** The status bar while edits are on their way: "Sending 2 changes · portal#1187". */
    sending(edits: readonly Edit[]): string;
    /** The status bar of an item while its edits are on their way: "Sending 2 changes: Status, Priority". */
    sendingFields(edits: readonly Edit[]): string;
    /** The status bar after a failure: "1 change failed · label “regression” no longer exists". */
    failed(failure: EditFailure): string;
    /** A row's note on its edit undone: "“regression” label undone". */
    undone(subject: EditSubject): string;
}

/** The words of the user's edits, in the app's language. */
export function useEditTexts(): EditTexts {
    const t = useTranslate();

    return {
        failureTitle,
        failureDetail,
        sending,
        sendingFields,
        failed,
        undone,
    };

    function failureTitle(failure: EditFailure) {
        const [first] = failure.failed;
        if (!first) {
            return '';
        }

        if (failure.itemCount <= 1) {
            return failedTitle(first.edit);
        }

        const done = failure.itemCount - new Set(failure.failed.map(entry => entry.edit.itemId)).size;
        const { subject } = first.edit;
        return subject.kind === 'labelAdded'
            ? t(l.partlyLabelAdded, { label: subject.label, done, total: failure.itemCount })
            : t(l.partly, { change: capitalize(change(subject)), done, total: failure.itemCount });
    }

    function failureDetail(failure: EditFailure) {
        const [first, ...rest] = failure.failed;
        if (!first) {
            return '';
        }

        const text =
            failure.itemCount <= 1
                ? reason(first)
                : t(l.reasonOfItem, { reference: shortReference(first.edit.reference), reason: reason(first) });
        return rest.length > 0 ? `${text} ${capitalize(t(l.moreFailed, { count: rest.length }))}` : text;
    }

    function sending(edits: readonly Edit[]) {
        const items = new Set(edits.map(edit => edit.itemId));
        const [first] = edits;
        const target =
            items.size === 1 && first ? shortReference(first.reference) : t(l.itemCount, { count: items.size });
        return t(l.sendingTo, { count: edits.length, target });
    }

    function sendingFields(edits: readonly Edit[]) {
        const fields = [...new Set(edits.map(edit => fieldName(edit.subject)))];
        return t(l.sendingFields, { count: edits.length, fields: fields.join(', ') });
    }

    function failed(failure: EditFailure) {
        const [first] = failure.failed;
        if (!first) {
            return '';
        }

        if (failure.editCount <= 1) {
            return t(l.failedOne, { subject: noun(first.edit.subject), reason: shortReason(first.reason) });
        }

        const references = [...new Set(failure.failed.map(entry => shortReference(entry.edit.reference)))];
        return t(l.failedSome, {
            failed: failure.failed.length,
            total: failure.editCount,
            target: references.join(', '),
        });
    }

    function undone(subject: EditSubject) {
        return subject.kind === 'labelAdded'
            ? t(l.undoneLabel, { label: subject.label })
            : t(l.undone, { change: capitalize(change(subject)) });
    }

    function failedTitle(edit: Edit) {
        const { subject, reference } = edit;
        switch (subject.kind) {
            case 'labelAdded':
                return t(l.failedLabelAdded, { label: subject.label, reference });
            case 'labelRemoved':
                return t(l.failedLabelRemoved, { label: subject.label, reference });
            case 'assigneeAdded':
                return t(l.failedAssigneeAdded, { login: subject.login, reference });
            case 'assigneeRemoved':
                return t(l.failedAssigneeRemoved, { login: subject.login, reference });
            case 'milestone':
                return t(l.failedMilestone, { reference });
            case 'issueType':
                return t(l.failedIssueType, { reference });
            case 'closed':
                return t(l.failedClosed, { reference });
            case 'reopened':
                return t(l.failedReopened, { reference });
            case 'comment':
                return t(l.failedComment, { reference });
            case 'projectField':
                return t(l.failedProjectField, { field: subject.field, reference });
            case 'addedToProject':
                return t(l.failedAddedToProject, { project: subject.project, reference });
            case 'draftAdded':
                return t(l.failedDraftAdded, { title: subject.title, project: subject.project });
            case 'issueCreated':
                return t(l.failedIssueCreated, { title: subject.title, repository: subject.repository });
            case 'subIssueOf':
                return t(l.failedSubIssueOf, { reference, parent: subject.parent });
            case 'reviewRequested':
                return t(l.failedReviewRequested, { login: subject.login, reference });
            case 'draft':
                return subject.draft ? t(l.failedDraft, { reference }) : t(l.failedReady, { reference });
            default:
                return assertNever(subject);
        }
    }

    function change(subject: EditSubject) {
        switch (subject.kind) {
            case 'labelAdded':
                return t(l.changeLabelAdded, { label: subject.label });
            case 'labelRemoved':
                return t(l.changeLabelRemoved, { label: subject.label });
            case 'assigneeAdded':
                return t(l.changeAssigneeAdded, { login: subject.login });
            case 'assigneeRemoved':
                return t(l.changeAssigneeRemoved, { login: subject.login });
            case 'milestone':
                return t(l.changeMilestone);
            case 'issueType':
                return t(l.changeIssueType);
            case 'closed':
                return t(l.changeClosed);
            case 'reopened':
                return t(l.changeReopened);
            case 'comment':
                return t(l.changeComment);
            case 'projectField':
                return subject.field;
            case 'addedToProject':
                return t(l.changeAddedToProject, { project: subject.project });
            case 'draftAdded':
                return t(l.changeDraftAdded, { title: subject.title });
            case 'issueCreated':
                return t(l.changeIssueCreated, { title: subject.title });
            case 'subIssueOf':
                return t(l.changeSubIssueOf, { parent: subject.parent });
            case 'reviewRequested':
                return t(l.changeReviewRequested, { login: subject.login });
            case 'draft':
                return subject.draft ? t(l.changeDraft) : t(l.changeReady);
            default:
                return assertNever(subject);
        }
    }

    /** What the edit was about, without what was done: "label “regression”". */
    function noun(subject: EditSubject) {
        switch (subject.kind) {
            case 'labelAdded':
            case 'labelRemoved':
                return t(l.subjectLabel, { label: subject.label });
            case 'assigneeAdded':
            case 'assigneeRemoved':
                return subject.login;
            default:
                return change(subject);
        }
    }

    function fieldName(subject: EditSubject) {
        switch (subject.kind) {
            case 'labelAdded':
            case 'labelRemoved':
                return t(l.fieldLabels);
            case 'assigneeAdded':
            case 'assigneeRemoved':
                return t(l.fieldAssignees);
            case 'milestone':
                return t(l.fieldMilestone);
            case 'issueType':
                return t(l.fieldIssueType);
            case 'closed':
            case 'reopened':
                return t(l.fieldState);
            case 'comment':
                return t(l.fieldComment);
            case 'projectField':
                return subject.field;
            case 'addedToProject':
            case 'draftAdded':
                return t(l.fieldProjects);
            case 'issueCreated':
                return t(l.fieldNewIssue);
            case 'subIssueOf':
                return t(l.fieldParent);
            case 'reviewRequested':
                return t(l.fieldReviewers);
            case 'draft':
                return t(l.fieldDraft);
            default:
                return assertNever(subject);
        }
    }

    function reason(entry: FailedEdit) {
        const repository = entry.edit.reference.split('#')[0] ?? '';
        return reasonText(entry.reason, repository);
    }

    function reasonText(failure: EditFailureReason, repository: string) {
        switch (failure.kind) {
            case 'dropped':
                return t(l.reasonDropped, { repository });
            case 'notAllowed':
                return t(l.reasonNotAllowed, { repository });
            case 'missing':
                return t(l.reasonMissing, { repository });
            case 'offline':
                return t(l.reasonOffline);
            case 'refused':
                return t(l.reasonRefused, { message: failure.message.replace(/\.$/u, '') });
            default:
                return assertNever(failure);
        }
    }

    function shortReason(failure: EditFailureReason) {
        switch (failure.kind) {
            case 'dropped':
                return t(l.shortDropped);
            case 'notAllowed':
                return t(l.shortNotAllowed);
            case 'missing':
                return t(l.shortMissing);
            case 'offline':
                return t(l.shortOffline);
            case 'refused':
                return t(l.shortRefused);
            default:
                return assertNever(failure);
        }
    }
}

/** `sigma-clinic/portal#1187` → `portal#1187`, as the status bar names an item. */
function shortReference(reference: string) {
    return parseRepositoryName(reference).name;
}

function capitalize(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
