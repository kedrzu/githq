import type { CheckRunState, StatusState } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { ItemCheckState } from './ItemDetailTypes.js';

/**
 * How a check run in this state ended, or that it has not yet — for a row's counts by state and for a run of the
 * detail's list (its conclusion once completed) alike. Neutral and skipped runs are `skipped`: the list says so,
 * and a row's counts take them as passing, as GitHub's checks list does — they hold nothing back.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function classifyCheckRun(state: CheckRunState): ItemCheckState {
    switch (state) {
        case 'SUCCESS':
        case 'COMPLETED':
            return 'passing';
        case 'NEUTRAL':
        case 'SKIPPED':
            return 'skipped';
        case 'FAILURE':
        case 'TIMED_OUT':
        case 'CANCELLED':
        case 'ACTION_REQUIRED':
        case 'STARTUP_FAILURE':
        case 'STALE':
            return 'failing';
        case 'QUEUED':
        case 'IN_PROGRESS':
        case 'PENDING':
        case 'WAITING':
            return 'pending';
        default:
            return assertNever(state);
    }
}

/**
 * How a commit status in this state ended, or that it has not yet — for a row's counts and the detail's list alike.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function classifyStatus(state: StatusState): ItemCheckState {
    switch (state) {
        case 'SUCCESS':
            return 'passing';
        case 'FAILURE':
        case 'ERROR':
            return 'failing';
        case 'PENDING':
        case 'EXPECTED':
            return 'pending';
        default:
            return assertNever(state);
    }
}
