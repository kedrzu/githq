import { isApplePlatform } from '@/utils/isApplePlatform.js';

/**
 * On a Mac, has ⌘[ and ⌘] go back and forward, as in a browser: the shortcuts are the browser's rather than the
 * webview's, so the desktop app's window has none of its own.
 */
export function installHistoryKeys() {
    if (!isApplePlatform()) {
        return;
    }

    window.addEventListener('keydown', event => {
        if (event.defaultPrevented || !event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        switch (event.key) {
            case '[':
                event.preventDefault();
                window.history.back();
                break;
            case ']':
                event.preventDefault();
                window.history.forward();
                break;
        }
    });
}
