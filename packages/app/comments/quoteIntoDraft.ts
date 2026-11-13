import { applyMarkdownTool } from '@/components/applyMarkdownTool.js';

/**
 * The comment draft with `body` quoted at its end (Quote reply, F15), a blank line after it for the reply. HTML
 * comments (an issue template's hints) render as nothing on GitHub, so quoted they would show: they are left out.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function quoteIntoDraft(body: string, draft: string) {
    const text = body
        .replace(/<!--[\s\S]*?-->/gu, '')
        .replace(/\n{3,}/gu, '\n\n')
        .trim();
    const quote = `${applyMarkdownTool(text, { start: 0, end: text.length }, 'quote').insert}\n\n`;
    return draft.trim() ? `${draft.trimEnd()}\n\n${quote}` : quote;
}
