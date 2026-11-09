/** Words a minute an article is read at: an unhurried reader of technical prose. */
const WORDS_PER_MINUTE = 200;

/**
 * How many minutes a page takes to read, from its Markdown source: the words outside the frontmatter, at
 * {@link WORDS_PER_MINUTE}, rounded, never under a minute. Code and markup count as words; at this precision it doesn't
 * matter.
 */
export function readingMinutes(markdown: string): number {
    const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, '');
    const words = body.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
