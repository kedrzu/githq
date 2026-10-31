import { assertNever } from '@nzyme/utils/assertNever.js';
import { Milestone } from 'lucide-vue-next';

import type { ListGrouping, ListGroupValue } from '@/lists/groupEntries.js';
import { getAssigneeGroupValue, getUngroupedGrouping, groupEntries, NO_VALUE } from '@/lists/groupEntries.js';
import type { ListGroup } from '@/lists/ListTypes.js';
import type { ProjectField, ProjectIteration } from '@/store/ItemDetailTypes.js';
import { compareText } from '@/utils/compareText.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { isCurrentIteration } from '@/utils/isCurrentIteration.js';

import type { ProjectGrouping, ProjectSort, ProjectSortLevel } from './projectViewOptions.js';
import { describeProjectFieldValue } from './describeProjectFieldValue.js';
import { getGroupingField, parseProjectSort } from './projectViewOptions.js';
import type { Project, ProjectEntry } from './ProjectTypes.js';

/** What the groups are called — the caller's translations. */
export interface ProjectListTexts {
    /** The one group when nothing groups the list. */
    readonly all: string;
    /** The group of items without the field's value ("No Status"). */
    noValue(field: string): string;
    readonly unassigned: string;
    readonly noMilestone: string;
    /** The group of draft issues, which have no repository. */
    readonly drafts: string;
    /** An iteration's header detail: its days, and whether it runs now ("Oct 20 – Nov 2 · current"). */
    iterationDetail(iteration: ProjectIteration, current: boolean): string;
}

/** What {@link buildProjectList} lists. */
export interface BuildProjectListParams {
    readonly project: Project;
    /** The entries the view shows, in GitHub's order of the project. */
    readonly entries: readonly ProjectEntry[];
    readonly grouping: ProjectGrouping;
    readonly sort: ProjectSort;
    readonly texts: ProjectListTexts;
    /** Today's UTC day, `YYYY-MM-DD`: which iteration is current. */
    readonly today: string;
}

