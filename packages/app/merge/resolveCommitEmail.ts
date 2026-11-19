import type { MergeSettings } from './getMergeMethods.js';

/** What {@link resolveCommitEmail} decides from. */
export interface ResolveCommitEmailParams {
    /** The repository's own choice: `undefined` inherits the owner's, `null` is GitHub's default, a string that address. */
    readonly repository: string | null | undefined;
    /** The owner's choice: an address, `null` for GitHub's default. */
    readonly owner: string | null;
    /** What GitHub offers for the repository; `null` until its metadata is known. */
    readonly settings: Pick<MergeSettings, 'viewerDefaultCommitEmail' | 'viewerPossibleCommitEmails'> | null;
}

/** The address a merge starts on, and the level that chose it. */
export interface ResolvedCommitEmail {
    readonly email: string;
    readonly source: 'repository' | 'owner' | 'github';
}

/**
 * The address a merge in the repository commits with: the repository's choice, else the owner's, else GitHub's
 * default. A chosen address GitHub does not offer for the repository (an alias removed since) is skipped, so the
 * result is always one GitHub offers. An explicit "GitHub's default" for the repository reports `'repository'`, since
 * the user chose it for this repository; an owner's address not offered falls to GitHub's default as `'github'`.
 * `null` when the settings are unknown or name no default.
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCommitEmail(params: ResolveCommitEmailParams): ResolvedCommitEmail | null {
    const { repository, owner, settings } = params;
    const fallback = settings?.viewerDefaultCommitEmail;
    if (!settings || !fallback) {
        return null;
    }

    if (repository === null) {
        return { email: fallback, source: 'repository' };
    }

    if (repository !== undefined && isOffered(settings, repository)) {
        return { email: repository, source: 'repository' };
    }

    if (owner !== null && isOffered(settings, owner)) {
        return { email: owner, source: 'owner' };
    }

    return { email: fallback, source: 'github' };
}

function isOffered(settings: Pick<MergeSettings, 'viewerPossibleCommitEmails'>, email: string) {
    return settings.viewerPossibleCommitEmails.includes(email);
}
