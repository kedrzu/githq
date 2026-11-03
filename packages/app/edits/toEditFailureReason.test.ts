/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { GitHubApiError } from '@githq/github/GitHubApiError.js';

import { toEditFailureReason } from './toEditFailureReason.js';

const RESTRICTED =
    'Although you appear to have the correct authorization credentials, the `nzymejs` organization has enabled OAuth ' +
    'App access restrictions, meaning that data access to third-parties is limited. For more information on these ' +
    'restrictions, including how to approve this app, visit ' +
    'https://docs.github.com/articles/restricting-access-to-your-organization-s-data/';

test("G5: an organisation that hasn't approved githq — over REST and over GraphQL — is named, not quoted", () => {
    const rest = new GitHubApiError({ status: 403, message: 'Forbidden', githubMessage: RESTRICTED });
    const graphql = new GitHubApiError({
        status: 200,
        message: RESTRICTED,
        errors: [{ type: 'FORBIDDEN', message: RESTRICTED }],
    });

    expect(toEditFailureReason(rest)).toEqual({ kind: 'organizationRestricted', organization: 'nzymejs' });
    expect(toEditFailureReason(graphql)).toEqual({ kind: 'organizationRestricted', organization: 'nzymejs' });
});

test("any other refusal is GitHub's words", () => {
    const error = new GitHubApiError({
        status: 403,
        message: 'Forbidden',
        githubMessage: 'Resource not accessible by integration',
    });

    expect(toEditFailureReason(error)).toEqual({ kind: 'refused', message: 'Resource not accessible by integration' });
    expect(toEditFailureReason(new Error('fetch failed'))).toEqual({ kind: 'offline' });
});
