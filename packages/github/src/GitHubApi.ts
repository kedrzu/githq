// Where githq talks to GitHub. Both APIs live on one host: GraphQL for fetching and writing, REST for
// conditional requests (ETags, free 304s) that detect changes.

/** The GraphQL endpoint; every query and mutation is a POST here. */
export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** The base of every REST call. */
export const GITHUB_REST_URL = 'https://api.github.com';
