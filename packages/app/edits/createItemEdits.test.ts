/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { UpdatePullRequestBranchMutation } from '@githq/github/generated.gen.js';

import { ItemStore } from '@/store/ItemStore.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { samplePullRequest } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { ItemEditor } from './ItemEditor.js';

test('PM20: updating the branch names the head the user saw — GitHub refuses it once the branch moved', async () => {
    const { editor, session } = await setup(null);

    const outcome = await editor.edit(['PR_1'], { kind: 'updateBranch', method: 'MERGE' });

    expect(outcome.failed).toEqual([]);
    expect(session.github.requests.filter(request => request.operation === 'UpdatePullRequestBranch')).toEqual([
        expect.objectContaining({
            variables: { pullRequestId: 'PR_1', expectedHeadOid: 'seen-head', updateMethod: 'MERGE' },
        }),
    ]);
});

test('PM20: an update GitHub refuses is a failed edit like any other, with its reason', async () => {
    const { editor, items } = await setup('Expected head sha did not match current head ref.');

    const outcome = await editor.edit(['PR_1'], { kind: 'updateBranch', method: 'MERGE' });

    expect(outcome.failed.map(({ edit, reason }) => ({ subject: edit.subject, reason }))).toEqual([
        {
            subject: { kind: 'branchUpdated' },
            reason: { kind: 'refused', message: 'Expected head sha did not match current head ref.' },
        },
    ]);
    expect(items.get('PR_1')).toMatchObject({ headRefOid: 'seen-head', mergeStateStatus: 'BEHIND' });
});

/** A pull request behind its base, as the user saw it; GitHub refuses the update with `refusal` when given. */
async function setup(refusal: string | null) {
    const session = createTestSession({ login: `user-${crypto.randomUUID()}`, answer });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const editor = session.container.resolve(ItemEditor);
    await items.ready();
    items.upsertMany([{ ...samplePullRequest('PR_1'), headRefOid: 'seen-head', mergeStateStatus: 'BEHIND' }]);

    return { editor, items, session };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (request.operation !== 'UpdatePullRequestBranch') {
            return undefined;
        }

        if (refusal !== null) {
            return { data: { updatePullRequestBranch: null }, errors: [{ type: 'UNPROCESSABLE', message: refusal }] };
        }

        const data: UpdatePullRequestBranchMutation = { updatePullRequestBranch: { pullRequest: { id: 'PR_1' } } };
        return { data };
    }
}
