import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { parseWorkflowFile } from './parseWorkflowFile.js';
import type { GitHubWorkflowFileParse } from './parseWorkflowFile.js';

test('reads every dispatch input type with its settings, a string when no type is named', async () => {
    const expected: GitHubWorkflowFileParse = {
        kind: 'parsed',
        file: {
            triggers: [{ event: 'workflow_dispatch' }, { event: 'push', tags: ['v*'] }],
            dispatch: {
                inputs: [
                    {
                        name: 'mode',
                        type: 'choice',
                        required: true,
                        default: 'preview',
                        options: ['preview', 'stable'],
                        description:
                            'preview only prints the version and notes; stable tags and builds a draft release',
                    },
                    {
                        name: 'notes',
                        type: 'string',
                        required: false,
                        description: 'Extra notes above the list of changes',
                    },
                    { name: 'draft', type: 'boolean', required: false, default: true },
                    { name: 'build', type: 'number', required: false, default: 3 },
                    { name: 'target', type: 'environment', required: false },
                ],
            },
            callOnly: false,
        },
    };

    expect(await parseWorkflowFile(fixture('release.yml'))).toEqual(expected);
});

test('reads the branch filters of each event, as a list or one pattern, and a dispatch with no inputs', async () => {
    const expected: GitHubWorkflowFileParse = {
        kind: 'parsed',
        file: {
            triggers: [
                { event: 'push', branches: ['main', 'release/**'] },
                { event: 'pull_request', branches: ['main'] },
                { event: 'schedule' },
                { event: 'workflow_dispatch' },
            ],
            dispatch: { inputs: [] },
            callOnly: false,
        },
    };

    expect(await parseWorkflowFile(fixture('deploy.yml'))).toEqual(expected);
});

test('reads the branches and tags an event skips, as a list or one pattern', async () => {
    const text = [
        'on:',
        '  push:',
        "    branches-ignore: ['dependabot/**', renovate]",
        "    tags-ignore: 'v*-rc*'",
        '  pull_request:',
        '    branches-ignore: gh-pages',
    ].join('\n');

    expect(await parseWorkflowFile(text)).toMatchObject({
        file: {
            triggers: [
                { event: 'push', branchesIgnore: ['dependabot/**', 'renovate'], tagsIgnore: ['v*-rc*'] },
                { event: 'pull_request', branchesIgnore: ['gh-pages'] },
            ],
        },
    });
});

test('a workflow only other workflows run is call-only and cannot be dispatched', async () => {
    expect(await parseWorkflowFile(fixture('desktop-build.yml'))).toEqual({
        kind: 'parsed',
        file: { triggers: [{ event: 'workflow_call' }], dispatch: null, callOnly: true },
    });
});

test.each([
    ['one event', 'on: push', ['push']],
    ['a list of events', 'on: [push, pull_request]', ['push', 'pull_request']],
    ['a key a YAML 1.1 writer left as `true`', 'true:\n  workflow_dispatch:', ['workflow_dispatch']],
])('reads `on:` given as %s', async (_, text, events) => {
    const parsed = await parseWorkflowFile(text);

    expect(parsed.kind === 'parsed' ? parsed.file.triggers.map(trigger => trigger.event) : parsed).toEqual(events);
});

test.each<[string, string | null, GitHubWorkflowFileParse]>([
    ['no file', null, { kind: 'missing' }],
    ['not YAML', 'on: [push\njobs: {', { kind: 'notYaml' }],
    ['YAML without `on:`', 'name: Lint\njobs: {}', { kind: 'noTriggers' }],
    ['an empty `on:`', 'on:\njobs: {}', { kind: 'noTriggers' }],
    ['not a map', '- push', { kind: 'noTriggers' }],
])('answers why it cannot read %s, without throwing', async (_, text, expected) => {
    expect(await parseWorkflowFile(text)).toEqual(expected);
});

function fixture(name: string) {
    return readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8');
}
