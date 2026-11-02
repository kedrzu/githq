import type { ProjectOwnerKind } from '@/projects/ProjectTypes.js';

/**
 * How the user stands to an owner of something they track (G8, T17): it is them, an organisation they are in, an
 * owner they aren't a member of — or not known yet, before GitHub's lists of what they can track are read.
 */
export type TrackedOwnerRelation = 'own' | 'organization' | 'notMember' | 'unknown';

/** The tracked repositories or projects of one owner, as Settings' Repositories and Projects list them. */
export interface TrackedOwnerGroup<T> {
    readonly login: string;
    readonly relation: TrackedOwnerRelation;
    /** What its icon shows: a person or a building. */
    readonly ownerKind: ProjectOwnerKind;
    /** How many the owner has to track, as GitHub lists them; `null` when not known or it can't be listed. */
    readonly total: number | null;
    /** Its "Track more": listed, and something of it is left to track. */
    readonly canTrackMore: boolean;
    /** Alphabetical. */
    readonly rows: readonly T[];
}

/** What {@link groupTrackedByOwner} groups, and by what. */
export interface GroupTrackedByOwnerParams<T> {
    readonly entries: readonly T[];
    readonly getOwner: (entry: T) => string;
    /** What it is sorted by inside its group. */
    readonly getName: (entry: T) => string;
    /** Whose own a group is, a person rather than an organisation; `null` when nobody can be told by it. */
    readonly getOwnerKind?: (entry: T) => ProjectOwnerKind;
    /** The signed-in user's login; `null` signed out. */
    readonly login: string | null;
    /**
     * How many each owner the user is in (themselves and their organisations) has to track, by login — `null` for
     * one GitHub refuses to list; the map itself `null` until GitHub's lists are read.
     */
    readonly listed: ReadonlyMap<string, number | null> | null;
}

/**
 * Tracked repositories or projects grouped by owner (G8, T17): the user's own first, then the organisations they
 * are in, then the owners they aren't a member of — or, before that is known, every other owner — each kind of
 * owner, and the entries inside a group, alphabetical. Logins match whatever their case, as on GitHub.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function groupTrackedByOwner<T>(params: GroupTrackedByOwnerParams<T>): TrackedOwnerGroup<T>[] {
    const { getName, getOwner, getOwnerKind, listed } = params;
    const login = params.login?.toLowerCase() ?? null;
    const listedByKey = new Map([...(listed ?? [])].map(([owner, total]) => [owner.toLowerCase(), total]));
    const byOwner = new Map<string, T[]>();
    for (const entry of params.entries) {
        const key = getOwner(entry).toLowerCase();
        byOwner.set(key, [...(byOwner.get(key) ?? []), entry]);
    }

    const groups: TrackedOwnerGroup<T>[] = [];
    for (const [key, entries] of byOwner) {
        const first = entries[0];
        if (first === undefined) {
            continue;
        }

        const relation = getRelation(key);
        const total = listedByKey.get(key) ?? null;
        groups.push({
            login: getOwner(first),
            relation,
            ownerKind: relation === 'own' ? 'user' : (getOwnerKind?.(first) ?? 'org'),
            total,
            canTrackMore:
                (relation === 'own' || relation === 'organization') && total !== null && entries.length < total,
            rows: entries.toSorted((a, b) => compareNames(getName(a), getName(b))),
        });
    }

    return groups.toSorted(
        (a, b) => RELATION_ORDER[a.relation] - RELATION_ORDER[b.relation] || compareNames(a.login, b.login),
    );

    function getRelation(key: string): TrackedOwnerRelation {
        if (key === login) {
            return 'own';
        }

        if (!listed) {
            return 'unknown';
        }

        return listedByKey.has(key) ? 'organization' : 'notMember';
    }
}

const RELATION_ORDER: Readonly<Record<TrackedOwnerRelation, number>> = {
    own: 0,
    organization: 1,
    unknown: 2,
    notMember: 3,
};

function compareNames(a: string, b: string) {
    return a.localeCompare(b, 'en', { sensitivity: 'base' });
}
