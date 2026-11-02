import { escapeRegExp } from '@/utils/escapeRegExp.js';

/**
 * Whether a ref's name — a branch's or a tag's alike — matches a pattern in GitHub Actions' filter syntax (actions
 * D13), whole: `*` matches anything but `/`, `**` anything; `?` makes the character before it optional and `+`
 * repeats it; `[a-z0-9]` matches one character listed or in a range; `\` takes the next character literally. A
 * leading `!` (negation) means nothing here and is matched as itself, as is a malformed `[`.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function matchRefPattern(pattern: string, ref: string): boolean {
    return new RegExp(`^${toRegExpSource(pattern)}$`).test(ref);
}

/** Letters and digits listed or in ranges, the only character classes GitHub's filters allow. */
const CLASS_PATTERN = /^(?:[a-zA-Z0-9](?:-[a-zA-Z0-9])?)+$/;

function toRegExpSource(pattern: string) {
    let source = '';
    // Whether the last piece is one character, which `?` and `+` may apply to; a wildcard is not.
    let afterCharacter = false;
    let index = 0;
    while (index < pattern.length) {
        const char = pattern.charAt(index);
        switch (char) {
            case '*': {
                const isDouble = pattern.charAt(index + 1) === '*';
                source += isDouble ? '.*' : '[^/]*';
                index += isDouble ? 2 : 1;
                afterCharacter = false;
                break;
            }
            case '?':
            case '+':
                source += afterCharacter ? char : escapeRegExp(char);
                afterCharacter = !afterCharacter;
                index += 1;
                break;
            case '[': {
                const end = pattern.indexOf(']', index + 1);
                const listed = end < 0 ? '' : pattern.slice(index + 1, end);
                if (isCharacterClass(listed)) {
                    source += `[${listed}]`;
                    index = end + 1;
                } else {
                    source += escapeRegExp(char);
                    index += 1;
                }
                afterCharacter = true;
                break;
            }
            case '\\': {
                const next = pattern.charAt(index + 1);
                source += escapeRegExp(next || char);
                index += next ? 2 : 1;
                afterCharacter = true;
                break;
            }
            default:
                source += escapeRegExp(char);
                index += 1;
                afterCharacter = true;
        }
    }

    return source;
}

function isCharacterClass(listed: string) {
    if (!CLASS_PATTERN.test(listed)) {
        return false;
    }

    // A range must run upwards within one kind (`a-z`, `0-9`), or the regular expression would not compile.
    for (const [, from, to] of listed.matchAll(/(.)-(.)/g)) {
        if (from === undefined || to === undefined || from > to || kindOf(from) !== kindOf(to)) {
            return false;
        }
    }

    return true;
}

function kindOf(char: string) {
    if (char >= '0' && char <= '9') {
        return 'digit';
    }

    return char === char.toLowerCase() ? 'lower' : 'upper';
}
