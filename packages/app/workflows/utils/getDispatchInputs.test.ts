/// <reference types="bun" />
import type { WorkflowInput } from '@githq/github/workflows/parseWorkflowFile.js';
import { expect, test } from 'bun:test';

import type { CommandFormField } from '@/commands/CommandTypes.js';

import { getDispatchFields } from './getDispatchFields.js';
import { getDispatchInputs } from './getDispatchInputs.js';

const INPUTS: readonly WorkflowInput[] = [
    { name: 'environment', type: 'choice', required: true, options: ['staging', 'production'], default: 'staging' },
    { name: 'version', type: 'string', required: false },
    { name: 'dry_run', type: 'boolean', required: false, default: true },
    { name: 'replicas', type: 'number', required: false, default: 2 },
    { name: 'region', type: 'choice', required: false, options: ['eu', 'us'] },
];

test('only what was entered or changed is sent; what the fields showed untouched is left to GitHub', () => {
    const fields = getDispatchFields(INPUTS, 'en');

    // As the form submits them: every field shown, with its value or its default.
    const untouched = {
        'input:environment': 'staging',
        'input:version': '',
        'input:dry_run': true,
        'input:replicas': 2,
        'input:region': 'eu',
    };
    expect(getDispatchInputs(fields, untouched)).toEqual({});

    const changed = {
        'input:environment': 'production',
        'input:version': '2.14.0',
        'input:dry_run': false,
        'input:replicas': null,
        'input:region': 'us',
    };
    expect(getDispatchInputs(fields, changed)).toEqual({
        environment: 'production',
        version: '2.14.0',
        dry_run: false,
        region: 'us',
    });
});

test('an input named `ref` is its own field: the ref to run on is never sent as it, nor it as the ref', () => {
    const inputs: readonly WorkflowInput[] = [{ name: 'ref', type: 'string', required: false, default: 'HEAD' }];
    const refField: CommandFormField = { kind: 'text', name: 'ref', default: 'main', required: true };
    const fields = [refField, ...getDispatchFields(inputs, 'en')];

    expect(new Set(fields.map(field => field.name)).size).toBe(fields.length);
    expect(getDispatchInputs(fields, { ref: 'release/2.14', 'input:ref': 'HEAD' })).toEqual({});
    expect(getDispatchInputs(fields, { ref: 'main', 'input:ref': 'v1.2' })).toEqual({ ref: 'v1.2' });
});
