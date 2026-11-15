import type { HistoryState, RouteLocation } from 'vue-router';

import { CommitRoutes } from '@/commits/commitRoutes.js';
import type { CommitReference } from '@/commits/commitRoutes.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';
import { parseRepositoryName } from '@/utils/parseRepositoryName.js';
import type { RepositoryName } from '@/utils/parseRepositoryName.js';
import { WorkflowRoutes } from '@/workflows/workflowRoutes.js';
import type { WorkflowReference } from '@/workflows/workflowRoutes.js';

import { defineOpenedItemKind } from './defineOpenedItemKind.js';
import type { OpenedItemKind, OpenedItemRouteSource, OpenedKindRoute } from './defineOpenedItemKind.js';

/**
 * How an opened item is shown (D9): in the panel beside the screen it was opened over, or on a page of its own. The
 * same item view in both.
 */
export type ItemArrangement = 'page' | 'panel';

/** An issue or pull request as an address names it: its repository and number. */
export interface ItemReference extends RepositoryName {
    readonly number: number;
}

/** What a route opens: an item of a kind, on its own page or over a list. */
export type OpenedItemRoute =
    | (OpenedKindRoute<ItemReference> & { readonly kind: 'issue' })
    | (OpenedKindRoute<WorkflowReference> & { readonly kind: 'workflow' })
    | (OpenedKindRoute<CommitReference> & { readonly kind: 'commit' });

/**
 * The route paths of an item's own page, shaped like GitHub's: a github.com path pasted after the app's host
 * opens the same item. Issue or pull request, the item is found by its number; the segment only mirrors GitHub,
 * and settles on the item's kind once it is known.
 */
export const ITEM_PAGE_PATHS = ['/:owner/:name/issues/:number(\\d+)', '/:owner/:name/pull/:number(\\d+)'] as const;

/**
 * The route path of a pull request's review, GitHub's address of its changed files, and the one GitHub's newer view
 * uses: a github.com link pasted after the app's host opens the same screen.
 */
export const REVIEW_PAGE_PATH = '/:owner/:name/pull/:number(\\d+)/files';
export const REVIEW_PAGE_ALIAS = '/:owner/:name/pull/:number(\\d+)/changes';

/** What separates the owner, the name and the number in the pane's `issue` parameter. */
const ISSUE_SEPARATOR = '|';

/**
 * An issue or a pull request opened as an item: on its page (`/owner/name/issues/12`), or over a list in GitHub's
 * project-pane format (`?pane=issue&issue=owner%7Cname%7C12`).
 */
export const IssueRoutes = defineOpenedItemKind<ItemReference>({
    kind: 'issue',
    formatPaneValue(reference) {
        return [reference.owner, reference.name, reference.number].join(ISSUE_SEPARATOR);
    },
    parsePaneValue(value) {
        const [owner, name, number, ...rest] = value.split(ISSUE_SEPARATOR);
        return owner && name && rest.length === 0 ? toReference(owner, name, number) : null;
    },
    parsePageParams(params) {
        const { owner, name, number } = params;
        return typeof owner === 'string' && typeof name === 'string' ? toReference(owner, name, number) : null;
    },
    getPagePath(reference) {
        return getItemPagePath(reference);
    },
    formatKey(reference) {
        return formatItemReference(reference);
    },
});

