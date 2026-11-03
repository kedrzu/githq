import type { ReviewFile } from './ReviewFiles.js';
import { getFileFolder } from './utils/getFileFolder.js';

/** A folder's files, as the review's file list shows them. */
export interface ReviewFileGroup {
    /** Its whole path, `src/api/generated`; `null` for the files at the repository's root. */
    readonly folder: string | null;
    readonly files: readonly ReviewFile[];
}

/**
 * The files in GitHub's tree order, which is the list's and the diff's: those at the root first, then each folder that
 * holds a file directly, a folder right before the ones inside it. Within a folder they stay in the order given. A
 * folder holding only folders has no group: its path is part of theirs (compact folders, as in VS Code).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupReviewFiles(files: readonly ReviewFile[]): ReviewFileGroup[] {
    const byFolder = new Map<string | null, ReviewFile[]>();
    for (const file of files) {
        const folder = getFileFolder(file.path);
        const group = byFolder.get(folder);
        if (group) {
            group.push(file);
        } else {
            byFolder.set(folder, [file]);
        }
    }

    return [...byFolder]
        .map(([folder, grouped]): ReviewFileGroup => ({ folder, files: grouped }))
        .toSorted((a, b) => compareFolders(a.folder, b.folder));
}

/** By segment, so that `e2e/fixtures` follows `e2e` even with `e2e-tools` around. By code unit, as git sorts. */
function compareFolders(a: string | null, b: string | null) {
    if (a === null || b === null) {
        return a === b ? 0 : a === null ? -1 : 1;
    }

    const left = a.split('/');
    const right = b.split('/');
    for (let index = 0; index < Math.min(left.length, right.length); index++) {
        const [x = '', y = ''] = [left[index], right[index]];
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }

    return left.length - right.length;
}
