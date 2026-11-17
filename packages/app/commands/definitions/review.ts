import {
    ArrowDown,
    ArrowUp,
    ChevronsDown,
    ChevronsUp,
    ChevronsUpDown,
    Columns2,
    Equal,
    Eye,
    GitPullRequest,
    ListFilter,
    MessageSquare,
    MessageSquarePlus,
    PanelLeft,
    PanelRight,
    Undo2,
} from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './review.loc.js';

/**
 * Goes to a pull request of the stack the reviewed one is in, by its place in the stack, the binding naming it. In the
 * command menu only: no number has a key (the family's last is below its first), as a stack's place is no key to learn.
 */
export const goToStackPullRequest = defineAppCommand({
    id: 'goToStackPullRequest',
    title: l.goToStackPullRequest,
    icon: GitPullRequest,
    numbers: { first: 1, last: 0 },
    places: ['review'],
});

/** To the next thread on the code, the open ones first, landing held in place and opened. */
export const nextThread = defineAppCommand({
    id: 'nextThread',
    title: l.nextThread,
    icon: MessageSquare,
    key: 'N',
    places: ['review'],
});

/** To the previous thread on the code; as {@link nextThread}. */
export const previousThread = defineAppCommand({
    id: 'previousThread',
    title: l.previousThread,
    icon: MessageSquare,
    key: 'Shift+N',
    places: ['review'],
});

/** A comment box under the cursor's line, or on the lines chosen for one. */
export const commentOnLine = defineAppCommand({
    id: 'commentOnLine',
    title: l.commentOnLine,
    icon: MessageSquarePlus,
    key: 'C',
    places: ['review'],
});

/** Chooses lines for a comment from the cursor's line, a line further down. */
export const rangeDown = defineAppCommand({
    id: 'rangeDown',
    title: l.rangeDown,
    key: 'Shift+ArrowDown',
    places: ['review'],
    configurable: false,
});

/** Chooses lines for a comment from the cursor's line, a line further up. */
export const rangeUp = defineAppCommand({
    id: 'rangeUp',
    title: l.rangeUp,
    key: 'Shift+ArrowUp',
    places: ['review'],
    configurable: false,
});

/** Lets go of the lines chosen for a comment: the first Escape while there are some. */
export const clearRange = defineAppCommand({
    id: 'clearRange',
    title: l.clearRange,
    key: 'Escape',
    places: ['review'],
    configurable: false,
});

/** Sets GitHub's viewed mark on the current file, or the files selected, or takes it off; the binding says which. */
export const toggleViewed = defineAppCommand({
    id: 'toggleViewed',
    title: l.toggleViewed,
    icon: Eye,
    key: 'V',
    places: ['review'],
});

/** Selects the files down to the next one, from the current file. */
export const selectNextFile = defineAppCommand({
    id: 'selectNextFile',
    title: l.selectNextFile,
    key: '}',
    places: ['review'],
});

/** Selects the files up to the previous one, from the current file. */
export const selectPreviousFile = defineAppCommand({
    id: 'selectPreviousFile',
    title: l.selectPreviousFile,
    key: '{',
    places: ['review'],
});

/** Empties the filter of the files by path: an Escape after the selection's and find's. */
export const clearFilter = defineAppCommand({
    id: 'clearFilter',
    title: l.clearFilter,
    key: 'Escape',
    places: ['review'],
    configurable: false,
});

/** Puts the cursor in the filter of the files by path. */
export const focusFilter = defineAppCommand({
    id: 'focusFilter',
    title: l.focusFilter,
    icon: ListFilter,
    key: '/',
    places: ['review'],
});

/** Moves the diff's line cursor a stop down, faster the longer it is held. */
export const lineDown = defineAppCommand({
    id: 'lineDown',
    title: l.lineDown,
    icon: ArrowDown,
    key: 'ArrowDown',
    places: ['review'],
    configurable: false,
});

/** Moves the diff's line cursor a stop up, faster the longer it is held. */
export const lineUp = defineAppCommand({
    id: 'lineUp',
    title: l.lineUp,
    icon: ArrowUp,
    key: 'ArrowUp',
    places: ['review'],
    configurable: false,
});

/** Moves the diff's line cursor a screen down. */
export const pageDown = defineAppCommand({
    id: 'pageDown',
    title: l.pageDown,
    icon: ChevronsDown,
    key: 'PageDown',
    places: ['review'],
    configurable: false,
});

/** Moves the diff's line cursor a screen up. */
export const pageUp = defineAppCommand({
    id: 'pageUp',
    title: l.pageUp,
    icon: ChevronsUp,
    key: 'PageUp',
    places: ['review'],
    configurable: false,
});

/** Hides the list of files at the left, or shows it: the review's `⌘B`, over the sidebar's (commands D13). */
export const toggleFileList = defineAppCommand({
    id: 'toggleFileList',
    title: l.toggleFileList,
    icon: PanelLeft,
    key: 'Mod+B',
    places: ['review'],
});

/** Shows the pull request's conversation at the right, or hides it. */
export const toggleConversation = defineAppCommand({
    id: 'toggleConversation',
    title: l.toggleConversation,
    icon: PanelRight,
    key: 'Alt+Mod+B',
    places: ['review'],
});

/** Shows the diff split, or unified; the binding names the way it goes and gives its icon. */
export const toggleDiffLayout = defineAppCommand({
    id: 'toggleDiffLayout',
    title: l.toggleDiffLayout,
    icon: Columns2,
    places: ['review'],
});

/** Hides changes of whitespace alone, or shows them. */
export const toggleWhitespace = defineAppCommand({
    id: 'toggleWhitespace',
    title: l.toggleWhitespace,
    icon: Equal,
    places: ['review'],
});

/** Shows the threads of collapsed files, or hides them. */
export const toggleThreadsInCollapsed = defineAppCommand({
    id: 'toggleThreadsInCollapsed',
    title: l.toggleThreadsInCollapsed,
    icon: MessageSquare,
    places: ['review'],
});

/** Hides the files marked viewed, or shows them; the binding gives its icon. */
export const toggleHideViewed = defineAppCommand({
    id: 'toggleHideViewed',
    title: l.toggleHideViewed,
    icon: Eye,
    places: ['review'],
});

/** Shows more of the hidden lines nearest the cursor, toward the hunk on the side of the screen's reading line. */
export const showHiddenLines = defineAppCommand({
    id: 'showHiddenLines',
    title: l.showHiddenLines,
    icon: ChevronsUpDown,
    key: 'E',
    places: ['review'],
});

/** Shows all of the hidden lines nearest the cursor. No key: `⇧E` is the pull request's Re-run failed checks. */
export const showAllHiddenLines = defineAppCommand({
    id: 'showAllHiddenLines',
    title: l.showAllHiddenLines,
    icon: ChevronsUpDown,
    places: ['review'],
});

/** Reopens the comment box just discarded with its text, while its toast is there. */
export const restoreComment = defineAppCommand({
    id: 'restoreComment',
    title: l.restoreComment,
    icon: Undo2,
    key: 'Mod+Z',
    places: ['review'],
});
