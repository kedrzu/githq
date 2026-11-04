import { getTagCommit } from '@githq/github/rest/getTagCommit.js';
import { listCommitSubjects } from '@githq/github/rest/listCommitSubjects.js';
import { listReleases } from '@githq/github/rest/listReleases.js';
import type { GitHubRelease } from '@githq/github/rest/listReleases.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { isPrereleaseVersion } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';

import { findLastStable, getReleaseVersion, GITHQ_REPOSITORY } from './buildChangelog.js';
import type { DevelopmentCommits } from './buildChangelog.js';

/** How many pages of 100 commits a Development build reads at most (D17). */
const MAX_COMMIT_PAGES = 3;

/** What the Changelog read from GitHub. */
export interface ChangelogAnswer {
    readonly releases: readonly GitHubRelease[];
    /** The commits of a Development build; `null` on a Stable version. */
    readonly development: DevelopmentCommits | null;
}

/** How reading the Changelog stands: `idle` until the section first opens. */
export type ChangelogRead =
    | { readonly kind: 'idle' | 'loading' | 'offline' | 'failed' }
    | { readonly kind: 'loaded'; readonly answer: ChangelogAnswer };

/** The build whose Changelog is read. */
export interface ChangelogBuild {
    readonly version: string;
    /** The commit it was built from; `null` for a local build, which reads from `main`. */
    readonly commit: string | null;
}

/**
 * The Changelog as read from GitHub (desktop releases D10, D17), only when its section opens and once per run: another
 * opening reuses the answer, and retries after a failure. Offline it waits for the connection and reads by itself once
 * back.
 */
export type ChangelogStore = Resolved<typeof ChangelogStore>;
export const ChangelogStore = defineService({
    name: 'ChangelogStore',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        logger: Logger,
    },
    setup({ accounts, browser, logger }) {
        const readRef = shallowRef<ChangelogRead>({ kind: 'idle' });
        let wanted: ChangelogBuild | null = null;

        browser.onOnlineChange(() => {
            if (wanted && readRef.value.kind === 'offline' && browser.isOnline()) {
                void load(wanted);
            }
        });

        return {
            /** How it stands; reactive. */
            get read() {
                return readRef.value;
            },
            /** The section opened: reads, unless the answer is here or on its way. */
            open(build: ChangelogBuild) {
                const { kind } = readRef.value;
                if (kind !== 'loaded' && kind !== 'loading') {
                    wanted = build;
                    void load(build);
                }
            },
        };

        async function load(build: ChangelogBuild) {
            if (!browser.isOnline()) {
                readRef.value = { kind: 'offline' };
                return;
            }

            readRef.value = { kind: 'loading' };
            try {
                readRef.value = { kind: 'loaded', answer: await readAnswer(build) };
            } catch (error) {
                logger.warn('Could not read the changelog', { error });
                readRef.value = { kind: browser.isOnline() ? 'failed' : 'offline' };
            }
        }

        async function readAnswer({ version, commit }: ChangelogBuild): Promise<ChangelogAnswer> {
            const account = accounts.current;
            if (!account) {
                throw new Error('Nobody is signed in to read the changelog with');
            }

            const releases = await listReleases(account.rest, GITHQ_REPOSITORY);
            return {
                releases,
                development: isPrereleaseVersion(version)
                    ? await readDevelopment(account.rest, releases, version, commit)
                    : null,
            };
        }

        async function readDevelopment(
            rest: GitHubRestRequester,
            releases: readonly GitHubRelease[],
            version: string,
            commit: string | null,
        ): Promise<DevelopmentCommits> {
            const last = findLastStable(releases, version);
            const until = last && (await getTagCommit(rest, GITHQ_REPOSITORY, last.tagName));
            const { subjects, limited } = await listCommitSubjects(rest, {
                nameWithOwner: GITHQ_REPOSITORY,
                from: commit ?? 'main',
                until,
                maxPages: MAX_COMMIT_PAGES,
            });

            return { since: last && getReleaseVersion(last), subjects, limited };
        }
    },
});
