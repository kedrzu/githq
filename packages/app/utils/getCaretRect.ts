/** What lays text out in a text area: a copy of it styled so is where its characters land. */
const MIRRORED_STYLES = [
    'boxSizing',
    'width',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'letterSpacing',
    'lineHeight',
    'tabSize',
    'textIndent',
    'textTransform',
    'wordSpacing',
] as const;

/**
 * Where the character at `index` of a text area is drawn on screen — its left edge, the line's top and height — for
 * what opens at the caret (the editor's @ and # suggestions). A text area tells no position of its own, so a copy of
 * its text, laid out as it lays it out, is measured.
 *
 * @util
 */
export function getCaretRect(textarea: HTMLTextAreaElement, index: number): DOMRect {
    const style = getComputedStyle(textarea);
    const mirror = document.createElement('div');
    for (const property of MIRRORED_STYLES) {
        mirror.style[property] = style[property];
    }

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.textContent = textarea.value.slice(0, index);
    const marker = document.createElement('span');
    // Something to measure even at the end of a line; the rest of the text wraps the line as the text area does.
    marker.textContent = textarea.value.slice(index) || '.';
    mirror.append(marker);
    document.body.append(mirror);

    const lineHeight = Number.parseFloat(style.lineHeight) || marker.offsetHeight;
    const box = textarea.getBoundingClientRect();
    const left = box.left + marker.offsetLeft - textarea.scrollLeft;
    const top = box.top + marker.offsetTop - textarea.scrollTop;
    mirror.remove();

    return new DOMRect(left, top, 0, lineHeight);
}
