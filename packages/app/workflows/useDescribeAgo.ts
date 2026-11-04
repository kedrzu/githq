import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { formatAge } from '@/utils/formatAge.js';

import * as l from './useDescribeAgo.loc.js';

const MINUTE = 60_000;

/**
 * How long ago something happened, as the workflow screens' sentences say it: `14m ago`, under a minute `just now`.
 *
 * @util
 */
export function useDescribeAgo() {
    const t = useTranslate();

    return describeAgo;

    function describeAgo(at: number, now: number) {
        return now - at < MINUTE ? t(l.justNow) : t(l.ago, { age: formatAge(at, now) });
    }
}
