import type { Command } from '@/commands/CommandTypes.js';
import type { Item } from '@/store/ItemTypes.js';

/**
 * The item menus' groups, top to bottom, by the action's name after its section (`item.labels` → `labels`): going
 * to the item; its project fields — for a pull request merging it and its ordinary commands, then its reviews, first; its own properties;
 * writing about it and copying it; closing it. An action not named here is not in the menus.
 */
const LAYOUT: Readonly<Record<Item['kind'], readonly (readonly string[])[]>> = {
    issue: [
        ['open', 'openFullScreen', 'openOnGitHub'],
        ['status', 'priority', 'iteration', 'addToProject'],
        ['assignees', 'labels', 'milestone', 'issueType'],
        ['comment', 'copyLink', 'copyReference'],
        ['state'],
    ],
    pullRequest: [
        ['open', 'openFullScreen', 'review', 'openOnGitHub', 'openFiles'],
        ['merge', 'updateBranch', 'updateBranchByRebase', 'rerunChecks', 'branch', 'revert', 'dequeue'],
        ['reviewers', 'draft'],
        ['assignees', 'labels', 'milestone', 'status', 'priority', 'iteration', 'addToProject'],
        ['comment', 'copyLink', 'copyBranch'],
        ['state'],
    ],
};

/**
 * The actions of an item, or of items selected together, as the item menus group them (L1–L4, M1–M2) — those
 * offered in menus and able to run now, in the design's order. A selection of issues and pull requests is laid out
 * as issues.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemMenuSections(commands: readonly Command[], kind: Item['kind']): Command[][] {
    const actions = getItemMenuActions(commands, kind);
    return LAYOUT[kind].map(names => names.flatMap(name => actions.get(name) ?? []));
}

/**
 * The actions the item menus offer for `kind` and able to run now, by their name after the section (`item.status` →
 * `status`), for a caller that reaches for one action by name rather than laying the menu out.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemMenuActions(commands: readonly Command[], kind: Item['kind']): Map<string, Command> {
    const offered = new Set(LAYOUT[kind].flat());
    const byName = new Map<string, Command>();
    for (const command of commands) {
        const name = command.id.slice(command.id.indexOf('.') + 1);
        if (offered.has(name) && command.menu !== false && (command.when?.() ?? true)) {
            byName.set(name, command);
        }
    }

    return byName;
}
