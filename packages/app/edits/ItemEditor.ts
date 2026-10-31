import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import type { RepositoryNames } from '@/repos/RepositoryStore.js';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import { Clock } from '@/services/Clock.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import { isPendingItem } from '@/store/isPendingItem.js';

import { CommentDrafts } from './CommentDrafts.js';
import { createDraftFieldEdit } from './createDraftFieldEdit.js';
import { createDraftIssueEdit } from './createDraftIssueEdit.js';
import { createIssueEdit } from './createIssueEdit.js';
import type { NewIssueInput, NewIssueProject } from './createIssueEdit.js';
import { createItemEdits } from './createItemEdits.js';
import { EditQueue } from './EditQueue.js';
import type { EditAccount, EditOutcome, FailedEdit } from './EditQueue.js';
import type { Edit, EditRequest, ItemEditRequest, ProjectFieldInput } from './EditTypes.js';
import { getEditPermissions } from './getEditPermissions.js';
import type { EditPermissions } from './getEditPermissions.js';

/**
 * Turns what the user asks for — in the item view, or for every item selected in a list — into edits of each
 * item and sends them ({@link EditQueue}). An item the user may not edit that way is not edited: it is reported
 * as failed with the rest (K2), never sent.
 */
export type ItemEditor = Resolved<typeof ItemEditor>;
export const ItemEditor = defineService({
    name: 'ItemEditor',
    deps: {
        auth: AuthStore,
        details: ItemDetailStore,
        items: ItemStore,
        projects: ProjectStore,
        repositories: RepositoryStore,
        queue: EditQueue,
        overlay: ItemOverlay,
        drafts: CommentDrafts,
        clock: Clock,
    },
    setup({ auth, details, items, projects, repositories, queue, overlay, drafts, clock }) {
        let nextDraft = 1;
        let nextIssue = 1;

        return { getPermissions, getPlaces, edit, addDraftIssue, setDraftField, createIssue };

        /** What the user may edit of the item, by their role in its repository; reactive. */
        function getPermissions(item: Item): EditPermissions {
            const metadata = repositories.get(item.repository.nameWithOwner);
            return getEditPermissions({
                item,
                viewerLogin: auth.viewer?.login ?? '',
                permission: metadata?.viewerPermission ?? item.repository.viewerPermission,
                archived: metadata?.isArchived,
            });
        }

        /**
         * Makes the change of every item that is in memory; resolves with what failed once GitHub answered. Dropped
         * when the user signs out or another account signs in while it is being made: it is built from the ids read
         * for the account that asked.
         */
        async function edit(itemIds: readonly string[], request: EditRequest): Promise<EditOutcome> {
            const viewer = auth.viewer;
            const token = auth.token;
            if (!viewer || token === null) {
                return { failed: [] };
            }

            const account: EditAccount = { login: viewer.login, token };

            const edits: Edit[] = [];
            // By repository: the items of a selection in one repository look the same names up once.
            const prepared = new Map<string, Promise<PreparedMetadata>>();
            let itemCount = 0;
            for (const id of itemIds) {
                const resolved = await resolveItem(id, request);
                if (!resolved) {
                    continue;
                }

                const { item } = resolved;
                itemCount++;
                const places = getPlaces(item);
                const itemRequest = toItemRequest(resolved.request, places);
                let metadata: PreparedMetadata = { metadata: null, unreachable: false };
                if (needsMetadata(request)) {
                    const name = item.repository.nameWithOwner;
                    const preparing = prepared.get(name) ?? prepareMetadata(name, request);
                    prepared.set(name, preparing);
                    metadata = await preparing;
                }

                if (!isSignedIn(account)) {
                    return { failed: [] };
                }

                const madeEdits = createItemEdits({
                    request: itemRequest,
                    item,
                    projects: places,
                    metadata: metadata.metadata,
                    viewer: { login: viewer.login, avatarUrl: viewer.avatarUrl },
                    now: new Date(clock.now()).toISOString(),
                });
                const allowed = isAllowed(getPermissions(item), itemRequest, places);
                for (const made of madeEdits) {
                    if (!allowed) {
                        edits.push(notAllowed(made));
                    } else {
                        edits.push(metadata.unreachable ? unreachable(made) : made);
                    }
                }
            }

            const outcome = await queue.submit({ edits, account, itemCount });
            // Something it named is gone from GitHub: the pickers are read again, not to offer it any more.
            const stale = new Set<string>();
            for (const { edit: failed, reason } of outcome.failed) {
                if (reason.kind === 'missing') {
                    stale.add(failed.reference.split('#')[0] ?? '');
                }

                // A comment not posted goes back into its empty box; over new text, its toast offers to restore it.
                if (failed.subject.kind === 'comment' && isSignedIn(account) && !drafts.get(failed.itemId).trim()) {
                    drafts.set(failed.itemId, failed.subject.body);
                }
            }

            for (const name of stale) {
                void repositories.ensure(name, 0);
            }

            return outcome;
        }

        /**
         * The item the edit is made of. An issue still being created (selected, or moved on the board, before GitHub
         * answered) is waited for, and the edit made of the issue GitHub created — a field of its place in a project
         * becomes that of the created issue's place — so it is never sent with the temporary id. `null` for an item
         * not in memory, or an issue GitHub did not create (that failure is reported with the creation).
         */
        async function resolveItem(id: string, request: EditRequest): Promise<ResolvedItem | null> {
            const item = details.getItem(id);
            if (!item || !isPendingItem(item)) {
                return item ? { item, request } : null;
            }

            await queue.settled(id);
            const confirmedId = overlay.getConfirmedId(id);
            const created = confirmedId === null ? undefined : details.getItem(confirmedId);
            if (!created) {
                return null;
            }

            const place =
                request.kind === 'projectField'
                    ? item.projects.find(candidate => candidate.itemId === request.projectItemId)
                    : undefined;
            if (request.kind !== 'projectField' || !place) {
                return { item: created, request };
            }

            return {
                item: created,
                request: {
                    kind: 'projectFieldInProject',
                    projectId: place.projectId,
                    fieldId: request.fieldId,
                    value: request.value,
                },
            };
        }

        /**
         * The item's places in projects with their fields: as its detail read them, and — for a tracked project the
         * detail does not have (not read yet) — as the project holds them. Reactive.
         */
        function getPlaces(item: Item): ItemDetailProject[] {
            const places = [...(details.get(item.id)?.projects ?? [])];
            for (const place of item.projects) {
                const project = projects.get(place.projectId);
                const stored = projects.getStoredItem(place.itemId);
                if (!project || !stored || places.some(other => other.itemId === place.itemId)) {
                    continue;
                }

                places.push({
                    itemId: place.itemId,
                    projectId: project.id,
                    title: project.title,
                    number: project.number,
                    url: project.url,
                    updatedAt: stored.updatedAt,
                    viewerCanUpdate: project.viewerCanUpdate,
                    fields: project.fields,
                    values: stored.values,
                });
            }

            return places;
        }

        /**
         * Adds a draft issue to a tracked project: it shows there at once and stays once GitHub took it; resolves
         * with what failed. Nothing when the project is not tracked or the user may not write to it.
         */
        async function addDraftIssue(projectId: string, draft: DraftIssueInput): Promise<EditOutcome> {
            const viewer = auth.viewer;
            const token = auth.token;
            const project = projects.get(projectId);
            if (!viewer || token === null || !project?.viewerCanUpdate || !draft.title.trim()) {
                return { failed: [] };
            }

            const adding = createDraftIssueEdit({
                project,
                title: draft.title.trim(),
                body: draft.body,
                now: new Date(clock.now()).toISOString(),
                temporaryId: `pending:draft:${nextDraft++}`,
                values: (draft.values ?? []).flatMap(({ fieldId, value }) => {
                    const field = project.fields.find(candidate => candidate.id === fieldId);
                    return field ? [{ field, value }] : [];
                }),
            });
            return await queue.submit({ edits: [adding], account: { login: viewer.login, token }, itemCount: 1 });
        }

        /**
         * Sets a field of a draft issue in a tracked project (a card moved to another column); resolves with what
         * failed. Like an issue's project field, it needs only the right to update the project (D14). Nothing for a
         * draft still on its way to GitHub or a project not tracked.
         */
        async function setDraftField(
            projectItemId: string,
            fieldId: string,
            value: ProjectFieldInput | null,
        ): Promise<EditOutcome> {
            const viewer = auth.viewer;
            const token = auth.token;
            const stored = projects.getStoredItem(projectItemId);
            const project = stored && projects.get(stored.projectId);
            const field = project?.fields.find(candidate => candidate.id === fieldId);
            const item = project && projects.getItems(project.id).find(candidate => candidate.itemId === projectItemId);
            if (!viewer || token === null || !project || !field || !item?.draft) {
                return { failed: [] };
            }

            const setting = createDraftFieldEdit({ project, item, field, value });
            return await queue.submit({
                edits: [project.viewerCanUpdate ? setting : notAllowed(setting)],
                account: { login: viewer.login, token },
                itemCount: 1,
            });
        }

        /**
         * Creates an issue (H1, H3): it shows at once wherever it belongs and GitHub's issue takes its place
         * ({@link createIssueEdit}). Resolves once GitHub answered: `created: false` when it did not create it — the
         * caller keeps the text (H9) — with what failed, also listed with the other failures (toast, status bar).
         */
        async function createIssue(request: CreateIssueRequest): Promise<CreateIssueOutcome> {
            const viewer = auth.viewer;
            const token = auth.token;
            if (!viewer || token === null) {
                return { created: false, failed: [] };
            }

            const account: EditAccount = { login: viewer.login, token };
            const { issue } = request;
            const kept = repositories.get(request.repository) ?? (await repositories.ensure(request.repository));
            // Labels and people past the pages the pickers read are looked up by name.
            const metadata =
                kept &&
                (await repositories
                    .complete(kept, { labels: issue.labels, logins: issue.assignees })
                    .catch(() => kept));

            if (!isSignedIn(account)) {
                return { created: false, failed: [] };
            }

            const temporaryId = `pending:issue:${nextIssue++}`;
            const creating: Edit = metadata
                ? createIssueEdit({
                      repository: metadata,
                      isPrivate: items.all.some(
                          item => item.repository.nameWithOwner === request.repository && item.repository.isPrivate,
                      ),
                      issue,
                      projects: request.projects.flatMap(project => toNewIssueProject(project)),
                      viewer: { login: viewer.login, avatarUrl: viewer.avatarUrl },
                      now: new Date(clock.now()).toISOString(),
                      temporaryId,
                  })
                : {
                      itemId: temporaryId,
                      reference: request.repository,
                      subject: { kind: 'issueCreated', repository: request.repository, title: issue.title },
                      optimistic: { item: item => item },
                      // GitHub does not show the user the repository (any more).
                      failure: { kind: 'missing' },
                  };
            const outcome = await queue.submit({ edits: [creating], account, itemCount: 1 });
            return { created: !outcome.failed.some(failed => failed.edit === creating), failed: outcome.failed };
        }

        /** A project the issue is added to, with its fields as githq knows them; nothing for one it does not know. */
        function toNewIssueProject(project: CreateIssueProject): NewIssueProject[] {
            const tracked = projects.get(project.projectId);
            if (tracked) {
                return [
                    {
                        id: tracked.id,
                        title: tracked.title,
                        number: tracked.number,
                        url: tracked.url,
                        tracked: true,
                        values: project.values.flatMap(({ fieldId, value }) => {
                            const field = tracked.fields.find(candidate => candidate.id === fieldId);
                            return field ? [{ field, value }] : [];
                        }),
                    },
                ];
            }

            const known = repositories.viewerProjects?.find(candidate => candidate.id === project.projectId);
            return known
                ? [
                      {
                          id: known.id,
                          title: known.title,
                          number: known.number,
                          url: known.url,
                          tracked: false,
                          values: [],
                      },
                  ]
                : [];
        }

        function isSignedIn(account: EditAccount) {
            return auth.viewer?.login === account.login && auth.token === account.token;
        }

        /**
         * The metadata in memory, however old — the pickers showed it — or read now; with the labels and users the
         * request names looked up when it does not hold them (past the pages read, or made since).
         */
        async function prepareMetadata(name: string, request: EditRequest): Promise<PreparedMetadata> {
            const metadata = repositories.get(name) ?? (await repositories.ensure(name));
            if (!metadata) {
                return { metadata, unreachable: false };
            }

            try {
                return { metadata: await repositories.complete(metadata, getNames(request)), unreachable: false };
            } catch {
                return { metadata, unreachable: true };
            }
        }
    },
});

