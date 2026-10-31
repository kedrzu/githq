import { expect, test } from 'bun:test';

import { parseIssueForm } from './parseIssueForm.js';
import type { IssueForm } from './parseIssueForm.js';

test('reads what a form sets and the fields it asks for, leaving markdown blocks out', async () => {
    const text = [
        'name: "\\U0001F41E Bug report"',
        'description: Report an issue',
        'title: "[Bug]: "',
        'labels: [pending triage, bug]',
        'assignees: octocat',
        'type: Bug',
        'body:',
        '  - type: markdown',
        '    attributes:',
        '      value: Thanks!',
        '  - type: input',
        '    id: version',
        '    attributes:',
        '      label: Version',
        '      placeholder: 1.2.3',
        '    validations:',
        '      required: true',
        '  - type: textarea',
        '    attributes:',
        '      label: Logs',
        '      value: |',
        '        none',
        '  - type: dropdown',
        '    id: pm',
        '    attributes:',
        '      label: Package manager',
        '      options: [npm, yarn]',
        '  - type: checkboxes',
        '    attributes:',
        '      label: Checklist',
        '      options:',
        '        - label: I searched',
        '          required: true',
        '        - label: Optional box',
        '    validations:',
        '      required: true',
    ].join('\n');

    const expected: IssueForm = {
        filename: 'bug_report.yml',
        name: '🐞 Bug report',
        description: 'Report an issue',
        title: '[Bug]: ',
        labels: ['pending triage', 'bug'],
        assignees: ['octocat'],
        type: 'Bug',
        fields: [
            {
                kind: 'input',
                label: 'Version',
                description: null,
                required: true,
                placeholder: '1.2.3',
                value: null,
            },
            {
                kind: 'textarea',
                label: 'Logs',
                description: null,
                required: false,
                placeholder: null,
                value: 'none\n',
            },
            {
                kind: 'dropdown',
                label: 'Package manager',
                description: null,
                required: false,
                options: ['npm', 'yarn'],
            },
            {
                kind: 'checkboxes',
                label: 'Checklist',
                description: null,
                required: true,
                options: [
                    { label: 'I searched', required: true },
                    { label: 'Optional box', required: false },
                ],
            },
        ],
    };
    expect(await parseIssueForm('bug_report.yml', text)).toEqual(expected);
});

test('is null for a file that is not a form', async () => {
    expect(await parseIssueForm('config.yml', 'blank_issues_enabled: false\n')).toBeNull();
    expect(await parseIssueForm('broken.yml', 'name: [unclosed\nbody: x')).toBeNull();
});
