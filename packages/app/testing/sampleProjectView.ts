import type { ListChoice } from '@/lists/ListTypes.js';
import type { ProjectListTexts } from '@/projects/buildProjectList.js';
import { buildProjectList } from '@/projects/buildProjectList.js';
import { compileProjectFilter } from '@/projects/filter/compileProjectFilter.js';
import type { Project, ProjectEntry, ProjectView } from '@/projects/ProjectTypes.js';
import type { ProjectTab } from '@/projects/ProjectView.vue';
import type { ProjectViewOptions } from '@/projects/projectViewOptions.js';
import {
    getProjectViewChoices,
    getProjectViewDefaults,
    getGroupingField,
    parseProjectSort,
} from '@/projects/projectViewOptions.js';
import { selectProjectEntries } from '@/projects/selectProjectEntries.js';

import { SAMPLE_TODAY } from './sampleProject.js';

const TEXTS: ProjectListTexts = {
    all: 'All items',
    noValue: field => `No ${field}`,
    unassigned: 'Unassigned',
    noMilestone: 'No milestone',
    drafts: 'Drafts',
    iterationDetail: (iteration, current) => (current ? `${iteration.title} · current` : iteration.startDate),
};

/** What {@link sampleProjectView} shows. */
export interface SampleProjectViewParams {
    readonly project: Project;
    readonly view: ProjectView | null;
    readonly entries: readonly ProjectEntry[];
    /** The options as changed on this device; the view's own when not given. */
    readonly options?: ProjectViewOptions;
    /** The project item ids GitHub answered a view it evaluates with (K6); `null` while it has not. */
    readonly answered?: ReadonlySet<string> | null;
    /** The tabs marked modified locally. */
    readonly modifiedViews?: readonly number[];
}

/**
 * A project view's props for stories and specs, built as the page builds them: the view's options, its filter
 * evaluated (or GitHub's answer), the groups, the tabs and the orders.
 */
export function sampleProjectView(params: SampleProjectViewParams) {
    const { project, view, entries, answered = null, modifiedViews = [] } = params;
    const defaults = view
        ? getProjectViewDefaults(project, view)
        : {
              options: {
                  layout: 'list',
                  grouping: 'none',
                  sort: 'manual',
                  properties: [],
                  filter: '',
              } satisfies ProjectViewOptions,
              roadmap: false,
          };
    const options = params.options ?? defaults.options;
    const filter = compile(project, options.filter || null, entries);
    const selected = selectProjectEntries({ entries, filter, answered });
    const tabs: ProjectTab[] = project.views.map(saved => ({
        key: saved.id,
        name: saved.name,
        to: `/orgs/${project.owner}/projects/${project.number}/views/${saved.number}`,
        current: saved.number === view?.number,
        modified: modifiedViews.includes(saved.number),
        answered: compile(project, saved.filter, entries).kind === 'github',
    }));
    const sorts: ListChoice[] = getProjectViewChoices(project, defaults.options).sorts.map(sort => ({
        value: sort,
        label:
            parseProjectSort(project, sort)
                .map(
                    level =>
                        `${getGroupingField(project, level.key)?.name ?? level.key} ${level.direction === 'asc' ? '↑' : '↓'}`,
                )
                .join(', ') || "GitHub's order",
    }));

    return {
        project,
        view,
        tabs,
        options,
        roadmap: defaults.roadmap,
        groups: selected
            ? buildProjectList({
                  project,
                  entries: selected,
                  grouping: options.grouping,
                  sort: options.sort,
                  texts: TEXTS,
                  today: SAMPLE_TODAY,
              })
            : null,
        itemCount: entries.filter(entry => !entry.item.isArchived).length,
        answeredTerm: filter.kind === 'github' ? filter.term : null,
        sorts,
    };
}

function compile(project: Project, filter: string | null, entries: readonly ProjectEntry[]) {
    return compileProjectFilter({
        filter,
        fields: project.fields,
        viewerLogin: 'kedrzu',
        today: SAMPLE_TODAY,
        hasDrafts: entries.some(entry => entry.item.draft !== null),
        hasDraftPullRequests: entries.some(entry => entry.content?.kind === 'pullRequest' && entry.content.isDraft),
    });
}
