/// <reference types="bun" />
// IndexedDB for bun; a browser has its own. Every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type { GitHubGraphQLErrorEntry } from '@githq/github/GitHubApiError.js';
import type {
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
    const expected: Partial<EditFailure> = { itemCount: 1, editCount: 1, toast: true };
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

test('a comment GitHub does not take goes back into its empty box; over new text, it waits to be restored after it', async () => {
    const { editor, details, drafts, github } = await setup();
    await details.ensure('I_1');
    github.error = { type: 'FORBIDDEN', message: 'Commenting is disabled' };

    await editor.edit(['I_1'], { kind: 'comment', body: 'First try' });

    expect(drafts.get('I_1')).toBe('First try');
    expect(details.get('I_1')?.comments.nodes).toEqual([]);

    drafts.set('I_1', 'Something new');
    const outcome = await editor.edit(['I_1'], { kind: 'comment', body: 'Second try' });

    expect(drafts.get('I_1')).toBe('Something new');
    // Its toast offers to restore it; restored, it follows what was typed.
    expect(outcome.failed.map(failed => failed.edit.subject)).toEqual([{ kind: 'comment', body: 'Second try' }]);
    drafts.restore('I_1', 'Second try');
    expect(drafts.get('I_1')).toBe('Something new\n\nSecond try');
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
                                    bodyHTML: '<p>Fixed in <b>#12</b></p>',
                                },
                            },
                        },
                    },
                };
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
