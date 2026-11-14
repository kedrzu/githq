import type { SidebarTracked, SidebarTrackedEntry } from '@/shell/Sidebar.vue';
import type { SidebarMyWorkCounts } from '@/shell/SidebarTypes.js';

/** The counts of "my work" for stories of the sidebar's places. */
export const SAMPLE_MY_WORK_COUNTS: SidebarMyWorkCounts = {
    reviewRequested: 2,
    authored: 3,
    assigned: 5,
    mentioned: 3,
    total: 13,
};

/** Tracked projects and repositories for stories of the sidebar's places, as the phone's drawings show them. */
export const SAMPLE_TRACKED: SidebarTracked = {
    projects: [
        project('Platform Q4', 'skyline-labs', 1, 128),
        project('githq Roadmap', 'kedrzu', 2, 34),
        project('Docs revamp', 'skyline-labs', 3, 12),
    ],
    repositories: [
        repository('kedrzu/githq', 18),
        repository('kedrzu/skills', 7),
        repository('skyline-labs/portal', 142, true),
        repository('skyline-labs/api', 96, true),
    ],
};

function project(title: string, owner: string, number: number, count: number): SidebarTrackedEntry {
    return {
        key: `project:${number}`,
        label: title,
        to: `/orgs/${owner}/projects/${number}`,
        target: { kind: 'project', id: `PVT_${number}` },
        status: { kind: 'count', count },
    };
}

function repository(nameWithOwner: string, count: number, isPrivate = false): SidebarTrackedEntry {
    return {
        key: `repository:${nameWithOwner}`,
        label: nameWithOwner,
        to: `/${nameWithOwner}`,
        target: { kind: 'repository', nameWithOwner },
        status: { kind: 'count', count },
        isPrivate,
    };
}
