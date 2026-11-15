import { expect, test } from 'bun:test';

import { getWorkflowFile } from './getWorkflowFile.js';

test("a workflow's segment is its file under .github/workflows, or a generated one's segment of GitHub's address", () => {
    expect(
        getWorkflowFile({
            id: 1,
            name: 'Deploy',
            path: '.github/workflows/deploy.yml',
            state: 'active',
            htmlUrl: 'https://github.com/acme/web/blob/main/.github/workflows/deploy.yml',
        }),
    ).toBe('deploy.yml');
    expect(
        getWorkflowFile({
            id: 2,
            name: 'pages-build-deployment',
            path: 'dynamic/pages/pages-build-deployment',
            state: 'active',
            htmlUrl: 'https://github.com/acme/web/actions/workflows/pages/pages-build-deployment',
        }),
    ).toBe('pages/pages-build-deployment');
});
