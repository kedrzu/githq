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
/**
 * The first line of a signature broken over several, opening its parameters and closing none: `async load(`,
 * `export const load = async (`. A call broken the same way is told apart by its closing line ({@link SIGNATURE_CLOSE}).
 */
const OPEN_PARAMETERS = new RegExp(
    String.raw`^${MODIFIERS}(?:(?:const|let|var)\s+[\w$]+\s*(?::[^=]+)?=\s*(?:async\s+)?|(?:[\w$.<>[\],?&]+\s+)*\*?[\w$]+\s*(?:<[^>]*>)?\s*)\([^()]*$`,
    'u',
);
/** What closes a signature's parameters and opens its body: `): Promise<void> {`, `) => {`, `) -> None:`; never `);`. */
const SIGNATURE_CLOSE = /^\)[^;]*(?:\{|=>|:)$/u;
/** A test's block, whose name says what the code is in: `describe('sync', () => {`, `it.each(cases)(`. */
const TEST_BLOCK = /^(?:describe|it|test)(?:\.(?:only|skip|each|todo|concurrent|failing))*\s*[(`]/u;
/** A function put in a variable: `export const load = async (id: string) => {`. */
const BY_ASSIGNMENT = new RegExp(
    String.raw`^${MODIFIERS}(?:const|let|var)\s+[\w$]+\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[\w$]+\s*=>)`,
    'u',
);
/** A comment, a decorator or an attribute: never what code sits in. */
const NOT_CODE = /^(?:\/\/|\/\*|\*|#|@|--|<!--)/u;
/** What looks like a call or a signature and is neither: a branch, a loop or a statement. */
const CONTROL =
    /^(?:if|else|elif|elsif|elseif|unless|when|match|guard|for|foreach|while|until|loop|do|switch|select|case|catch|except|rescue|ensure|try|finally|return|with|using|lock|await|yield|throw|raise|new)\b/u;

/**
 * The declaration a line sits in, by indentation, for a gap to show what it is in ("export class SyncEngine {", D42):
 * the nearest earlier line indented less than the first non-blank line from `index` that is a class, interface, type,
 * function or method signature, one broken over several lines too, or a test's `describe`, `it` or `test`. A comment, a
 * decorator, a brace, a branch, any other call or anything else indented less is passed over, the search going on for
 * what that sits in; closing brackets and blank lines don't count. `null` at the top level, or with no such line above.
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
        if (isDeclaration(trimmed) || isOpenSignature(lines, at, from)) {
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

    return (
        BY_KEYWORD.test(line) ||
        BY_ASSIGNMENT.test(line) ||
        TEST_BLOCK.test(line) ||
        // A call taking a callback opens more than it closes: `watch(x, () => {`.
        (BY_PARAMETERS.test(line) && count(line, '(') === count(line, ')'))
    );
}

/** The line at `at` opens parameters that a line before `from`, as indented as it, closes and opens a body after. */
function isOpenSignature(lines: readonly string[], at: number, from: number) {
    const line = (lines[at] ?? '').trim();
    if (NOT_CODE.test(line) || CONTROL.test(line) || !OPEN_PARAMETERS.test(line)) {
        return false;
    }

    const indent = getIndent(lines[at] ?? '');
    for (let next = at + 1; next < from; next++) {
        const closing = lines[next] ?? '';
        if (!isBlank(closing) && getIndent(closing) <= indent) {
            return SIGNATURE_CLOSE.test(closing.trim());
        }
    }

    return false;
}

function count(line: string, char: string) {
    return line.split(char).length - 1;
}

function isBlank(line: string) {
    return line.trim() === '';
}

function getIndent(line: string) {
    return line.length - line.trimStart().length;
}
