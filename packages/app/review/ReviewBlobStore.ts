import type { ReviewBlobOidAnswer } from '@githq/github/readReviewBlobs.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { openDB } from 'idb';
import type { DBSchema } from 'idb';

import { createDatabaseConnections } from '@/utils/createDatabaseConnections.js';

import type { ReviewFile } from './ReviewFiles.js';
import type { ReviewThread } from './threads/ReviewThread.js';

/** The layout of the database. Separate from the local copy's version, whose every raise would drop the contents. */
const REVIEW_BLOB_DATABASE_VERSION = 2;

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
}

interface ReviewBlobDatabase extends DBSchema {
    blobs: { key: string; value: ReviewBlob };
    resolutions: { key: string; value: ReviewKeptResolution };
    mergeBases: { key: string; value: string };
    fileLists: { key: string; value: ReviewKeptFileList };
    threads: { key: string; value: readonly ReviewThread[] };
}

/**
 * What makes a review open without the network, on disk (D19) in a database per login: the contents of reviewed files
 * by blob oid, what expressions resolve to and merge bases, which never change, and each pull request's list of files
 * and review threads, which do. A cache kept apart from the local copy, for that one is dropped on every version raise and these are
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
    },
});

function openDatabase(login: string) {
    return openDB<ReviewBlobDatabase>(getReviewBlobDatabaseName(login), REVIEW_BLOB_DATABASE_VERSION, {
        upgrade(db) {
            // Another layout: a cache, read again rather than carried over.
            for (const store of db.objectStoreNames) {
                db.deleteObjectStore(store);
            }

            db.createObjectStore('blobs', { keyPath: 'oid' });
            db.createObjectStore('resolutions');
            db.createObjectStore('mergeBases');
            db.createObjectStore('fileLists');
            db.createObjectStore('threads');
        },
    });
}
