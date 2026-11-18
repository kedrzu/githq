import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

/** The project the demo ends on, by title. */
export const DEMO_PROJECT = 'Platform Q4';

/** The issue the demo finds with ⌘K and moves to "In Progress". */
export const DEMO_ISSUE = 'Calendar shows wrong timezone for recurring classes';

/**
 * The README demo's world: a busy "My work" across the viewer's repositories `octocat/tasklet` and `octocat/mdlint`
 * (tracked on the first sign-in, with the project "Platform Q4", shown as a board first) and someone else's
 * `fitloop/webapp` and `fitloop/api`. {@link DEMO_ISSUE} is assigned to the viewer and "Todo" in the project.
 */
export function createSampleDemoWork(): GitHubWorld {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const project = world.project({
        title: DEMO_PROJECT,
        number: 1,
        views: [{ name: 'Board', layout: 'BOARD_LAYOUT' }, { name: 'Backlog' }],
    });
    world.repository('octocat/tasklet');
    world.repository('octocat/mdlint');

    world.pullRequest({
        repository: 'fitloop/api',
        number: 482,
        title: 'Add rate-limit backoff to webhook worker',
        author: 'monalisa',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        minutesAgo: 120,
    });
    world.pullRequest({
        repository: 'fitloop/webapp',
        number: 1203,
        title: 'Migrate class calendar to new date picker',
        author: 'hubot',
        foundBy: ['reviewRequested'],
        reviewRequests: [world.viewer],
        minutesAgo: 300,
    });
    world.pullRequest({
        repository: 'octocat/tasklet',
        number: 15,
        title: 'IndexedDB store for issues and pull requests',
        foundBy: ['authored'],
        failingChecks: 2,
        reviewDecision: 'CHANGES_REQUESTED',
        projects: [{ project, status: 'In Progress' }],
        minutesAgo: 12,
    });
    world.pullRequest({
        repository: 'fitloop/api',
        number: 477,
        title: 'Retry Stripe webhook delivery on 5xx',
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 180,
    });
    world.pullRequest({
        repository: 'octocat/mdlint',
        number: 38,
        title: 'Bump lint rules to the new preset',
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 60,
    });
    world.issue({
        repository: 'fitloop/webapp',
        number: 1187,
        title: DEMO_ISSUE,
        author: 'monalisa',
        foundBy: ['assigned'],
        labels: ['bug'],
        issueType: 'Bug',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 20,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 12,
        title: 'Background sync with conditional requests',
        foundBy: ['assigned'],
        labels: ['enhancement'],
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 1440,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 9,
        title: 'Command palette: jump to issue by number',
        foundBy: ['assigned'],
        labels: ['enhancement'],
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 2880,
    });
    world.issue({
        repository: 'fitloop/api',
        number: 455,
        title: 'Document webhook retry policy',
        author: 'hubot',
        foundBy: ['assigned'],
        labels: ['documentation'],
        minutesAgo: 5760,
    });
    world.issue({
        repository: 'octocat/mdlint',
        number: 31,
        title: 'cli: support glob patterns in --ignore',
        author: 'monalisa',
        foundBy: ['mentioned'],
        projects: [{ project, status: 'Done' }],
        minutesAgo: 4320,
    });
    world.issue({
        repository: 'octocat/tasklet',
        number: 21,
        title: 'Keyboard shortcut cheat sheet',
        projects: [{ project, status: 'Todo' }],
        minutesAgo: 7200,
    });

    return world;
}
