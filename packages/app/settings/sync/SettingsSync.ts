import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import { createSettingsRepository } from '@githq/github/settings/createSettingsRepository.js';
import { getSettingsRepository } from '@githq/github/settings/getSettingsRepository.js';
import { readSettingsFile } from '@githq/github/settings/readSettingsFile.js';
import { writeSettingsFile } from '@githq/github/settings/writeSettingsFile.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { isRateLimitRefusal } from '@/sync/isRateLimitRefusal.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { mergeSettings } from './mergeSettings.js';
import { EMPTY_SETTINGS_DOCUMENT, parseSettings, serializeSettings } from './SettingsDocument.js';
import type { SettingsDocument } from './SettingsDocument.js';
import type { SettingsSaving, StoppedReason } from './SettingsSaving.js';

/** What turning syncing on would meet in the user's account (settings-sync T3, T6). */
export type SettingsInspection =
    /** No settings repository: turning on creates it. */
    | { readonly kind: 'absent' }
    /** Settings saved before, from this or another device: turning on combines them with this one's (D9). */
    | ({ readonly kind: 'found' } & FoundSettings)
    /** A repository that cannot be used, and why. */
    | { readonly kind: 'unusable'; readonly reason: StoppedReason };

/** The settings file as {@link SettingsSync.inspect} found it. */
export interface FoundSettings {
    readonly document: SettingsDocument;
    /** The version's blob sha. */
    readonly sha: string;
    readonly etag: string | null;
}

/** How many times a write refused for a newer file is merged and tried again before the next trigger. */
const WRITE_ROUNDS = 3;

/**
 * How long to wait before writing the first file again: GitHub refuses it with a 409 for a moment after creating the
 * repository (settings-sync D14).
 */
const NEW_REPOSITORY_PAUSE_MS = 1000;

/** The signed-in user the settings are synced for. */
interface Session {
    readonly account: Account;
    readonly rest: GitHubRestRequester;
    /** The sync under way; a trigger during it runs one more after it. */
    running: Promise<void> | null;
    again: boolean;
}

/** A failure of a GitHub call, sorted by what syncing does about it. */
type Failure = { readonly kind: 'transient' } | { readonly kind: 'stop'; readonly reason: StoppedReason };

/**
 * Keeps the user's tracked repositories and projects in `settings.json` of a private repository in their account
 * (settings-sync D6), once they turn it on (D2): `on` — synced; `off` — this device keeps its settings to itself;
 * `stopped` — something prevents syncing (D12), and nothing is written until the user tries again.
 *
 * Every sync is the three-way merge of D11 between this device's settings, the file now, and the file as this
 * device last saw it (kept in `saving`, the settings' slot, through {@link TrackingStore}): it takes the file's
 * changes in, and writes what is new here. It runs once the user's settings are in memory, when the tab is shown
 * again or its window focused, and right after the user changes what is tracked in this tab; one at a time, a
 * trigger during one running once after it. GitHub out of reach or the allowance spent leave it on, for the next
 * trigger.
 *
 * It follows the signed-in user like the tracking store: an answer for a session that ended is dropped.
 */
