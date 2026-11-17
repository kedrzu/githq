import { Github, Maximize2, Minimize2 } from 'lucide-vue-next';

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
