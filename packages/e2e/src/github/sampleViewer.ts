import type { GitHubOperationData } from './GitHubMock.js';

/** The user the tests sign in as, as GitHub's `Viewer` operation answers. */
export const SAMPLE_VIEWER: GitHubOperationData<'Viewer'> = {
    viewer: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    },
};

/** A token for the development sign-in; the GitHub mock accepts any. */
export const SAMPLE_TOKEN = 'gho_e2eSampleToken';
