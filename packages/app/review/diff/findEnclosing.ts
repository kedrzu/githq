/** How far up to look: enough for a long class, and a flat file of 100k lines doesn't pay for each of its gaps. */
const MAX_LINES_UP = 2000;
const CLOSING = /^\s*[)\]}]/u;

/**
 * The declaration a line sits in, by indentation alone, for a gap to show what it is in ("export class SyncEngine {"):
 * the nearest earlier line indented less than the first non-blank line from `index`, closing brackets and blank lines
 * not counting. `null` at the top level.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findEnclosing(lines: readonly string[], index: number): string | null {
    let from = index;
    while (from < lines.length && isBlank(lines[from] ?? '')) {
        from++;
    }

    const indent = getIndent(lines[from] ?? '');
    if (indent === 0) {
        return null;
    }

    for (let at = from - 1; at >= Math.max(from - MAX_LINES_UP, 0); at--) {
        const line = lines[at] ?? '';
        if (!isBlank(line) && !CLOSING.test(line) && getIndent(line) < indent) {
            return line.trim();
        }
    }

    return null;
}

function isBlank(line: string) {
    return line.trim() === '';
}

function getIndent(line: string) {
    return line.length - line.trimStart().length;
}
