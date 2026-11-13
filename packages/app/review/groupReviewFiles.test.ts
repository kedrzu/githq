import { expect, test } from 'bun:test';

import { groupReviewFiles } from './groupReviewFiles.js';
import type { ReviewFile } from './ReviewFiles.js';

test("groups folders in GitHub's tree order, then the root's files, then the submodules, files in the order given", () => {
    const groups = groupReviewFiles([
        sampleFile('.github/workflows/e2e.yml'),
        sampleFile('README.md'),
        submoduleFile('nzyme'),
        sampleFile('bun.lock'),
        sampleFile('docs/sync.md'),
        sampleFile('docs/architecture.md'),
        sampleFile('e2e-tools/run.ts'),
        sampleFile('e2e/fixtures/workouts.json'),
        sampleFile('e2e/offline.spec.ts'),
        submoduleFile('vendor/tiptap'),
        // Its patch hasn't arrived: nothing says it is a submodule yet.
        sampleFile('vendor/tokens'),
        // Gone from the diff: no patch, so never a submodule.
        { ...sampleFile('vendor/old'), changeType: 'DELETED', gone: { kind: 'notInDiff' } },
        // A plain file's patch has `submodule: null`.
        { ...sampleFile('src/api/client.ts'), patch: { layout: null, verdict: null, submodule: null } },
        sampleFile('src/api/generated/schema.json'),
    ]);

    expect(
        groups.map(group => [group.kind === 'folder' ? group.folder : group.kind, group.files.map(file => file.path)]),
    ).toEqual([
        ['.github/workflows', ['.github/workflows/e2e.yml']],
        ['docs', ['docs/sync.md', 'docs/architecture.md']],
        ['e2e', ['e2e/offline.spec.ts']],
        ['e2e/fixtures', ['e2e/fixtures/workouts.json']],
        ['e2e-tools', ['e2e-tools/run.ts']],
        ['src/api', ['src/api/client.ts']],
        ['src/api/generated', ['src/api/generated/schema.json']],
        ['vendor', ['vendor/tokens', 'vendor/old']],
        ['root', ['README.md', 'bun.lock']],
        ['submodules', ['nzyme', 'vendor/tiptap']],
    ]);
});

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'UNVIEWED' };
}

function submoduleFile(path: string): ReviewFile {
    return {
        ...sampleFile(path),
        patch: { layout: null, verdict: 'submodule', submodule: { before: 'a1c9e2f', after: 'd4f7b21' } },
    };
}
