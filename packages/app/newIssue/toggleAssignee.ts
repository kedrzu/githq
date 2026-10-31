/**
 * The assignees with `login` added, or taken out where it is one: "Assign to me" (⌥A).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function toggleAssignee(assignees: readonly string[], login: string): string[] {
    return assignees.includes(login) ? assignees.filter(assignee => assignee !== login) : [...assignees, login];
}
