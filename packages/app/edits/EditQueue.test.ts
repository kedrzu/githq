/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type {
    IssueCommentFieldsFragment,
    ProjectItemDetailFieldsFragment,
    RepositoryLabelQuery,
    RepositoryMetadataQuery,
    SetProjectFieldValueMutation,
} from '@githq/github/generated.gen.js';
import { createPromise } from '@nzyme/utils/createPromise.js';

import { ProjectStore } from '@/projects/ProjectStore.js';
import type { ProjectItem } from '@/projects/ProjectTypes.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import type { IssueItem, ItemLabel } from '@/store/ItemTypes.js';
import type { TestGraphQLAnswer, TestGraphQLRequest } from '@/testing/createTestSession.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { sampleIssueDetailNode } from '@/testing/sampleDetailNodes.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { CommentDrafts } from './CommentDrafts.js';
import { EditQueue } from './EditQueue.js';
import type { EditFailure } from './EditQueue.js';
import type { Edit, EditAnswer, EditVerdict } from './EditTypes.js';
import { ItemEditor } from './ItemEditor.js';

const BUG: ItemLabel = { name: 'bug', color: 'd73a4a' };
const REGRESSION: ItemLabel = { name: 'regression', color: 'b60205' };
/** A label of the repository past the pages the pickers read. */
const WONTFIX: ItemLabel = { name: 'wontfix', color: 'ffffff' };
const BEFORE = '2026-10-20T10:00:00Z';
const CONFIRMED = '2026-10-30T13:00:00Z';
const LATER = '2026-10-30T14:00:00Z';

test('an edit shows at once in the row and the detail, and once GitHub keeps it, it is what the store holds', async () => {
    const { editor, items, queue, github, session } = await setup();
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    await session.clock.advance(0);

    expect(items.get('I_1')?.labels).toEqual([BUG, REGRESSION]);
    // Not part of what is stored until GitHub answers.
    expect(items.getStored('I_1')?.labels).toEqual([BUG]);
    expect(queue.pending.map(edit => edit.subject)).toEqual([{ kind: 'labelAdded', label: 'regression' }]);

    held.resolve();
    expect(await done).toEqual({ failed: [] });

    expect(items.getStored('I_1')?.labels).toEqual([BUG, REGRESSION]);
    expect(items.get('I_1')?.labels).toEqual([BUG, REGRESSION]);
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
    expect(github.mutations()).toEqual([
        { operation: 'AddLabels', variables: { labelableId: 'I_1', labelIds: ['LA_regression'] } },
    ]);
});

test('a value missing from GitHub’s answer is a rejection: the change is undone, listed as failed and named in its row', async () => {
    const { editor, items, queue, github, session } = await setup();
    // Without push access GitHub answers with the labels as they were (D14).
    github.keepLabels = false;

    const outcome = await editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });

    expect(outcome.failed.map(failed => failed.reason)).toEqual([{ kind: 'dropped' }]);
    expect(items.get('I_1')?.labels).toEqual([BUG]);
    // Dated by the queue's clock: the status bar says the newest of what it has to say.
    const expected: Partial<EditFailure> = { itemCount: 1, editCount: 1, toast: true, at: session.clock.now() };
    expect(queue.failures).toMatchObject([expected]);
    expect(queue.undone.get('I_1')).toEqual({ kind: 'labelAdded', label: 'regression' });

    await session.clock.advance(10_000);
    expect(queue.undone.has('I_1')).toBe(false);
    // Stays listed until dismissed.
    queue.dismiss(queue.failures[0]?.id ?? 0);
    expect(queue.failures).toEqual([]);
});

test('an error from GitHub undoes the change and says why', async () => {
    const { editor, items, github } = await setup();
    github.error = { type: 'NOT_FOUND', message: "Could not resolve to a node with the global id of 'LA_regression'" };

    const outcome = await editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });

    expect(outcome.failed.map(failed => failed.reason)).toEqual([{ kind: 'missing' }]);
    expect(items.get('I_1')?.labels).toEqual([BUG]);
});

test('a label the pickers did not read is looked up by name; only one GitHub does not know is missing', async () => {
    const { editor, items, github, session } = await setup();
    items.upsertMany([{ ...stored(), labels: [BUG, WONTFIX] }]);

    const removed = await editor.edit(['I_1'], { kind: 'labels', add: [], remove: ['wontfix'] });

    expect(removed).toEqual({ failed: [] });
    expect(items.get('I_1')?.labels).toEqual([BUG]);
    expect(github.mutations()).toEqual([
        { operation: 'RemoveLabels', variables: { labelableId: 'I_1', labelIds: ['LA_wontfix'] } },
    ]);

    const added = await editor.edit(['I_1'], { kind: 'labels', add: ['nonexistent'], remove: [] });

    expect(added.failed.map(failed => failed.reason)).toEqual([{ kind: 'missing' }]);
    expect(github.mutations()).toHaveLength(1);
    expect(session.operations().filter(operation => operation === 'RepositoryLabel')).toHaveLength(2);
});

