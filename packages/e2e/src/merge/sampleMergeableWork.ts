import { GitHubWorld } from '../github/GitHubWorld.js';
import type { GitHubWorldPullRequestParams, GitHubWorldRepositoryParams } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';

/** The title of the first pull request of {@link createSampleMergeableWork}, acme/web#15. */
export const FIRST_TITLE = 'Redirect once after sign-in';
/** The title of the second pull request of {@link createSampleMergeableWork}, acme/web#16. */
export const SECOND_TITLE = 'Cache response headers';
/** What GitHub proposes for the merge commit of the first pull request: its branch, not the fallback the panel writes. */
export const PROPOSED_TITLE = 'Merge pull request #15 from acme/redirect-once';

/** What {@link createSampleMergeableWork} changes in its world. */
export interface SampleMergeableWorkOptions {
    /** acme/web's settings. */
    readonly repository?: GitHubWorldRepositoryParams;
    /** Where the first pull request stands besides approved: a draft, conflicting, behind. */
    readonly first?: Partial<GitHubWorldPullRequestParams>;
}

/** The world of the merge tests and the node ids of its pull requests. */
export interface SampleMergeableWork {
    readonly world: GitHubWorld;
    /** {@link FIRST_TITLE} (acme/web#15), approved and ready to merge, at the top of "My pull requests". */
    readonly first: string;
    /** {@link SECOND_TITLE} (acme/web#16), ready too, the row after it. */
    readonly second: string;
}

/**
 * "My pull requests" of two approved pull requests of acme/web, ready to merge unless `options.first` says otherwise.
 * The repository allows all three methods and starts on a merge commit, unless `options.repository` says otherwise.
 */
export function createSampleMergeableWork(options: SampleMergeableWorkOptions = {}): SampleMergeableWork {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.repository('acme/web', { defaultMergeMethod: 'MERGE', ...options.repository });
    const first = world.pullRequest({
        repository: 'acme/web',
        number: 15,
        title: FIRST_TITLE,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        proposedTexts: { MERGE: { title: PROPOSED_TITLE, body: FIRST_TITLE } },
        minutesAgo: 5,
        ...options.first,
    });
    const second = world.pullRequest({
        repository: 'acme/web',
        number: 16,
        title: SECOND_TITLE,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 10,
    });
    return { world, first, second };
}
