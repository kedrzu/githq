import {
    CircleCheck,
    Ellipsis,
    FileDiff,
    GitBranch,
    Github,
    Hash,
    Link,
    Maximize2,
    Minimize2,
    Pencil,
    Send,
    SquareKanban,
    TextQuote,
    Trash2,
} from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './item.loc.js';

/**
 * Opens what the keyboard is on on github.com, in a new tab: a list's selected row, the opened item, commit, workflow
 * or run, the review's pull request, the changelog's releases or commits, what a screen GitHub won't show stands for;
 * from a menu, the repository or project it is about.
 */
export const openOnGitHub = defineAppCommand({
    id: 'openOnGitHub',
    title: l.openOnGitHub,
    icon: Github,
    key: 'O',
    places: [
        'list',
        'item',
        'commit',
        'workflow',
        'workflowRun',
        'workflows',
        'review',
        'changelog',
        'cantBeRead',
        'repository',
        'project',
    ],
});

/**
 * Closes the opened item, commit or workflow — the panel's Escape: back to the list, or with none up to its parent —
 * after the view's own layers over it (`useItemKeys`). Not offered where Escape closes full screen ({@link closeFullScreen}).
 */
export const closeItem = defineAppCommand({
    id: 'closeItem',
    title: l.closeItem,
    key: 'Escape',
    places: ['item', 'commit', 'workflow'],
    configurable: false,
});

/**
 * Opens an item full screen: a list's or a repository's Workflows section's row straight on its page, the opened item,
 * commit, workflow or run from the panel. One command (commands D1): whoever moves it off `⇧Enter` moves it for all of
 * them. It only opens; Escape closes full screen ({@link closeFullScreen}).
 */
export const openFullScreen = defineAppCommand({
    id: 'openFullScreen',
    title: l.openFullScreen,
    icon: Maximize2,
    key: 'Shift+Enter',
    places: ['list', 'workflows', 'item', 'commit', 'workflow', 'workflowRun'],
});

/**
 * Back to the panel from an item's, commit's or workflow's page expanded from it, while the window has room for it —
 * that page's Escape in place of {@link closeItem}, after the view's own layers (`useItemKeys`). A run's page offers it
 * in the command menu only, its Escape being the run's own step back.
 */
export const closeFullScreen = defineAppCommand({
    id: 'closeFullScreen',
    title: l.closeFullScreen,
    icon: Minimize2,
    key: 'Escape',
    places: ['item', 'commit', 'workflow', 'workflowRun'],
    configurable: false,
});

/** An opened workflow to the next of the list it was opened from: `J` is its runs'. */
export const nextWorkflow = defineAppCommand({
    id: 'nextWorkflow',
    title: l.nextWorkflow,
    key: 'Shift+J',
    places: ['workflow'],
});

/** An opened workflow to the previous of the list it was opened from: `K` is its runs'. */
export const previousWorkflow = defineAppCommand({
    id: 'previousWorkflow',
    title: l.previousWorkflow,
    key: 'Shift+K',
    places: ['workflow'],
});

/** The opened item's own menu (M1–M2), under its reference in the header; run by its key, never offered in ⌘K. */
export const itemMenu = defineAppCommand({
    id: 'itemMenu',
    title: l.itemMenu,
    key: 'Mod+.',
    places: ['item'],
});

/** A pull request's code review, in the app; on a phone, which has none yet, its files on github.com (mobile D11). */
export const review = defineAppCommand({
    id: 'review',
    title: l.review,
    icon: FileDiff,
    key: 'D',
    places: ['item'],
});

/** A pull request's changed files on github.com, in a new tab: the opened one, or a list's row. */
export const openFiles = defineAppCommand({
    id: 'openFiles',
    title: l.openFiles,
    icon: FileDiff,
    key: 'Shift+O',
    places: ['item'],
});

/** Adds the items to one of the viewer's projects: a picker of those not every one of them is in already. */
export const addToProject = defineAppCommand({
    id: 'addToProject',
    title: l.addToProject,
    icon: SquareKanban,
    places: ['item'],
});

/**
 * Copies the address on github.com of what it is offered for: the items (one per line, its binding then saying "Copy
 * links"), the opened workflow or run, or the repository or project a menu is about.
 */
export const copyLink = defineAppCommand({
    id: 'copyLink',
    title: l.copyLink,
    icon: Link,
    places: ['item', 'workflow', 'workflowRun', 'repository', 'project'],
});

/** Copies an issue's or a pull request's reference, `owner/name#number`. */
export const copyReference = defineAppCommand({
    id: 'copyReference',
    title: l.copyReference,
    icon: Hash,
    places: ['item'],
});

/** Copies a pull request's branch name. */
export const copyBranch = defineAppCommand({
    id: 'copyBranch',
    title: l.copyBranch,
    icon: GitBranch,
    places: ['item'],
});

/**
 * The viewer's draft review submitted: its dialog, on the opened pull request's thread or in its review (there with no
 * draft too, a review of no comments), or — from the draft reviews — the selected row's review opened at it.
 */
export const submitReview = defineAppCommand({
    id: 'submitReview',
    title: l.submitReview,
    icon: Send,
    key: 'Shift+S',
    places: ['item', 'draftReviews', 'review'],
});

/** The viewer's draft review on the opened pull request, or the one reviewed, thrown away after its dialog asks. */
export const discardReview = defineAppCommand({
    id: 'discardReview',
    title: l.discardReview,
    icon: Trash2,
    places: ['item', 'review'],
});

/**
 * Opens the menu (⋯) of the card the reading cursor is on, on an opened item's page: the description, a comment, a
 * review or a comment of a code thread; and of the comment under the review's cursor, on a thread shown whole. Not
 * offered on a stop with no menu (a commit, an event, a comment on its way).
 */
export const commentMenu = defineAppCommand({
    id: 'commentMenu',
    title: l.commentMenu,
    icon: Ellipsis,
    key: '.',
    places: ['item', 'review'],
});

/**
 * Quotes the card the reading cursor is on into the composer, as its menu's Quote reply does, on an item's page; a code
 * thread's comment into its thread's reply box, there and under the review's cursor.
 */
export const quoteComment = defineAppCommand({
    id: 'quoteComment',
    title: l.quoteComment,
    icon: TextQuote,
    key: 'Q',
    places: ['item', 'review'],
});

/**
 * Resolves the code thread the reading cursor is in, or unresolves it, on an item's page and under the review's cursor on
 * a thread shown whole, where GitHub lets the viewer; the binding names which way it goes and gives its icon.
 */
export const resolveThread = defineAppCommand({
    id: 'resolveThread',
    title: l.resolveThread,
    icon: CircleCheck,
    key: 'H',
    places: ['item', 'review'],
});

/**
 * Edits the comment or the description the reading cursor is on in place, on an item's page, or the comment under the
 * review's cursor, where GitHub lets the viewer; with its editor open already, puts the text cursor back in it.
 */
export const editComment = defineAppCommand({
    id: 'editComment',
    title: l.editComment,
    icon: Pencil,
    key: 'W',
    places: ['item', 'review'],
});
