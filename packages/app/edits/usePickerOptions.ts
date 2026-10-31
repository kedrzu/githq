import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { PickerOption } from '@/components/Picker.vue';
import type { RepositoryMetadata } from '@/repos/RepositoryTypes.js';
import type { ProjectField, ProjectIteration } from '@/store/ItemDetailTypes.js';
import { formatShortDate } from '@/utils/formatShortDate.js';
import { getGitHubColor } from '@/utils/getGitHubColor.js';
import { isCurrentIteration } from '@/utils/isCurrentIteration.js';

import * as l from './usePickerOptions.loc.js';

/** The options of the pickers of an item's own properties, by name: of one repository, or all of a selection's. */
export interface PickerOptions {
    labels(repositories: readonly RepositoryMetadata[]): PickerOption[];
    /** The signed-in user first ("assign to me"). */
    assignees(repositories: readonly RepositoryMetadata[], viewerLogin: string): PickerOption[];
    /** With their due dates. */
    milestones(repositories: readonly RepositoryMetadata[]): PickerOption[];
    issueTypes(repositories: readonly RepositoryMetadata[]): PickerOption[];
    /**
     * A project field's values, by id: a single-select's options with their colours; an iteration field's last
     * completed iteration, then the current and coming ones, with their dates (`now` tells which is current).
     * None for a field of other values.
     */
    projectField(field: ProjectField, now: number): PickerOption[];
}

const DAY = 24 * 60 * 60_000;

/**
 * The options of the property pickers (A, L, M, the type, a project's fields — S, P, I). Several repositories offer each name once — a
 * selection's items are edited by name, each in its own repository.
 */
export function usePickerOptions(): PickerOptions {
    const t = useTranslate();

    return {
        labels: repositories =>
            unique(
                repositories.flatMap(repository => repository.labels),
                label => label.name,
            ).map(label => ({
                value: label.name,
                label: label.name,
                color: label.color,
            })),
        assignees: (repositories, viewerLogin) => {
            const users = unique(
                repositories.flatMap(repository => repository.assignableUsers),
                user => user.login,
            );
            const me = users.filter(user => user.login === viewerLogin);
            const others = users.filter(user => user.login !== viewerLogin);
            return [...me, ...others].map(user => ({
                value: user.login,
                label: user.login,
                detail: user.login === viewerLogin ? t(l.you) : undefined,
                avatarUrl: user.avatarUrl,
            }));
        },
        milestones: repositories =>
            unique(
                repositories.flatMap(repository => repository.milestones),
                milestone => milestone.title,
            ).map(milestone => ({
                value: milestone.title,
                label: milestone.title,
                detail: milestone.dueOn ? t(l.due, { date: formatShortDate(Date.parse(milestone.dueOn)) }) : undefined,
            })),
        issueTypes: repositories =>
            unique(
                repositories.flatMap(repository => repository.issueTypes),
                issueType => issueType.name,
            ).map(issueType => ({
                value: issueType.name,
                label: issueType.name,
                color: getGitHubColor(issueType.color),
            })),
        projectField,
    };

    function projectField(field: ProjectField, now: number): PickerOption[] {
        switch (field.kind) {
            case 'singleSelect':
                return field.options.map(option => ({
                    value: option.id,
                    label: option.name,
                    color: getGitHubColor(option.color),
                }));
            case 'iteration': {
                const previous = field.completedIterations.toSorted((a, b) =>
                    b.startDate.localeCompare(a.startDate),
                )[0];
                const iterations = previous ? [previous, ...field.iterations] : field.iterations;
                return iterations.map(iteration => ({
                    value: iteration.id,
                    label: iteration.title,
                    detail: describeIteration(iteration, iteration === previous, now),
                }));
            }
            default:
                return [];
        }
    }

    function describeIteration(iteration: ProjectIteration, previous: boolean, now: number) {
        const start = Date.parse(iteration.startDate);
        const range = `${formatShortDate(start)} – ${formatShortDate(start + (iteration.duration - 1) * DAY)}`;
        if (previous) {
            return t(l.previousIteration, { range });
        }

        if (isCurrentIteration(iteration, now)) {
            return t(l.currentIteration, { range });
        }

        return range;
    }
}

/** The first of each name. */
function unique<T>(entries: readonly T[], getName: (entry: T) => string): T[] {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const entry of entries) {
        const name = getName(entry);
        if (!seen.has(name)) {
            seen.add(name);
            result.push(entry);
        }
    }

    return result;
}
