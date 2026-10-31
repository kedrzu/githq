/// <reference types="bun" />
// IndexedDB for bun; every test uses its own login, so their databases never meet.
import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';

import type {
    IssueFieldsFragment,
    ProjectFieldFieldsFragment,
    RepositoryPermission,
} from '@githq/github/generated.gen.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import { ItemEditor } from '@/edits/ItemEditor.js';
import { ItemStore } from '@/store/ItemStore.js';
import { toItem } from '@/store/toItem.js';
import type { ItemProject } from '@/store/ItemTypes.js';
import { SyncEngine } from '@/sync/SyncEngine.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { createTrackingWorld, worldProjectItem } from '@/testing/createTrackingWorld.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ProjectStore } from './ProjectStore.js';

const MONDAY = '2026-10-26T10:00:00Z';

test('a field set from a project view shows there at once, and once GitHub keeps it, it is what the project holds', async () => {
    const { session, projects, editor } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;

    // The item was never opened: its project's fields come from the tracked project.
    const done = editor.edit(['I_1'], {
        kind: 'projectField',
        projectItemId: 'PVTI_1',
        fieldId: 'F_status',
        value: { kind: 'singleSelect', optionId: 'O_done' },
    });
    await session.clock.advance(0);
    expect(projects.getItems('PVT_1')[0]?.values.F_status).toMatchObject({ name: 'Done' });
    expect(projects.getStoredItem('PVTI_1')?.values.F_status).toMatchObject({ name: 'Todo' });

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(projects.getStoredItem('PVTI_1')?.values.F_status).toMatchObject({ name: 'Done' });
    expect(projects.getStoredItem('PVTI_1')?.updatedAt).toBe('2026-10-30T13:30:00Z');
});

test('a draft issue shows in its project at once, then as the item GitHub made; one GitHub does not take goes', async () => {
    const { session, projects, editor, world } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;

    const done = editor.addDraftIssue('PVT_1', { title: 'Write the docs', body: '' });
    await session.clock.advance(0);
    expect(projects.getItems('PVT_1').map(item => [item.itemId, item.draft?.title])).toEqual([
        ['PVTI_1', undefined],
        ['pending:draft:1', 'Write the docs'],
    ]);

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(projects.getItems('PVT_1').map(item => [item.itemId, item.draft?.title])).toEqual([
        ['PVTI_1', undefined],
        ['PVTI_draft1', 'Write the docs'],
    ]);

    world.failing.add('AddDraftIssue null');
    const refused = await editor.addDraftIssue('PVT_1', { title: 'Refused', body: '' });
    expect(refused.failed.map(failed => failed.edit.subject)).toEqual([
        { kind: 'draftAdded', project: 'Roadmap', title: 'Refused' },
    ]);
    expect(projects.getItems('PVT_1').map(item => item.itemId)).toEqual(['PVTI_1', 'PVTI_draft1']);
});

test('an item of a repository the user only reads: its project field is set, a label is refused and never sent', async () => {
    const { session, projects, editor } = await setup({ permission: 'READ' });

    const labelled = await editor.edit(['I_1'], { kind: 'labels', add: ['bug'], remove: [] });
    expect(labelled.failed.map(failed => failed.reason)).toEqual([{ kind: 'notAllowed' }]);
    expect(session.github.requests.map(request => request.operation)).not.toContain('AddLabels');

    const moved = await editor.edit(['I_1'], {
        kind: 'projectField',
        projectItemId: 'PVTI_1',
        fieldId: 'F_status',
        value: { kind: 'singleSelect', optionId: 'O_done' },
    });
    expect(moved).toEqual({ failed: [] });
    expect(projects.getStoredItem('PVTI_1')?.values.F_status).toMatchObject({ name: 'Done' });
});

test('a draft written in a column carries the column’s value; moving a draft sets its field', async () => {
    const { session, projects, editor } = await setup();
    const held = createPromise();
    session.github.hold = held.promise;

    const done = editor.addDraftIssue('PVT_1', {
        title: 'Plan the launch',
        body: '',
        values: [{ fieldId: 'F_status', value: { kind: 'singleSelect', optionId: 'O_done' } }],
    });
    await session.clock.advance(0);
    expect(projects.getItems('PVT_1')[1]?.values.F_status).toMatchObject({ name: 'Done' });

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(session.github.requests.map(request => request.operation)).toContain('SetProjectFieldValue');
    await session.clock.advance(0);
    const draft = projects.getItems('PVT_1').find(item => item.draft?.title === 'Plan the launch');
    expect(draft?.itemId).toBe('PVTI_draft1');
    expect(draft?.values.F_status).toMatchObject({ name: 'Done' });

    const moved = await editor.setDraftField('PVTI_draft1', 'F_status', { kind: 'singleSelect', optionId: 'O_todo' });
    expect(moved).toEqual({ failed: [] });
    expect(projects.getItems('PVT_1').find(item => item.itemId === 'PVTI_draft1')?.values.F_status).toMatchObject({
        name: 'Todo',
    });
});

test('an issue added to a project from it shows there at once, and stays once GitHub made its place', async () => {
    const { session, world, items, projects, editor } = await setup();
    const issue = sampleIssueNode('I_2', { repository: 'acme/web', number: 2, updatedAt: MONDAY });
    world.items.set('I_2', issue);
    items.upsertMany([assertValue(toItem(issue))]);
    const held = createPromise();
    session.github.hold = held.promise;

    const project = assertValue(projects.get('PVT_1'));
    const done = editor.edit(['I_2'], { kind: 'addToProject', project });
    await session.clock.advance(0);
    expect(projects.getItems('PVT_1').map(item => item.contentId)).toEqual(['I_1', 'I_2']);

    held.resolve();
    expect(await done).toEqual({ failed: [] });
    expect(projects.getItems('PVT_1').map(item => [item.itemId, item.contentId])).toEqual([
        ['PVTI_1', 'I_1'],
        ['PVTI_added1', 'I_2'],
    ]);
});

