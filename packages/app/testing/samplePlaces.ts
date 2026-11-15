import type { SidebarTracked, SidebarTrackedEntry, SidebarTrackedStatus } from '@/shell/Sidebar.vue';
import type { SidebarMyWorkCounts } from '@/shell/SidebarTypes.js';

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
    };
}
