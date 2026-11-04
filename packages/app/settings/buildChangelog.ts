import type { GitHubRelease } from '@githq/github/listReleases.js';

import { REPOSITORY_URL } from '@/landing/landingLinks.js';
import { userVisibleChanges } from '@/scripts/releasePlan.js';
import type { UserVisibleChangeGroup } from '@/scripts/releasePlan.js';
import { isNewerVersion, isOlderVersion, isPrereleaseVersion } from '@/services/AppUpdate.js';

/** The repository the app's versions are published in. */
export const GITHQ_REPOSITORY = { owner: 'kedrzu', name: 'githq' };

/** A Stable version with its own fold (U41, U42). */
export interface ChangelogRelease {
    readonly kind: 'release';
    /** Without the `v`. */
    readonly version: string;
    /** ISO. */
    readonly publishedAt: string;
    /** As GitHub rendered and sanitized it. */
    readonly html: string;
    /** It is the installed version. */
    readonly running: boolean;
    /** The user didn't have it before this update (D17). */
    readonly isNew: boolean;
}

/** The one fold of a Development build, for everything since the last Stable (U43, U44). */
export interface ChangelogDevelopment {
    readonly kind: 'development';
    /** The Stable the walk back from the build ended at; `null` when it met none. */
    readonly since: string | null;
    /** How many commits were read. */
    readonly commits: number;
    /** More commits are behind those read (D17). */
    readonly limited: boolean;
    /** What users notice among them. */
    readonly groups: readonly UserVisibleChangeGroup[];
}

/** A fold of the Changelog. */
export type ChangelogVersion = ChangelogDevelopment | ChangelogRelease;

/** What a Development build read of its commits since the last Stable. */
export interface DevelopmentCommits {
    readonly since: string | null;
    readonly subjects: string[];
    readonly limited: boolean;
}

/** The parameters of {@link buildChangelog}. */
export interface BuildChangelogParams {
    readonly releases: readonly GitHubRelease[];
    /** The commits of a Development build; `null` on a Stable version. */
    readonly development: DevelopmentCommits | null;
    /** The version running. */
    readonly version: string;
    /** The version the user had before this update, if any. */
    readonly previousVersion: string | null;
}

/**
 * The Changelog's folds, newest first; a Development build's own first (D17).
 * @__NO_SIDE_EFFECTS__
 */
export function buildChangelog({
    releases,
    development,
    version,
    previousVersion,
}: BuildChangelogParams): ChangelogVersion[] {
    const stable = sortReleases(releases).map((release): ChangelogRelease => {
        const released = getReleaseVersion(release);
        return {
            kind: 'release',
            version: released,
            publishedAt: release.publishedAt,
            html: release.bodyHtml,
            running: released === version,
            isNew: previousVersion !== null && isNewerVersion(released, previousVersion),
        };
    });

    if (!development) {
        return stable;
    }

    return [
        {
            kind: 'development',
            since: development.since,
            commits: development.subjects.length,
            limited: development.limited,
            groups: userVisibleChanges(development.subjects),
        },
        ...stable,
    ];
}

/**
 * The Stable tagged on a commit, the newest by number when a commit has several.
 * @__NO_SIDE_EFFECTS__
 */
export function findStableAt(releases: readonly GitHubRelease[], commit: string) {
    return sortReleases(releases).find(release => release.tagCommit === commit) ?? null;
}

/**
 * The address of a build's commits on GitHub; `null` for a Stable version, whose changes are its release's.
 * @__NO_SIDE_EFFECTS__
 */
export function getCommitsUrl(version: string, commit: string | null) {
    return isPrereleaseVersion(version) ? `${REPOSITORY_URL}/commits/${commit ?? 'main'}` : null;
}

/**
 * The address of a pull request on GitHub.
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestUrl(number: number) {
    return `${REPOSITORY_URL}/pull/${number}`;
}

/**
 * A release's version, without the `v` of its tag.
 * @__NO_SIDE_EFFECTS__
 */
export function getReleaseVersion({ tagName }: GitHubRelease) {
    return tagName.replace(/^v/, '');
}

/** Newest first by number: GitHub doesn't state its order, and a patch can be published after a newer minor. */
function sortReleases(releases: readonly GitHubRelease[]) {
    return releases.toSorted((a, b) => {
        const [first, second] = [getReleaseVersion(a), getReleaseVersion(b)];
        return isOlderVersion(first, second) ? 1 : isOlderVersion(second, first) ? -1 : 0;
    });
}