test('the edits of one item go one at a time, in order; a sync answer meanwhile does not undo them, nor does an older one after', async () => {
    const { editor, items, github, session } = await setup();
    const held = createPromise();
    github.hold(held.promise);

    const first = editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    const second = editor.edit(['I_1'], { kind: 'labels', add: [], remove: ['bug'] });
    await session.clock.advance(0);

    // Only the first is on its way.
    expect(github.mutations().map(request => request.operation)).toEqual(['AddLabels']);
    expect(items.get('I_1')?.labels).toEqual([REGRESSION]);

    // A poll that started before the edits answers now: the edits stay drawn over it.
    items.upsertMany([{ ...stored(), title: 'Renamed on GitHub' }]);
    expect(items.get('I_1')).toMatchObject({ title: 'Renamed on GitHub', labels: [REGRESSION] });

    held.resolve();
    await Promise.all([first, second]);
    expect(github.mutations().map(request => request.operation)).toEqual(['AddLabels', 'RemoveLabels']);
    expect(items.get('I_1')?.labels).toEqual([REGRESSION]);

    // A sync answer read before the edits arrives late: what GitHub confirmed wins.
    items.upsertMany([stored()]);
    expect(items.get('I_1')?.labels).toEqual([REGRESSION]);

    // One read after them: GitHub's copy wins (last write wins, D8).
    items.upsertMany([{ ...stored(), labels: [BUG], updatedAt: LATER }]);
    expect(items.get('I_1')?.labels).toEqual([BUG]);
});

test('a sync answer read before an edit and arriving after it, in another tab, undoes it in no tab — row, detail or project item', async () => {
    const tabs = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const editing = await setup({ tabs, login });
    const other = await setup({ tabs, login });
    editing.projects.upsertItems([projectItem()]);
    await editing.details.ensure('I_1');
    await other.session.clock.advance(0);

    await editing.editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    await editing.editor.edit(['I_1'], {
        kind: 'projectField',
        projectItemId: 'PVTI_1',
        fieldId: 'F_status',
        value: { kind: 'singleSelect', optionId: 'O_done' },
    });
    await other.session.clock.advance(0);

    // The other tab's sync read the item, its detail and its project before the edits; the answers come now.
    other.items.upsertMany([stored()]);
    other.projects.upsertItems([projectItem()]);
    await other.session.clock.advance(61_000);
    await other.details.ensure('I_1');
    await editing.session.clock.advance(0);

    expect(other.session.operations()).toContain('ItemDetail');
    for (const tab of [other, editing]) {
        expect(tab.items.getStored('I_1')?.labels).toEqual([BUG, REGRESSION]);
        expect(tab.projects.getStoredItem('PVTI_1')?.values.F_status).toMatchObject({ name: 'Done' });
    }

    // The other tab draws no layer of the edits: this is what it holds.
    expect(other.details.get('I_1')?.item.labels).toEqual([BUG, REGRESSION]);
    expect(other.details.get('I_1')?.projects[0]?.values.F_status).toMatchObject({ name: 'Done' });

    // A copy read after the edits replaces them (last write wins, D8).
    other.items.upsertMany([{ ...stored(), updatedAt: LATER }]);
    await editing.session.clock.advance(0);
    expect(editing.items.getStored('I_1')?.labels).toEqual([BUG]);
});

test('an edit confirmed while a later one of the item is on its way does not hide the later one', async () => {
    const { editor, items, github, session } = await setup();
    const first = createPromise();
    github.hold(first.promise);

    const adding = editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    const removing = editor.edit(['I_1'], { kind: 'labels', add: [], remove: ['bug'] });
    await session.clock.advance(0);

    // The first answer holds the whole list with `bug` in it; the second has not come yet.
    const second = createPromise();
    github.hold(second.promise);
    first.resolve();
    await adding;
    await session.clock.advance(0);

    expect(github.mutations().map(request => request.operation)).toEqual(['AddLabels', 'RemoveLabels']);
    expect(items.get('I_1')?.labels).toEqual([REGRESSION]);

    second.resolve();
    await removing;
    expect(items.get('I_1')?.labels).toEqual([REGRESSION]);
});

test('a change of several items reports the ones that failed of all, and undoes only those', async () => {
    const { editor, items, queue, github } = await setup();
    items.upsertMany([{ ...stored('I_2') }, { ...stored('I_3'), repository: readOnlyRepository() }]);
    github.dropFor.add('I_2');

    const outcome = await editor.edit(['I_1', 'I_2', 'I_3'], { kind: 'labels', add: ['regression'], remove: [] });

    expect(outcome.failed.map(failed => [failed.edit.itemId, failed.reason.kind])).toEqual([
        ['I_2', 'dropped'],
        // The user may only read its repository: never sent.
        ['I_3', 'notAllowed'],
    ]);
    expect(queue.failures).toMatchObject([{ itemCount: 3, editCount: 3 }]);
    expect(items.get('I_1')?.labels).toEqual([BUG, REGRESSION]);
    expect(items.get('I_2')?.labels).toEqual([BUG]);
    expect(items.get('I_3')?.labels).toEqual([BUG]);
    expect(github.mutations().map(request => request.variables.labelableId)).toEqual(['I_1', 'I_2']);
});

