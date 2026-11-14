import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';

/** Where the unfolded folders are kept, per user: `githq.refFolders.<login>`. */
const KEY_PREFIX = 'githq.refFolders.';

/**
 * Which folders of the branch and tag list the user unfolded, per repository: folders are folded until opened. Each
 * path is `branches:<a/b>` or `tags:<a/b>`. It describes what the user is looking at, so it stays on this device and
 * never goes into the saved settings; forgotten when they sign out. A change another tab of the browser made shows
 * here too.
 */
export type CommitRefFolders = Resolved<typeof CommitRefFolders>;
export const CommitRefFolders = defineService({
    name: 'CommitRefFolders',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const foldersRef = shallowRef<Readonly<Record<string, string[]>>>({});
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: read,
            follow: folders => {
                foldersRef.value = folders ?? {};
            },
        });
        browser.onLocalStorageChange(key => {
            if (key === null || key.startsWith(KEY_PREFIX)) {
                foldersRef.value = slot.read() ?? {};
            }
        });

        return { isUnfolded, toggle };

        /** Whether the repository's folder at `path` is unfolded; reactive. */
        function isUnfolded(nameWithOwner: string, path: string): boolean {
            return foldersRef.value[nameWithOwner]?.includes(path) ?? false;
        }

        /**
         * Folds the folder if it is unfolded, unfolds it otherwise. With `presentPaths` — the folders on screen, a
         * complete read — it also forgets the repository's unfolded folders that are not among them; with `null`
         * (the read is not complete) it forgets nothing.
         */
        function toggle(nameWithOwner: string, path: string, presentPaths: readonly string[] | null) {
            const all = slot.read() ?? foldersRef.value;
            const unfolded = all[nameWithOwner] ?? [];
            const flipped = unfolded.includes(path) ? unfolded.filter(known => known !== path) : [...unfolded, path];
            const kept = presentPaths ? flipped.filter(known => presentPaths.includes(known)) : flipped;

            const { [nameWithOwner]: _replaced, ...others } = all;
            const next = kept.length > 0 ? { ...others, [nameWithOwner]: kept } : others;
            foldersRef.value = next;
            slot.save(next);
        }

        function read(stored: unknown) {
            const folders: Record<string, string[]> = {};
            if (isPlainObject(stored)) {
                for (const [nameWithOwner, paths] of Object.entries(stored)) {
                    if (Array.isArray(paths) && paths.every(path => typeof path === 'string')) {
                        folders[nameWithOwner] = paths;
                    }
                }
            }

            return folders;
        }
    },
});
