import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

/** The world of the edit tests and the node ids of its items, by role. */
export interface SampleEditableWork {
    readonly world: GitHubWorld;
    /** "Sign-in loops after the token expires" (acme/web#12): assigned, in "Roadmap" with the status "Todo". */
    readonly issue: string;
    /** "Flaky login test" (acme/web#21) and "Document the keyboard shortcuts" (acme/web#9): assigned. */
    readonly secondIssue: string;
    readonly thirdIssue: string;
    /** The viewer's "Redirect once after sign-in" (acme/web#15), waiting for no one's review yet. */
    readonly pullRequest: string;
    /** The viewer's draft "Cache response headers" (acme/api#30). */
    readonly draft: string;
}

/**
 * "My work" to edit, in repositories where the viewer may write (the default labels `bug`, `documentation`,
 * `enhancement`; `monalisa` and `hubot` to assign), with the projects "Roadmap" and "Platform":
 *
 * - My pull requests: "Redirect once after sign-in", "Cache response headers" (draft);
 * - Assigned to me: "Sign-in loops after the token expires", "Flaky login test", "Document the keyboard
 *   shortcuts".
 */
export function createSampleEditableWork(): SampleEditableWork {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const roadmap = world.project({ title: 'Roadmap', number: 1 });
    world.project({ title: 'Platform', number: 2 });

    const pullRequest = world.pullRequest({
        repository: 'acme/web',
        number: 15,
        title: 'Redirect once after sign-in',
        foundBy: ['authored'],
        minutesAgo: 20,
    });
    const draft = world.pullRequest({
        repository: 'acme/api',
        number: 30,
        title: 'Cache response headers',
        foundBy: ['authored'],
        isDraft: true,
        minutesAgo: 30,
    });
    const issue = world.issue({
        repository: 'acme/web',
        number: 12,
        title: 'Sign-in loops after the token expires',
        author: 'monalisa',
        foundBy: ['assigned'],
        projects: [{ project: roadmap, status: 'Todo' }],
        minutesAgo: 5,
    });
    const secondIssue = world.issue({
        repository: 'acme/web',
        number: 21,
        title: 'Flaky login test',
        author: 'hubot',
        foundBy: ['assigned'],
        minutesAgo: 10,
    });
    const thirdIssue = world.issue({
        repository: 'acme/web',
        number: 9,
        title: 'Document the keyboard shortcuts',
        foundBy: ['assigned'],
        minutesAgo: 15,
    });

    return { world, issue, secondIssue, thirdIssue, pullRequest, draft };
}