test('an edit GitHub took and goes on with holds no slot: with four running another item’s edit goes at once, while the item’s own later edit waits', async () => {
    const { editor, queue, github, session } = await setup();
    const account = { login: github.viewer, token: github.token };
    const running = createPromise<EditVerdict>();
    const follow = () => running.promise;
    const sent: string[] = [];

    const followed = queue.submit({
        edits: ['PR_1', 'PR_2', 'PR_3', 'PR_4'].map(id => sampleEdit(id, { kind: 'following', follow })),
        account,
        itemCount: 4,
    });
    await session.clock.advance(0);

    const other = editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    await session.clock.advance(0);
    expect(github.mutations()).toHaveLength(1);
    expect(await other).toEqual({ failed: [] });

    const later = queue.submit({
        edits: [{ ...sampleEdit('PR_1', { kind: 'unknown' }), send: sendLater }],
        account,
        itemCount: 1,
    });
    await session.clock.advance(0);
    expect(sent).toEqual([]);

    running.resolve({ kind: 'unknown' });
    expect(await followed).toEqual({ failed: [] });
    expect(await later).toEqual({ failed: [] });
    expect(sent).toEqual(['PR_1']);
    expect(queue.pending).toEqual([]);

    function sendLater() {
        sent.push('PR_1');
        return Promise.resolve<EditAnswer>({ kind: 'unknown' });
    }
});

test('asking how an edit GitHub took ended rejects: it is undone and reported like one refused', async () => {
    const { queue, github, session } = await setup();
    const account = { login: github.viewer, token: github.token };
    const answer: EditAnswer = { kind: 'following', follow: () => Promise.reject(new Error('Offline')) };

    const outcome = await queue.submit({ edits: [sampleEdit('PR_1', answer)], account, itemCount: 1 });
    await session.clock.advance(0);

    expect(outcome.failed).toHaveLength(1);
    expect(queue.pending).toEqual([]);
});

test('the edits waiting when the user signs out are dropped, never sent with the next account’s token', async () => {
    const { editor, items, queue, github, session } = await setup();
    const held = createPromise();
    github.hold(held.promise);

    void editor.edit(['I_1'], { kind: 'labels', add: ['regression'], remove: [] });
    void editor.edit(['I_1'], { kind: 'labels', add: [], remove: ['bug'] });
    await session.clock.advance(0);
    expect(github.mutations()).toHaveLength(1);

    session.signInFromAnotherTab(`other-${crypto.randomUUID()}`);
    held.resolve();
    await session.clock.advance(0);

    // The first was on its way under the old token; the second never went.
    expect(github.tokens()).toEqual([github.token]);
    expect(queue.pending).toEqual([]);
    expect(queue.failures).toEqual([]);
    expect(items.get('I_1')).toBeUndefined();
});

test('an edit still being made when another account signs in is dropped, never sent with that account’s token', async () => {
    const { editor, items, github, session } = await setup();
    // Its repository's metadata is not in memory: the edit waits for GitHub to read it.
    items.upsertMany([{ ...stored('I_2'), repository: { ...stored().repository, nameWithOwner: 'acme/api' } }]);
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_2'], { kind: 'labels', add: ['regression'], remove: [] });
    await session.clock.advance(0);
    expect(session.operations().at(-1)).toBe('RepositoryMetadata');

    session.signInFromAnotherTab(`other-${crypto.randomUUID()}`);
    held.resolve();

    expect(await done).toEqual({ failed: [] });
    await session.clock.advance(0);
    expect(github.mutations()).toEqual([]);
});

test('a comment shows at once as on its way, then as GitHub rendered it', async () => {
    const { editor, details, github, session } = await setup();
    await details.ensure('I_1');
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_1'], { kind: 'comment', body: 'Fixed in <b>#12</b>' });
    await session.clock.advance(0);

    const pending = details.get('I_1')?.comments.nodes.at(-1);
    // Shown as typed, as text: the markdown is GitHub's to render.
    expect(pending).toMatchObject({ pendingBody: 'Fixed in <b>#12</b>', author: { login: github.viewer } });

    held.resolve();
    await done;
    const comments = details.get('I_1')?.comments;
    expect(comments?.nodes.map(comment => [comment.id, comment.bodyHtml, comment.pendingBody])).toEqual([
        ['IC_new', '<p>Fixed in <b>#12</b></p>', undefined],
    ]);
    expect(comments?.totalCount).toBe(1);
});