/**
 * The item a route opens, of whichever kind, or `null`: an item's own page, or a list with one opened over it in
 * GitHub's project-pane format.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getOpenedItemRoute(route: OpenedItemRouteSource): OpenedItemRoute | null {
    const issue = IssueRoutes.getOpened(route);
    if (issue) {
        return { kind: 'issue', ...issue };
    }

    const workflow = WorkflowRoutes.getOpened(route);
    if (workflow) {
        return { kind: 'workflow', ...workflow };
    }

    const commit = CommitRoutes.getOpened(route);
    return commit ? { kind: 'commit', ...commit } : null;
}

/**
 * The address of an item's own page, as GitHub's: `/owner/name/issues/12` or `/owner/name/pull/15`. Either
 * opens the item whatever its kind, as on GitHub; an item not known yet goes under `issues`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemPagePath(reference: ItemReference, kind: Item['kind'] = 'issue') {
    return `/${reference.owner}/${reference.name}/${kind === 'issue' ? 'issues' : 'pull'}/${reference.number}`;
}

/**
 * The address of the entry behind the current one in the history, as vue-router keeps it in the entry's state (`back`,
 * kept through a replace); `null` at the first entry, or where the history keeps no such state (a memory history).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getHistoryBack(state: HistoryState): string | null {
    const { back } = state;
    return typeof back === 'string' ? back : null;
}

/**
 * The address of a pull request's review (D2), always a page of its own.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewPath(reference: ItemReference) {
    return `${getItemPagePath(reference, 'pullRequest')}/files`;
}

/**
 * The address of a comment on the code in its pull request's review, from the comment's github.com `url`
 * (`…/pull/15#discussion_r7`): the review's path with the same fragment, which lands on the comment's thread. `null`
 * for a url that names no such comment, as one on its way to GitHub.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewCommentPath(url: string) {
    const [, item, anchor] = /^([^#]+)#(discussion_[\w-]+)$/u.exec(url) ?? [];
    const reference = item && parseItemUrl(item);
    return reference ? `${getReviewPath(reference)}#${anchor}` : null;
}

/**
 * The pull request a review's address names, or `null` for a number no pull request can have.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getReviewReference(route: Pick<RouteLocation, 'params'>): ItemReference | null {
    const { owner, name, number } = route.params;
    return typeof owner === 'string' && typeof name === 'string' ? toReference(owner, name, number) : null;
}

/**
 * The reference of an item the app holds.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getItemReference(item: Item): ItemReference {
    return { ...parseRepositoryName(item.repository.nameWithOwner), number: item.number };
}

/**
 * The item a github.com address names (a pull request's `url`), or `null` when it names none. The address says its
 * repository, which may not be the one it was read from: a fork's commit answers with its upstream's pull request.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseItemUrl(url: string): ItemReference | null {
    const [, owner, name, number] =
        /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)\/?$/u.exec(url) ?? [];
    return owner && name ? toReference(owner, name, number) : null;
}

/**
 * `name#number`, how an item is named where its owner goes without saying (the command menu's chip and results, a
 * parent); `name#…` for an issue GitHub has not numbered yet.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatShortReference(item: Item) {
    const { name } = parseRepositoryName(item.repository.nameWithOwner);
    return `${name}#${isPendingItem(item) ? '…' : item.number}`;
}

/**
 * `owner/name/number`: an item's reference as one string, the same for the same item (the resolver's key).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatItemReference(reference: ItemReference) {
    return `${reference.owner}/${reference.name}/${reference.number}`;
}

function toReference(owner: string, name: string, number: unknown): ItemReference | null {
    if (typeof number !== 'string' || !/^[1-9]\d*$/u.test(number) || !owner || !name) {
        return null;
    }

    return { owner, name, number: Number(number) };
}

declare module 'vue-router' {
    interface RouteMeta {
        /** The route is the own page of an item of this kind (`ITEM_PAGE_PATHS`, `WORKFLOW_PAGE_PATH`, `COMMIT_PAGE_PATH`). */
        itemPage?: OpenedItemKind;
        /**
         * The screen is a list an item opens over, in the panel beside it (D9): opening one from anywhere else — a
         * review, Settings, a run — goes to its own page (`useOpenItemReference`).
         */
        itemPanel?: boolean;
        /**
         * The route shows what GitHub shows at the same address (an item, a repository, a project, a run, "my work"),
         * so a github.com link to it may open here (`shell/gitHubLinks.ts`). Not set on githq's own pages (settings,
         * sign-in, download), on GitHub's settings of a repository or a project, nor on a hand-off.
         */
        gitHubScreen?: boolean;
        /**
         * The screen wants the app sidebar as the rail (code review's D24), whatever the user keeps it as: it is forced
         * by the shell for as long as the route lasts and never written to their preference.
         */
        railForced?: boolean;
    }
}
