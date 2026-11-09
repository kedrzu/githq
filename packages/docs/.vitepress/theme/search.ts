/** Opens the default theme's search, as ⌘K does: it offers no other way in from outside its own button. */
export function openSearch() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
}
