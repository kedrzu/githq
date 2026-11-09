//! The Mac's menu bar: Tauri's default one, except that ⌘W does not close the window. The app has the one window, and
//! closing it quits, so ⌘W asks the page to say that ⌘Q quits (`desktop/QuitHintToast.vue`). The window's close button
//! still closes it.

use tauri::menu::{Menu, MenuEvent, MenuItem, MenuItemKind};
use tauri::{AppHandle, Emitter, Runtime};

/// The event telling the page ⌘W was pressed, or Close Window chosen in the menu.
const CLOSE_WINDOW_PRESSED_EVENT: &str = "close-window-pressed";

/// The menu item that stands in for the predefined Close Window.
const CLOSE_WINDOW_ID: &str = "close-window";

/// The text of Tauri's predefined Close Window, the only way to find it: its id is random.
const CLOSE_WINDOW_TEXT: &str = "Close Window";

/// Tauri's default menu with each predefined Close Window (in File and in Window) swapped, in place, for one of the
/// app's own on the same key.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;

    for entry in menu.items()? {
        let MenuItemKind::Submenu(submenu) = entry else {
            continue;
        };
        for (position, item) in submenu.items()?.into_iter().enumerate() {
            let MenuItemKind::Predefined(predefined) = item else {
                continue;
            };
            if predefined.text()? != CLOSE_WINDOW_TEXT {
                continue;
            }

            let close_window = MenuItem::with_id(
                app,
                CLOSE_WINDOW_ID,
                CLOSE_WINDOW_TEXT,
                true,
                Some("CmdOrCtrl+W"),
            )?;
            submenu.remove_at(position)?;
            submenu.insert(&close_window, position)?;
        }
    }

    Ok(menu)
}

/// Tells the page when the app's Close Window was chosen.
pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id() == CLOSE_WINDOW_ID {
        let _ = app.emit(CLOSE_WINDOW_PRESSED_EVENT, ());
    }
}
