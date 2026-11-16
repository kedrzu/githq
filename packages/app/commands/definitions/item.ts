import { Github } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './item.loc.js';

/** Opens what the keyboard is on (the selected rows, the opened item) on github.com, each in a new tab. */
export const openOnGitHub = defineAppCommand({
    id: 'openOnGitHub',
    title: l.openOnGitHub,
    icon: Github,
    key: 'O',
    places: ['list', 'item'],
});
