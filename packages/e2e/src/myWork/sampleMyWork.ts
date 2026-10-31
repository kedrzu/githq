import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

/** The sample "my work": the world and the node ids of its items, by role. */
export interface SampleMyWork {
    readonly world: GitHubWorld;
    /** Someone else's pull request asking for the viewer's review, which mentions them too. */
    readonly reviewRequest: string;
    /** The viewer's pull requests: with failing checks, with conflicts, waiting for a review. */
    readonly failingPullRequest: string;
    readonly conflictingPullRequest: string;
    readonly waitingPullRequest: string;
    /** An issue assigned to the viewer, and the viewer's pull request that closes it. */
    readonly assignedIssue: string;
    readonly closingPullRequest: string;
    /** An issue assigned to the viewer that nothing closes yet. */
    readonly otherAssignedIssue: string;
    /** An issue someone mentioned the viewer in. */
    readonly mention: string;
}

/**
 * "My work" with something in every group, newest first as listed here:
 *
 * - Review requested (1): "Add rate limit headers to the API";
 * - My pull requests (3): "Cache search results" (2 checks failing), "Move the sidebar state to the store"
 *   (conflicts), "Retry polls on network errors" (waiting for review);
 * - Assigned to me (2): "Sign-in loops after the token expires", with "Redirect once after sign-in" nested under
 *   it (waiting for review), then "Document the keyboard shortcuts";
 * - Mentioned (1): "Dark mode for the status bar".
 */
export function createSampleMyWork(): SampleMyWork {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);

    const reviewRequest = world.pullRequest({
        repository: 'acme/api',
        number: 52,
        title: 'Add rate limit headers to the API',
        author: 'hubot',
        foundBy: ['reviewRequested', 'mentioned'],
        reviewRequests: [world.viewer],
        minutesAgo: 5,
    });
    const failingPullRequest = world.pullRequest({
        repository: 'acme/api',
        number: 48,
        title: 'Cache search results',
        foundBy: ['authored'],
        failingChecks: 2,
        minutesAgo: 10,
    });
    const conflictingPullRequest = world.pullRequest({
        repository: 'acme/web',
        number: 17,
        title: 'Move the sidebar state to the store',
        foundBy: ['authored'],
        conflicts: true,
        minutesAgo: 20,
    });
    const waitingPullRequest = world.pullRequest({
        repository: 'octocat/hello-world',
        number: 7,
        title: 'Retry polls on network errors',
        foundBy: ['authored'],
        reviewRequests: ['monalisa'],
        minutesAgo: 30,
    });
    const assignedIssue = world.issue({
        repository: 'acme/web',
        number: 12,
        title: 'Sign-in loops after the token expires',
        author: 'monalisa',
        foundBy: ['assigned'],
        minutesAgo: 15,
    });
    const closingPullRequest = world.pullRequest({
        repository: 'acme/web',
        number: 15,
        title: 'Redirect once after sign-in',
        foundBy: ['authored'],
        closes: [assignedIssue],
        reviewRequests: ['monalisa'],
        minutesAgo: 8,
    });
    const otherAssignedIssue = world.issue({
        repository: 'acme/web',
        number: 9,
        title: 'Document the keyboard shortcuts',
        foundBy: ['assigned'],
        minutesAgo: 60,
    });
    const mention = world.issue({
        repository: 'octocat/hello-world',
        number: 3,
        title: 'Dark mode for the status bar',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 120,
    });

    return {
        world,
        reviewRequest,
        failingPullRequest,
        conflictingPullRequest,
        waitingPullRequest,
        assignedIssue,
        closingPullRequest,
        otherAssignedIssue,
        mention,
    };
}
