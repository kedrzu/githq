//! The githq desktop app: the app's desktop build (`bun --cwd packages/app build:desktop`) in one native window.

mod credentials;
mod device_flow;
mod external;

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};

use credentials::Credentials;
use device_flow::DeviceFlow;

/// The address `nuxt dev` serves the app on, which `tauri dev` loads (`build.devUrl` in `tauri.conf.json`).
const DEV_SERVER_PORT: u16 = 8787;

/// Starts the app and blocks until it quits.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Credentials::os())
        .manage(DeviceFlow::github())
        // Each one is also listed in `build.rs` and allowed for the window in `capabilities/default.json`.
        .invoke_handler(tauri::generate_handler![
            credentials::token_load,
            credentials::token_save,
            credentials::token_delete,
            device_flow::device_start,
            device_flow::device_finish,
            external::open_external,
        ])
        .setup(|app| {
            open_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("the desktop app failed to start");
}

/// The app's one window. Created here rather than in `tauri.conf.json`, which cannot say where the webview may
/// navigate: it stays on the app, and every other address opens in the system browser instead.
fn open_main_window(app: &AppHandle) -> tauri::Result<()> {
    let navigation_app = app.clone();
    let new_window_app = app.clone();

    WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("githq")
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        // A backstop: the app opens GitHub's pages in the browser itself; a link that still leaves it ends up here.
        .on_navigation(move |url| {
            if is_app_url(url) {
                return true;
            }

            // Refused or failed, the webview stays where it is; `external::open` logs a failure.
            let _ = external::open(&navigation_app, url);
            false
        })
        // Also a backstop: WebView2 does not report every `target="_blank"` link here.
        .on_new_window(move |url, _features| {
            let _ = external::open(&new_window_app, &url);
            NewWindowResponse::Deny
        })
        .build()?;

    Ok(())
}

/// Whether the address is the app's own: the origin Tauri serves the built app from — `tauri://localhost`, or
/// `http://tauri.localhost` on Windows — or, under `tauri dev`, the dev server.
fn is_app_url(url: &Url) -> bool {
    match (url.scheme(), url.host_str()) {
        ("tauri", Some("localhost")) => !cfg!(windows),
        ("http", Some("tauri.localhost")) => cfg!(windows),
        ("http", Some("localhost")) => cfg!(dev) && url.port() == Some(DEV_SERVER_PORT),
        _ => false,
    }
}
