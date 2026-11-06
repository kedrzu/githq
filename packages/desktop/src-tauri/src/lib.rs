//! The githq desktop app: the app's desktop build (`bun --cwd packages/app build:desktop`) in one native window.

mod credentials;
mod device_flow;
mod external;
mod job_logs;
mod updater;

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindowBuilder};
#[cfg(target_os = "macos")]
use tauri::{Webview, WebviewWindow, WindowEvent};

use credentials::Credentials;
use device_flow::DeviceFlow;
use job_logs::JobLogs;

/// The event telling the page a trackpad scroll's phases (`report_scroll_phases`).
#[cfg(target_os = "macos")]
const SCROLL_PHASE_EVENT: &str = "scroll-phase";

/// The address `nuxt dev` serves the app on, which `tauri dev` loads (`build.devUrl` in `tauri.conf.json`).
const DEV_SERVER_PORT: u16 = 8787;

/// Starts the app and blocks until it quits.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Credentials::os())
        .manage(DeviceFlow::github())
        .manage(JobLogs::github())
        // Each one is also listed in `build.rs` and allowed for the window in `capabilities/default.json`.
        .invoke_handler(tauri::generate_handler![
            credentials::token_load,
            credentials::token_save,
            credentials::token_delete,
            device_flow::device_start,
            device_flow::device_finish,
            external::open_external,
            job_logs::read_job_log,
            updater::update_status,
            updater::update_check,
            updater::update_set_stream,
            updater::update_restart,
        ])
        .setup(|app| {
            // First, as it sets up the state the window's commands reach for.
            updater::start(app.handle());
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

    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
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
        });

    // On macOS the window controls sit in the sidebar instead of a bar of their own, in the strip the app leaves for
    // them (`shell/windowControls.ts`). With no title bar, the page says what drags the window.
    #[cfg(target_os = "macos")]
    let window = window
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(10.0, 20.0));

    #[cfg(target_os = "macos")]
    {
        let window = window.build()?;
        keep_keyboard_on_webview(&window);
        go_back_and_forward_on_swipes(&window);
        report_scroll_phases(&window);
    }
    #[cfg(not(target_os = "macos"))]
    window.build()?;

    Ok(())
}

/// Gives the keyboard back to the webview whenever the native side may have taken it. Leaving full screen hands it to
/// tao's own view, which wry has already taken out of the window, so the window ends up holding the keyboard: the page
/// gets no key until a click, even after coming back to the window from another Space. Tao queues that change on the
/// main queue before it reports the resize, so queueing this behind it runs it after; run straight away, it loses
/// the race now and then. It only moves the keyboard inside the window and never activates the app.
#[cfg(target_os = "macos")]
fn keep_keyboard_on_webview(window: &WebviewWindow) {
    let webview: Webview = window.as_ref().clone();

    window.on_window_event(move |event| {
        if matches!(event, WindowEvent::Focused(true) | WindowEvent::Resized(_)) {
            let webview = webview.clone();
            dispatch2::DispatchQueue::main().exec_async(move || {
                let _ = webview.set_focus();
            });
        }
    });
}

/// Goes back or forward on macOS's swipe event: what a mouse's back and forward buttons send when their driver turns
/// them into macOS's gesture, as Logi Options+ does. The webview's own back-forward gestures stay off, as they slide a
/// picture of the whole page; the page draws its own for a trackpad's two-finger swipe (`desktop/useHistorySwipe.ts`).
/// The monitor sees only the app's own events and lasts as long as the app.
#[cfg(target_os = "macos")]
fn go_back_and_forward_on_swipes(window: &WebviewWindow) {
    use std::ptr::NonNull;

    use objc2_app_kit::{NSEvent, NSEventMask};

    let window = window.clone();
    let handler = block2::RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        // As WebKit reads it: a positive delta goes back.
        let delta = unsafe { event.as_ref() }.deltaX();
        let script = if delta > 0.0 {
            Some("history.back()")
        } else if delta < 0.0 {
            Some("history.forward()")
        } else {
            None
        };
        if let Some(script) = script {
            let _ = window.eval(script);
        }

        event.as_ptr()
    });

    // SAFETY: the handler hands back the event it was given, a valid pointer.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::Swipe, &handler)
    };
    std::mem::forget(monitor);
}

/// Tells the page when the fingers come down on the trackpad to scroll, lift off, or the system takes the scroll away
/// (the `scroll-phase` event: `began`, `ended`, `cancelled`), which a wheel event does not say: the page's swipe through
/// the history (`desktop/useHistorySwipe.ts`) goes when the fingers lift, not when they rest. The scrolling that
/// coasts on after them is not told, nor a mouse's wheel, which has no phases.
#[cfg(target_os = "macos")]
fn report_scroll_phases(window: &WebviewWindow) {
    use std::ptr::NonNull;

    use objc2_app_kit::{NSEvent, NSEventMask, NSEventPhase};
    use tauri::Emitter;

    let window = window.clone();
    let handler = block2::RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        let scroll = unsafe { event.as_ref() };
        let phase = scroll.phase();
        let reported = if scroll.momentumPhase() != NSEventPhase::None {
            None
        } else if phase.contains(NSEventPhase::Began) {
            Some("began")
        } else if phase.contains(NSEventPhase::Ended) {
            Some("ended")
        } else if phase.contains(NSEventPhase::Cancelled) {
            Some("cancelled")
        } else {
            None
        };
        if let Some(reported) = reported {
            let _ = window.emit(SCROLL_PHASE_EVENT, reported);
        }

        event.as_ptr()
    });

    // SAFETY: the handler hands back the event it was given, a valid pointer.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::ScrollWheel, &handler)
    };
    std::mem::forget(monitor);
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
