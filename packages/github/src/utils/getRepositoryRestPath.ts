/**
 * The REST path of a repository, `/repos/{owner}/{name}`, from its `nameWithOwner`, each part escaped.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getRepositoryRestPath(nameWithOwner: string): string {
    const parts = nameWithOwner.split('/').map(part => encodeURIComponent(part));
    return `/repos/${parts.join('/')}`;
}
