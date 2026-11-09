import type { MarkdownRenderer } from 'vitepress';

type StateCore = Parameters<Parameters<MarkdownRenderer['core']['ruler']['push']>[1]>[0];
type Token = StateCore['tokens'][number];

/** The tag of the article's meta line (`theme/components/ArticleMeta.vue`, registered globally by the theme). */
export const ARTICLE_META_TAG = 'ArticleMeta';

/**
 * Puts the article's meta line ("Updated … · N min read") under its title: after the H1, or after the paragraph right
 * under it, which is the page's lead and gets the `lead` class for its larger, dimmer type (`Docs` article in
 * `githq.pen`). A page without an H1 gets no meta line.
 */
export function articleMetaPlugin(md: MarkdownRenderer): void {
    md.core.ruler.push('docs_article_meta', state => {
        const tokens = state.tokens;
        const titleOpen = tokens.findIndex(token => token.type === 'heading_open' && token.tag === 'h1');
        if (titleOpen === -1) {
            return;
        }
        const titleClose = tokens.findIndex(
            (token, index) => index > titleOpen && token.type === 'heading_close' && token.tag === 'h1',
        );
        let insertAt = titleClose + 1;
        const lead = tokens[insertAt];
        if (lead?.type === 'paragraph_open' && lead.level === 0) {
            lead.attrJoin('class', 'lead');
            insertAt = tokens.findIndex((token, index) => index > insertAt && token.type === 'paragraph_close') + 1;
        }
        const meta: Token = new state.Token('html_block', '', 0);
        meta.content = `<${ARTICLE_META_TAG} />\n`;
        tokens.splice(insertAt, 0, meta);
    });
}

/**
 * A code block's file name in its head: ```` ```toml [wrangler.toml] ```` (`Docs / Code block`). VitePress reads the
 * `[…]` only in a code group, as the tab's label; there the block keeps its tab and gets no head.
 */
export function codeTitlePlugin(md: MarkdownRenderer): void {
    const fence = md.renderer.rules.fence;
    if (!fence) {
        throw new Error('VitePress renders fences: its rule must be in place before this plugin');
    }
    md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index];
        const title = token && !inCodeGroup(tokens, index) ? /\[(.+?)\]/.exec(token.info)?.[1] : undefined;
        const html = fence(tokens, index, options, env, self);
        if (!title) {
            return html;
        }
        return html
            .replace(/^<div class="/, '<div class="has-title ')
            .replace(
                '<span class="lang">',
                `<span class="title">${md.utils.escapeHtml(title)}</span><span class="lang">`,
            );
    };
}

function inCodeGroup(tokens: Token[], index: number): boolean {
    for (let i = index - 1; i >= 0; i--) {
        const type = tokens[i]?.type;
        if (type === 'container_code-group_close') {
            return false;
        }
        if (type === 'container_code-group_open') {
            return true;
        }
    }
    return false;
}
