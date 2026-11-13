import type { ReviewFile } from './ReviewFiles.js';
import { getFileFolder } from './utils/getFileFolder.js';

/** A run of files as the review's file list shows them (D27): a folder's, the root's, or the submodule changes. */
export type ReviewFileGroup =
    | {
          readonly kind: 'folder';
          /** Its whole path, `src/api/generated`. */
          readonly folder: string;
          readonly files: readonly ReviewFile[];
      }
    /** The files at the repository's root; while a filter is on, every file matching it, flat. */
    | { readonly kind: 'root'; readonly files: readonly ReviewFile[] }
    /** The submodule changes, wherever they sit, under a header of their own. */
    | { readonly kind: 'submodules'; readonly files: readonly ReviewFile[] };

/**
 * The files in the order of the list and the diff (D27): each folder that holds a file directly, in GitHub's tree order
 * (a folder right before the ones inside it), then the files at the root, then the submodule changes. Within a group they
 * stay in the order given. A folder holding only folders has no group: its path is part of theirs (compact folders, as
 * in VS Code). A file is a submodule only once its patch says so: one whose patch hasn't arrived, or a gone one, stays
 * in its folder.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupReviewFiles(files: readonly ReviewFile[]): ReviewFileGroup[] {
    const byFolder = new Map<string, ReviewFile[]>();
    const root: ReviewFile[] = [];
    const submodules: ReviewFile[] = [];
    for (const file of files) {
        if (file.patch?.submodule != null) {
            submodules.push(file);
            continue;
        }

        const folder = getFileFolder(file.path);
        if (folder === null) {
            root.push(file);
            continue;
        }

        const group = byFolder.get(folder);
        if (group) {
            group.push(file);
        } else {
            byFolder.set(folder, [file]);
        }
    }

    const groups = [...byFolder]
        .toSorted(([a], [b]) => compareFolders(a, b))
        .map(([folder, grouped]): ReviewFileGroup => ({ kind: 'folder', folder, files: grouped }));
    if (root.length > 0) {
        groups.push({ kind: 'root', files: root });
    }

    if (submodules.length > 0) {
        groups.push({ kind: 'submodules', files: submodules });
    }

    return groups;
}

/** By segment, so that `e2e/fixtures` follows `e2e` even with `e2e-tools` around. By code unit, as git sorts. */
function compareFolders(a: string, b: string) {
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
