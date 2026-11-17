import { CloudDownload, EyeOff, Settings } from 'lucide-vue-next';

import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './tracking.loc.js';

/** Goes to the settings of a tracked repository or project (T16, T17), in Settings. */
export const trackedSettings = defineAppCommand({
    id: 'trackedSettings',
    title: l.trackedSettings,
    icon: Settings,
    places: ['repository', 'project'],
});

/**
 * Tracks a repository not tracked, or brings back one on its way out (Undo). Last of a repository's actions, so that a
 * plain Enter cannot start it (D34).
 */
export const track = defineAppCommand({
    id: 'track',
    title: l.track,
    icon: CloudDownload,
    places: ['repository'],
});

/**
 * Stops tracking a repository or a project, offering Undo (`PendingUntracks`), from its menu in the sidebar. Not the
 * tracked lists' ⌫ (`remove`), the fixed key of a row there.
 */
export const untrack = defineAppCommand({
    id: 'untrack',
    title: l.untrack,
    icon: EyeOff,
    places: ['repository', 'project'],
});
