/**
 * What was thrown, as an `Error` a failed state can hold and show ({@link getFailureText}).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}
