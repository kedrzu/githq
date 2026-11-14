import { assertNever } from '@nzyme/utils/assertNever.js';

import { compareText } from '@/utils/compareText.js';

import type { CommitRef } from './CommitTypes.js';

/** Which of the list's groups a tree is built for; the first part of every folder path. */
export type RefTreeGroup = 'branches' | 'tags';

/** How the entries of every level are ordered: folders always come before refs. */
export type RefTreeOrder = 'name' | 'newest';

/**
 * A level of the ref tree: a group's root or a folder. Its entries are kept unordered; `flattenRefTree` orders them,
 * so one tree serves both orders.
 */
export interface RefTreeFolder {
    /**
     * `<group>:<a/b>`, as `CommitRefFolders` keeps it (`tags:release/2026`). The root of a group is `<group>:`
     * (`tags:`), the path its own "Show more" row carries.
     */
    readonly path: string;
    /** Its last segment; `''` for the root. */
    readonly name: string;
    readonly folders: readonly RefTreeFolder[];
    readonly refs: readonly RefTreeLeaf[];
    /** How many refs it holds, at every level below it. */
    readonly count: number;
    /** The `committedDate` of its newest ref, at every level below it. */
    readonly newestDate: string;
}

/** A ref in its level of the tree. */
export interface RefTreeLeaf {
    readonly ref: CommitRef;
    /** Its name past its folder's path: `q4` in `release/2026`, `kedrzu/fix-x` when no other ref shares `kedrzu/`. */
    readonly label: string;
}

/** A row of the list drawn from a ref tree, in the order it is drawn. `depth` is 0 for the group's top level. */
export type RefTreeRow =
    | {
          readonly kind: 'folder';
          readonly path: string;
          readonly name: string;
          /** The refs it holds, at every level; while filtering, its matches. */
          readonly count: number;
          /** Whether its entries follow; always while filtering. */
          readonly unfolded: boolean;
          readonly depth: number;
      }
    | {
          readonly kind: 'ref';
          readonly ref: CommitRef;
          /** Its name past its folder's path; the full name while filtering. */
          readonly label: string;
          readonly depth: number;
      }
    | {
          readonly kind: 'more';
          /** The path of the level it shows more of: a folder's, or the root's `<group>:`. */
          readonly path: string;
          /** How many entries of the level are not drawn. */
          readonly hidden: number;
          /** The depth of the entries it shows more of. */
          readonly depth: number;
      };

/** What decides which rows of a ref tree are drawn. */
export interface FlattenRefTreeOptions {
    /** Whether the folder at the path is unfolded; ignored while filtering, which unfolds every folder shown. */
    readonly isUnfolded: (path: string) => boolean;
    /** How many entries, folders and refs together, the level at the path draws (the root's path is `<group>:`). */
    readonly shownAt: (path: string) => number;
    readonly order: RefTreeOrder;
    /** The refs that match the filter; `null` or absent while not filtering. */
    readonly matches?: ReadonlySet<CommitRef> | null;
}

/** A level's entry as one ordered list: a folder with what it shows, or a ref. */
type LevelEntry =
    | { readonly kind: 'folder'; readonly folder: RefTreeFolder; readonly count: number; readonly newestDate: string }
    | { readonly kind: 'ref'; readonly leaf: RefTreeLeaf };

/** A level to build: its refs labelled by their names past its path. */
interface BuildFolderParams {
    readonly path: string;
    readonly name: string;
    readonly entries: readonly RefTreeLeaf[];
}

/** Natural order, so `v99` comes before `v100`. */
const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true });

/**
 * Nests a group's refs by `/` into folders, at every level. A prefix shared by two refs or more at a level is a folder;
 * one held by a single ref makes none, and that ref stays loose under its full remaining name. A ref and a folder of
 * the same name both stay. Build it once per list of refs and flatten it for each view.
 * @__NO_SIDE_EFFECTS__
 */
export function buildRefTree(refs: readonly CommitRef[], group: RefTreeGroup): RefTreeFolder {
    return buildFolder({
        path: `${group}:`,
        name: '',
        entries: refs.map(ref => ({ ref, label: ref.name })),
    });
}

/**
 * The rows a ref tree draws: each level ordered folders first, then refs, cut to what it shows with a "Show more" row
 * for the rest, and an unfolded folder's rows right under it. While filtering, only matches and the folders holding
 * them show, all unfolded, counting their matches.
 * @__NO_SIDE_EFFECTS__
 */
