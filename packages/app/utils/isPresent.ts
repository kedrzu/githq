/**
 * A `node(id:)` answer that is the node asked for: GitHub answers `{}` for a node of another type than the query's
 * fragment names, `null` for none.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isPresent<T extends object>(node: T | Record<PropertyKey, never> | null): node is T {
    return node !== null && Object.keys(node).length > 0;
}
