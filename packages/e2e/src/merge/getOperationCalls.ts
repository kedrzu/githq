import type { GitHubGraphQLCall, GitHubMock } from '../github/GitHubMock.js';

/** The variables of each `name` the app asked GitHub for, oldest first. */
export function getOperationCalls(
    github: GitHubMock,
    name: GitHubGraphQLCall['name'],
): GitHubGraphQLCall['variables'][] {
    return github.graphqlCalls.filter(call => call.name === name).map(call => call.variables);
}
