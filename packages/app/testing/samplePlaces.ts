import { Columns3, List } from 'lucide-vue-next';

import { REPOSITORY_SECTION_ICONS } from '@/repository/RepositorySection.js';
import type { SidebarTracked, SidebarTrackedEntry, SidebarTrackedStatus } from '@/shell/Sidebar.vue';
import type { SidebarMyWorkCounts, SidebarSubEntry } from '@/shell/SidebarTypes.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

/** The counts of "my work" for stories of the sidebar's places. */
export const SAMPLE_MY_WORK_COUNTS: SidebarMyWorkCounts = {
    reviewRequested: 2,
    authored: 3,
    assigned: 5,
    mentioned: 3,
    total: 13,
};

/** Tracked projects and repositories for stories of the sidebar's places, as the drawings show them. */
export const SAMPLE_TRACKED: SidebarTracked = {
    projects: [
        sampleTrackedProject('Platform Q4', 'skyline-labs', 1, { kind: 'count', count: 128 }),
        sampleTrackedProject('githq Roadmap', 'kedrzu', 2, { kind: 'count', count: 34 }),
        sampleTrackedProject('Docs revamp', 'skyline-labs', 3, { kind: 'count', count: 12 }),
    ],
    repositories: [
        sampleTrackedRepository('kedrzu/githq', { kind: 'count', count: 18 }),
        sampleTrackedRepository('kedrzu/skills', { kind: 'count', count: 7 }),
        sampleTrackedRepository('skyline-labs/portal', { kind: 'count', count: 142 }, true),
        sampleTrackedRepository('skyline-labs/api', { kind: 'count', count: 96 }, true),
    ],
};

/** A tracked project as the sidebar lists it, for a story. */
export function sampleTrackedProject(
    title: string,
    owner: string,
    number: number,
    status: SidebarTrackedStatus,
): SidebarTrackedEntry {
    return {
        key: `project:${number}`,
        label: title,
        to: `/orgs/${owner}/projects/${number}`,
        target: { kind: 'project', id: `PVT_${number}` },
        status,
        // Every sample project has saved views (`sampleGetChildren`).
        expandable: true,
    };
}

/** A tracked repository as the sidebar lists it, for a story. */
export function sampleTrackedRepository(
    nameWithOwner: string,
    status: SidebarTrackedStatus,
    isPrivate = false,
): SidebarTrackedEntry {
    return {
        key: `repository:${nameWithOwner}`,
        label: nameWithOwner,
        to: `/${nameWithOwner}`,
        target: { kind: 'repository', nameWithOwner },
        status,
        isPrivate,
        expandable: true,
    };
}

/** {@link SAMPLE_TRACKED}, or other places, with the one under `key` as the open place. */
export function withOpenPlace(tracked: SidebarTracked, key: string): SidebarTracked {
    const mark = (entry: SidebarTrackedEntry) => ({ ...entry, open: entry.key === key });
    return { projects: tracked.projects.map(mark), repositories: tracked.repositories.map(mark) };
}

/** Which sample place is open, and on which of its rows. */
export interface SampleGetChildrenOptions {
    readonly open?: TrackedTarget;
    /** The open place's row shown: a section, or a saved view's key. */
    readonly current?: string;
}

/**
 * The rows under a sample place, as the shell gives them to the places panel: a repository's sections with their counts,
 * Commits and Workflows leaving for github.com, and a project's saved views, the first changed on this device, the third answered
 * by GitHub, as the drawings show them.
 */
export function sampleGetChildren(options: SampleGetChildrenOptions = {}) {
    return (target: TrackedTarget): readonly SidebarSubEntry[] => {
        const isOpen =
            options.open?.kind === target.kind &&
            (target.kind === 'repository'
                ? options.open.kind === 'repository' && options.open.nameWithOwner === target.nameWithOwner
                : options.open.kind === 'project' && options.open.id === target.id);
        const current = isOpen ? options.current : undefined;
        return target.kind === 'repository'
            ? sampleSections(target.nameWithOwner, current)
            : sampleViews(target.id, current);
    };
}

function sampleSections(nameWithOwner: string, current: string | undefined): SidebarSubEntry[] {
    const sections = [
        { key: 'issues', label: 'Issues', segment: 'issues', count: '118' },
        { key: 'pullRequests', label: 'Pull requests', segment: 'pulls', count: '24' },
        { key: 'commits', label: 'Commits', segment: 'commits', count: '' },
        { key: 'workflows', label: 'Workflows', segment: 'actions', count: '2' },
    ] as const;
    return sections.map(section => {
        const external = section.key === 'commits' || section.key === 'workflows';
        return {
            key: section.key,
            label: section.label,
            to: `/${nameWithOwner}/${section.segment}`,
            icon: REPOSITORY_SECTION_ICONS[section.key],
            count: external ? '' : section.count,
            current: section.key === current,
            external: external ? `https://github.com/${nameWithOwner}/${section.segment}` : undefined,
        };
    });
}

function sampleViews(projectId: string, current: string | undefined): SidebarSubEntry[] {
    const number = projectId.replace('PVT_', '');
    const views = ['Current sprint', 'Backlog', 'Next sprint', 'By assignee', 'Bugs'];
    return views.map((name, index) => ({
        key: `view-${index + 1}`,
        label: name,
        to: `/orgs/skyline-labs/projects/${number}/views/${index + 1}`,
        icon: index === 0 || index === 3 ? Columns3 : List,
        count: '',
        current: `view-${index + 1}` === current,
        modified: index === 0,
        answered: index === 2,
    }));
}
