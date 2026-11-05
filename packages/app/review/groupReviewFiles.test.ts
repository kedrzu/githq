import { expect, test } from 'bun:test';

import { groupReviewFiles } from './groupReviewFiles.js';
import type { ReviewFile } from './ReviewFiles.js';

test("groups in GitHub's tree order: root files first, each folder right before the ones inside it, files in the order given", () => {
    const groups = groupReviewFiles(
        [
            '.github/workflows/e2e.yml',
            'README.md',
            'bun.lock',
            'docs/sync.md',
            'docs/architecture.md',
            'e2e-tools/run.ts',
            'e2e/fixtures/workouts.json',
            'e2e/offline.spec.ts',
            'src/api/client.ts',
            'src/api/generated/schema.json',
        ].map(sampleFile),
    );

    expect(groups.map(group => [group.folder, group.files.map(file => file.path)])).toEqual([
        [null, ['README.md', 'bun.lock']],
        ['.github/workflows', ['.github/workflows/e2e.yml']],
        ['docs', ['docs/sync.md', 'docs/architecture.md']],
        ['e2e', ['e2e/offline.spec.ts']],
        ['e2e/fixtures', ['e2e/fixtures/workouts.json']],
        ['e2e-tools', ['e2e-tools/run.ts']],
        ['src/api', ['src/api/client.ts']],
        ['src/api/generated', ['src/api/generated/schema.json']],
    ]);
});

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'UNVIEWED' };
}
