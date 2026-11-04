import { formatLocalDate } from '@/utils/formatLocalDate.js';

import { useDescribeAgo } from './useDescribeAgo.js';

const DAY = 24 * 60 * 60_000;

/**
 * When a run started, as a workflow's row and a run's line say it: under a day `14m ago` or `just now`, older its local day `Oct 28`.
 *
 * @util
 */
export function useDescribeRunWhen() {
    const describeAgo = useDescribeAgo();

    return describeRunWhen;

    function describeRunWhen(createdAt: string, now: number) {
        const at = Date.parse(createdAt);
        return now - at < DAY ? describeAgo(at, now) : formatLocalDate(at);
    }
}
