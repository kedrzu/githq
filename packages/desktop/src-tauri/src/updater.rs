//! Keeping the app up to date from GitHub Releases (`plugins.updater` in `tauri.conf.json`): checked at launch and
//! every few hours, downloaded in the background — its signature always verified — and then offered to the user,
//! who restarts when they choose. Nothing restarts on its own.
//!
//! On macOS and Linux the download is installed at once: the plugin replaces the app on disk and the running one
//! goes on, so the new version starts at the next launch, whether the user restarts now or quits later. On Windows
//! installing runs the installer, which quits the app, so the download waits for the user's restart.
//!
//! The window learns of a ready update twice over, so it never misses one however the two race: the `update-ready`
//! event once the update is ready, and `update_status`, which the window calls once after it started listening.
//! Errors — offline, no release yet, a bad signature — are logged and retried at the next check, never shown.

use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;

/// How long between two checks.
const CHECK_INTERVAL: Duration = Duration::from_secs(4 * 60 * 60);

/// The event that tells the window an update is ready, with an [`UpdateReady`].
const READY_EVENT: &str = "update-ready";

/// What [`READY_EVENT`] carries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UpdateReady {
    /// The version ready to run (`1.4.0`).
    pub version: String,
}

/// Why `update_restart` did not restart. Serialised for the app as the bare code.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RestartError {
    /// No update is ready.
    NotReady,
    /// The installer could not be started; Windows only, the one platform that installs on restart.
    #[cfg(windows)]
    Failed,
}

/// A downloaded update, verified — and on macOS and Linux already installed.
struct Ready {
    version: String,
    /// What `update_restart` installs on Windows: the update and its downloaded package.
    #[cfg(windows)]
    package: (tauri_plugin_updater::Update, Vec<u8>),
}

/// The update ready to run, once there is one; the app's managed state.
#[derive(Default)]
pub struct Updates {
    ready: Mutex<Option<Ready>>,
}

impl Updates {
    fn lock(&self) -> MutexGuard<'_, Option<Ready>> {
        // A panic while holding it cannot leave it half written: it only ever holds a whole `Ready` or none.
        self.ready
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// The version of the update ready to run.
    fn ready_version(&self) -> Option<String> {
        self.lock().as_ref().map(|ready| ready.version.clone())
    }

    fn set_ready(&self, ready: Ready) {
        *self.lock() = Some(ready);
    }
}

/// Starts checking for updates in the background — not under `tauri dev`, which has no release to update to.
pub fn start(app: &AppHandle) {
    if cfg!(dev) {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        // Once one is ready the checks stop: the next launch runs it, and checks again from there.
        loop {
            match prepare(&app).await {
                Ok(Some(version)) => {
                    if let Err(error) = app.emit(READY_EVENT, UpdateReady { version }) {
                        eprintln!("Could not tell the window about the update: {error}");
                    }
                    return;
                }
                Ok(None) => {}
                Err(error) => eprintln!("Could not update the app, retrying later: {error}"),
            }

            tokio::time::sleep(CHECK_INTERVAL).await;
        }
    });
}

/// Checks for a newer release and readies it: downloaded and verified, on macOS and Linux also installed. Answers
/// its version, or `None` when the app is up to date.
async fn prepare(app: &AppHandle) -> tauri_plugin_updater::Result<Option<String>> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(None);
    };

    let bytes = update.download(|_, _| {}, || {}).await?;
    // Replaces the app on disk; the running one goes on until the user restarts or quits.
    #[cfg(not(windows))]
    update.install(&bytes)?;

    let version = update.version.clone();
    app.state::<Updates>().set_ready(Ready {
        version: version.clone(),
        #[cfg(windows)]
        package: (update, bytes),
    });
    Ok(Some(version))
}

/// The version of the update ready to run, if any — for the window to ask once it listens for `update-ready`.
#[tauri::command]
pub fn update_status(updates: State<'_, Updates>) -> Option<String> {
    updates.ready_version()
}

/// Restarts into the ready update, at the user's word: on Windows runs its installer, which quits the app and starts
/// the new version; on macOS and Linux, where it is installed already, restarts the app.
#[tauri::command]
pub fn update_restart(app: AppHandle, updates: State<'_, Updates>) -> Result<(), RestartError> {
    let ready = updates.lock();
    let ready = ready.as_ref().ok_or(RestartError::NotReady)?;
    restart_into(&app, ready)
}

/// Runs the installer, which quits the app once it started.
#[cfg(windows)]
fn restart_into(_app: &AppHandle, ready: &Ready) -> Result<(), RestartError> {
    let (update, bytes) = &ready.package;
    update.install(bytes).map_err(|error| {
        eprintln!("Could not install the update {}: {error}", ready.version);
        RestartError::Failed
    })
}

/// Restarts the app, installed already.
#[cfg(not(windows))]
fn restart_into(app: &AppHandle, _ready: &Ready) -> Result<(), RestartError> {
    app.request_restart();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_event_carries_the_version() {
        let payload = serde_json::to_value(UpdateReady {
            version: "1.4.0".to_owned(),
        });
        assert_eq!(
            payload.ok(),
            Some(serde_json::json!({ "version": "1.4.0" }))
        );
    }

    #[test]
    fn restart_errors_are_bare_codes() {
        assert_eq!(
            serde_json::to_value(RestartError::NotReady).ok(),
            Some(serde_json::json!("notReady"))
        );
        #[cfg(windows)]
        assert_eq!(
            serde_json::to_value(RestartError::Failed).ok(),
            Some(serde_json::json!("failed"))
        );
    }
}
