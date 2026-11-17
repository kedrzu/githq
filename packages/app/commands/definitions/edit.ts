import {
    CalendarRange,
    CircleCheckBig,
    CircleDashed,
    GitBranch,
    GitMerge,
    GitPullRequestArrow,
    GitPullRequestDraft,
    ListMinus,
    MessageSquare,
    Milestone,
    RefreshCw,
    Shapes,
    SignalHigh,
    Tag,
    Undo2,
    UserCheck,
    UserPlus,
} from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './edit.loc.js';

/**
 * Where an item's edits are offered (E1, E4): a list — the items checked together, and its merge —, an item — the
 * opened one, and a list's selected row or right-clicked one, which stands for its item (`useItemCommands`) —, and the
 * pull request a review is of (`useEditCommands`).
 */
const EDIT_PLACES = ['list', 'item', 'review'] as const;

/**
 * The merge panel for one pull request (merging D9), or a stack's entry's whole stack (stacked PRs D11). Its bindings
 * name the way forward the panel leads to ("Queue…", "Auto-merge…", "Mark ready…", "Merge all 3").
 */
export const merge = defineAppCommand({
    id: 'merge',
    title: l.merge,
    icon: GitMerge,
    key: 'Shift+M',
    places: EDIT_PLACES,
});

/** Who the items are assigned to: a picker of the repositories' people. */
export const assignees = defineAppCommand({
    id: 'assignees',
    title: l.assignees,
    icon: UserPlus,
    key: 'A',
    keywords: [l.assigneesKeyword],
    places: EDIT_PLACES,
});

/** The items' labels: a picker, several at once. */
export const labels = defineAppCommand({
    id: 'labels',
    title: l.labels,
    icon: Tag,
    key: 'L',
    keywords: [l.labelsKeyword],
    places: EDIT_PLACES,
});

/** The items' milestone. */
export const milestone = defineAppCommand({
    id: 'milestone',
    title: l.milestone,
    icon: Milestone,
    key: 'M',
    places: EDIT_PLACES,
});

/** An issue's type, in a repository that has types. */
export const issueType = defineAppCommand({
    id: 'issueType',
    title: l.issueType,
    icon: Shapes,
    key: 'T',
    places: EDIT_PLACES,
});

/** The items' status in a project. */
export const status = defineAppCommand({
    id: 'status',
    title: l.status,
    icon: CircleDashed,
    key: 'S',
    places: EDIT_PLACES,
});

/** The items' priority in a project. */
export const priority = defineAppCommand({
    id: 'priority',
    title: l.priority,
    icon: SignalHigh,
    key: 'P',
    places: EDIT_PLACES,
});

/** The items' iteration in a project. */
export const iteration = defineAppCommand({
    id: 'iteration',
    title: l.iteration,
    icon: CalendarRange,
    key: 'I',
    places: EDIT_PLACES,
});

/** Who is asked to review one pull request. */
export const reviewers = defineAppCommand({
    id: 'reviewers',
    title: l.reviewers,
    icon: UserCheck,
    key: 'Shift+R',
    keywords: [l.reviewersKeyword],
    places: EDIT_PLACES,
});

/** One pull request back to a draft, or a draft ready for review, with no key; its binding names the way it goes. */
export const draft = defineAppCommand({
    id: 'draft',
    title: l.draft,
    icon: GitPullRequestDraft,
    places: EDIT_PLACES,
});

/**
 * Closes the items — a submenu of the reasons where there are several — or reopens them; its binding names what it does
 * to what ("Close issue", "Reopen", "Close 3 items").
 */
export const state = defineAppCommand({
    id: 'state',
    title: l.state,
    icon: CircleCheckBig,
    key: 'Shift+X',
    places: EDIT_PLACES,
});

/**
 * The opened item's comment box, a list's row opening first; a reply box in the thread the keys are on — the review's
 * under the cursor, an opened item's focused thread on the code. One command: rebinding moves both.
 */
export const comment = defineAppCommand({
    id: 'comment',
    title: l.comment,
    icon: MessageSquare,
    key: 'R',
    places: ['item', 'review'],
});

/** A pull request's ordinary command (merging D16): its branch brought up to date with the base by a merge. */
export const updateBranch = defineAppCommand({
    id: 'updateBranch',
    title: l.updateBranch,
    icon: GitPullRequestArrow,
    key: 'U',
    places: EDIT_PLACES,
});

/** Its branch rebased on the base, where the repository updates branches that way. */
export const updateBranchByRebase = defineAppCommand({
    id: 'updateBranchByRebase',
    title: l.updateBranchByRebase,
    icon: GitPullRequestArrow,
    key: 'Shift+U',
    places: EDIT_PLACES,
});

/** Re-runs the failed checks of its workflow runs. */
export const rerunChecks = defineAppCommand({
    id: 'rerunChecks',
    title: l.rerunChecks,
    icon: RefreshCw,
    key: 'Shift+E',
    places: EDIT_PLACES,
});

/** A merged or closed pull request's branch deleted, or a deleted one restored; its binding says which. */
export const branch = defineAppCommand({
    id: 'branch',
    title: l.branch,
    icon: GitBranch,
    key: 'Shift+D',
    places: EDIT_PLACES,
});

/** A merged pull request reverted by a new one. */
export const revert = defineAppCommand({
    id: 'revert',
    title: l.revert,
    icon: Undo2,
    key: 'Shift+Z',
    places: EDIT_PLACES,
});

/** A pull request taken out of the merge queue. */
export const dequeue = defineAppCommand({
    id: 'dequeue',
    title: l.dequeue,
    icon: ListMinus,
    key: 'Shift+Q',
    places: EDIT_PLACES,
});
