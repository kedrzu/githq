/** How far up to look: enough for a long class, and a flat file of 100k lines doesn't pay for each of its gaps. */
const MAX_LINES_UP = 2000;
const CLOSING = /^\s*[)\]}]/u;
/** The words that may stand before what a declaration declares: `export default abstract class`, `pub async fn`. */
const MODIFIERS = String.raw`(?:(?:export|default|public|private|protected|internal|static|abstract|final|sealed|async|declare|override|open|data|inline|partial|virtual|readonly|unsafe|extern|pub(?:\([^)]*\))?)\s+)*`;
/** A class, an interface, a type or a function by its keyword, in the languages that have one. */
const BY_KEYWORD = new RegExp(
    String.raw`^${MODIFIERS}(?:class|interface|enum|struct|trait|impl|type|namespace|module|object|protocol|extension|record|function|func|fn|def)(?=[\s*(<])`,
    'u',
);
/** A method or a function by its parameters: `async load(id: string): Promise<void> {`, `public void run() {`. */
const BY_PARAMETERS = new RegExp(
    String.raw`^${MODIFIERS}(?:[\w$.<>[\],?&]+\s+)*\*?[\w$]+\s*(?:<[^>]*>)?\s*\(.*\)\s*(?::[^=]*)?\s*(?:\{|=>\s*\{?|:)?\s*$`,
    'u',
);
/** A function put in a variable: `export const load = async (id: string) => {`. */
const BY_ASSIGNMENT = new RegExp(
    String.raw`^${MODIFIERS}(?:const|let|var)\s+[\w$]+\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[\w$]+\s*=>)`,
    'u',
);
/** A comment, a decorator or an attribute: never what code sits in. */
const NOT_CODE = /^(?:\/\/|\/\*|\*|#|@|--|<!--)/u;
/** What looks like a call or a signature and is neither. */
const CONTROL =
    /^(?:if|else|for|foreach|while|do|switch|case|catch|try|finally|return|with|using|lock|await|yield|throw|new)\b/u;

/**
 * The declaration a line sits in, by indentation, for a gap to show what it is in ("export class SyncEngine {", D42):
 * the nearest earlier line indented less than the first non-blank line from `index` that is a class, interface, type,
 * function or method signature. A comment, a decorator, a brace or anything else indented less is passed over, the search
 * going on for what that sits in; closing brackets and blank lines don't count. `null` at the top level, or with no such
 * line above.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function findEnclosing(lines: readonly string[], index: number): string | null {
    let from = index;
    while (from < lines.length && isBlank(lines[from] ?? '')) {
        from++;
    }

    let indent = getIndent(lines[from] ?? '');
    for (let at = from - 1; indent > 0 && at >= Math.max(from - MAX_LINES_UP, 0); at--) {
        const line = lines[at] ?? '';
        if (isBlank(line) || CLOSING.test(line) || getIndent(line) >= indent) {
            continue;
        }

        const trimmed = line.trim();
        if (isDeclaration(trimmed)) {
            return trimmed;
        }

        indent = getIndent(line);
    }

    return null;
}

function isDeclaration(line: string) {
    if (NOT_CODE.test(line) || CONTROL.test(line) || line.endsWith(';')) {
        return false;
    }

    return BY_KEYWORD.test(line) || BY_ASSIGNMENT.test(line) || BY_PARAMETERS.test(line);
}

function isBlank(line: string) {
    return line.trim() === '';
}

function getIndent(line: string) {
    return line.length - line.trimStart().length;
}
