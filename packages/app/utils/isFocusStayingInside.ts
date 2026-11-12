/**
 * Whether focus moving in or out of an element stays inside it: a move between its own controls, not into
 * or out of it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isFocusStayingInside({ currentTarget, relatedTarget }: FocusEvent): boolean {
    return currentTarget instanceof Node && relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
}