test('a project item written after its project was untracked keeps nothing in the copy', async () => {
    const { projects, tracking } = await setup();
    const stored = projects.getStoredItem('PVTI_1');
    expect(projects.holdsContent('I_1')).toBe(true);

    tracking.untrack({ kind: 'project', id: 'PVT_1' });
    // An answer that was on its way lands anyway.
    projects.upsertItems(stored ? [stored] : []);
    expect(projects.getStoredItem('PVTI_1')).toBeDefined();
    expect(projects.holdsContent('I_1')).toBe(false);
});

test('a tab opening before another wrote a project item it changed gets it from it', async () => {
    const tabs = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const first = await setup({ login, tabs });
    const stored = assertValue(first.projects.getStoredItem('PVTI_1'));
    first.projects.upsertItems([{ ...stored, itemId: 'PVTI_2' }]);

    // It reads the copy before the first tab's write: what it finds there lacks `PVTI_2`.
    const second = await setup({ login, tabs });
    await waitUntil(() => second.projects.getStoredItem('PVTI_2') !== undefined, { timeoutMs: 1000, intervalMs: 5 });
});

test('D12: outside a project, its row field shows — "Status", else the first single-select, else the one picked — tracked projects first', async () => {
    const { projects, items } = await setup({
        extraFields: [
            {
                id: 'F_priority',
                name: 'Priority',
                dataType: 'SINGLE_SELECT',
                options: [{ id: 'O_high', name: 'High', color: 'RED' }],
            },
        ],
    });
    const untracked: ItemProject = {
        itemId: 'PVTI_x',
        projectId: 'PVT_other',
        title: 'Elsewhere',
        number: 9,
        url: 'https://github.com/orgs/other/projects/9',
        status: { name: 'Backlog', color: 'BLUE', optionId: 'O_backlog' },
        updatedAt: MONDAY,
    };
    const stored = items.get('I_1');
    const tracked = stored?.projects[0];
    if (!stored || !tracked) {
        throw new Error('I_1 is not in the tracked project');
    }

    const item = { ...stored, projects: [untracked, tracked] };
    const rows = () => projects.withRowFields(item).projects.map(place => [place.title, place.status?.name ?? null]);

    expect(rows()).toEqual([
        ['Roadmap', 'Todo'],
        ['Elsewhere', 'Backlog'],
    ]);

    // Without a "Status", the first single-select.
    const project = projects.get('PVT_1');
    if (!project) {
        throw new Error('PVT_1 is not tracked');
    }

    projects.setProject({ ...project, fields: project.fields.filter(field => field.name !== 'Status') });
    expect(projects.getRowField('PVT_1')?.name).toBe('Priority');
    projects.setProject(project);

    // Picked by the user.
    projects.setRowField('PVT_1', 'F_priority');
    expect(rows()).toEqual([
        ['Roadmap', null],
        ['Elsewhere', 'Backlog'],
    ]);
    expect(projects.getRowField('PVT_1')?.name).toBe('Priority');

    projects.setRowField('PVT_1', null);
    expect(projects.getRowField('PVT_1')).toBeNull();
});

interface SetupOptions {
    /** The project's fields after "Status". */
    readonly extraFields?: readonly ProjectFieldFieldsFragment[];
    /** The user's role in the issue's repository; WRITE by default. */
    readonly permission?: RepositoryPermission;
    /** Signed in as this user; a new one by default. */
    readonly login?: string;
    /** The browser this session is a tab of. */
    readonly tabs?: TestTabs;
}

/** Signs a user in against a world tracking project 1 with one issue in it, and lets its download finish. */
async function setup(options: SetupOptions = {}) {
    const world = createTrackingWorld();
    const base = sampleIssueNode('I_1', { repository: 'acme/web', number: 1, updatedAt: MONDAY });
    const issue = {
        ...base,
        repository: { ...base.repository, viewerPermission: options.permission ?? 'WRITE' },
        projectItems: {
            nodes: [
                {
                    id: 'PVTI_1',
                    isArchived: false,
                    updatedAt: MONDAY,
                    project: {
                        id: 'PVT_1',
                        title: 'Roadmap',
                        number: 1,
                        url: 'https://github.com/orgs/acme/projects/1',
                    },
                    fieldValueByName: { name: 'Todo', color: 'GRAY', optionId: 'O_todo' },
                },
            ],
        },
    } satisfies IssueFieldsFragment;
    world.items.set('I_1', issue);
    world.project.items = [worldProjectItem('PVTI_1', issue, 'O_todo')];
    world.project.fields.push(...(options.extraFields ?? []));

    const session = createTestSession({
        login: options.login ?? `user-${crypto.randomUUID()}`,
        answer: request => world.answer(request),
        answerRest: request => world.answerRest(request),
        tabs: options.tabs,
    });
    setIndexedDbPersistence(session.container);
    const items = session.container.resolve(ItemStore);
    const tracking = session.container.resolve(TrackingStore);
    const projects = session.container.resolve(ProjectStore);
    const editor = session.container.resolve(ItemEditor);
    session.container.resolve(SyncEngine);
    await items.ready();
    await session.clock.advance(0);

    tracking.choose({
        repositories: [{ nameWithOwner: 'acme/web', id: 'R_web' }],
        projects: [{ id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' }],
    });
    world.assigned = [];
    await session.clock.advance(0);

    return { session, world, items, projects, editor, tracking };
}
