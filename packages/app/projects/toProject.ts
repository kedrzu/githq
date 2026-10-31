import type {
    DraftIssueFieldsFragment,
    ProjectFieldFieldsFragment,
    ProjectFieldRefFieldsFragment,
    ProjectItemRowFieldsFragment,
    ProjectViewFieldsFragment,
} from '@githq/github/generated.gen.js';
import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';

import type { Item } from '@/store/ItemTypes.js';
import { toItem, toItemUsers } from '@/store/toItem.js';
import { toProjectField, toProjectFieldValues } from '@/store/toItemDetail.js';

import type {
    Project,
    ProjectDraftIssue,
    ProjectFieldRef,
    ProjectItem,
    ProjectOwnerKind,
    ProjectView,
} from './ProjectTypes.js';

/** What {@link toProject} builds a project from: its own data, as `ProjectFull` or `ProjectSchema` reads it. */
export interface ToProjectParams {
    readonly id: string;
    readonly title: string;
    readonly number: number;
    readonly url: string;
    readonly owner: string;
    readonly ownerKind: ProjectOwnerKind;
    readonly closed: boolean;
    readonly viewerCanUpdate: boolean;
    readonly fields: { readonly nodes: readonly (ProjectFieldFieldsFragment | null)[] | null };
    readonly views: { readonly nodes: readonly (ProjectViewFieldsFragment | null)[] | null };
}

/** A project item and its issue's or pull request's row, as a page of a tracked project reads them. */
export interface ReadProjectItem {
    readonly item: ProjectItem;
    /** `null` for a draft issue, or content GitHub does not show. */
    readonly content: Item | null;
}

/**
 * A tracked project as the local copy keeps it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toProject(params: ToProjectParams): Project {
    return {
        id: params.id,
        title: params.title,
        number: params.number,
        url: params.url,
        owner: params.owner,
        ownerKind: params.ownerKind,
        closed: params.closed,
        viewerCanUpdate: params.viewerCanUpdate,
        fields: mapNotNull(params.fields.nodes ?? [], field => field && toProjectField(field)),
        views: filterNotNull(params.views.nodes ?? []).map(toProjectView),
    };
}

/**
 * A project item of a page (`ProjectItemRowFields`) and the row of its issue or pull request.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toProjectItem(node: ProjectItemRowFieldsFragment, projectId: string): ReadProjectItem {
    const { content } = node;
    const draft = content?.__typename === 'DraftIssue' ? toDraftIssue(content) : null;
    const item = content && content.__typename !== 'DraftIssue' ? toItem(content) : null;
    return {
        item: {
            itemId: node.id,
            projectId,
            contentId: item?.id ?? null,
            draft,
            values: toProjectFieldValues(node.fieldValues.nodes ?? []),
            updatedAt: node.updatedAt,
            isArchived: node.isArchived,
        },
        content: item,
    };
}

/**
 * A draft issue as a project item holds it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toDraftIssue(draft: DraftIssueFieldsFragment): ProjectDraftIssue {
    return {
        id: draft.id,
        title: draft.title,
        body: draft.body,
        assignees: toItemUsers(draft.assignees),
        createdAt: draft.createdAt,
    };
}

function toProjectView(view: ProjectViewFieldsFragment): ProjectView {
    return {
        id: view.id,
        number: view.number,
        name: view.name,
        layout: view.layout,
        filter: view.filter,
        groupBy: toFieldRefs(view.groupByFields?.nodes),
        verticalGroupBy: toFieldRefs(view.verticalGroupByFields?.nodes),
        sortBy: mapNotNull(
            view.sortByFields?.nodes ?? [],
            sort => sort && { field: toFieldRef(sort.field), direction: sort.direction },
        ),
        fields: toFieldRefs(view.fields?.nodes),
    };
}

function toFieldRefs(nodes: readonly (ProjectFieldRefFieldsFragment | null)[] | null | undefined) {
    return mapNotNull(nodes ?? [], node => node && toFieldRef(node));
}

function toFieldRef(field: ProjectFieldRefFieldsFragment): ProjectFieldRef {
    return { id: field.id, name: field.name };
}
