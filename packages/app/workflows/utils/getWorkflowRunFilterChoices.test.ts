/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { sampleWorkflowRuns } from '@/testing/sampleWorkflows.js';

import { NO_WORKFLOW_RUN_FILTERS } from '../WorkflowRunHistory.js';
import { getWorkflowRunFilterChoices } from './getWorkflowRunFilterChoices.js';
import type { WorkflowRunFilterChoices } from './getWorkflowRunFilterChoices.js';

test('offers the refs that count by an exact name first, then the loaded runs’ values, newest first, and a value set that no run has', () => {
    const runs = sampleWorkflowRuns({
        id: 1,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', ago: '3h', branch: 'v1.0.0' },
            { conclusion: 'failure', ago: '2h', branch: 'feature', event: 'pull_request' },
            { conclusion: null, ago: '1h', branch: 'main' },
        ],
    });

    const choices = getWorkflowRunFilterChoices({
        runs,
        refGroups: [
            { kind: 'defaultBranch', branch: 'main' },
            { kind: 'pattern', pattern: 'v*' },
            { kind: 'pattern', pattern: 'release' },
        ],
        filters: { ...NO_WORKFLOW_RUN_FILTERS, event: 'schedule', actor: 'monalisa' },
    });

    const expected: WorkflowRunFilterChoices = {
        refs: ['main', 'release', 'feature', 'v1.0.0'],
        events: ['push', 'pull_request', 'schedule'],
        statuses: ['in_progress', 'failure', 'success'],
        actors: ['monalisa'],
    };
    expect(choices).toEqual(expected);
});
