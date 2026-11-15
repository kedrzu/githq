/**
 * How a row on a phone names a repository (mobile D23): by its name alone when it is tracked, its owner being one of
 * the user's own anyway; with its owner when it is not, where the name alone could be anyone's.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getPhoneRepositoryName(nameWithOwner: string, tracked: boolean) {
    return tracked ? nameWithOwner.slice(nameWithOwner.indexOf('/') + 1) : nameWithOwner;
}
