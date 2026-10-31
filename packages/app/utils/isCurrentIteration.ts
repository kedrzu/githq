import type { ProjectIteration } from '@/store/ItemDetailTypes.js';

const DAY = 24 * 60 * 60_000;

/**
 * Whether a project's iteration runs at `now` (epoch ms): from its start date for its `duration` days.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isCurrentIteration(iteration: Pick<ProjectIteration, 'duration' | 'startDate'>, now: number) {
    const start = Date.parse(iteration.startDate);
    return now >= start && now < start + iteration.duration * DAY;
}
