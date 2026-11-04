import type { ReviewBlobOidAnswer } from '@githq/github/readReviewBlobs.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { openDB } from 'idb';
import type { DBSchema } from 'idb';

import { createDatabaseConnections } from '@/utils/createDatabaseConnections.js';

import type { ReviewPosition } from './buildReviewRows.js';
import type { DiffLineRange } from './diff/buildDiffRows.js';
import type { ReviewFile } from './ReviewFiles.js';
import type { ReviewThread } from './threads/ReviewThread.js';
import type { FileFilterInput } from './utils/createFileFilter.js';
import { NO_REVIEW_SUBMISSION } from './writing/ReviewWriting.js';
import type { ReviewCommentTarget, ReviewSubmissionChoice } from './writing/ReviewWriting.js';

/** The layout of the database. Separate from the local copy's version, whose every raise would drop the contents. */
const REVIEW_BLOB_DATABASE_VERSION = 4;

/** Every store of the database, with how it is keyed. */
const STORES = [
    ['blobs', { keyPath: 'oid' }],
    ['resolutions', {}],
    ['mergeBases', {}],
    ['fileLists', {}],
    ['threads', {}],
    ['reviewStates', {}],
    ['commentBoxes', {}],
] as const;

/**
 * The database of what `login`'s reviews keep: contents, file lists, review threads, paths and oids. `IndexedDbPersistence.destroy`
 * deletes it with the local copy, so whatever signs a user out — here, in another tab or by a token GitHub rejects —
 * takes their private files off the disk.
 */
export function getReviewBlobDatabaseName(login: string) {
    return `githq-blobs/${login}`;
}

/** A file's content, which its oid names for good. */
export interface ReviewBlob {
    readonly oid: string;
    readonly text: string;
}

/** What an expression (`<commit oid>:<path>`) resolves to for good. A failure to answer says nothing about that. */
export type ReviewKeptResolution = Exclude<ReviewBlobOidAnswer, { readonly kind: 'failed' }>;

/** A pull request's list of files, as it was when last read whole. Only ever what to show until GitHub answers. */
export interface ReviewKeptFileList {
    readonly id: string;
    readonly headRefOid: string;
    readonly baseRefOid: string;
    readonly changedFiles: number;
    readonly files: readonly ReviewFile[];
}

/** Lines of a file shown beyond the context, and the head blob they mean those lines of (D14). */
export interface ReviewExpandedLines {
    readonly oid: string;
    readonly lines: readonly DiffLineRange[];
}

/** What the user did in a pull request (D14). Nothing of it goes to GitHub or to the synced settings. */
export interface ReviewKeptState {
    /** `null` until it has been opened: it then lands by D16. */
    readonly position: ReviewPosition | null;
    /** The files the user opened (`true`) or collapsed (`false`) themselves, by path. */
    readonly collapseChoices: ReadonlyMap<string, boolean>;
    readonly filter: FileFilterInput;
    readonly hideViewed: boolean;
    /** By path. */
    readonly expandedLines: ReadonlyMap<string, ReviewExpandedLines>;
    /** What the submit dialog holds, until it is sent or the draft is discarded (CR76). */
    readonly submission: ReviewSubmissionChoice;
}

/** A comment box left with text in it: what makes a comment not sent yet survive a reload. */
export interface ReviewKeptCommentBox extends ReviewCommentTarget {
    readonly text: string;
}

/** What a pull request keeps until something is done in it. */
const NOTHING_DONE: ReviewKeptState = {
    position: null,
    collapseChoices: new Map(),
    filter: { pattern: '', regex: false },
    hideViewed: false,
    expandedLines: new Map(),
    submission: NO_REVIEW_SUBMISSION,
};

/** What a review keeps on disk, by login. A `read` opens the login's database; a `write` rejects when it is not open (anymore). */
export interface ReviewBlobStoreShape {
    /** The texts of those of `oids` it holds, by oid. */
    read(login: string, oids: readonly string[]): Promise<Map<string, string>>;
    write(login: string, blobs: readonly ReviewBlob[]): Promise<void>;
    /** Those of `keys` it holds, by key, in one transaction. */
    readResolutions(login: string, keys: readonly string[]): Promise<Map<string, ReviewKeptResolution>>;
    writeResolutions(login: string, resolutions: ReadonlyMap<string, ReviewKeptResolution>): Promise<void>;
    readMergeBase(login: string, key: string): Promise<string | undefined>;
    writeMergeBase(login: string, key: string, oid: string): Promise<void>;
    readFileList(login: string, key: string): Promise<ReviewKeptFileList | undefined>;
    writeFileList(login: string, key: string, list: ReviewKeptFileList): Promise<void>;
    deleteFileList(login: string, key: string): Promise<void>;
    /** A pull request's review threads as last read whole, by the same key as its list. */
    readThreads(login: string, key: string): Promise<readonly ReviewThread[] | undefined>;
    writeThreads(login: string, key: string, threads: readonly ReviewThread[]): Promise<void>;
    deleteThreads(login: string, key: string): Promise<void>;
    /** What the user did in a pull request, by the same key as its list. */
    readState(login: string, key: string): Promise<ReviewKeptState | undefined>;
    /** Over what is kept, in one transaction: the rest may be what another tab on the pull request did. */
    writeState(login: string, key: string, changes: Partial<ReviewKeptState>): Promise<void>;
    /** A pull request's comment boxes with text in them, by the same key as its list. */
    readCommentBoxes(login: string, key: string): Promise<readonly ReviewKeptCommentBox[]>;
    /** One record per box: another tab on the pull request has boxes of its own. */
    writeCommentBox(login: string, key: string, box: ReviewKeptCommentBox): Promise<void>;
    deleteCommentBox(login: string, key: string, id: string): Promise<void>;
}

