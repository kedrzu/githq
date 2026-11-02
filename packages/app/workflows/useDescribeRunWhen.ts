import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatAge } from '@/utils/formatAge.js';
import { formatLocalDate } from '@/utils/formatLocalDate.js';

import * as l from './useDescribeRunWhen.loc.js';

const DAY = 24 * 60 * 60_000;

/**
 * When a run started, as a workflow's row and a run's line say it: under a day `14m ago`, older its local day `Oct 28`.
 *
 * @util
 */
export function useDescribeRunWhen() {
    const t = useTranslate();

    return describeRunWhen;

    function describeRunWhen(createdAt: string, now: number) {
        const at = Date.parse(createdAt);
        return now - at < DAY ? t(l.ago, { age: formatAge(at, now) }) : formatLocalDate(at);
    }
}