test('a project field is confirmed by its own value, and the item’s other values stay', async () => {
    const { editor, details, github } = await setup();
    await details.ensure('I_1');

    const outcome = await editor.edit(['I_1'], {
        kind: 'projectField',
        projectItemId: 'PVTI_1',
        fieldId: 'F_status',
        value: { kind: 'singleSelect', optionId: 'O_done' },
    });

    expect(outcome).toEqual({ failed: [] });
    expect(github.mutations()).toMatchObject([
        { operation: 'SetProjectFieldValue', variables: { fieldId: 'F_status', fieldName: 'Status' } },
    ]);
    const expected: ItemDetailProject['values'] = {
        F_status: { kind: 'singleSelect', optionId: 'O_done', name: 'Done', color: 'GREEN' },
        F_note: { kind: 'text', text: 'Ship it' },
    };
    expect(details.get('I_1')?.projects[0]?.values).toEqual(expected);
});

test('a comment from code review GitHub does not take goes back into its empty box; over new text, its toast restores it', async () => {
    const { editor, details, drafts, queue, github } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };

    await editor.edit(['I_1'], { kind: 'comment', body: 'First try' });

    expect(drafts.get('I_1')).toBe('First try');
    expect(drafts.getFailed('I_1')).toEqual([]);
    expect(details.get('I_1')?.comments.nodes).toEqual([]);

    drafts.set('I_1', 'Something new');
    const outcome = await editor.edit(['I_1'], { kind: 'comment', body: 'Second try' });

    expect(drafts.get('I_1')).toBe('Something new');
    // Listed for its toast, which offers to restore it; restored, it follows what was typed.
    expect(outcome.failed.map(failed => failed.edit.subject)).toEqual([{ kind: 'comment', body: 'Second try' }]);
    expect(queue.failures.flatMap(failure => failure.failed.map(failed => failed.edit.subject))).toContainEqual({
        kind: 'comment',
        body: 'Second try',
    });
    drafts.restore('I_1', 'Second try');
    expect(drafts.get('I_1')).toBe('Something new\n\nSecond try');
});

test('a comment from the thread GitHub does not take stays as not sent, in the order written, the box left as it is and no toast', async () => {
    const { editor, details, drafts, queue, github } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };
    drafts.set('I_1', 'Something new');

    await editor.edit(['I_1'], { kind: 'comment', body: 'First try', keptInThread: true });
    await editor.edit(['I_1'], { kind: 'comment', body: 'Second try', keptInThread: true });

    expect(drafts.getFailed('I_1').map(({ body, reason }) => [body, reason])).toEqual([
        ['First try', { kind: 'refused', message: 'Commenting is disabled' }],
        ['Second try', { kind: 'refused', message: 'Commenting is disabled' }],
    ]);
    expect(drafts.get('I_1')).toBe('Something new');
    expect(details.get('I_1')?.comments.nodes).toEqual([]);
    // The thread says it: no toast, nothing listed for the status bar.
    expect(queue.failures).toEqual([]);
});

test('a comment not sent, retried once GitHub answers, is posted and leaves the failed ones', async () => {
    const { editor, details, drafts, github } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };
    await editor.edit(['I_1'], { kind: 'comment', body: 'Fixed in <b>#12</b>', keptInThread: true });
    const [failed] = drafts.getFailed('I_1');

    github.error = null;
    expect(await editor.retryComment(failed?.id ?? 0)).toEqual({ failed: [] });

    expect(drafts.getFailed('I_1')).toEqual([]);
    expect(drafts.hasAny).toBe(false);
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(['IC_new']);
});

test('a retry GitHub refuses again keeps the comment where it was, with the new reason', async () => {
    const { editor, details, drafts, github, session } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };
    await editor.edit(['I_1'], { kind: 'comment', body: 'First', keptInThread: true });
    await editor.edit(['I_1'], { kind: 'comment', body: 'Second', keptInThread: true });
    const [first] = drafts.getFailed('I_1');

    github.error = { type: 'FORBIDDEN', message: 'Rate limited' };
    const held = createPromise();
    github.hold(held.promise);
    const retrying = editor.retryComment(first?.id ?? 0);
    await session.clock.advance(0);
    // On its way: shown as sending, not as failed.
    expect(drafts.getFailed('I_1').map(comment => comment.body)).toEqual(['Second']);

    held.resolve();
    await retrying;

    expect(drafts.getFailed('I_1').map(({ body, reason }) => [body, reason])).toEqual([
        ['First', { kind: 'refused', message: 'Rate limited' }],
        ['Second', { kind: 'refused', message: 'Commenting is disabled' }],
    ]);
});

test('a comment not sent is dropped only when discarded, and on sign-out', async () => {
    const { editor, details, drafts, github, session } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };
    await editor.edit(['I_1'], { kind: 'comment', body: 'First', keptInThread: true });
    await editor.edit(['I_1'], { kind: 'comment', body: 'Second', keptInThread: true });
    const [first] = drafts.getFailed('I_1');

    drafts.discardFailed(first?.id ?? 0);
    expect(drafts.getFailed('I_1').map(comment => comment.body)).toEqual(['Second']);

    session.signOutFromAnotherTab();
    expect(drafts.getFailed('I_1')).toEqual([]);
    expect(drafts.hasAny).toBe(false);
});

