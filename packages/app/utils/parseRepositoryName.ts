/** A repository as GitHub names it: `owner/name`. */
export interface RepositoryName {
    readonly owner: string;
    readonly name: string;
}

/**
 * The owner and name of `owner/name` (GitHub's `nameWithOwner`); a part missing is empty. Whatever follows the
 * first `/` is the name, so `owner/name#12` gives `name#12`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseRepositoryName(nameWithOwner: string): RepositoryName {
    const slash = nameWithOwner.indexOf('/');
    return slash < 0
        ? { owner: nameWithOwner, name: '' }
        : { owner: nameWithOwner.slice(0, slash), name: nameWithOwner.slice(slash + 1) };
}