interface ReviewBlobDatabase extends DBSchema {
    blobs: { key: string; value: ReviewBlob };
    resolutions: { key: string; value: ReviewKeptResolution };
    mergeBases: { key: string; value: string };
    fileLists: { key: string; value: ReviewKeptFileList };
    threads: { key: string; value: readonly ReviewThread[] };
    reviewStates: { key: string; value: ReviewKeptState };
    commentBoxes: { key: string; value: ReviewKeptCommentBox };
}

/**
 * What makes a review open without the network, on disk (D19) in a database per login: the contents of reviewed files
 * by blob oid, what expressions resolve to and merge bases, which never change, and each pull request's list of files,
 * review threads and what the user did in it, which do, and the comments typed there and not sent. A cache kept apart from the local copy, for that one is dropped on every version raise and these are
 * worth not downloading again. Nothing cleans it up yet but signing out.
 *
 * Only the `read` functions open the database, so they must be called only for the user signed in now. A connection
 * gives way when another one wants the database deleted — this or another tab signing out — and only a later read opens
 * it again: a late write fails rather than bringing back the files of a user who signed out.
 */
export type ReviewBlobStore = Resolved<typeof ReviewBlobStore>;
export const ReviewBlobStore = defineService({
    name: 'ReviewBlobStore',
    setup(): ReviewBlobStoreShape {
        const { connect, getOpen } = createDatabaseConnections(openDatabase);

        return {
            read,
            write,
            readResolutions,
            writeResolutions,
            readMergeBase,
            writeMergeBase,
            readFileList,
            writeFileList,
            deleteFileList,
            readThreads,
            writeThreads,
            deleteThreads,
            readState,
            writeState,
            readCommentBoxes,
            writeCommentBox,
            deleteCommentBox,
        };

        async function read(login: string, oids: readonly string[]) {
            const db = await connect(login);
            const tx = db.transaction('blobs');
            const found = await Promise.all(oids.map(oid => tx.store.get(oid)));
            const texts = new Map<string, string>();
            for (const blob of found) {
                if (blob) {
                    texts.set(blob.oid, blob.text);
                }
            }

            return texts;
        }

        async function write(login: string, blobs: readonly ReviewBlob[]) {
            const db = await getOpen(login);
            const tx = db.transaction('blobs', 'readwrite');
            await Promise.all([...blobs.map(blob => tx.store.put(blob)), tx.done]);
        }

        async function readResolutions(login: string, keys: readonly string[]) {
            const db = await connect(login);
            const tx = db.transaction('resolutions');
            const found = await Promise.all(keys.map(key => tx.store.get(key)));
            const resolutions = new Map<string, ReviewKeptResolution>();
            for (const [index, resolution] of found.entries()) {
                const key = keys[index];
                if (key !== undefined && resolution) {
                    resolutions.set(key, resolution);
                }
            }

            return resolutions;
        }

        async function writeResolutions(login: string, resolutions: ReadonlyMap<string, ReviewKeptResolution>) {
            const db = await getOpen(login);
            const tx = db.transaction('resolutions', 'readwrite');
            await Promise.all([...[...resolutions].map(([key, resolution]) => tx.store.put(resolution, key)), tx.done]);
        }

        async function readMergeBase(login: string, key: string) {
            const db = await connect(login);
            return await db.get('mergeBases', key);
        }

        async function writeMergeBase(login: string, key: string, oid: string) {
            const db = await getOpen(login);
            await db.put('mergeBases', oid, key);
        }

        async function readFileList(login: string, key: string) {
            const db = await connect(login);
            return await db.get('fileLists', key);
        }

        async function writeFileList(login: string, key: string, list: ReviewKeptFileList) {
            const db = await getOpen(login);
            await db.put('fileLists', list, key);
        }

        async function deleteFileList(login: string, key: string) {
            const db = await getOpen(login);
            await db.delete('fileLists', key);
        }

        async function readThreads(login: string, key: string) {
            const db = await connect(login);
            return await db.get('threads', key);
        }

        async function writeThreads(login: string, key: string, threads: readonly ReviewThread[]) {
            const db = await getOpen(login);
            await db.put('threads', threads, key);
        }

        async function deleteThreads(login: string, key: string) {
            const db = await getOpen(login);
            await db.delete('threads', key);
        }

        async function readState(login: string, key: string) {
            const db = await connect(login);
            return await db.get('reviewStates', key);
        }

        async function writeState(login: string, key: string, changes: Partial<ReviewKeptState>) {
            const db = await getOpen(login);
            const tx = db.transaction('reviewStates', 'readwrite');
            const kept = await tx.store.get(key);
            await Promise.all([tx.store.put({ ...NOTHING_DONE, ...kept, ...changes }, key), tx.done]);
        }

        async function readCommentBoxes(login: string, key: string) {
            const db = await connect(login);
            return await db.getAll('commentBoxes', IDBKeyRange.bound(`${key}\0`, `${key}\0\uffff`));
        }

        async function writeCommentBox(login: string, key: string, box: ReviewKeptCommentBox) {
            const db = await getOpen(login);
            await db.put('commentBoxes', box, `${key}\0${box.id}`);
        }

        async function deleteCommentBox(login: string, key: string, id: string) {
            const db = await getOpen(login);
            await db.delete('commentBoxes', `${key}\0${id}`);
        }
    },
});

function openDatabase(login: string) {
    return openDB<ReviewBlobDatabase>(getReviewBlobDatabaseName(login), REVIEW_BLOB_DATABASE_VERSION, {
        upgrade(db) {
            // Added to, never dropped: what's in `blobs` is named by its oid for good and costly to read again.
            for (const [name, options] of STORES) {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, options);
                }
            }
        },
    });
}
