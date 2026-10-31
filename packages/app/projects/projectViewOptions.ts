import type { ItemProperty } from '@/lists/ItemProperty.js';
import type { ListLayout, ListViewOptions } from '@/lists/ListTypes.js';
import type { ListViewChoices } from '@/lists/useListViewOptions.js';
import type { ProjectField } from '@/store/ItemDetailTypes.js';

import type { Project, ProjectFieldRef, ProjectView } from './ProjectTypes.js';

/**
 * What a project's items are grouped by: nothing, one of GitHub's own properties, or one of the project's fields
 * (`field:<id>`). On the board, the grouping is the columns.
 */
export type ProjectGrouping = 'assignees' | 'milestone' | 'none' | 'repository' | `field:${string}`;

/** A key a project's items are ordered by: the title, one of GitHub's own properties, or a field (`field:<id>`). */
export type ProjectSortKey = 'assignees' | 'milestone' | 'repository' | 'title' | `field:${string}`;

/** One key of a project's order and its direction. */
export interface ProjectSortLevel {
    readonly key: ProjectSortKey;
    readonly direction: 'asc' | 'desc';
}

/**
 * How a project's items are ordered: `manual` — GitHub's own order of the project — or keys with their direction,
 * written `field:<id>:asc,title:desc`; the saved view's order may have more than one.
 */
export type ProjectSort = string;

/** What a row or card of a project shows: GitHub's own properties, or a field's value (`field:<id>`). */
export type ProjectProperty = Exclude<ItemProperty, 'projectField' | 'size'> | `field:${string}`;

/** A project view's options as githq shows them (D13). */
export type ProjectViewOptions = ListViewOptions<ProjectGrouping>;

/** What a saved view's options are in githq, and what githq could not take from it. */
export interface ProjectViewDefaults {
    readonly options: ProjectViewOptions;
    /** A roadmap on GitHub: githq has no roadmap and shows it as a list. */
    readonly roadmap: boolean;
}

/** GitHub's own properties a row of a project may show, in the order the display options list them. */
const ITEM_PROPERTIES = ['status', 'labels', 'milestone', 'people', 'updated'] as const satisfies ProjectProperty[];

/** The order of a project when its view sets none: GitHub's own (manual) order of the items. */
export const MANUAL_SORT = 'manual';

