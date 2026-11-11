import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef, watch } from 'vue';

import { CommentDrafts } from '@/edits/CommentDrafts.js';
import { EditQueue } from '@/edits/EditQueue.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { LocalCopyVersion } from '@/store/LocalCopyVersion.js';

import { ReloadHolds } from './ReloadHolds.js';

/**
 * How long nothing has to be at stake before the page goes: an edit GitHub did not take leaves the queue a moment
 * before its failure is listed, or its comment kept as not sent.
 */
const RELOAD_DELAY_MS = 1000;

/**
 * Brings a tab up to a newer githq: told that another tab opened the local copy in a newer layout, it can neither keep
 * anything nor sync any more (`SyncLeadership`), so it reloads — shown or hidden — as soon as that loses nothing the
 * user did. What only its memory holds stops it: an edit on its way, a failure not dismissed yet, text not sent
 * (typed, or a comment GitHub did not take).
 */
export const OutdatedTabReload = defineService({
    name: 'OutdatedTabReload',
    deps: {
        localCopyVersion: LocalCopyVersion,
        queue: EditQueue,
        drafts: CommentDrafts,
        holds: ReloadHolds,
        browser: Browser,
        clock: Clock,
        logger: Logger,
    },
    setup({ localCopyVersion, queue, drafts, holds, browser, clock, logger }) {
        const outdatedRef = shallowRef(false);
        let cancelReload: (() => void) | null = null;

        localCopyVersion.onNewerVersion(() => {
            outdatedRef.value = true;
        });

        watch(
            () =>
                outdatedRef.value &&
                queue.pending.length === 0 &&
                queue.failures.length === 0 &&
                !drafts.hasAny &&
                !holds.held,
            canReload => {
                cancelReload?.();
                cancelReload = canReload ? clock.schedule(reload, RELOAD_DELAY_MS) : null;
            },
        );

        function reload() {
            logger.info('A newer githq is open in another tab: reloading');
            browser.reload();
        }
    },
});
