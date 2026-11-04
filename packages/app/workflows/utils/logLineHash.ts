/** A line of a job's log the way GitHub addresses it: `#step:<number>:<line>`. */
export interface LogLineAddress {
    readonly stepNumber: number;
    /** 1-based within the step. */
    readonly stepLine: number;
}

const HASH_PATTERN = /^#step:(\d+):(\d+)$/u;

/**
 * The hash of GitHub's address of a log line.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatLogLineHash(address: LogLineAddress) {
    return `#step:${address.stepNumber}:${address.stepLine}`;
}

/**
 * The log line an address's hash names; `null` for any other hash.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseLogLineHash(hash: string): LogLineAddress | null {
    const match = HASH_PATTERN.exec(hash);
    return match ? { stepNumber: Number(match[1]), stepLine: Number(match[2]) } : null;
}