test('a comment edited shows at once as typed and edited, then as GitHub rendered it', async () => {
    const { editor, details, github, session } = await setup();
    github.comments = [sampleComment('IC_1', 'First take')];
    await details.ensure('I_1');
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_1'], { kind: 'editComment', commentId: 'IC_1', body: 'Second take' });
    await session.clock.advance(0);

    expect(details.get('I_1')?.comments.nodes).toMatchObject([
        { id: 'IC_1', body: 'Second take', pendingBody: 'Second take', lastEditedAt: expect.any(String) },
    ]);

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(github.mutations()).toEqual([
        { operation: 'UpdateIssueComment', variables: { id: 'IC_1', body: 'Second take' } },
    ]);
    const [comment] = details.get('I_1')?.comments.nodes ?? [];
    expect([comment?.bodyHtml, comment?.pendingBody, comment?.lastEditedAt]).toEqual([
        '<p>Second take</p>',
        undefined,
        CONFIRMED,
    ]);
});

test('an edit GitHub refuses never loses the text: the comment reads as it was, and the text waits with why, no toast', async () => {
    const { editor, details, drafts, queue, github } = await setup();
    github.comments = [sampleComment('IC_1', 'First take')];
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Comment is too long' };

    await editor.edit(['I_1'], { kind: 'editComment', commentId: 'IC_1', body: 'Second take' });

    expect(details.get('I_1')?.comments.nodes.map(comment => [comment.body, comment.pendingBody])).toEqual([
        ['First take', undefined],
    ]);
    expect(drafts.getFailedEdits('I_1')).toEqual([
        {
            itemId: 'I_1',
            commentId: 'IC_1',
            body: 'Second take',
            reason: { kind: 'refused', message: 'Comment is too long' },
        },
    ]);
    expect(queue.failures).toEqual([]);

    // Saved again, it waits no more.
    github.error = null;
    await editor.edit(['I_1'], { kind: 'editComment', commentId: 'IC_1', body: 'Shorter' });
    expect(drafts.getFailedEdits('I_1')).toEqual([]);
    expect(details.get('I_1')?.comments.nodes[0]?.body).toBe('Shorter');
});

test('a comment deleted is gone at once; one GitHub refuses to delete comes back, with its toast', async () => {
    const { editor, details, queue, github, session } = await setup();
    github.comments = [sampleComment('IC_1', 'Keep'), sampleComment('IC_2', 'Drop')];
    await details.ensure('I_1');
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_1'], { kind: 'deleteComment', commentId: 'IC_2' });
    await session.clock.advance(0);
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(['IC_1']);
    expect(details.get('I_1')?.comments.totalCount).toBe(1);

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(github.mutations()).toEqual([{ operation: 'DeleteIssueComment', variables: { id: 'IC_2' } }]);
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(['IC_1']);

    github.error = { type: 'FORBIDDEN', message: 'Resource not accessible by integration' };
    const refused = await editor.edit(['I_1'], { kind: 'deleteComment', commentId: 'IC_1' });

    expect(refused.failed.map(failed => failed.edit.subject)).toEqual([{ kind: 'commentDeleted' }]);
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.id)).toEqual(['IC_1']);
    expect(queue.failures).toMatchObject([{ toast: true }]);
});

test('K1b: what GitHub does not let the viewer edit or delete is never sent, and the text written is kept', async () => {
    const { editor, details, drafts, github } = await setup();
    github.comments = [sampleComment('IC_1', 'Theirs', { viewerCanUpdate: false, viewerCanDelete: false })];
    github.bodyEditable = false;
    await details.ensure('I_1');

    const edited = await editor.edit(['I_1'], { kind: 'editComment', commentId: 'IC_1', body: 'Mine now' });
    const deleted = await editor.edit(['I_1'], { kind: 'deleteComment', commentId: 'IC_1' });
    const described = await editor.edit(['I_1'], { kind: 'editBody', body: 'New description' });

    expect([edited, deleted, described].flatMap(outcome => outcome.failed.map(failed => failed.reason))).toEqual([
        { kind: 'notAllowed' },
        { kind: 'notAllowed' },
        { kind: 'notAllowed' },
    ]);
    expect(github.mutations()).toEqual([]);
    expect(details.get('I_1')?.comments.nodes.map(comment => comment.body)).toEqual(['Theirs']);
    expect(drafts.getFailedEdits('I_1').map(edit => [edit.commentId, edit.body])).toEqual([
        ['IC_1', 'Mine now'],
        [null, 'New description'],
    ]);
});

