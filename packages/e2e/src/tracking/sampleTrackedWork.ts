import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

/** How long ago the sample's items last changed: three days, so a change made now is the only one since. */
const THREE_DAYS = 3 * 24 * 60;

/** The viewer's repository the sample tracks. */
export const SAMPLE_REPOSITORY = `${SAMPLE_VIEWER.viewer.login}/app`;

/** The viewer's project the sample tracks, by title, and where githq shows it. */
export const SAMPLE_PROJECT = 'Roadmap';
export const SAMPLE_PROJECT_PATH = `/users/${SAMPLE_VIEWER.viewer.login}/projects/1`;

/** The sample's tracked repository and project: the world and the node ids of their items, by role. */
export interface SampleTrackedWork {
    readonly world: GitHubWorld;
    /** "Roadmap"'s node id. */
    readonly project: string;
    /** The repository's open issue assigned to the viewer, in my work: "Crash on start" (v1.0, a bug). */
    readonly assignedIssue: string;
    /** The repository's open issue in nobody's work: "Add a dark theme" (v2.0, a feature). */
    readonly themeIssue: string;
    /** The repository's open issue "Roadmap" holds too: "Document the setup" (no milestone, no type; Todo). */
    readonly setupIssue: string;
    /** The repository's open pull request: "Fix the crash on start" (v1.0). */
    readonly fixPullRequest: string;
    /** "Roadmap"'s issues of an untracked repository: "Collapse the sidebar on narrow screens" (Todo). */
    readonly collapseIssue: string;
    /** "Remember the sidebar width" (In Progress). */
    readonly widthIssue: string;
    /** "Ship the onboarding tour" (Done). */
    readonly tourIssue: string;
    /** "Old sidebar experiment" (Todo), archived in "Roadmap". */
    readonly archivedIssue: string;
}

/**
 * The viewer's repository `octocat/app` and project "Roadmap" (`/users/octocat/projects/1`), both offered and
 * chosen on the first sign-in; nothing has changed in three days.
 *
 * `octocat/app`, milestones v1.0 and v2.0: "Crash on start" (v1.0, Bug, assigned to the viewer), "Add a dark theme"
 * (v2.0, Feature), "Document the setup", the pull request "Fix the crash on start" (v1.0), and the closed "Old
 * crash".
 *
 * "Roadmap", in GitHub's order: "Document the setup" (Todo); from the untracked `acme/web`: "Collapse the sidebar
 * on narrow screens" (Todo), "Remember the sidebar width" (In Progress), "Ship the onboarding tour" (Done) and the
 * archived "Old sidebar experiment" (Todo); the draft issue "Sketch the settings page" (Todo). Its saved views:
 * "Backlog" (a table, `-status:Done`), "Board" (a board by Status), "Sidebar work" (a table filtered by the free text
 * `sidebar`, which GitHub answers), "Shipped bugs" (`status:Done label:bug`, which nothing matches).
 */
export function createSampleTrackedWork(): SampleTrackedWork {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const project = world.project({
        title: SAMPLE_PROJECT,
        number: 1,
        views: [
            { name: 'Backlog', filter: '-status:Done' },
            { name: 'Board', layout: 'BOARD_LAYOUT' },
            { name: 'Sidebar work', filter: 'sidebar' },
            { name: 'Shipped bugs', filter: 'status:Done label:bug' },
        ],
    });

    world.repository(SAMPLE_REPOSITORY, { milestones: ['v1.0', 'v2.0'] });
    const assignedIssue = world.issue({
        repository: SAMPLE_REPOSITORY,
        number: 1,
        title: 'Crash on start',
        milestone: 'v1.0',
        issueType: 'Bug',
        foundBy: ['assigned'],
        minutesAgo: THREE_DAYS,
    });
    const themeIssue = world.issue({
        repository: SAMPLE_REPOSITORY,
        number: 2,
        title: 'Add a dark theme',
        milestone: 'v2.0',
        issueType: 'Feature',
        minutesAgo: THREE_DAYS + 10,
    });
    const setupIssue = world.issue({
        repository: SAMPLE_REPOSITORY,
        number: 3,
        title: 'Document the setup',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: THREE_DAYS + 20,
    });
    const fixPullRequest = world.pullRequest({
        repository: SAMPLE_REPOSITORY,
        number: 4,
        title: 'Fix the crash on start',
        milestone: 'v1.0',
        minutesAgo: THREE_DAYS + 30,
    });
    world.issue({
        repository: SAMPLE_REPOSITORY,
        number: 5,
        title: 'Old crash',
        closed: true,
        minutesAgo: THREE_DAYS + 40,
    });

    const collapseIssue = world.issue({
        repository: 'acme/web',
        number: 11,
        title: 'Collapse the sidebar on narrow screens',
        author: 'monalisa',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: THREE_DAYS,
    });
    const widthIssue = world.issue({
        repository: 'acme/web',
        number: 12,
        title: 'Remember the sidebar width',
        author: 'monalisa',
        projects: [{ project, status: 'In Progress' }],
        minutesAgo: THREE_DAYS,
    });
    const tourIssue = world.issue({
        repository: 'acme/web',
        number: 13,
        title: 'Ship the onboarding tour',
        author: 'monalisa',
        projects: [{ project, status: 'Done' }],
        minutesAgo: THREE_DAYS,
    });
    const archivedIssue = world.issue({
        repository: 'acme/web',
        number: 14,
        title: 'Old sidebar experiment',
        author: 'monalisa',
        projects: [{ project, status: 'Todo', archived: true }],
        minutesAgo: THREE_DAYS,
    });
    world.draft({ project, title: 'Sketch the settings page', status: 'Todo', minutesAgo: THREE_DAYS });

    return {
        world,
        project,
        assignedIssue,
        themeIssue,
        setupIssue,
        fixPullRequest,
        collapseIssue,
        widthIssue,
        tourIssue,
        archivedIssue,
    };
}
