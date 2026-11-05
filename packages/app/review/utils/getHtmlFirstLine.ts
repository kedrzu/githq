/**
 * The first line of a comment's text. Only ever as text: a body is shown as HTML nowhere but in `GitHubHtml`, and this is
 * not a document scripts run in.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getHtmlFirstLine(html: string): string {
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
    return text.trim().split('\n')[0] ?? '';
}