test('the description edited shows at once as typed and edited, then as GitHub rendered it', async () => {
    const { editor, details, github, session } = await setup();
    await details.ensure('I_1');
    const held = createPromise();
    github.hold(held.promise);

    const done = editor.edit(['I_1'], { kind: 'editBody', body: 'Steps to reproduce' });
    await session.clock.advance(0);
    expect(details.get('I_1')).toMatchObject({ body: 'Steps to reproduce', pendingBody: 'Steps to reproduce' });

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(github.mutations()).toEqual([
        { operation: 'UpdateIssueBody', variables: { id: 'I_1', body: 'Steps to reproduce' } },
    ]);
    const detail = details.get('I_1');
    expect([detail?.bodyHtml, detail?.pendingBody, detail?.lastEditedAt]).toEqual([
        '<p>Steps to reproduce</p>',
        undefined,
        CONFIRMED,
    ]);
});

/** The fake GitHub of a test: what it answers the edits with. */
interface FakeGitHub {
    readonly viewer: string;
    readonly token: string;
    /** Whether it keeps the labels it is asked to add or remove. */
    keepLabels: boolean;
    /** Whether it closes and reopens what it is asked to. */
    keepState: boolean;
    /** The items whose labels it never changes. */
    readonly dropFor: Set<string>;
    /** What every answer fails with. */
    error: GitHubGraphQLErrorEntry | null;
    /** I_1's comments, as its detail reads them and the comment edits change them. */
    comments: IssueCommentFieldsFragment[];
    /** Whether GitHub lets the viewer edit I_1's description. */
    bodyEditable: boolean;
    /** The edits received, in order. */
    mutations(): { operation: string; variables: Readonly<Record<string, unknown>> }[];
    /** The tokens the edits carried. */
    tokens(): string[];
    hold(promise: Promise<void>): void;
}

test('closing as not planned shows closed at once; GitHub answering it still open undoes it', async () => {
    const { editor, items, github, session } = await setup();
    const held = createPromise();
    github.hold(held.promise);

    const closed = editor.edit(['I_1'], { kind: 'close', reason: 'NOT_PLANNED' });
    await session.clock.advance(0);
    expect(items.get('I_1')).toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });

    held.resolve();
    expect(await closed).toEqual({ failed: [] });
    expect(github.mutations()).toEqual([
        { operation: 'CloseIssue', variables: { issueId: 'I_1', stateReason: 'NOT_PLANNED' } },
    ]);
    expect(items.getStored('I_1')).toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED' });

    github.keepState = false;
    const reopened = await editor.edit(['I_1'], { kind: 'reopen' });
    expect(reopened.failed.map(failed => failed.reason.kind)).toEqual(['dropped']);
    expect(items.get('I_1')?.state).toBe('CLOSED');
});

test('a close offers Undo, which reopens it — sent after the close when that is still on its way', async () => {
    const { editor, items, github, session } = await setup();
    const held = createPromise();
    github.hold(held.promise);

    const closed = editor.edit(['I_1'], { kind: 'close', reason: 'COMPLETED' });
    await session.clock.advance(0);
    expect(editor.closes.map(close => close.targets)).toEqual([[{ itemId: 'I_1', reference: 'acme/web#1' }]]);

    const undone = editor.undoClose(editor.closes[0]?.id ?? 0);
    await session.clock.advance(0);
    expect(editor.closes).toEqual([]);
    expect(items.get('I_1')?.state).toBe('OPEN');

    held.resolve();
    await closed;
    expect(await undone).toEqual({ failed: [] });
    expect(github.mutations().map(mutation => mutation.operation)).toEqual(['CloseIssue', 'ReopenIssue']);
    expect(items.getStored('I_1')?.state).toBe('OPEN');
});

test('a close GitHub refused offers no Undo; its failure says what happened', async () => {
    const { editor, queue, github } = await setup();
    github.keepState = false;

    await editor.edit(['I_1'], { kind: 'close', reason: 'COMPLETED' });

    expect(editor.closes).toEqual([]);
    expect(queue.failures).toHaveLength(1);
});

test('only closing offers Undo: not reopening, nor an item closed already', async () => {
    const { editor } = await setup();

    await editor.edit(['I_1'], { kind: 'close', reason: 'COMPLETED' });
    editor.forgetClose(editor.closes[0]?.id ?? 0);
    await editor.edit(['I_1'], { kind: 'close', reason: 'NOT_PLANNED' });
    expect(editor.closes).toEqual([]);

    await editor.edit(['I_1'], { kind: 'reopen' });
    expect(editor.closes).toEqual([]);
});

interface SetupOptions {
    /** The browser the session is a tab of, with the other sessions given it. */
    readonly tabs?: TestTabs;
    readonly login?: string;
}

