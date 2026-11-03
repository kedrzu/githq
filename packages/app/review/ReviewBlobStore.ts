import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

/** The layout of the database. Separate from the local copy's version, whose every raise would drop the contents. */
const REVIEW_BLOB_DATABASE_VERSION = 1;

/**
 * The database of `login`'s file contents. `IndexedDbPersistence.destroy` deletes it with the local copy, so whatever
 * signs a user out — here, in another tab or by a token GitHub rejects — takes their private files off the disk.
 */
export function getReviewBlobDatabaseName(login: string) {
    return `githq-blobs/${login}`;
}

/** A file's content, which its oid names for good. */
export interface ReviewBlob {
    readonly oid: string;
    readonly text: string;
}

interface ReviewBlobDatabase extends DBSchema {
    blobs: { key: string; value: ReviewBlob };
}

/**
 * The contents of reviewed files on disk (D19), by blob oid, in a database per login. A cache kept apart from the local
 * copy, for that one is dropped on every version raise and these are worth not downloading again. Nothing cleans it up
 * yet but signing out.
 *
 * Only {@link read} opens the database, so it must be called only for the user signed in now. A connection gives way
 * when another one wants the database deleted — this or another tab signing out — and only a later `read` opens it
 * again: a late {@link write} fails rather than bringing back the files of a user who signed out.
 */
export type ReviewBlobStore = Resolved<typeof ReviewBlobStore>;
export const ReviewBlobStore = defineService({
    name: 'ReviewBlobStore',
    setup() {
        const connections = new Map<string, Promise<IDBPDatabase<ReviewBlobDatabase>>>();

        return { read, write };

        /** Opens `login`'s database when it isn't, and returns the texts of those of `oids` it holds, by oid. */
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

        /** Keeps `blobs` in the database {@link read} opened; rejects when it is not open (anymore). */
        async function write(login: string, blobs: readonly ReviewBlob[]) {
            const connection = connections.get(login);
            if (!connection) {
                throw new Error(`The file contents of ${login} are not open`);
            }

            const db = await connection;
            const tx = db.transaction('blobs', 'readwrite');
            await Promise.all([...blobs.map(blob => tx.store.put(blob)), tx.done]);
        }

        function connect(login: string) {
            let connection = connections.get(login);
            if (!connection) {
                connection = openDB<ReviewBlobDatabase>(
                    getReviewBlobDatabaseName(login),
                    REVIEW_BLOB_DATABASE_VERSION,
                    {
                        upgrade(db) {
                            db.createObjectStore('blobs', { keyPath: 'oid' });
                        },
                    },
                ).then(db => {
                    db.addEventListener('versionchange', () => {
                        db.close();
                        forget(login, connection);
                    });
                    return db;
                });

                connections.set(login, connection);
                connection.catch(() => forget(login, connection));
            }

            return connection;
        }

        function forget(login: string, connection: Promise<IDBPDatabase<ReviewBlobDatabase>> | undefined) {
            if (connections.get(login) === connection) {
                connections.delete(login);
            }
        }
    },
});