export function flattenRefTree(tree: RefTreeFolder, options: FlattenRefTreeOptions): RefTreeRow[] {
    const matches = options.matches ?? null;
    const rows: RefTreeRow[] = [];
    pushLevel(tree, 0);
    return rows;

    function pushLevel(folder: RefTreeFolder, depth: number) {
        const entries = getLevelEntries(folder, matches).toSorted((a, b) => compareEntries(a, b, options.order));
        const shown = entries.slice(0, Math.max(0, options.shownAt(folder.path)));
        for (const entry of shown) {
            switch (entry.kind) {
                case 'folder': {
                    const unfolded = matches !== null || options.isUnfolded(entry.folder.path);
                    rows.push({
                        kind: 'folder',
                        path: entry.folder.path,
                        name: entry.folder.name,
                        count: entry.count,
                        unfolded,
                        depth,
                    });
                    if (unfolded) {
                        pushLevel(entry.folder, depth + 1);
                    }

                    break;
                }

                case 'ref': {
                    const { ref, label } = entry.leaf;
                    rows.push({ kind: 'ref', ref, label: matches === null ? label : ref.name, depth });
                    break;
                }
            }
        }

        const hidden = entries.length - shown.length;
        if (hidden > 0) {
            rows.push({ kind: 'more', path: folder.path, hidden, depth });
        }
    }
}

function buildFolder(params: BuildFolderParams): RefTreeFolder {
    const byPrefix = new Map<string, RefTreeLeaf[]>();
    const loose: RefTreeLeaf[] = [];
    for (const entry of params.entries) {
        const slash = entry.label.indexOf('/');
        if (slash <= 0) {
            loose.push(entry);
            continue;
        }

        const prefix = entry.label.slice(0, slash);
        const sharing = byPrefix.get(prefix);
        const child = { ref: entry.ref, label: entry.label.slice(slash + 1) };
        if (sharing) {
            sharing.push(child);
        } else {
            byPrefix.set(prefix, [child]);
        }
    }

    const folders: RefTreeFolder[] = [];
    for (const [prefix, children] of byPrefix) {
        const [only] = children;
        if (only && children.length === 1) {
            loose.push({ ref: only.ref, label: `${prefix}/${only.label}` });
            continue;
        }

        const separator = params.name === '' ? '' : '/';
        folders.push(buildFolder({ path: `${params.path}${separator}${prefix}`, name: prefix, entries: children }));
    }

    let count = loose.length;
    let newestDate = '';
    for (const leaf of loose) {
        newestDate = maxText(newestDate, leaf.ref.committedDate);
    }

    for (const folder of folders) {
        count += folder.count;
        newestDate = maxText(newestDate, folder.newestDate);
    }

    return { path: params.path, name: params.name, folders, refs: loose, count, newestDate };
}

/** The folder's entries that show: all of them, or while filtering the matches and the folders holding any. */
function getLevelEntries(folder: RefTreeFolder, matches: ReadonlySet<CommitRef> | null): LevelEntry[] {
    const entries: LevelEntry[] = [];
    for (const child of folder.folders) {
        if (matches === null) {
            entries.push({ kind: 'folder', folder: child, count: child.count, newestDate: child.newestDate });
            continue;
        }

        const summary = summarizeMatches(child, matches);
        if (summary.count > 0) {
            entries.push({ kind: 'folder', folder: child, count: summary.count, newestDate: summary.newestDate });
        }
    }

    for (const leaf of folder.refs) {
        if (matches === null || matches.has(leaf.ref)) {
            entries.push({ kind: 'ref', leaf });
        }
    }

    return entries;
}

function summarizeMatches(folder: RefTreeFolder, matches: ReadonlySet<CommitRef>) {
    let count = 0;
    let newestDate = '';
    for (const leaf of folder.refs) {
        if (matches.has(leaf.ref)) {
            count++;
            newestDate = maxText(newestDate, leaf.ref.committedDate);
        }
    }

    for (const child of folder.folders) {
        const summary = summarizeMatches(child, matches);
        count += summary.count;
        newestDate = maxText(newestDate, summary.newestDate);
    }

    return { count, newestDate };
}

function compareEntries(a: LevelEntry, b: LevelEntry, order: RefTreeOrder): number {
    if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
    }

    const aName = getEntryName(a);
    const bName = getEntryName(b);
    switch (order) {
        case 'name':
            return NAME_COLLATOR.compare(aName, bName) || compareText(aName, bName);
        case 'newest':
            return compareText(getEntryDate(b), getEntryDate(a)) || compareText(aName, bName);
        default:
            return assertNever(order);
    }
}

function getEntryName(entry: LevelEntry): string {
    return entry.kind === 'folder' ? entry.folder.name : entry.leaf.label;
}

function getEntryDate(entry: LevelEntry): string {
    return entry.kind === 'folder' ? entry.newestDate : entry.leaf.ref.committedDate;
}

function maxText(a: string, b: string): string {
    return compareText(a, b) >= 0 ? a : b;
}
