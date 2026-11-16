import { Github } from 'lucide-vue-next';

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
