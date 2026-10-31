import type { Command } from '@/commands/CommandTypes.js';
import type { Item } from '@/store/ItemTypes.js';

/**
 * The item menus' groups, top to bottom, by the action's name after its section (`item.labels` → `labels`): going
 * to the item; its project fields — for a pull request its reviews first; its own properties; writing about it and
 * copying it; closing it. An action not named here is not in the menus.
 */
const LAYOUT: Readonly<Record<Item['kind'], readonly (readonly string[])[]>> = {
    issue: [
        ['open', 'openPage', 'openOnGitHub'],
        ['status', 'priority', 'iteration', 'addToProject'],
        ['assignees', 'labels', 'milestone', 'issueType'],
        ['comment', 'copyLink', 'copyReference'],
        ['state'],
    ],
    pullRequest: [
        ['open', 'openPage', 'openOnGitHub', 'openFiles'],
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
    const byName = new Map<string, Command>();
    for (const command of commands) {
        if (command.menu !== false && (command.when?.() ?? true)) {
            byName.set(command.id.slice(command.id.indexOf('.') + 1), command);
        }
    }

    return LAYOUT[kind].map(names => names.flatMap(name => byName.get(name) ?? []));
}
