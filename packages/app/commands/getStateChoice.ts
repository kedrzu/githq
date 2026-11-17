import type { Translator } from '@nzyme/i18n/Translator.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheckBig, CircleSlash, GitPullRequestClosed, RotateCcw } from 'lucide-vue-next';

import type { EditRequest } from '@/edits/EditTypes.js';
import type { EditPermissions } from '@/edits/getEditPermissions.js';
import type { Item } from '@/store/ItemTypes.js';

import * as l from './getStateChoice.loc.js';

/** A way to close or reopen: an entry of the submenu, or the action itself when it is the only one. */
export interface StateOption {
    readonly key: string;
    readonly text: string;
    readonly icon: LucideIcon;
    readonly request: EditRequest;
}

/** How the items are closed or reopened: the action's title and its entries. */
export interface StateChoice {
    /**
     * "Close issue", "Close pull request", "Close 3 items…" — the ellipsis only for several, whose two reasons are a
     * submenu — or "Reopen".
     */
    readonly title: string;
    /** The entries the user may use; none when no item may be closed or reopened. */
    readonly options: readonly StateOption[];
}

/**
 * Close the open ones — an issue, or several, as completed or not planned, a pull request alone without a reason — or
 * reopen them when all those the user may change are closed. A merged pull request is neither (`getEditPermissions`).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getStateChoice(
    items: readonly Item[],
    getPermissions: (item: Item) => EditPermissions,
    t: Translator,
): StateChoice {
    const closable = items.filter(item => getPermissions(item).state);
    const one = items.length === 1 ? items[0] : undefined;
    if (closable.every(item => item.state !== 'OPEN')) {
        return {
            title: t(l.reopen),
            options:
                closable.length > 0
                    ? [{ key: 'reopen', text: t(l.reopen), icon: RotateCcw, request: { kind: 'reopen' } }]
                    : [],
        };
    }

    if (one?.kind === 'pullRequest') {
        return {
            title: t(l.closePullRequest),
            options: [
                {
                    key: 'close',
                    text: t(l.closePullRequest),
                    icon: GitPullRequestClosed,
                    request: { kind: 'close', reason: 'COMPLETED' },
                },
            ],
        };
    }

    return {
        title: one ? t(l.closeIssue) : t(l.closeItems, { count: items.length }),
        options: [
            {
                key: 'completed',
                text: t(l.closeCompleted),
                icon: CircleCheckBig,
                request: { kind: 'close', reason: 'COMPLETED' },
            },
            {
                key: 'notPlanned',
                text: t(l.closeNotPlanned),
                icon: CircleSlash,
                request: { kind: 'close', reason: 'NOT_PLANNED' },
            },
        ],
    };
}