/**
 * A saved view as githq's view options (D13): its layout (a roadmap as a list), its grouping — on a board the
 * column field, in a table the group-by field — its order, the fields it shows and its filter. A board without a field to
 * make columns from (K7) is shown as a list.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectViewDefaults(project: Project, view: ProjectView): ProjectViewDefaults {
    const columns = getColumnGrouping(project, view);
    const board = view.layout === 'BOARD_LAYOUT' && columns !== null;
    const layout: ListLayout = board ? 'board' : 'list';
    const grouping = board ? columns : (toGrouping(project, view.groupBy[0]) ?? 'none');
    const sort = view.sortBy
        .flatMap(level => {
            const key = toSortKey(project, level.field);
            return key ? [{ key, direction: level.direction === 'DESC' ? 'desc' : 'asc' } as const] : [];
        })
        .map(level => `${level.key}:${level.direction}`)
        .join(',');
    const properties = new Set<ProjectProperty>(['status']);
    for (const field of view.fields) {
        const property = toProperty(project, field);
        if (property) {
            properties.add(property);
        }
    }

    return {
        options: {
            layout,
            grouping,
            sort: sort || MANUAL_SORT,
            properties: [...properties],
            filter: view.filter?.trim() ?? '',
        },
        roadmap: view.layout === 'ROADMAP_LAYOUT',
    };
}

/**
 * The board's columns as the view sets them (its column field); else the project's row field, else its first
 * single select or iteration field. `null`: nothing to make columns from (K7).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getColumnGrouping(project: Project, view: ProjectView | null): ProjectGrouping | null {
    const set = view ? toGrouping(project, view.verticalGroupBy[0]) : null;
    if (set && isColumnGrouping(project, set)) {
        return set;
    }

    const field =
        project.fields.find(candidate => candidate.kind === 'singleSelect' && candidate.name === 'Status') ??
        project.fields.find(candidate => candidate.kind === 'singleSelect') ??
        project.fields.find(candidate => candidate.kind === 'iteration');
    return field ? `field:${field.id}` : null;
}

/**
 * Whether a board's columns can be made of the grouping: a single select or an iteration field, as on GitHub.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isColumnGrouping(project: Project, grouping: ProjectGrouping) {
    const field = getGroupingField(project, grouping);
    return field?.kind === 'singleSelect' || field?.kind === 'iteration';
}

/**
 * What a project's view options may be set to: its groupings, the orders by each key both ways (and the saved
 * view's own, which may have several keys), and the properties.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectViewChoices(
    project: Project,
    defaults: ProjectViewOptions,
): ListViewChoices<ProjectGrouping, string> {
    const groupings: ProjectGrouping[] = ['none', 'repository', 'milestone', 'assignees'];
    const sortKeys: ProjectSortKey[] = ['title', 'repository', 'milestone', 'assignees'];
    const fieldProperties: ProjectProperty[] = [];
    for (const field of project.fields) {
        if (field.kind !== 'multiSelect') {
            groupings.push(`field:${field.id}`);
            sortKeys.push(`field:${field.id}`);
        }

        fieldProperties.push(`field:${field.id}`);
    }

    const sorts = new Set<ProjectSort>([MANUAL_SORT, defaults.sort]);
    for (const key of sortKeys) {
        sorts.add(`${key}:asc`);
        sorts.add(`${key}:desc`);
    }

    return { groupings, sorts: [...sorts], properties: [...ITEM_PROPERTIES, ...fieldProperties] };
}

/**
 * The levels of an order as written (`field:<id>:asc,title:desc`); none for the manual order, a level naming
 * what the project no longer has left out.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseProjectSort(project: Project, sort: ProjectSort): ProjectSortLevel[] {
    if (sort === MANUAL_SORT) {
        return [];
    }

    const levels: ProjectSortLevel[] = [];
    for (const part of sort.split(',')) {
        const separator = part.lastIndexOf(':');
        const key = toKnownSortKey(project, part.slice(0, separator));
        const direction = part.slice(separator + 1);
        if (key && (direction === 'asc' || direction === 'desc')) {
            levels.push({ key, direction });
        }
    }

    return levels;
}

/**
 * The project field a grouping, an order's key or a property names; `undefined` for GitHub's own.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getGroupingField(project: Project, key: string): ProjectField | undefined {
    return key.startsWith('field:') ? project.fields.find(field => `field:${field.id}` === key) : undefined;
}

function toGrouping(project: Project, ref: ProjectFieldRef | undefined): ProjectGrouping | null {
    if (!ref) {
        return null;
    }

    const field = project.fields.find(candidate => candidate.id === ref.id);
    if (field) {
        return field.kind === 'multiSelect' ? null : `field:${field.id}`;
    }

    // GitHub's own fields, by the name GitHub gives them.
    switch (ref.name) {
        case 'Assignees':
            return 'assignees';
        case 'Milestone':
            return 'milestone';
        case 'Repository':
            return 'repository';
        default:
            return null;
    }
}

function toSortKey(project: Project, ref: ProjectFieldRef): ProjectSortKey | null {
    if (project.fields.some(field => field.id === ref.id && field.kind !== 'multiSelect')) {
        return `field:${ref.id}`;
    }

    switch (ref.name) {
        case 'Title':
            return 'title';
        case 'Assignees':
            return 'assignees';
        case 'Milestone':
            return 'milestone';
        case 'Repository':
            return 'repository';
        default:
            return null;
    }
}

function toKnownSortKey(project: Project, key: string): ProjectSortKey | null {
    switch (key) {
        case 'title':
        case 'assignees':
        case 'milestone':
        case 'repository':
            return key;
        default:
            return getGroupingField(project, key) ? `field:${key.slice('field:'.length)}` : null;
    }
}

function toProperty(project: Project, ref: ProjectFieldRef): ProjectProperty | null {
    if (project.fields.some(field => field.id === ref.id)) {
        return `field:${ref.id}`;
    }

    switch (ref.name) {
        case 'Assignees':
            return 'people';
        case 'Labels':
            return 'labels';
        case 'Milestone':
            return 'milestone';
        default:
            return null;
    }
}

/**
 * Whether a property is one of GitHub's own a row shows, rather than a field's.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isItemProperty(property: string): property is (typeof ITEM_PROPERTIES)[number] {
    return ITEM_PROPERTIES.some(known => known === property);
}
