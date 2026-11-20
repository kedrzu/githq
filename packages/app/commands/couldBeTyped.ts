/** A text-editing key that, with `Mod`, is still a field's own: select all, copy, paste, cut, undo, redo, moving and deleting by word or line, a field's submit. */
const EDITING_KEY = /^(?:[ACVXYZ]|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Backspace|Delete|Home|End|Enter)$/iu;

/**
 * Whether a key in the app's notation (`Mod+K`, `Shift+Mod+G`, `A`, `ArrowDown`) may be a focused field's own, so a
 * command must leave it to the field (commands D15). Without `Mod` it always may be: a letter, digit or symbol, with
 * Shift or Alt too, types; an arrow, Enter, Escape, Tab or Backspace edits or moves. With `Mod` only a text-editing
 * key may be (⌘A, ⌘C, ⌘V, ⌘X, ⌘Z, ⌘Y, ⌘ with an arrow, Backspace, Delete, Home, End or Enter, with Shift or Alt
 * too): every other `Mod` key is never typing, and runs its command.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function couldBeTyped(key: string): boolean {
    const parts = key.split('+');
    const name = parts.pop() ?? '';
    return !parts.includes('Mod') || EDITING_KEY.test(name);
}
