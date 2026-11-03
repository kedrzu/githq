import type { RepositoryPermission } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
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
    /** Bring the base branch into an open pull request's head: pushing to it, as WRITE does, or as its author. */
    readonly updateBranch: boolean;
    /** Add it to a project (the project's own permission is the project's). */
    readonly addToProject: boolean;
    /**
     * Open the merge panel: an open pull request by WRITE and above — in a stack any open one, the panel showing what
     * merges with it (stacked PRs D11) — also while it is being merged, to see that (PM24).
     */
    readonly mergePanel: boolean;
    /**
     * Send a merge, what {@link mergePanel} allows, while it is not being merged already — and so turn auto-merge on
     * or off, jump the merge queue or leave it.
     */
    readonly merge: boolean;
    /** Delete a closed or merged pull request's branch: GitHub says who may ({@link PullRequestStatus.viewerCanDeleteHeadRef}). */
    readonly deleteBranch: boolean;
    /** Create a closed or merged pull request's deleted branch again: pushing, in its own repository, not a fork. */
    readonly restoreBranch: boolean;
    /** Open a pull request reverting a merged one. */
    readonly revert: boolean;
    /** Re-run an open pull request's GitHub Actions checks. */
    readonly rerunChecks: boolean;
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
    updateBranch: false,
    addToProject: false,
    mergePanel: false,
    merge: false,
    deleteBranch: false,
    restoreBranch: false,
    revert: false,
    rerunChecks: false,
};

/**
 * The edits the user may make to an item, by their role in its repository. GitHub's table of repository roles
 * (docs.github.com, "Repository roles for an organization"):
 *
 * - READ: open issues and comment; close and reopen the issues and pull requests they opened themselves.
 * - TRIAGE: apply labels and milestones, assign, close and reopen any issue or pull request, request reviews.
 * - WRITE: also mark a draft ready for review or convert one to a draft (an author may do it to their own), set
 *   the issue type — the REST docs say "only users with push access can set the type"; the roles table does not
 *   list types — and merge a pull request (GitHub's rules of the branch may still refuse it), in a stack together
 *   with every open one before it (stacked PRs D11). Updating a pull request's branch pushes to it: WRITE, or its author, whose branch it is.
 *
 * Where the two sources differ the REST docs say labels, assignees and milestones also need push access; the
 * roles table (TRIAGE) is what github.com does, and a write GitHub drops anyway is caught as a rejection (D14).
 * A merged pull request can no longer be closed, reopened or made a draft. Deleting a branch while its pull request is
 * open would close it, so that is not offered; a fork's deleted branch can't be restored here (merging D16).
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
    const pr = item.kind === 'pullRequest' ? item : null;
    const mergePanel = item.kind === 'pullRequest' && isOpenPullRequest(item) && write;
    const merging = item.kind === 'pullRequest' && item.merging !== undefined;

    return {
        comment: true,
        labels: triage,
        assignees: triage,
        milestone: triage,
        issueType: !pullRequest && write,
        state: !merged && (triage || author),
        reviewers: pullRequest && triage,
        draft: pullRequest && !merged && item.state === 'OPEN' && (write || author),
        updateBranch: pullRequest && item.state === 'OPEN' && (write || author),
        addToProject: true,
        mergePanel,
        merge: mergePanel && !merging,
        deleteBranch: pr !== null && !isOpenPullRequest(pr) && pr.headRefId !== null && pr.viewerCanDeleteHeadRef,
        restoreBranch: write && pr !== null && !isOpenPullRequest(pr) && pr.headRefId === null && !pr.isCrossRepository,
        revert: write && merged,
        rerunChecks: write && pr !== null && isOpenPullRequest(pr),
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
