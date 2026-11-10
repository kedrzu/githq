/** An issue or a pull request named by its repository (`owner/name`) and number. */
export interface NumberedReference {
    readonly repository: string;
    readonly number: number;
}

/**
 * How an issue or a pull request is named from within `nameWithOwner`: `#12` in that same repository, else
 * `owner/name#12`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatRelativeReference(reference: NumberedReference, nameWithOwner: string) {
    return reference.repository === nameWithOwner
        ? `#${reference.number}`
        : `${reference.repository}#${reference.number}`;
}
