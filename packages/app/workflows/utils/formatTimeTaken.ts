import { formatDuration } from '@/utils/formatDuration.js';

/**
 * How long a finished job or step took, from when GitHub says it started and completed (ISO).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatTimeTaken(startedAt: string, completedAt: string) {
    return formatDuration(Date.parse(completedAt) - Date.parse(startedAt));
}
