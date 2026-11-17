import { defineAppCommand } from '../defineAppCommand.js';
import * as l from './workflows.loc.js';

/**
 * Opens the repository's settings on Workflow alerts from its Workflows section — on their add field from a workflow
 * failing only where nothing raises alerts (actions W13). `⇧P`, not `P`: with an item open beside the section, `P` is
 * the item's priority.
 */
export const alertSettings = defineAppCommand({
    id: 'alertSettings',
    title: l.alertSettings,
    key: 'Shift+P',
    places: ['workflows'],
});