async function setup(options: SetupOptions = {}) {
    const login = options.login ?? `user-${crypto.randomUUID()}`;
    const READS = new Set(['Viewer', 'RepositoryMetadata', 'RepositoryLabel', 'ItemDetail']);
    const received = () => session.github.requests.filter(request => !READS.has(request.operation));
    const github: FakeGitHub = {
        viewer: login,
        token: `gho_${login}`,
        keepLabels: true,
        keepState: true,
        dropFor: new Set(),
        error: null,
        comments: [],
        bodyEditable: true,
        mutations: () => received().map(({ operation, variables }) => ({ operation, variables })),
        tokens: () => received().map(request => request.token),
        hold: promise => {
            session.github.hold = promise;
        },
    };
    let labels: ItemLabel[] = [BUG];
    let state = 'OPEN';

    const session = createTestSession({ login, answer, tabs: options.tabs });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const details = session.container.resolve(ItemDetailStore);
    const repositories = session.container.resolve(RepositoryStore);
    const queue = session.container.resolve(EditQueue);
    const projects = session.container.resolve(ProjectStore);
    const editor = session.container.resolve(ItemEditor);
    const drafts = session.container.resolve(CommentDrafts);
    await items.ready();
    items.upsertMany([stored()]);
    // The pickers read it before anything is edited.
    await repositories.ensure('acme/web');

    return { editor, items, details, projects, queue, drafts, github, session };

    function answer(request: TestGraphQLRequest): TestGraphQLAnswer | undefined {
        if (github.error && !READS.has(request.operation)) {
            return { data: null, errors: [github.error] };
        }

        switch (request.operation) {
            case 'RepositoryMetadata':
                return { data: repositoryMetadata() };
            case 'RepositoryLabel': {
                const data: RepositoryLabelQuery = {
                    repository: {
                        label:
                            request.variables.label === WONTFIX.name
                                ? { id: 'LA_wontfix', ...WONTFIX, description: null }
                                : null,
                    },
                };
                return { data };
            }
            case 'ItemDetail':
                return {
                    data: {
                        node: {
                            ...sampleIssueDetailNode(String(request.variables.id), BEFORE),
                            viewerCanUpdate: github.bodyEditable,
                            commentPage: {
                                totalCount: github.comments.length,
                                pageInfo: { hasPreviousPage: false, startCursor: null },
                                nodes: github.comments,
                            },
                            projectItems: { nodes: [place()] },
                        },
                    },
                };
            case 'SetProjectFieldValue': {
                // Answers with the value of the field named; the item's other values are not in it.
                const data: SetProjectFieldValueMutation = {
                    updateProjectV2ItemFieldValue: {
                        projectV2Item: {
                            id: 'PVTI_1',
                            updatedAt: CONFIRMED,
                            fieldValueByName:
                                request.variables.fieldName === 'Status'
                                    ? {
                                          __typename: 'ProjectV2ItemFieldSingleSelectValue',
                                          field: { id: 'F_status' },
                                          optionId: 'O_done',
                                          name: 'Done',
                                          color: 'GREEN',
                                      }
                                    : null,
                        },
                    },
                };
                return { data };
            }
            case 'AddLabels':
            case 'RemoveLabels':
                return answerLabels(request);
            case 'CloseIssue':
            case 'ReopenIssue': {
                const closing = request.operation === 'CloseIssue';
                state = github.keepState === closing ? 'CLOSED' : 'OPEN';
                const issue = {
                    id: request.variables.issueId,
                    updatedAt: CONFIRMED,
                    state,
                    stateReason: closing ? request.variables.stateReason : 'REOPENED',
                    closedAt: state === 'CLOSED' ? CONFIRMED : null,
                };
                return { data: closing ? { closeIssue: { issue } } : { reopenIssue: { issue } } };
            }
            case 'AddComment':
                return {
                    data: {
                        addComment: {
                            commentEdge: {
                                node: {
                                    id: 'IC_new',
                                    url: 'https://github.com/acme/web/issues/1#issuecomment-1',
                                    createdAt: CONFIRMED,
                                    lastEditedAt: null,
                                    author: { login, avatarUrl: `https://avatars.test/${login}` },
                                    body: 'Fixed in <b>#12</b>',
                                    bodyHTML: '<p>Fixed in <b>#12</b></p>',
                                    viewerCanUpdate: true,
                                    viewerCanDelete: true,
                                },
                            },
                        },
                    },
                };
            case 'UpdateIssueComment': {
                github.comments = github.comments.map(comment =>
                    comment.id === request.variables.id
                        ? {
                              ...comment,
                              body: String(request.variables.body),
                              bodyHTML: `<p>${String(request.variables.body)}</p>`,
                              lastEditedAt: CONFIRMED,
                          }
                        : comment,
                );
                const issueComment = github.comments.find(comment => comment.id === request.variables.id) ?? null;
                return { data: { updateIssueComment: { issueComment } } };
            }
            case 'DeleteIssueComment':
                github.comments = github.comments.filter(comment => comment.id !== request.variables.id);
                return { data: { deleteIssueComment: { clientMutationId: null } } };
            case 'UpdateIssueBody': {
                const body = String(request.variables.body);
                const issue = {
                    id: request.variables.id,
                    updatedAt: CONFIRMED,
                    lastEditedAt: CONFIRMED,
                    body,
                    bodyHTML: `<p>${body}</p>`,
                };
                return { data: { updateIssue: { issue } } };
            }
            default:
                return undefined;
        }
    }

    function answerLabels(request: TestGraphQLRequest): TestGraphQLAnswer {
        const id = String(request.variables.labelableId);
        const adding = request.operation === 'AddLabels';
        const name = String(request.variables.labelIds).replace('LA_', '');
        const dropped = !github.keepLabels || github.dropFor.has(id);
        if (!dropped) {
            labels = adding
                ? [...labels.filter(label => label.name !== name), REGRESSION]
                : labels.filter(label => label.name !== name);
        }

        const labelable = {
            __typename: 'Issue',
            id,
            updatedAt: CONFIRMED,
            labels: { nodes: (dropped ? [BUG] : labels).map(label => ({ id: `LA_${label.name}`, ...label })) },
        };
        return {
            data: adding ? { addLabelsToLabelable: { labelable } } : { removeLabelsFromLabelable: { labelable } },
        };
    }
}

