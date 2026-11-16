import { Github, Maximize2 } from 'lucide-vue-next';

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
 * Closes the opened item, commit or workflow — the panel's Escape: back to the list, or a page expanded from the panel
 * back to it (`useItemArrangement`), after the view's own layers over it (`useItemKeys`).
 */
export const closeItem = defineAppCommand({
    id: 'closeItem',
    title: l.closeItem,
    key: 'Escape',
    places: ['item', 'commit', 'workflow'],
    configurable: false,
});

/**
 * Moves an item between the panel and its page: a list's or a repository's Workflows section's row opened straight full
 * screen, the opened item, commit, workflow or run to its page, or — named so by its binding — back to the panel. One
 * command (commands D1): whoever moves it off `⇧Enter` moves it for all of them.
 */
export const fullScreen = defineAppCommand({
    id: 'fullScreen',
    title: l.fullScreen,
    icon: Maximize2,
    key: 'Shift+Enter',
    places: ['list', 'workflows', 'item', 'commit', 'workflow', 'workflowRun'],
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