export type SettingsSync = Resolved<typeof SettingsSync>;
export const SettingsSync = defineService({
    name: 'SettingsSync',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        clock: Clock,
        createRest: GitHubRestFactory,
        tracking: TrackingStore,
        logger: Logger,
    },
    setup({ accounts, browser, clock, createRest, tracking, logger }) {
        let session: Session | null = null;

        accounts.onChange(follow);
        tracking.onLocalChange(() => void sync());
        browser.onVisibilityChange(() => {
            if (browser.isVisible()) {
                void syncShown();
            }
        });
        browser.onFocus(() => void syncShown());

        return {
            /** Whether and how the settings are synced; reactive. */
            get state(): SettingsSaving {
                return tracking.saving;
            },
            inspect,
            turnOn,
            turnOff,
            retry,
            sync,
        };

        /**
         * Looks at what the user's account holds for turning syncing on: no repository, a usable file, or a
         * repository that cannot be used — public, without the file, or with one this build cannot read. Rejects
         * when signed out or when GitHub cannot be reached.
         */
        async function inspect(): Promise<SettingsInspection> {
            const current = assertSession();
            try {
                return await inspectFor(current);
            } catch (error) {
                const failure = classify(error);
                if (failure.kind === 'stop') {
                    return { kind: 'unusable', reason: failure.reason };
                }

                throw error;
            }
        }

        /**
         * Turns syncing on. With nothing `found` ({@link inspect} found no repository) it creates the repository and
         * saves this device's settings in it. With a file found, the two are combined as on first contact (D9): what
         * either tracks stays, and what the file untracked ends untracked here; the result is saved when it differs
         * from the file. A refusal stops syncing; rejects when signed out or when GitHub cannot be reached.
         */
        async function turnOn(found?: FoundSettings) {
            const current = assertSession();
            if (!found) {
                try {
                    await createSettingsRepository(current.rest);
                } catch (error) {
                    const failure = classify(error);
                    if (failure.kind === 'transient' || !isCurrent(current)) {
                        throw error;
                    }

                    tracking.saveSaving({ state: 'stopped', reason: failure.reason });
                    return;
                }

                if (!isCurrent(current)) {
                    return;
                }

                // The sync writes the file: a new repository may refuse it for a moment, which it takes for a conflict.
                tracking.saveSaving({
                    state: 'on',
                    base: EMPTY_SETTINGS_DOCUMENT,
                    sha: null,
                    etag: null,
                    syncedAt: null,
                });
                await sync();
                return;
            }

            const local = tracking.document;
            const merged = mergeSettings({ local, remote: found.document, base: EMPTY_SETTINGS_DOCUMENT });
            if (!isSame(merged, local)) {
                tracking.replaceDocument(merged);
            }

            // Seen the file and taken it in: what is left to save is what this device adds to it.
            tracking.saveSaving({
                state: 'on',
                base: found.document,
                sha: found.sha,
                etag: found.etag,
                syncedAt: null,
            });
            await sync();
        }

        /** Stops syncing on this device: its settings stay, and the repository stays in the account (D10). */
        function turnOff() {
            tracking.saveSaving({ state: 'off', repositoryLeft: true });
        }

        /**
         * Tries again after syncing stopped: checks the repository again and, when it can be used, goes on from the
         * file as this device last saw it — or, having never seen it, as on first contact. A repository gone stays
         * gone: it is never created again here (T8). One this device never saw — GitHub refused creating it — is
         * created, as turning on would. Rejects when signed out or when GitHub cannot be reached.
         */
        async function retry() {
            const saving = tracking.readSaving();
            if (saving.state !== 'stopped') {
                return;
            }

            const current = assertSession();
            const inspection = await inspect();
            if (!isCurrent(current)) {
                return;
            }

            switch (inspection.kind) {
                case 'absent':
                    if (!saving.base) {
                        await turnOn();
                        return;
                    }

                    stop({ kind: 'deleted' });
                    return;
                case 'unusable':
                    stop(inspection.reason);
                    return;
                case 'found':
                    if (!saving.base) {
                        await turnOn(inspection);
                        return;
                    }

                    tracking.saveSaving({
                        state: 'on',
                        base: saving.base,
                        sha: inspection.sha,
                        etag: null,
                        syncedAt: saving.syncedAt ?? null,
                    });
                    await sync();
                    return;
                default:
                    assertNever(inspection);
            }
        }

        /**
         * Syncs when the user comes back to the tab — shown again, or its window focused. Both usually arrive
         * together: one joins the sync the other started, rather than reading the file again after it.
         */
        function syncShown() {
            return session?.running ?? sync();
        }

        /**
         * Syncs the settings with the file now, while syncing is on; one at a time — called during one, it runs once
         * more after it and resolves after that. Never rejects.
         */
        function sync(): Promise<void> {
            const current = session;
            if (!current || !tracking.loaded) {
                return Promise.resolve();
            }

            if (current.running) {
                current.again = true;
                return current.running;
            }

            current.running = runSyncs(current).finally(() => {
                current.running = null;
            });
            return current.running;
        }

        async function runSyncs(current: Session) {
            do {
                current.again = false;
                try {
                    await syncOnce(current);
                } catch (error) {
                    if (isCurrent(current)) {
                        logger.warn('The settings could not be synced', { error });
                    }
                }
            } while (current.again && isCurrent(current));
        }

        async function syncOnce(current: Session) {
            let saving = tracking.readSaving();
            for (let round = 0; round < WRITE_ROUNDS; round++) {
                if (saving.state !== 'on' || !isCurrent(current)) {
                    return;
                }

                const read = await readSettingsFile(current.rest, {
                    owner: current.account.login,
                    // A conflict says the file moved on: read it whole.
                    etag: round === 0 ? saving.etag : null,
                });
                if (!isCurrent(current) || tracking.readSaving().state !== 'on') {
                    return;
                }

                let remote = saving.base;
                let { sha, etag } = saving;
                switch (read.status) {
                    case 304:
                        break;
                    case 404:
                        // Gone — unless this device created the repository and has not written the file yet.
                        if (saving.sha !== null) {
                            stop({ kind: 'deleted' }, saving);
                            return;
                        }

                        break;
                    case 200: {
                        const parsed = parseSettings(read.text);
                        if (parsed.kind !== 'ok') {
                            stop(
                                parsed.kind === 'newer'
                                    ? { kind: 'newer', version: parsed.version }
                                    : { kind: 'unreadable' },
                                saving,
                            );
                            return;
                        }

                        remote = parsed.document;
                        ({ sha, etag } = read);
                        break;
                    }
                    default:
                        assertNever(read);
                }

                const local = tracking.document;
                const merged = mergeSettings({ local, remote, base: saving.base });
                if (!isSame(merged, local)) {
                    tracking.replaceDocument(merged);
                }

                if (isSame(merged, remote) && sha !== null) {
                    keepOn({ state: 'on', base: remote, sha, etag, syncedAt: clock.now() });
                    return;
                }

                // Taken the file in: what is left to save is what this device adds to it, also if the write is lost.
                saving = { state: 'on', base: remote, sha, etag, syncedAt: saving.syncedAt };
                if (!keepOn(saving)) {
                    return;
                }

                const written = await write(current, merged, sha);
                if (!written) {
                    return;
                }

                if (written.kind === 'written') {
                    keepOn({ state: 'on', base: merged, sha: written.sha, etag: null, syncedAt: clock.now() });
                    return;
                }

                if (sha === null) {
                    await pause(NEW_REPOSITORY_PAUSE_MS);
                }

                saving = tracking.readSaving();
            }
        }

        /** Keeps `next` unless syncing was turned off or stopped meanwhile, here or in another tab; whether it did. */
        function keepOn(next: SettingsSaving) {
            if (tracking.readSaving().state !== 'on') {
                return false;
            }

            tracking.saveSaving(next);
            return true;
        }

        function pause(ms: number) {
            return new Promise<void>(resolve => {
                clock.schedule(resolve, ms);
            });
        }

        /** Writes `document` over the version `sha`; `null` when it was not written, or syncing stopped. */
        async function write(current: Session, document: SettingsDocument, sha: string | null) {
            try {
                const written = await writeSettingsFile(current.rest, {
                    owner: current.account.login,
                    text: serializeSettings(document),
                    sha,
                });
                return isCurrent(current) ? written : null;
            } catch (error) {
                const failure = classify(error);
                if (!isCurrent(current)) {
                    return null;
                }

                if (failure.kind === 'stop') {
                    stop(failure.reason, tracking.readSaving());
                    return null;
                }

                throw error;
            }
        }

        async function inspectFor(current: Session): Promise<SettingsInspection> {
            const owner = current.account.login;
            const repository = await getSettingsRepository(current.rest, owner);
            if (!repository.exists) {
                return { kind: 'absent' };
            }

            if (!repository.private) {
                return { kind: 'unusable', reason: { kind: 'public' } };
            }

            const read = await readSettingsFile(current.rest, { owner, etag: null });
            switch (read.status) {
                case 404:
                    return { kind: 'unusable', reason: { kind: 'foreign' } };
                case 304:
                    // Not asked conditionally; GitHub would not answer so.
                    throw new GitHubApiError({
                        status: 304,
                        message: 'GitHub answered an unconditional read with 304',
                    });
                case 200: {
                    const parsed = parseSettings(read.text);
                    switch (parsed.kind) {
                        case 'ok':
                            return { kind: 'found', document: parsed.document, sha: read.sha, etag: read.etag };
                        case 'newer':
                            return { kind: 'unusable', reason: { kind: 'newer', version: parsed.version } };
                        case 'unreadable':
                            return { kind: 'unusable', reason: { kind: 'unreadable' } };
                        default:
                            return assertNever(parsed);
                    }
                }
                default:
                    return assertNever(read);
            }
        }

        /** Stops syncing for `reason`, keeping what `on` had, so that trying again goes on from it. */
        function stop(reason: StoppedReason, from: SettingsSaving = tracking.readSaving()) {
            switch (from.state) {
                case 'on':
                    tracking.saveSaving({
                        state: 'stopped',
                        reason,
                        base: from.base,
                        sha: from.sha,
                        etag: from.etag,
                        syncedAt: from.syncedAt,
                    });
                    break;
                case 'stopped':
                    tracking.saveSaving({ ...from, reason });
                    break;
                case 'off':
                    break;
                default:
                    assertNever(from);
            }
        }

        /** Another account signed in, or none: syncs for the new one once its settings are in memory. */
        function follow(account: Account | null) {
            session = null;
            if (!account) {
                return;
            }

            const current: Session = {
                account,
                rest: createRest(() => account.token),
                running: null,
                again: false,
            };
            session = current;
            void syncWhenReady(current);
        }

        /** Syncs once the user's settings are in memory — after sign-in, or when the app starts. */
        async function syncWhenReady(current: Session) {
            await tracking.ready();
            if (isCurrent(current)) {
                await sync();
            }
        }

        function assertSession() {
            if (!session) {
                throw new Error('Settings sync needs a signed-in user');
            }

            return session;
        }

        /** Whether `current` is still the session — what it asked GitHub may be kept. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

/**
 * What syncing does about a failed call: GitHub out of reach, failing, or the allowance spent pass; a 404 means the
 * repository is gone; any other refusal stops syncing with GitHub's message.
 */
function classify(error: unknown): Failure {
    if (!(error instanceof GitHubApiError) || isRateLimitRefusal(error)) {
        return { kind: 'transient' };
    }

    const { status } = error;
    if (status === 404) {
        return { kind: 'stop', reason: { kind: 'deleted' } };
    }

    // A 401 signs the user out elsewhere; a 2xx said something unexpected.
    if (status < 400 || status === 401 || status >= 500) {
        return { kind: 'transient' };
    }

    return { kind: 'stop', reason: { kind: 'refused', message: error.githubMessage ?? error.message } };
}

function isSame(a: SettingsDocument, b: SettingsDocument) {
    return serializeSettings(a) === serializeSettings(b);
}
