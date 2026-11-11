import type { GitHubRestRequester } from './createGitHubRestRequester.js';

/** What to render, and where it is written. */
export interface RenderMarkdownParams {
    text: string;
    /** `owner/name` of the repository the text belongs to: `#42` links to its issue 42, as on GitHub. */
    context: string;
}

/**
 * GitHub's own rendering of Markdown, as its comments are rendered (`POST /markdown`, gfm mode): sanitized HTML,
 * mentions and references linked. GraphQL has no equivalent. GitHub answers the HTML itself, not JSON
 * (docs.github.com/en/rest/markdown/markdown, read 2026-11-09).
 *
 * Throws `GitHubApiError` when GitHub refuses.
 */
export async function renderMarkdown(rest: GitHubRestRequester, params: RenderMarkdownParams): Promise<string> {
    const answer = await rest({
        method: 'POST',
        url: '/markdown',
        body: { text: params.text, mode: 'gfm', context: params.context },
    });
    return answer.text;
}
