/**
 * A file's text by line, each with its carriage return if it has one. A final newline is no line of its own.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function splitLines(text: string | null): string[] {
    if (text === null) {
        return [];
    }

    const lines = text.split('\n');
    if (lines.at(-1) === '') {
        lines.pop();
    }

    return lines;
}