/** An issue the user creates. */
export interface CreateIssueRequest {
    /** `owner/name`. */
    readonly repository: string;
    readonly issue: NewIssueInput;
    /** The projects it is added to, with the fields set there. */
    readonly projects: readonly CreateIssueProject[];
}

/** A project a new issue is added to. */
export interface CreateIssueProject {
    readonly projectId: string;
    /** Fields set on it — the column it was started in (H5); only for a tracked project. */
    readonly values: readonly DraftIssueFieldInput[];
}

/** How creating an issue ended. */
export interface CreateIssueOutcome {
    /** GitHub created it (some of its values may still have failed). */
    readonly created: boolean;
    readonly failed: readonly FailedEdit[];
}

/** A draft issue the user writes into a project. */
export interface DraftIssueInput {
    readonly title: string;
    /** Markdown; may be empty. */
    readonly body: string;
    /** Fields set on it — the column or group it is written in. */
    readonly values?: readonly DraftIssueFieldInput[];
}

/** A field set on a draft issue as it is written. */
export interface DraftIssueFieldInput {
    readonly fieldId: string;
    readonly value: ProjectFieldInput;
}

/** An item of an edit, and the request as it is made of it. */
interface ResolvedItem {
    readonly item: Item;
    readonly request: EditRequest;
}

