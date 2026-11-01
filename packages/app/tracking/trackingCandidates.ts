import type {
    CandidateProject,
    CandidateRepositories,
    CandidateRepository,
    TrackedProject,
    TrackedRepository,
    TrackingCandidates,
} from './TrackingTypes.js';

// What the tracking screens do with what they offer (G2, G8): the repositories and projects of the user and of
// each organisation as one list, and a chosen one as what is tracked.

/**
 * Every repository read so far, the user's then each organisation's, in GitHub's order.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCandidateRepositories(candidates: TrackingCandidates): CandidateRepository[] {
    return [
        ...candidates.repositories.repositories,
        ...candidates.organizations.flatMap(organization => organization.repositories?.repositories ?? []),
    ];
}

/** The repositories an owner lists, read so far. */
export interface OwnerRepositories extends CandidateRepositories {
    /** The user's or the organisation's login. */
    readonly login: string;
}

/**
 * The user's repository list, then each organisation's that GitHub lists, by owner — not one whose list it refused.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getOwnerLists(candidates: TrackingCandidates): OwnerRepositories[] {
    return [
        { login: candidates.login, ...candidates.repositories },
        ...candidates.organizations.flatMap(organization =>
            organization.repositories ? [{ login: organization.login, ...organization.repositories }] : [],
        ),
    ];
}

/**
 * Every project, the user's and each organisation's: open before closed, the most recently updated first.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCandidateProjects(candidates: TrackingCandidates): CandidateProject[] {
    return [
        ...candidates.projects,
        ...candidates.organizations.flatMap(organization => organization.projects),
    ].toSorted((a, b) => Number(a.closed) - Number(b.closed) || b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * An offered repository as it is tracked.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toTrackedRepository(candidate: CandidateRepository): TrackedRepository {
    return { nameWithOwner: candidate.nameWithOwner, id: candidate.id };
}

/**
 * An offered project as it is tracked.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toTrackedProject(candidate: CandidateProject): TrackedProject {
    return {
        id: candidate.id,
        owner: candidate.owner,
        ownerKind: candidate.ownerKind,
        number: candidate.number,
        title: candidate.title,
    };
}
