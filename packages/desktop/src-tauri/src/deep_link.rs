//! Opening githq links in the app: a `githq://` deep link, a Universal Link to githq.dev, or a githq.dev page the
//! window would navigate to. Each one becomes an address of the app's own (`/kedrzu/githq/pull/1`), kept until the
//! page takes it (`link_take`) on start or when told (the `link-opened` event); which screen it opens is the page's
//! business. Anything else is refused: a link can be faked, even as a command-line argument, and must never take the
//! window off the app.

use std::sync::{Mutex, PoisonError};

use percent_encoding::percent_decode_str;
use tauri::{AppHandle, Emitter, Manager, State, Url};

/// The event telling the page a link was opened, with no payload: the page takes it with `link_take`.
const LINK_OPENED_EVENT: &str = "link-opened";

/// The app's scheme, registered with the system (`plugins.deep-link` in `tauri.conf.json`).
const SCHEME: &str = "githq";

/// The hosts the web app is served on.
const WEB_HOSTS: [&str; 2] = ["githq.dev", "www.githq.dev"];

/// The address of the last link opened, until the page takes it. A link opened before the page has taken the one
/// before replaces it: the latest one is where the user wants to be.
#[derive(Default)]
pub struct PendingLink(Mutex<Option<String>>);

impl PendingLink {
    fn slot(&self) -> std::sync::MutexGuard<'_, Option<String>> {
        // The guarded value is a plain `Option`, whole at every point a panic could leave it.
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// Opens a link in the app: keeps its address for the page, brings the window up and tells the page. A link that
/// maps to no address of the app's is logged and ignored.
pub fn open(app: &AppHandle, url: &Url) {
    let Some(address) = app_address(url) else {
        eprintln!("Refused to open {url} in the app: not a githq link");
        return;
    };

    *app.state::<PendingLink>().slot() = Some(address);
    show_window(app);
    if let Err(error) = app.emit(LINK_OPENED_EVENT, ()) {
        eprintln!("Could not tell the page a link was opened: {error}");
    }
}

/// Brings the app's window to the front, out of the Dock or the taskbar if need be.
pub fn show_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Whether the address is a page of the web app, which the window opens as the app's own instead of in the browser.
pub fn is_web_app_url(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str().is_some_and(|host| WEB_HOSTS.contains(&host))
}

/// The address of the last link opened, if the page has not taken it yet; taking it clears it.
#[tauri::command]
pub fn link_take(pending: State<'_, PendingLink>) -> Option<String> {
    pending.slot().take()
}

/// The app's own address a link stands for: `githq://<host><path>?<query>#<fragment>` → `/<host><path>?…#…`, and a
/// githq.dev page → its path, query and fragment. `None` for anything that is not a githq link, or whose address
/// could be read as another origin (`//host`, `/\host`) or carries a control character.
fn app_address(url: &Url) -> Option<String> {
    if !url.username().is_empty() || url.password().is_some() || url.port().is_some() {
        return None;
    }

    let path = match url.scheme() {
        SCHEME => {
            let host = url.host_str().unwrap_or_default();
            let path = if host.is_empty() {
                url.path().to_owned()
            } else {
                format!("/{host}{}", url.path())
            };
            if path.is_empty() {
                "/".to_owned()
            } else {
                path
            }
        }
        _ if is_web_app_url(url) => url.path().to_owned(),
        _ => return None,
    };

    let mut address = path.clone();
    if let Some(query) = url.query() {
        address.push('?');
        address.push_str(query);
    }
    if let Some(fragment) = url.fragment() {
        address.push('#');
        address.push_str(fragment);
    }

    let decoded_path = percent_decode_str(&path).decode_utf8_lossy();
    let decoded = percent_decode_str(&address).decode_utf8_lossy();
    let one_slash = |path: &str| path.starts_with('/') && !path.starts_with("//");
    let harmless = |address: &str| !address.chars().any(|c| c == '\\' || c.is_control());

    (one_slash(&path) && one_slash(&decoded_path) && harmless(&address) && harmless(&decoded))
        .then_some(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address(url: &str) -> Option<String> {
        app_address(&Url::parse(url).expect("a test URL parses"))
    }

    #[test]
    fn maps_githq_links_to_the_app_address() {
        for (url, expected) in [
            ("githq://kedrzu/githq/pull/1", "/kedrzu/githq/pull/1"),
            (
                "githq://kedrzu/githq/issues?q=is%3Aopen#top",
                "/kedrzu/githq/issues?q=is%3Aopen#top",
            ),
            ("githq://kedrzu", "/kedrzu"),
            ("githq:///kedrzu/githq", "/kedrzu/githq"),
            ("githq://", "/"),
            ("githq:///", "/"),
            ("githq://?q=1", "/?q=1"),
        ] {
            assert_eq!(address(url).as_deref(), Some(expected), "{url}");
        }
    }

    #[test]
    fn maps_web_app_pages_to_their_path() {
        for (url, expected) in [
            (
                "https://githq.dev/kedrzu/githq/pull/1",
                "/kedrzu/githq/pull/1",
            ),
            (
                "https://www.githq.dev/kedrzu/githq/issues?q=1#c2",
                "/kedrzu/githq/issues?q=1#c2",
            ),
            ("https://githq.dev", "/"),
            ("https://githq.dev:443/inbox", "/inbox"),
        ] {
            assert_eq!(address(url).as_deref(), Some(expected), "{url}");
        }
    }

    #[test]
    fn refuses_other_schemes_and_hosts() {
        for url in [
            "http://githq.dev/kedrzu/githq",
            "https://github.com/kedrzu/githq",
            "https://githq.dev.evil.com/kedrzu",
            "https://evil.com/githq.dev",
            "https://sub.githq.dev/kedrzu",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "tauri://localhost/kedrzu",
            "githqx://kedrzu/githq",
            "githq:kedrzu/githq",
        ] {
            assert_eq!(address(url), None, "{url}");
        }
    }

    #[test]
    fn refuses_credentials_and_ports() {
        for url in [
            "githq://user@kedrzu/githq",
            "githq://user:secret@kedrzu/githq",
            "githq://:secret@kedrzu/githq",
            "githq://kedrzu:8080/githq",
            "https://user@githq.dev/kedrzu",
            "https://user:secret@githq.dev/kedrzu",
            "https://githq.dev:8443/kedrzu",
        ] {
            assert_eq!(address(url), None, "{url}");
        }
    }

    #[test]
    fn refuses_addresses_that_read_as_another_origin() {
        for url in [
            "githq:////evil.com/path",
            "githq:///%2Fevil.com/path",
            "githq://%2Fevil.com/path",
            "githq://%2fevil.com",
            "https://githq.dev//evil.com/path",
            "https://githq.dev/%2Fevil.com",
            "https://githq.dev/\\evil.com",
        ] {
            assert_eq!(address(url), None, "{url}");
        }
    }

    #[test]
    fn refuses_backslashes_and_control_characters() {
        for url in [
            "githq://kedrzu/githq\\pull",
            "githq://kedrzu/%5Cevil.com",
            "githq://kedrzu/%5cevil.com",
            "githq://kedrzu/githq%00",
            "githq://kedrzu/githq%0A",
            "githq://kedrzu/githq%0D",
            "githq://kedrzu/githq?q=%0Aevil",
            "githq://kedrzu/githq#%00",
            "https://githq.dev/kedrzu%5Cevil.com",
            "https://githq.dev/kedrzu%00",
            "https://githq.dev/kedrzu?q=%5C",
            "https://githq.dev/kedrzu#%7F",
        ] {
            assert_eq!(address(url), None, "{url}");
        }
    }

    #[test]
    fn what_passes_starts_with_exactly_one_slash() {
        for url in [
            "githq://kedrzu/githq",
            "githq://",
            "githq:///",
            "githq:///a//b",
            "https://githq.dev",
            "https://githq.dev/a//b",
        ] {
            let address = address(url).expect(url);
            assert!(
                address.starts_with('/') && !address.starts_with("//"),
                "{url} → {address}"
            );
        }
    }
}
