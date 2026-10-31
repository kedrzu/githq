/**
 * How well typed text finds `text`, higher is better; `null` when it does not. The whole text (100), its start
 * (80), the start of every typed word in its words (60), anywhere in it (40), its letters in order (1–20, the
 * closer together the better). Case is ignored; nothing typed finds everything (0).
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function scoreText(query: string, text: string): number | null {
    const needle = query.trim().toLowerCase();
    const haystack = text.toLowerCase();
    if (needle === '') {
        return 0;
    }

    if (haystack === needle) {
        return 100;
    }

    if (haystack.startsWith(needle)) {
        return 80;
    }

    const words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const typed = needle.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (typed.length > 0 && typed.every(part => words.some(word => word.startsWith(part)))) {
        return 60;
    }

    if (haystack.includes(needle)) {
        return 40;
    }

    return scoreLetters(needle, haystack);
}

/** The typed letters in order, spread out by `gaps` letters in between. */
function scoreLetters(needle: string, haystack: string) {
    let at = 0;
    let gaps = 0;
    for (const letter of needle.replaceAll(' ', '')) {
        const found = haystack.indexOf(letter, at);
        if (found === -1) {
            return null;
        }

        gaps += at === 0 ? 0 : found - at;
        at = found + 1;
    }

    return Math.max(1, 20 - gaps);
}
