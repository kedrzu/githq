import type { IssueForm } from '@githq/github/issueForms/parseIssueForm.js';

import { toFormLine } from './toFormLine.js';

/**
 * The labels of the form's required fields still empty in the body written from it ({@link buildIssueFormBody}):
 * a section with nothing but comments, a required box not ticked, or a section the user removed. githq points them
 * out before creating the issue (H8) — GitHub does not check a form's fields for an issue created through the API.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findMissingFormFields(form: IssueForm, body: string): string[] {
    const sections = readSections(body);
    const missing: string[] = [];
    for (const field of form.fields) {
        const content = sections.get(toFormLine(field.label));
        if (content === undefined) {
            if (field.required) {
                missing.push(field.label);
            }

            continue;
        }

        if (field.kind === 'checkboxes') {
            const ticked = readTicked(content);
            const unticked = field.options.some(option => option.required && !ticked.has(toFormLine(option.label)));
            if (unticked) {
                missing.push(field.label);
            }

            continue;
        }

        if (field.required && content.replace(/<!--[\s\S]*?-->/gu, '').trim() === '') {
            missing.push(field.label);
        }
    }

    return missing;
}

/** The body's `### ` sections, by heading. */
function readSections(body: string) {
    const sections = new Map<string, string>();
    let heading: string | null = null;
    let lines: string[] = [];
    for (const line of body.split('\n')) {
        const match = /^###\s+(.*)$/u.exec(line);
        if (match) {
            if (heading !== null) {
                sections.set(heading, lines.join('\n'));
            }

            heading = toFormLine(match[1] ?? '');
            lines = [];
        } else {
            lines.push(line);
        }
    }

    if (heading !== null) {
        sections.set(heading, lines.join('\n'));
    }

    return sections;
}

/** The tasks ticked in a section, by their text: a whole line each (`- [x] No customer data`). */
function readTicked(content: string) {
    const ticked = new Set<string>();
    for (const line of content.split('\n')) {
        const match = /^\s*[-*]\s+\[[xX]\]\s+(.*)$/u.exec(line);
        if (match) {
            ticked.add(toFormLine(match[1] ?? ''));
        }
    }

    return ticked;
}
