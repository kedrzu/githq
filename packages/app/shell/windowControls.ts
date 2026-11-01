import { isApplePlatform } from '@/utils/isApplePlatform.js';

/**
 * Whether macOS's window controls sit over the window's top left corner rather than in a title bar of their own: the
 * desktop app on a Mac (`open_main_window` in `packages/desktop/src-tauri/src/lib.rs`). The web builds drop it, with
 * all that hangs on it.
 */
export const WINDOW_CONTROLS_OVERLAID = __DESKTOP__ && isApplePlatform();

/**
 * Bound on what takes over from the missing title bar: dragging it moves the window, and double-clicking it zooms,
 * except on what is clickable inside it. Elsewhere it is nothing: Windows and Linux have their title bars.
 */
export const WINDOW_DRAG_REGION = WINDOW_CONTROLS_OVERLAID ? { 'data-tauri-drag-region': 'deep' } : {};
