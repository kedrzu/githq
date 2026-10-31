import { expect, test } from 'bun:test';

import type { IssueForm } from '@githq/github/issueForms/parseIssueForm.js';

import { buildIssueFormBody } from './buildIssueFormBody.js';
import { findMissingFormFields } from './findMissingFormFields.js';

const FORM: IssueForm = {
    filename: 'bug_report.yml',
    name: 'Bug report',
    description: null,
    title: null,
    labels: [],
    assignees: [],
    type: null,
    fields: [
        {
            kind: 'textarea',
            label: 'What happened',
            description: null,
            required: true,
            placeholder: 'Tell us',
            value: null,
        },
        {
            kind: 'input',
            label: 'Expected',
            description: null,
            required: false,
            placeholder: null,
            value: null,
        },
        {
            kind: 'dropdown',
            label: 'Browser',
            description: null,
            required: true,
            options: ['Chrome', 'Safari'],
        },
        {
            kind: 'checkboxes',
            label: 'Checklist',
            description: null,
            required: true,
            options: [
                { label: 'No patient data', required: true },
                { label: 'Optional', required: false },
            ],
        },
    ],
};

test('a body fresh from the form misses every required field; comments do not count as an answer', () => {
    const body = buildIssueFormBody(FORM);

    expect(body).toContain('### What happened\n\n<!-- Tell us -->');
    expect(body).toContain('### Checklist\n\n- [ ] No patient data\n- [ ] Optional');
    expect(findMissingFormFields(FORM, body)).toEqual(['What happened', 'Browser', 'Checklist']);
});

test('answered sections and ticked required boxes are no longer missing; a removed required section is', () => {
    const body = buildIssueFormBody(FORM)
        .replace('<!-- Tell us -->', 'It crashes')
        .replace('- [ ] No patient data', '- [x] No patient data')
        .replace(/### Browser\n\n<!-- Chrome, Safari -->\n\n/u, '');

    expect(findMissingFormFields(FORM, body)).toEqual(['Browser']);
});

test('a hint holding `-->` stays inside its comment', () => {
    const form: IssueForm = {
        ...FORM,
        fields: [
            {
                kind: 'textarea',
                label: 'Steps',
                description: null,
                required: true,
                placeholder: 'Click A --> then B',
                value: null,
            },
        ],
    };
    const body = buildIssueFormBody(form);

    expect(body).toBe('### Steps\n\n<!-- Click A -- > then B -->\n');
    expect(findMissingFormFields(form, body)).toEqual(['Steps']);
});

test('a label over several lines is one heading, found again when checked', () => {
    const form: IssueForm = {
        ...FORM,
        fields: [
            {
                kind: 'textarea',
                label: 'What happened,\nin detail',
                description: null,
                required: true,
                placeholder: null,
                value: null,
            },
        ],
    };
    const body = buildIssueFormBody(form);

    expect(body.startsWith('### What happened, in detail\n\n')).toBe(true);
    expect(findMissingFormFields(form, body.replace(/<!--[\s\S]*?-->/u, 'It crashes'))).toEqual([]);
});

test('a required box is ticked only by its own line, not one it starts', () => {
    const form: IssueForm = {
        ...FORM,
        fields: [
            {
                kind: 'checkboxes',
                label: 'Checklist',
                description: null,
                required: true,
                options: [
                    { label: 'I agree', required: true },
                    { label: 'I agree to share logs', required: false },
                ],
            },
        ],
    };
    const body = buildIssueFormBody(form);

    expect(
        findMissingFormFields(form, body.replace('- [ ] I agree to share logs', '- [x] I agree to share logs')),
    ).toEqual(['Checklist']);
    expect(findMissingFormFields(form, body.replace('- [ ] I agree\n', '- [x] I agree\n'))).toEqual([]);
});
