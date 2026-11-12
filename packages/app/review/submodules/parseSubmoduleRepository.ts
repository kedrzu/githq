/** Where `.gitmodules` points at a repository on github.com, the rest being its `owner/name` path. */
const GITHUB_URL_PATTERN = /^(?:https?:\/\/(?:www\.)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)(.*)$/i;

/**
 * The `owner/name` of the repository a submodule's `.gitmodules` URL names: an https, SSH or scp-like (`git@…:`) URL
 * on github.com, or one relative to the parent's repository (`../r.git`), which git resolves against the parent's
 * remote. `null` for any other host or a URL that names no repository.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseSubmoduleRepository(gitUrl: string, parentNameWithOwner: string): string | null {
    const url = gitUrl.trim();
    if (url.startsWith('./') || url.startsWith('../')) {
        return readNameWithOwner(resolveRelative(parentNameWithOwner.split('/'), url.split('/')));
    }

    const path = GITHUB_URL_PATTERN.exec(url)?.[1];
    return path === undefined ? null : readNameWithOwner(path.split('/'));
}

/** `null` when `..` climbs above github.com itself. */
function resolveRelative(base: readonly string[], relative: readonly string[]) {
    const segments = [...base];
    for (const segment of relative) {
        if (segment === '..') {
            if (segments.length === 0) {
                return null;
            }

            segments.pop();
        } else if (segment !== '.') {
            segments.push(segment);
        }
    }

    return segments;
}

function readNameWithOwner(segments: readonly string[] | null) {
    // What a trailing slash leaves.
    const [owner = '', repository = '', ...rest] = segments?.at(-1) === '' ? segments.slice(0, -1) : (segments ?? []);
    const name = repository.endsWith('.git') ? repository.slice(0, -'.git'.length) : repository;
    return owner !== '' && name !== '' && rest.length === 0 ? `${owner}/${name}` : null;
}
