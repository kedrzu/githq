import type { DBSchema, IDBPDatabase } from 'idb';

/** A database per login, see {@link createDatabaseConnections}. */
export interface DatabaseConnections<TSchema extends DBSchema> {
    /** Opens `login`'s database when it isn't: only for the user signed in now. */
    readonly connect: (login: string) => Promise<IDBPDatabase<TSchema>>;
    /** The connection {@link connect} opened; rejects when there is none (anymore). */
    readonly getOpen: (login: string) => Promise<IDBPDatabase<TSchema>>;
    /** Lets go of `login`'s connection, for a deletion queued behind it: only {@link connect} opens one again. */
    readonly forget: (login: string) => void;
}

/**
 * The connections to databases holding what a login keeps. A connection gives way when another one wants its database
 * deleted or upgraded — this or another tab signing out, or a newer githq — and only {@link DatabaseConnections.connect}
 * opens it again: a late write fails rather than bringing back the private data of a user who signed out.
 *
 * @util
 */
export function createDatabaseConnections<TSchema extends DBSchema>(
    open: (login: string) => Promise<IDBPDatabase<TSchema>>,
): DatabaseConnections<TSchema> {
    const connections = new Map<string, Promise<IDBPDatabase<TSchema>>>();

    return {
        connect,
        getOpen,
        forget: login => {
            connections.delete(login);
        },
    };

    async function getOpen(login: string) {
        const connection = connections.get(login);
        if (!connection) {
            throw new Error(`The database of ${login} is not open`);
        }

        return await connection;
    }

    function connect(login: string) {
        let connection = connections.get(login);
        if (!connection) {
            connection = open(login).then(db => {
                db.addEventListener('versionchange', () => {
                    db.close();
                    forgetConnection(login, connection);
                });
                return db;
            });

            connections.set(login, connection);
            connection.catch(() => forgetConnection(login, connection));
        }

        return connection;
    }

    function forgetConnection(login: string, connection: Promise<IDBPDatabase<TSchema>> | undefined) {
        if (connections.get(login) === connection) {
            connections.delete(login);
        }
    }
}
