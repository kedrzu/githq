//! Opening web pages in the system browser — GitHub's pages, the device flow's code page — for the app and for the
//! window's navigation backstops alike. Only `http:` and `https:` addresses are opened, so a page can never make
//! the app launch a program or open a file.

use serde::Serialize;
use tauri::{AppHandle, Url};
use tauri_plugin_opener::OpenerExt;

/// Why `open_external` did not open the address. Serialised for the app as the bare code.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ExternalError {
    /// The address is not an `http:` or `https:` one, or not an address at all.
    NotWebPage,
    /// The system could not open the browser.
    Failed,
}

/// `url` if it is a web page's address.
fn web_page(url: &Url) -> Result<&Url, ExternalError> {
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err(ExternalError::NotWebPage),
    }
}

/// `url` parsed, if it is a web page's address.
fn parse_web_page(url: &str) -> Result<Url, ExternalError> {
    let url = Url::parse(url).map_err(|_| ExternalError::NotWebPage)?;
    web_page(&url)?;
    Ok(url)
}

/// Opens a web page in the system browser; any other kind of address is refused.
pub fn open(app: &AppHandle, url: &Url) -> Result<(), ExternalError> {
    let url = web_page(url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| {
            eprintln!("Could not open {url} in the browser: {error}");
            ExternalError::Failed
        })
}

/// Opens a web page (`http:` or `https:`) in the system browser.
#[tauri::command]
pub fn open_external(app: AppHandle, url: String) -> Result<(), ExternalError> {
    open(&app, &parse_web_page(&url)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_web_pages() {
        for url in ["https://github.com/login/device", "http://example.com/"] {
            assert_eq!(parse_web_page(url).map(String::from), Ok(url.to_owned()));
        }
    }

    #[test]
    fn refuses_anything_but_web_pages() {
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "x-github-client://openRepo/kedrzu/githq",
            "mailto:someone@example.com",
            "ftp://example.com/",
            "/relative/path",
            "not a url",
            "",
        ] {
            assert_eq!(parse_web_page(url), Err(ExternalError::NotWebPage), "{url}");
        }
    }
}
