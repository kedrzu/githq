import { SquarePen } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './app.loc.js';

/**
 * A new issue in the quick capture (H1): in the repository of the screen, else the one used last; from a repository's
 * or a project's menu, in that one. No key (commands D7): only a project has `C`, {@link newIssueInProject}.
 */
export const newIssue = defineAppCommand({
    id: 'newIssue',
    title: l.newIssue,
    icon: SquarePen,
    keywords: [l.createKeyword],
    places: ['app', 'repository', 'project'],
});

/** A new issue added to the project on screen (H5), its binding naming the project. */
export const newIssueInProject = defineAppCommand({
    id: 'newIssueInProject',
    title: l.newIssueInProject,
    icon: SquarePen,
    key: 'C',
    places: ['project'],
});

/**
 * Back to the merge panel of a merge GitHub refused, its text kept (merging D15, PM35): the newest such toast's, never the
 * selected row's — `⇧M` is that.
 */
export const backToMerge = defineAppCommand({
    id: 'backToMerge',
    title: l.backToMerge,
    key: 'Alt+M',
    places: ['app'],
});

/** The branch of a merge confirmed in a toast deleted or restored (PM34): the toast's own, `⇧D` being the row's. */
export const mergedBranch = defineAppCommand({
    id: 'mergedBranch',
    title: l.mergedBranch,
    key: 'Alt+D',
    places: ['app'],
});