/**
 * A project view's groups (D4, D5): its entries in the order asked, under the grouped field's values. A single
 * select's options and the current and coming iterations are groups in the project's order even when empty, so
 * every column of a board is there to drop into; entries can be moved between them (setting the field). Other
 * values come in their order, the entries without one last.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildProjectList(params: BuildProjectListParams): ListGroup<ProjectEntry>[] {
    const { project, entries, grouping, sort, texts, today } = params;
    const levels = parseProjectSort(project, sort);
    // Ties — and the manual order — keep GitHub's order of the project.
    const position = new Map(entries.map((entry, index) => [entry.item.itemId, index]));
    const sorted = entries.toSorted(
        (a, b) =>
            compareLevels(project, levels, a, b) ||
            (position.get(a.item.itemId) ?? 0) - (position.get(b.item.itemId) ?? 0),
    );

    return groupEntries({
        entries: sorted,
        getId: getProjectEntryId,
        grouping: getGrouping(project, grouping, texts, today),
    });
}

/**
 * The id an entry is opened, selected and edited by: its issue's or pull request's, a draft's project item id.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getProjectEntryId(entry: ProjectEntry) {
    return entry.content?.id ?? entry.item.itemId;
}

function getGrouping(
    project: Project,
    grouping: ProjectGrouping,
    texts: ProjectListTexts,
    today: string,
): ListGrouping<ProjectEntry> {
    switch (grouping) {
        case 'none':
            return getUngroupedGrouping(texts.all);
        case 'repository':
            return {
                values: entry => {
                    const name = entry.content?.repository.nameWithOwner;
                    return name ? [{ key: name, label: name }] : [];
                },
                none: { key: NO_VALUE, label: texts.drafts },
                movable: false,
            };
        case 'milestone':
            return {
                values: entry => {
                    const milestone = entry.content?.milestone;
                    return milestone
                        ? [{ key: milestone.title, label: milestone.title, marker: { kind: 'icon', icon: Milestone } }]
                        : [];
                },
                none: { key: NO_VALUE, label: texts.noMilestone },
                movable: false,
            };
        case 'assignees':
            return {
                values: entry =>
                    (entry.content?.assignees ?? entry.item.draft?.assignees ?? []).map(getAssigneeGroupValue),
                none: { key: NO_VALUE, label: texts.unassigned },
                movable: false,
            };
        default: {
            const field = getGroupingField(project, grouping);
            return field ? getFieldGrouping(field, texts, today) : getUngroupedGrouping(texts.all);
        }
    }
}

function getFieldGrouping(field: ProjectField, texts: ProjectListTexts, today: string): ListGrouping<ProjectEntry> {
    const none = { key: NO_VALUE, label: texts.noValue(field.name) };
    switch (field.kind) {
        case 'singleSelect':
            return {
                fixed: field.options.map(option => ({
                    key: option.id,
                    label: option.name,
                    marker: { kind: 'color', color: getGitHubColor(option.color) },
                })),
                values: entry => {
                    const value = entry.item.values[field.id];
                    return value?.kind === 'singleSelect' && value.optionId !== null && value.name !== null
                        ? [
                              {
                                  key: value.optionId,
                                  label: value.name,
                                  marker: { kind: 'color', color: getGitHubColor(value.color) },
                              },
                          ]
                        : [];
                },
                none,
                movable: true,
            };
        case 'iteration': {
            const all = [...field.completedIterations, ...field.iterations];
            const starts = new Map(all.map(iteration => [iteration.id, iteration.startDate]));
            const toGroup = (iteration: ProjectIteration): ListGroupValue => ({
                key: iteration.id,
                label: iteration.title,
                detail: texts.iterationDetail(
                    iteration,
                    isCurrentIteration(iteration, Date.parse(`${today}T00:00:00Z`)),
                ),
            });
            return {
                fixed: field.iterations.toSorted(byStart).map(toGroup),
                values: entry => {
                    const value = entry.item.values[field.id];
                    if (value?.kind !== 'iteration') {
                        return [];
                    }

                    const known = all.find(iteration => iteration.id === value.iterationId);
                    return [
                        toGroup(
                            known ?? {
                                id: value.iterationId,
                                title: value.title,
                                startDate: value.startDate,
                                duration: value.duration,
                            },
                        ),
                    ];
                },
                none,
                movable: true,
                compare: (a, b) => compareText(starts.get(a.key) ?? '', starts.get(b.key) ?? ''),
            };
        }
        case 'text':
        case 'number':
        case 'date':
        case 'multiSelect':
            return {
                values: entry => {
                    const value = entry.item.values[field.id];
                    const label = value ? describeProjectFieldValue(value) : null;
                    return label ? [{ key: label, label }] : [];
                },
                none,
                movable: false,
                compare: (a, b) =>
                    field.kind === 'number' ? Number(a.key) - Number(b.key) : a.label.localeCompare(b.label),
            };
        default:
            return assertNever(field);
    }
}

function compareLevels(
    project: Project,
    levels: readonly ProjectSortLevel[],
    a: ProjectEntry,
    b: ProjectEntry,
): number {
    for (const level of levels) {
        const keyA = getSortValue(project, level.key, a);
        const keyB = getSortValue(project, level.key, b);
        // Without a value last, whichever the direction, as on GitHub.
        if (keyA === null || keyB === null) {
            if (keyA !== keyB) {
                return keyA === null ? 1 : -1;
            }

            continue;
        }

        const order =
            typeof keyA === 'number' && typeof keyB === 'number'
                ? keyA - keyB
                : String(keyA).localeCompare(String(keyB));
        if (order !== 0) {
            return level.direction === 'asc' ? order : -order;
        }
    }

    return 0;
}

function getSortValue(project: Project, key: string, entry: ProjectEntry): number | string | null {
    switch (key) {
        case 'title':
            return entry.content?.title ?? entry.item.draft?.title ?? '';
        case 'repository':
            return entry.content?.repository.nameWithOwner ?? null;
        case 'milestone':
            return entry.content?.milestone?.title ?? null;
        case 'assignees':
            return (entry.content?.assignees ?? entry.item.draft?.assignees ?? [])[0]?.login ?? null;
        default: {
            const field = getGroupingField(project, key);
            const value = field ? entry.item.values[field.id] : undefined;
            if (!field || !value) {
                return null;
            }

            switch (value.kind) {
                case 'singleSelect':
                    // In the order of the field's options, as GitHub sorts them.
                    return field.kind === 'singleSelect'
                        ? field.options.findIndex(option => option.id === value.optionId)
                        : null;
                case 'iteration':
                    return value.startDate;
                case 'number':
                    return value.number;
                case 'date':
                    return value.date;
                case 'text':
                    return value.text;
                case 'multiSelect':
                    return value.options[0]?.name ?? null;
                default:
                    return assertNever(value);
            }
        }
    }
}

function byStart(a: ProjectIteration, b: ProjectIteration) {
    return compareText(a.startDate, b.startDate);
}
