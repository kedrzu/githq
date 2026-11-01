import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { readSettingsDocument } from './SettingsDocument.js';
import type { SettingsDocument } from './SettingsDocument.js';

/** Why syncing stopped (settings-sync D12): until the user tries again, nothing is written to the file. */
export type StoppedReason =
    /** The repository or its file is gone. */
    | { readonly kind: 'deleted' }
    /** A repository of that name exists without the file, so it is not githq's. */
    | { readonly kind: 'foreign' }
    /** The repository is public, found so when connecting. */
    | { readonly kind: 'public' }
    /** The file is not JSON, or not a settings document. */
    | { readonly kind: 'unreadable' }
    /** The file was written by a newer githq. */
    | { readonly kind: 'newer'; readonly version: number }
    /** GitHub refused creating the repository or writing the file, with its message. */
    | { readonly kind: 'refused'; readonly message: string };

/**
 * Whether this device keeps the user's settings in their settings repository, and what it last saw of the file there
 * (D11) — kept next to the settings in their `localStorage` slot.
 */
export type SettingsSaving =
    | {
          readonly state: 'off';
          /** Syncing was turned off here; the repository stays in the account (D10). */
          readonly repositoryLeft?: boolean;
      }
    | {
          readonly state: 'on';
          /** The file as this device last saw it: what the settings differ from it by is not saved yet. */
          readonly base: SettingsDocument;
          /** That version's blob sha; `null` while the repository githq created holds no file yet. */
          readonly sha: string | null;
          /** The ETag of the read that saw it; `null` after a write, so the next read is not conditional. */
          readonly etag: string | null;
          /** When the settings and the file last agreed (epoch ms); `null` before the first write. */
          readonly syncedAt: number | null;
      }
    | {
          readonly state: 'stopped';
          readonly reason: StoppedReason;
          /** What `on` had when it stopped, for trying again from it; none when it stopped while connecting. */
          readonly base?: SettingsDocument;
          readonly sha?: string | null;
          /** When the settings and the file last agreed, before it stopped (epoch ms). */
          readonly syncedAt?: number | null;
          /**
           * The kind of reason the user was told about in a toast (T9), so it is told once — again for another reason,
           * or once syncing went on and stopped again, which drops it.
           */
          readonly told?: StoppedReason['kind'];
      };

/** Syncing never turned on. */
export const SETTINGS_SAVING_OFF: SettingsSaving = { state: 'off' };

/**
 * The saving state kept in the slot; off when there is none or it is not understood — the slot of an older githq
 * has none.
 * @__NO_SIDE_EFFECTS__
 */
export function readSettingsSaving(stored: unknown): SettingsSaving {
    if (!isPlainObject(stored)) {
        return SETTINGS_SAVING_OFF;
    }

    switch (stored.state) {
        case 'on': {
            const base = readSettingsDocument(stored.base);
            const { sha, etag, syncedAt } = stored;
            if (
                !base ||
                (sha !== null && typeof sha !== 'string') ||
                (etag !== null && typeof etag !== 'string') ||
                (syncedAt !== null && typeof syncedAt !== 'number')
            ) {
                return SETTINGS_SAVING_OFF;
            }

            return { state: 'on', base, sha, etag, syncedAt };
        }
        case 'stopped': {
            const reason = readStoppedReason(stored.reason);
            if (!reason) {
                return SETTINGS_SAVING_OFF;
            }

            // The slot of an earlier build keeps an `etag` here too, unused.
            const base = readSettingsDocument(stored.base);
            const { sha } = stored;
            const syncedAt = typeof stored.syncedAt === 'number' ? stored.syncedAt : null;
            const told = readReasonKind(stored.told);
            const stopped: SettingsSaving =
                base && (sha === null || typeof sha === 'string')
                    ? { state: 'stopped', reason, base, sha, syncedAt }
                    : { state: 'stopped', reason };
            return told ? { ...stopped, told } : stopped;
        }
        default:
            return stored.repositoryLeft === true ? { state: 'off', repositoryLeft: true } : SETTINGS_SAVING_OFF;
    }
}

/**
 * Why syncing stopped, while the user has not been told yet (T9); `null` when it has not stopped, or they were.
 * @__NO_SIDE_EFFECTS__
 */
export function getUntoldStop(saving: SettingsSaving): StoppedReason | null {
    return saving.state === 'stopped' && saving.told !== saving.reason.kind ? saving.reason : null;
}

function readReasonKind(stored: unknown): StoppedReason['kind'] | null {
    switch (stored) {
        case 'deleted':
        case 'foreign':
        case 'public':
        case 'unreadable':
        case 'newer':
        case 'refused':
            return stored;
        default:
            return null;
    }
}

function readStoppedReason(stored: unknown): StoppedReason | null {
    if (!isPlainObject(stored)) {
        return null;
    }

    switch (stored.kind) {
        case 'deleted':
        case 'foreign':
        case 'public':
        case 'unreadable':
            return { kind: stored.kind };
        case 'newer':
            return typeof stored.version === 'number' ? { kind: 'newer', version: stored.version } : null;
        case 'refused':
            return typeof stored.message === 'string' ? { kind: 'refused', message: stored.message } : null;
        default:
            return null;
    }
}