/** The metadata an item's edits are made with. */
interface PreparedMetadata {
    readonly metadata: RepositoryMetadata | null;
    /** A name it does not hold could not be looked up: GitHub did not answer. */
    readonly unreachable: boolean;
}

function needsMetadata(request: EditRequest) {
    switch (request.kind) {
        case 'labels':
        case 'assignees':
        case 'milestone':
        case 'issueType':
        case 'requestReviewers':
            return true;
        case 'close':
        case 'reopen':
        case 'comment':
        case 'projectField':
        case 'projectFieldInProject':
        case 'addToProject':
        case 'draft':
            return false;
        default:
            return assertNever(request);
    }
}

/** The request as the item's edits are made of it: a project's field becomes that of the item's place there. */
function toItemRequest(request: EditRequest, places: readonly ItemDetailProject[]): ItemEditRequest {
    if (request.kind !== 'projectFieldInProject') {
        return request;
    }

    const place = places.find(candidate => candidate.projectId === request.projectId);
    return {
        kind: 'projectField',
        // Not in the project: no place to set it in, reported as not editable.
        projectItemId: place?.itemId ?? '',
        fieldId: request.fieldId,
        value: request.value,
    };
}

/** The labels and users the request names. */
function getNames(request: EditRequest): RepositoryNames {
    switch (request.kind) {
        case 'labels':
            return { labels: [...request.add, ...request.remove], logins: [] };
        case 'assignees':
            return { labels: [], logins: [...request.add, ...request.remove] };
        case 'requestReviewers':
            return { labels: [], logins: request.logins };
        default:
            return { labels: [], logins: [] };
    }
}

/** Whether the user may make the change of the item (D14). */
function isAllowed(permissions: EditPermissions, request: ItemEditRequest, places: readonly ItemDetailProject[]) {
    switch (request.kind) {
        case 'labels':
            return permissions.labels;
        case 'assignees':
            return permissions.assignees;
        case 'milestone':
            return permissions.milestone;
        case 'issueType':
            return permissions.issueType;
        case 'close':
        case 'reopen':
            return permissions.state;
        case 'comment':
            return permissions.comment;
        case 'projectField':
            return places.find(place => place.itemId === request.projectItemId)?.viewerCanUpdate === true;
        case 'addToProject':
            return permissions.addToProject;
        case 'requestReviewers':
            return permissions.reviewers;
        case 'draft':
            return permissions.draft;
        default:
            return assertNever(request);
    }
}

/** An edit naming what could not be looked up: not missing, GitHub did not answer. */
function unreachable(edit: Edit): Edit {
    return edit.failure?.kind === 'missing' ? { ...edit, failure: { kind: 'offline' } } : edit;
}

function notAllowed(edit: Edit): Edit {
    return { ...edit, optimistic: { item: item => item }, send: undefined, failure: { kind: 'notAllowed' } };
}
