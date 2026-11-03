/**
 * The title of GitHub's reason for refusing a merge: its first line, as the merge panel and the opened item's standing
 * say it (PM25, PM31, PM38). Empty for an empty message.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getReasonTitle(message: string): string {
    return message.trim().split('\n')[0] ?? '';
}
