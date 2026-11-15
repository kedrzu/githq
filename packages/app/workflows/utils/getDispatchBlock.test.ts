/// <reference types="bun" />
import type { RepositoryPermission } from '@githq/github/generated.gen.js';
import type { GitHubWorkflow } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowFileParse } from '@githq/github/workflows/parseWorkflowFile.js';
import { expect, test } from 'bun:test';

import { getDispatchBlock } from './getDispatchBlock.js';
import type { GetDispatchBlockParams } from './getDispatchBlock.js';

const DEPLOY: GitHubWorkflow = {
    id: 1,
    name: 'Deploy',
    path: '.github/workflows/deploy.yml',
    state: 'active',
    htmlUrl: 'https://github.com/acme/web/actions/workflows/deploy.yml',
};
const DISPATCHABLE: GitHubWorkflowFileParse = {
    kind: 'parsed',
    file: { triggers: [{ event: 'workflow_dispatch' }], dispatch: { inputs: [] }, callOnly: false },
};
const READY: GetDispatchBlockParams = {
    workflow: DEPLOY,
    generated: false,
    metadata: { isArchived: false, viewerPermission: 'WRITE' },
    parse: DISPATCHABLE,
};

test('only write access to a repository that is not archived may run it', () => {
    const roles: readonly (readonly [RepositoryPermission | null, boolean])[] = [
        ['READ', false],
        ['TRIAGE', false],
        [null, false],
        ['WRITE', true],
        ['MAINTAIN', true],
        ['ADMIN', true],
    ];
    for (const [viewerPermission, may] of roles) {
        const block = getDispatchBlock({ ...READY, metadata: { isArchived: false, viewerPermission } });
        expect(block).toBe(may ? null : 'noAccess');
    }

    expect(getDispatchBlock({ ...READY, metadata: undefined })).toBe('noAccess');
    expect(getDispatchBlock({ ...READY, metadata: { isArchived: true, viewerPermission: 'ADMIN' } })).toBe('archived');
});

test('a generated or disabled workflow, or a file without workflow_dispatch, is told apart', () => {
    expect(getDispatchBlock({ ...READY, generated: true })).toBe('generated');
    expect(getDispatchBlock({ ...READY, workflow: { ...DEPLOY, state: 'disabled_manually' } })).toBe('disabled');
    const push: GitHubWorkflowFileParse = {
        kind: 'parsed',
        file: { triggers: [{ event: 'push' }], dispatch: null, callOnly: false },
    };
    expect(getDispatchBlock({ ...READY, parse: push })).toBe('noDispatch');
    expect(getDispatchBlock({ ...READY, parse: { kind: 'missing' } })).toBe('unreadable');
    // Not read yet: nothing says it can't.
    expect(getDispatchBlock({ ...READY, parse: null })).toBeNull();
});
