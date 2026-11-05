import { waitUntil as pollUntil } from '@nzyme/utils/waitUntil.js';
import type { WaitUntilOptions } from '@nzyme/utils/waitUntil.js';

import { settle } from './settle.js';

/**
 * {@link pollUntil} for the tests that wait hundreds of times for work far shorter than its default interval: it looks
 * often, and then lets what is in flight finish, so that what a test says did not happen had its chance to.
 */
export async function waitUntil(condition: () => unknown, options?: WaitUntilOptions) {
    await pollUntil(condition, { intervalMs: 1, ...options });
    await settle();
}
