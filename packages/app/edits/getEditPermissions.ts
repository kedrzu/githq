import type { RepositoryPermission } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { Item } from '@/store/ItemTypes.js';

/** Which edits of an item the user may make (D14): the others are not offered at all (K1b). */
export interface EditPermissions {
    readonly comment: boolean;
    readonly labels: boolean;
    readonly assignees: boolean;
    readonly milestone: boolean;
    readonly issueType: boolean;
    /** Close and reopen. */
    readonly state: boolean;
    /** Ask for reviews of a pull request. */
    readonly reviewers: boolean;
    /** Mark a draft pull request ready for review, or turn one back into a draft. */
    readonly draft: boolean;
    /** Add it to a project (the project's own permission is the project's). */
    readonly addToProject: boolean;
}

/** What {@link getEditPermissions} decides from. */
export interface GetEditPermissionsParams {
    readonly item: Item;
    /** The signed-in user. */
    readonly viewerLogin: string;
    /** The user's role in the item's repository; `null` when GitHub does not say. */
    readonly permission: RepositoryPermission | null;
    /** The repository is archived: read-only for everyone. */
    readonly archived?: boolean;
}

/** Nothing may be edited. */
export const NO_EDITS: EditPermissions = {
    comment: false,
    labels: false,
    assignees: false,
    milestone: false,
    issueType: false,
    state: false,
    reviewers: false,
    draft: false,
    addToProject: false,
};

/**
 * The edits the user may make to an item, by their role in its repository. GitHub's table of repository roles
 * (docs.github.com, "Repository roles for an organization"):
 *
 * - READ: open issues and comment; close and reopen the issues and pull requests they opened themselves.
 * - TRIAGE: apply labels and milestones, assign, close and reopen any issue or pull request, request reviews.
 * - WRITE: also mark a draft ready for review or convert one to a draft (an author may do it to their own), and
 *   set the issue type — the REST docs say "only users with push access can set the type"; the roles table
 *   does not list types.
 *
 * Where the two sources differ the REST docs say labels, assignees and milestones also need push access; the
 * roles table (TRIAGE) is what github.com does, and a write GitHub drops anyway is caught as a rejection (D14).
 * A merged pull request can no longer be closed, reopened or made a draft.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getEditPermissions(params: GetEditPermissionsParams): EditPermissions {
    const { item, viewerLogin, permission } = params;
    if (permission === null || params.archived) {
        return NO_EDITS;
    }

    const triage = hasRole(permission, 'TRIAGE');
    const write = hasRole(permission, 'WRITE');
    const author = item.author?.login === viewerLogin;
    const merged = item.kind === 'pullRequest' && item.merged;
    const pullRequest = item.kind === 'pullRequest';

    return {
        comment: true,
        labels: triage,
        assignees: triage,
        milestone: triage,
        issueType: !pullRequest && write,
        state: !merged && (triage || author),
        reviewers: pullRequest && triage,
        draft: pullRequest && !merged && item.state === 'OPEN' && (write || author),
        addToProject: true,
    };
}

/**
 * Whether a role in a repository is `role` or above it (WRITE: the user can push). `null` — GitHub did not say — is
 * no role.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function hasRole(permission: RepositoryPermission | null | undefined, role: RepositoryPermission): boolean {
    return permission != null && getRank(permission) >= getRank(role);
}

function getRank(permission: RepositoryPermission) {
    switch (permission) {
        case 'READ':
            return 1;
        case 'TRIAGE':
            return 2;
        // Triage and a few more triage abilities, none of them an edit githq offers.
        case 'TRIAGE_PLUS':
            return 3;
        case 'WRITE':
            return 4;
        case 'MAINTAIN':
            return 5;
        case 'ADMIN':
            return 6;
        default:
            return assertNever(permission);
    }
}
