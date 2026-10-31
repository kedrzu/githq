import type { IssueForm, IssueFormField } from '@githq/github/issueForms/parseIssueForm.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { toFormLine } from './toFormLine.js';

/**
 * An issue form as a pre-filled markdown body (H8): a `### Label` section per field, as GitHub writes a form's
 * answers, with the field's pre-filled value, its placeholder or its choices as a comment, and checkboxes as a
 * task list to tick.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildIssueFormBody(form: IssueForm): string {
    return `${form.fields.map(field => `### ${toFormLine(field.label)}\n\n${getContent(field)}`).join('\n\n')}\n`;
}

function getContent(field: IssueFormField) {
    switch (field.kind) {
        case 'input':
        case 'textarea':
            return field.value?.trim() || toComment(field.placeholder ?? field.description ?? field.label);
        case 'dropdown':
            return toComment(field.options.join(', '));
        case 'checkboxes':
            return field.options.map(option => `- [ ] ${toFormLine(option.label)}`).join('\n');
        default:
            return assertNever(field);
    }
}

/** A hint as an HTML comment; a `-->` in it would end the comment early and show the rest in the issue. */
function toComment(text: string) {
    return `<!-- ${text.replaceAll('-->', '-- >')} -->`;
}