/** A comment on I_1 as GitHub reads it; the viewer may edit and delete it unless told otherwise. */
function sampleComment(
    id: string,
    body: string,
    overrides: Partial<IssueCommentFieldsFragment> = {},
): IssueCommentFieldsFragment {
    return {
        id,
        url: `https://github.com/acme/web/issues/1#issuecomment-${id}`,
        createdAt: BEFORE,
        lastEditedAt: null,
        author: { login: 'octocat', avatarUrl: 'https://avatars.test/octocat' },
        body,
        bodyHTML: `<p>${body}</p>`,
        viewerCanUpdate: true,
        viewerCanDelete: true,
        ...overrides,
    };
}

/** An edit of `itemId` drawing nothing, that GitHub answers with `answer`. */
function sampleEdit(itemId: string, answer: EditAnswer): Edit {
    return {
        itemId,
        reference: `acme/web#${itemId}`,
        subject: { kind: 'merged' },
        optimistic: { item: current => current },
        send: () => Promise.resolve(answer),
    };
}

function stored(id = 'I_1'): IssueItem {
    return { ...sampleIssue(id), labels: [BUG], updatedAt: BEFORE };
}

/** I_1 in the tracked project, as a sync read it before any edit. */
function projectItem(): ProjectItem {
    return {
        itemId: 'PVTI_1',
        projectId: 'PVT_1',
        contentId: 'I_1',
        draft: null,
        values: { F_status: { kind: 'singleSelect', optionId: 'O_todo', name: 'Todo', color: 'GRAY' } },
        updatedAt: BEFORE,
        isArchived: false,
    };
}

/** I_1's place in a project: its Status, and a note the field edits leave alone. */
function place(): ProjectItemDetailFieldsFragment {
    return {
        id: 'PVTI_1',
        isArchived: false,
        updatedAt: BEFORE,
        project: {
            id: 'PVT_1',
            title: 'Roadmap',
            number: 3,
            url: 'https://github.com/orgs/acme/projects/3',
            viewerCanUpdate: true,
            fields: {
                nodes: [
                    {
                        id: 'F_status',
                        name: 'Status',
                        dataType: 'SINGLE_SELECT',
                        options: [
                            { id: 'O_todo', name: 'Todo', color: 'GRAY' },
                            { id: 'O_done', name: 'Done', color: 'GREEN' },
                        ],
                    },
                    { id: 'F_note', name: 'Note', dataType: 'TEXT' },
                ],
            },
        },
        fieldValueByName: { name: 'Todo', color: 'GRAY', optionId: 'O_todo' },
        fieldValues: {
            nodes: [
                {
                    __typename: 'ProjectV2ItemFieldSingleSelectValue',
                    field: { id: 'F_status' },
                    optionId: 'O_todo',
                    name: 'Todo',
                    color: 'GRAY',
                },
                { __typename: 'ProjectV2ItemFieldTextValue', field: { id: 'F_note' }, text: 'Ship it' },
            ],
        },
    };
}

function readOnlyRepository(): IssueItem['repository'] {
    return { nameWithOwner: 'acme/web', owner: 'acme', isPrivate: false, viewerPermission: 'READ' };
}

function repositoryMetadata(): RepositoryMetadataQuery {
    return {
        repository: {
            id: 'R_web',
            nameWithOwner: 'acme/web',
            // The row's permission decides for I_3 (READ); the repository's as read here would say WRITE.
            viewerPermission: null,
            isArchived: false,
            hasIssuesEnabled: true,
            mergeCommitAllowed: true,
            squashMergeAllowed: true,
            rebaseMergeAllowed: true,
            viewerDefaultMergeMethod: 'MERGE',
            autoMergeAllowed: false,
            deleteBranchOnMerge: false,
            viewerDefaultCommitEmail: null,
            viewerPossibleCommitEmails: [],
            labels: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                    { id: 'LA_bug', ...BUG, description: null },
                    { id: 'LA_regression', ...REGRESSION, description: null },
                ],
            },
            milestones: { totalCount: 0, nodes: [] },
            assignableUsers: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
            issueTypes: { nodes: [] },
        },
    };
}
