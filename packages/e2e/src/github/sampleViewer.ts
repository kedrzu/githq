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

/** A refresh token as GitHub issues one with an expiring access token (`ghr_…`, which the Worker requires). */
export const SAMPLE_REFRESH_TOKEN = 'ghr_e2eSampleRefreshToken';

/** How long GitHub's OAuth App access tokens last, in seconds: 8 hours. */
export const SAMPLE_TOKEN_LIFETIME_SECONDS = 28_800;
