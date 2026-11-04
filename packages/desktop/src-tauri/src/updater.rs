//! Keeping the app up to date from GitHub Releases, on the stream the user follows: Stable, or Development with the
//! builds from `main`. One task checks at launch and on a timer, serially, and downloads what it finds in the background,
//! its signature always verified by the plugin. The update is then offered to the user, who restarts when they choose.
//! Nothing restarts on its own.
//!
//! On macOS the download is installed at once: the plugin replaces the app on disk and the running one goes on, so the
//! new version starts at the next launch, whether the user restarts now or quits later. On Linux and Windows it installs
//! only at the user's restart: Linux may ask for an administrator password, which the user can refuse and retry, and the
//! Windows installer quits the app.
//!
//! The native side owns one state, [`UpdateState`]. Every change sends it whole as the `update-state` event, and
//! `update_status` answers it, so a window that starts listening and then asks once can't miss one. Errors are logged and
//! retried at the next check; the state says only what the window needs to tell the user.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, Url};
use tauri_plugin_updater::{Error, Update, UpdaterExt};
use tokio::sync::Notify;

/// How long between two timed checks on Stable.
const STABLE_INTERVAL: Duration = Duration::from_secs(4 * 60 * 60);

/// How long between two timed checks on Development, which delivers what was just merged.
const DEVELOPMENT_INTERVAL: Duration = Duration::from_secs(15 * 60);

/// How long a connection may take to open, and then to send anything. Without a limit, a stalled connection would hold
/// the one task that checks forever. Not a limit on the whole request, which a slow download may well exceed.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const READ_TIMEOUT: Duration = Duration::from_secs(60);

/// The event that carries the [`UpdateState`] whole.
const STATE_EVENT: &str = "update-state";

/// The file in the app's data directory that holds the stream, once the user chose one.
const STREAM_FILE: &str = "update-stream.json";

/// The manifests of the two streams. Stable is GitHub's latest release, which a prerelease never is; Development is the
/// one release every build from `main` replaces.
const STABLE_MANIFEST: &str =
    "https://github.com/kedrzu/githq/releases/latest/download/latest.json";
const DEVELOPMENT_MANIFEST: &str =
    "https://github.com/kedrzu/githq/releases/download/development/latest.json";

/// Which builds the app follows.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Stream {
    Stable,
    Development,
}

/// Why a check or a download failed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FailReason {
    Offline,
    Unreachable,
}

/// What the updater is doing, or how the last thing it did ended.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Activity {
    Idle,
    Checking,
    UpToDate,
    Downloading {
        version: String,
        /// `None` when the server doesn't say how long the download is.
        percent: Option<u8>,
    },
    Ready {
        version: String,
    },
    Failed {
        reason: FailReason,
    },
    /// The stream has no release at all.
    NoRelease,
    Installing {
        version: String,
    },
    /// Installing failed. A refused password prompt can't be told from any other failure: the plugin falls through to `sudo`
    /// and answers `PackageInstallFailed` for both.
    InstallFailed {
        version: String,
    },
}

/// Everything the window knows about updates.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateState {
    /// The running version.
    version: String,
    /// The commit it was built from; `None` for a local build.
    commit: Option<String>,
    stream: Stream,
    /// Whether the user may change the stream. Windows has no Development builds.
    can_choose: bool,
    /// Whether the check under way or waiting its turn, or the last finished one, was asked for by the user.
    manual: bool,
    /// When the last check finished, in epoch milliseconds.
    checked_at: Option<u64>,
    activity: Activity,
}

/// The downloaded update that `update_restart` installs. The plugin verifies its signature again when installing.
struct Package {
    update: Update,
    bytes: Vec<u8>,
}

/// A downloaded and verified update.
struct Ready {
    version: String,
    /// What is still to be installed on Linux and Windows; `None` on macOS, where it already is.
    package: Option<Arc<Package>>,
}

/// One piece of work for the task that checks.
enum Job {
    Check,
    Install {
        version: String,
        package: Arc<Package>,
    },
}

/// What happens to the state, free of the app so that it can be tested.
struct Inner {
    state: UpdateState,
    ready: Option<Ready>,
    /// The user asked for a check that hasn't started.
    check_requested: bool,
    /// The user asked to restart into this update, and it hasn't started installing.
    install_requested: Option<(String, Arc<Package>)>,
}

impl Inner {
    fn new(version: &Version, commit: Option<&str>, stream: Stream, can_choose: bool) -> Self {
        Self {
            state: UpdateState {
                version: version.to_string(),
                commit: commit.map(str::to_owned),
                stream,
                can_choose,
                manual: false,
                checked_at: None,
                activity: Activity::Idle,
            },
            ready: None,
            check_requested: false,
            install_requested: None,
        }
    }

    /// The user asked for a check. It runs after the job under way, and that job shows as asked for from here on too, so
    /// whoever pressed the button sees it through.
    fn request_check(&mut self) {
        self.check_requested = true;
        self.state.manual = true;
    }

    /// The next piece of work, if there is any; `due` says the timer ran out. A check in progress shows from here on,
    /// in one step with taking it, so that a restart can't slip in between.
    fn next_job(&mut self, due: bool) -> Option<Job> {
        if let Some((version, package)) = self.install_requested.take() {
            return Some(Job::Install { version, package });
        }
        if !self.check_requested && !due {
            return None;
        }

        self.state.manual = self.check_requested;
        self.check_requested = false;
        self.state.activity = Activity::Checking;
        Some(Job::Check)
    }

    /// How a check or a download ended, unless an update is ready: that one is never lost, and stays on offer.
    fn settle(&mut self, activity: Activity) {
        self.state.activity = match &self.ready {
            Some(ready) => Activity::Ready {
                version: ready.version.clone(),
            },
            None => activity,
        };
    }

    /// A check found nothing to download, or failed.
    fn finish_check(&mut self, activity: Activity, at: u64) {
        self.state.checked_at = Some(at);
        self.settle(activity);
    }

    /// A check found this version. Answers whether to download it: not if it's the one already ready.
    fn found_update(&mut self, version: &str, at: u64) -> bool {
        if self
            .ready
            .as_ref()
            .is_some_and(|ready| ready.version == version)
        {
            self.finish_check(Activity::UpToDate, at);
            return false;
        }

        self.state.checked_at = Some(at);
        self.state.activity = Activity::Downloading {
            version: version.to_owned(),
            percent: None,
        };
        true
    }

    fn set_ready(&mut self, ready: Ready) {
        self.ready = Some(ready);
        self.settle(Activity::Idle);
    }

    /// The user chose a stream. Answers whether that's allowed; if so, a check for it runs next.
    fn choose_stream(&mut self, stream: Stream) -> bool {
        if !self.state.can_choose {
            return false;
        }

        self.state.stream = stream;
        self.request_check();
        true
    }

    /// The user asked to restart into the ready update. Answers whether the app is to restart right away, which it is
    /// when the update is installed already; otherwise installing is queued. Nothing happens unless the update is on
    /// offer: not while installing, so a second call changes nothing, and not while a check may be replacing it.
    fn request_restart(&mut self) -> bool {
        if !matches!(
            self.state.activity,
            Activity::Ready { .. } | Activity::InstallFailed { .. }
        ) {
            return false;
        }
        let Some(ready) = &self.ready else {
            return false;
        };
        let Some(package) = &ready.package else {
            return true;
        };

        self.install_requested = Some((ready.version.clone(), Arc::clone(package)));
        self.state.activity = Activity::Installing {
            version: ready.version.clone(),
        };
        false
    }
}

/// The updater; the app's managed state.
pub struct Updates {
    inner: Mutex<Inner>,
    /// Wakes the task that checks. A wake with the task busy is kept for when it next waits.
    wake: Notify,
    /// `None` when the app's data directory is unknown: the choice then holds for this run.
    stream_file: Option<PathBuf>,
}

impl Updates {
    fn new(app: &AppHandle) -> Self {
        let stream_file = match app.path().app_data_dir() {
            Ok(directory) => Some(directory.join(STREAM_FILE)),
            Err(error) => {
                eprintln!("Could not find where to store the update stream: {error}");
                None
            }
        };
        let version = &app.package_info().version;
        let can_choose = !cfg!(windows);
        let stored = stream_file.as_deref().and_then(read_stream);

        Self {
            inner: Mutex::new(Inner::new(
                version,
                option_env!("GITHQ_COMMIT").filter(|commit| !commit.is_empty()),
                initial_stream(stored, version, can_choose),
                can_choose,
            )),
            wake: Notify::new(),
            stream_file,
        }
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // A panic while holding it cannot leave it half written: every change to it is a few plain assignments.
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Changes the state and sends it to the window. Sent under the lock, so that two changes can't arrive in the wrong
    /// order and leave the window on the older one.
    fn change<T>(&self, app: &AppHandle, change: impl FnOnce(&mut Inner) -> T) -> T {
        let mut inner = self.lock();
        let result = change(&mut inner);
        if let Err(error) = app.emit(STATE_EVENT, &inner.state) {
            eprintln!("Could not tell the window about the update state: {error}");
        }
        result
    }
}

/// The stream of an app where the user has chosen none: a version with a prerelease part (`-dev.N`) is a Development
/// build, and whoever downloaded one wanted one.
fn default_stream(version: &Version) -> Stream {
    if version.pre.is_empty() {
        Stream::Stable
    } else {
        Stream::Development
    }
}

/// The stream at launch: the user's choice if there is one, and always Stable where there is no choosing.
fn initial_stream(stored: Option<Stream>, version: &Version, can_choose: bool) -> Stream {
    if !can_choose {
        return Stream::Stable;
    }
    stored.unwrap_or_else(|| default_stream(version))
}

/// The stored choice; a missing or unreadable file is no choice.
fn read_stream(file: &Path) -> Option<Stream> {
    let content = std::fs::read_to_string(file).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_stream(file: &Path, stream: Stream) -> std::io::Result<()> {
    if let Some(directory) = file.parent() {
        std::fs::create_dir_all(directory)?;
    }
    std::fs::write(file, serde_json::to_vec(&stream)?)
}

/// Whether a release is an update: strictly greater, except that a running version with a prerelease part on Stable takes
/// any stable release, even an older one, so leaving Development gets away from its bugs at once (D5). The rule holds no
/// state, so it survives being offline or a failed download.
fn is_update(stream: Stream, current: &Version, release: &Version) -> bool {
    if stream == Stream::Stable && !current.pre.is_empty() {
        return release.pre.is_empty();
    }
    release > current
}

/// The manifest's address. GitHub serves a replaced file stale for about 100 seconds at the plain URL; a query defeats it.
fn manifest_url(stream: Stream, unix_seconds: u64) -> tauri_plugin_updater::Result<Url> {
    let manifest = match stream {
        Stream::Stable => STABLE_MANIFEST,
        Stream::Development => DEVELOPMENT_MANIFEST,
    };
    Ok(Url::parse(&format!("{manifest}?t={unix_seconds}"))?)
}

fn check_interval(stream: Stream) -> Duration {
    match stream {
        Stream::Stable => STABLE_INTERVAL,
        Stream::Development => DEVELOPMENT_INTERVAL,
    }
}

/// What the window is told about a failed check or download.
fn failure_activity(error: &Error) -> Activity {
    match error {
        Error::ReleaseNotFound => Activity::NoRelease,
        Error::Reqwest(error) if error.is_connect() || error.is_timeout() => Activity::Failed {
            reason: FailReason::Offline,
        },
        _ => Activity::Failed {
            reason: FailReason::Unreachable,
        },
    }
}

/// How much of a download has arrived, in whole percent; `None` when its length is unknown.
fn percent_of(downloaded: u64, total: Option<u64>) -> Option<u8> {
    let total = total.filter(|total| *total > 0)?;
    u8::try_from((downloaded.saturating_mul(100) / total).min(100)).ok()
}

fn since_epoch() -> Duration {
    // Only a clock set before 1970 fails this, and a wrong time on a check harms nothing.
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
}

fn now_ms() -> u64 {
    u64::try_from(since_epoch().as_millis()).unwrap_or(u64::MAX)
}

/// Sets the updater up and starts checking in the background — not under `tauri dev`, which has no release to update to:
/// there the state stays idle.
pub fn start(app: &AppHandle) {
    app.manage(Updates::new(app));

    if cfg!(dev) {
        return;
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let updates = app.state::<Updates>();
        let updates = updates.inner();
        // The check at launch.
        let mut due = true;
        loop {
            match updates.change(&app, |inner| inner.next_job(due)) {
                Some(Job::Check) => check(&app, updates).await,
                Some(Job::Install { version, package }) => {
                    install(&app, updates, version, package).await;
                }
                None => {}
            }
            due = wait(updates).await;
        }
    });
}

/// Waits for a request or the next timed check, and answers whether a timed check is due. Once an update is ready the
/// timed checks stop: the next launch runs it, and checks again from there.
async fn wait(updates: &Updates) -> bool {
    let interval = {
        let inner = updates.lock();
        inner
            .ready
            .is_none()
            .then(|| check_interval(inner.state.stream))
    };

    match interval {
        Some(interval) => tokio::time::timeout(interval, updates.wake.notified())
            .await
            .is_err(),
        None => {
            updates.wake.notified().await;
            false
        }
    }
}

/// Runs one check and, when it finds an update, readies it.
async fn check(app: &AppHandle, updates: &Updates) {
    let stream = updates.lock().state.stream;

    let update = match find_update(app, stream).await {
        Ok(Some(update)) => update,
        Ok(None) => {
            updates.change(app, |inner| {
                inner.finish_check(Activity::UpToDate, now_ms());
            });
            return;
        }
        Err(error) => {
            eprintln!("Could not check for updates, retrying later: {error}");
            updates.change(app, |inner| {
                inner.finish_check(failure_activity(&error), now_ms());
            });
            return;
        }
    };

    if !updates.change(app, |inner| inner.found_update(&update.version, now_ms())) {
        return;
    }

    if let Err(error) = prepare(app, updates, update, stream).await {
        eprintln!("Could not update the app, retrying later: {error}");
        updates.change(app, |inner| inner.settle(failure_activity(&error)));
    }
}

async fn find_update(
    app: &AppHandle,
    stream: Stream,
) -> tauri_plugin_updater::Result<Option<Update>> {
    app.updater_builder()
        .endpoints(vec![manifest_url(stream, since_epoch().as_secs())?])?
        .version_comparator(move |current, release| is_update(stream, &current, &release.version))
        .configure_client(|client| {
            client
                .connect_timeout(CONNECT_TIMEOUT)
                .read_timeout(READ_TIMEOUT)
        })
        .build()?
        .check()
        .await
}

/// Downloads the update, which verifies it, and readies it; on macOS that includes installing it.
async fn prepare(
    app: &AppHandle,
    updates: &Updates,
    update: Update,
    stream: Stream,
) -> tauri_plugin_updater::Result<()> {
    let version = update.version.clone();
    let mut downloaded = 0;
    let mut shown = None;
    let bytes = update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                let percent = percent_of(downloaded, total);
                if percent != shown {
                    shown = percent;
                    updates.change(app, |inner| {
                        inner.state.activity = Activity::Downloading {
                            version: version.clone(),
                            percent,
                        };
                    });
                }
            },
            || {},
        )
        .await?;

    // The user switched while it downloaded, so this isn't wanted any more, least of all a lower version than the
    // running one. The check that switching asked for runs next and takes the activity from here.
    if updates.lock().state.stream != stream {
        return Ok(());
    }

    let package = Arc::new(Package { update, bytes });
    let package = if cfg!(target_os = "macos") {
        // Replaces the app on disk; the running one goes on until the user restarts or quits.
        run_install(package).await?;
        None
    } else {
        Some(package)
    };

    updates.change(app, |inner| inner.set_ready(Ready { version, package }));
    Ok(())
}

/// Installs at the user's restart, and restarts into it. The package stays when that fails, so a further `update_restart`
/// retries. On Windows the plugin's install quits the app itself once the installer started.
async fn install(app: &AppHandle, updates: &Updates, version: String, package: Arc<Package>) {
    match run_install(package).await {
        Ok(()) => app.request_restart(),
        Err(error) => {
            eprintln!("Could not install the update {version}: {error}");
            updates.change(app, |inner| {
                inner.state.activity = Activity::InstallFailed { version };
            });
        }
    }
}

/// Runs the plugin's install, which verifies the signature again, away from the async threads: it blocks for as long as
/// the system's password prompt is open.
async fn run_install(package: Arc<Package>) -> tauri_plugin_updater::Result<()> {
    tauri::async_runtime::spawn_blocking(move || package.update.install(&package.bytes)).await?
}

/// The state as it is now, for the window to ask once it listens for `update-state`.
#[tauri::command]
pub fn update_status(updates: State<'_, Updates>) -> UpdateState {
    updates.lock().state.clone()
}

/// Asks for a check at the user's word; if one is under way, it runs after that.
#[tauri::command]
pub fn update_check(app: AppHandle, updates: State<'_, Updates>) {
    updates.change(&app, Inner::request_check);
    updates.wake.notify_one();
}

/// Why `update_set_stream` refused. Serialised for the app as the bare code.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SetStreamError {
    /// This platform has no choice of stream.
    NotAvailable,
}

/// Switches to a stream at the user's word, and checks it.
#[tauri::command]
pub fn update_set_stream(
    app: AppHandle,
    updates: State<'_, Updates>,
    stream: Stream,
) -> Result<(), SetStreamError> {
    if !updates.change(&app, |inner| inner.choose_stream(stream)) {
        return Err(SetStreamError::NotAvailable);
    }

    if let Some(file) = &updates.stream_file {
        if let Err(error) = write_stream(file, stream) {
            eprintln!("Could not store the update stream, it holds until the app quits: {error}");
        }
    }
    updates.wake.notify_one();
    Ok(())
}

/// Restarts into the ready update, at the user's word: on macOS, where it is installed already, restarts the app; on
/// Linux and Windows installs it first, in the task that checks.
#[tauri::command]
pub fn update_restart(app: AppHandle, updates: State<'_, Updates>) {
    if updates.change(&app, Inner::request_restart) {
        app.request_restart();
    } else {
        updates.wake.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn version(version: &str) -> Version {
        Version::parse(version).unwrap_or_else(|error| panic!("{version}: {error}"))
    }

    fn takes(stream: Stream, current: &str, release: &str) -> bool {
        is_update(stream, &version(current), &version(release))
    }

    fn inner() -> Inner {
        Inner::new(&version("0.2.0"), None, Stream::Stable, true)
    }

    fn ready_inner() -> Inner {
        let mut inner = inner();
        inner.set_ready(Ready {
            version: "0.3.0".to_owned(),
            package: None,
        });
        inner
    }

    fn ready_activity() -> Activity {
        Activity::Ready {
            version: "0.3.0".to_owned(),
        }
    }

    #[test]
    fn a_development_build_leaving_for_stable_takes_an_older_release() {
        assert!(takes(Stream::Stable, "0.3.0-dev.214", "0.2.0"));
    }

    #[test]
    fn a_stable_build_refuses_an_older_release() {
        assert!(!takes(Stream::Stable, "0.2.0", "0.1.9"));
    }

    #[test]
    fn a_stable_build_on_development_takes_only_a_greater_build() {
        assert!(!takes(Stream::Development, "0.2.0", "0.2.0-dev.9"));
        assert!(takes(Stream::Development, "0.2.0", "0.3.0-dev.1"));
    }

    #[test]
    fn a_development_build_on_development_refuses_an_older_build() {
        assert!(!takes(
            Stream::Development,
            "0.3.0-dev.214",
            "0.3.0-dev.213"
        ));
        assert!(takes(Stream::Development, "0.3.0-dev.214", "0.3.0-dev.215"));
    }

    #[test]
    fn a_development_build_on_stable_refuses_another_development_build() {
        assert!(!takes(Stream::Stable, "0.3.0-dev.214", "0.3.0-dev.215"));
    }

    #[test]
    fn the_same_version_is_no_update() {
        assert!(!takes(Stream::Stable, "0.2.0", "0.2.0"));
        assert!(!takes(Stream::Development, "0.3.0-dev.1", "0.3.0-dev.1"));
    }

    #[test]
    fn a_fresh_install_follows_what_it_is() {
        assert_eq!(
            default_stream(&version("0.3.0-dev.214")),
            Stream::Development
        );
        assert_eq!(default_stream(&version("0.2.0")), Stream::Stable);
    }

    #[test]
    fn the_stored_choice_beats_what_the_build_is() {
        let build = version("0.3.0-dev.214");
        assert_eq!(
            initial_stream(Some(Stream::Stable), &build, true),
            Stream::Stable
        );
        assert_eq!(initial_stream(None, &build, true), Stream::Development);
    }

    #[test]
    fn where_there_is_no_choosing_the_stream_is_stable() {
        let build = version("0.3.0-dev.214");
        assert_eq!(
            initial_stream(Some(Stream::Development), &build, false),
            Stream::Stable
        );
        assert_eq!(initial_stream(None, &build, false), Stream::Stable);
    }

    #[test]
    fn choosing_a_stream_is_refused_where_there_is_no_choosing() {
        let mut inner = Inner::new(&version("0.2.0"), None, Stream::Stable, false);

        assert!(!inner.choose_stream(Stream::Development));

        assert_eq!(inner.state.stream, Stream::Stable);
        assert!(!inner.check_requested);
        assert!(!inner.state.manual);
    }

    #[test]
    fn choosing_a_stream_asks_for_a_manual_check() {
        let mut inner = inner();

        assert!(inner.choose_stream(Stream::Development));

        assert_eq!(inner.state.stream, Stream::Development);
        assert!(matches!(inner.next_job(false), Some(Job::Check)));
        assert!(inner.state.manual);
    }

    #[test]
    fn manifests_defeat_the_stale_cache() {
        assert_eq!(
            manifest_url(Stream::Stable, 1700).ok().map(String::from),
            Some(
                "https://github.com/kedrzu/githq/releases/latest/download/latest.json?t=1700"
                    .to_owned()
            )
        );
        assert_eq!(
            manifest_url(Stream::Development, 1700)
                .ok()
                .map(String::from),
            Some(
                "https://github.com/kedrzu/githq/releases/download/development/latest.json?t=1700"
                    .to_owned()
            )
        );
    }

    #[test]
    fn a_stream_is_stored_as_its_name() {
        assert_eq!(
            serde_json::to_value(Stream::Development).ok(),
            Some(json!("development"))
        );
        assert_eq!(
            serde_json::from_str::<Stream>("\"stable\"").ok(),
            Some(Stream::Stable)
        );
        assert_eq!(serde_json::from_str::<Stream>("\"nightly\"").ok(), None);
    }

    #[test]
    fn the_state_has_the_shape_the_window_expects() {
        let mut inner = Inner::new(
            &version("0.3.0-dev.214"),
            Some("abc"),
            Stream::Development,
            true,
        );
        inner.state.manual = true;
        inner.state.checked_at = Some(1700);
        inner.state.activity = Activity::Downloading {
            version: "0.3.0-dev.215".to_owned(),
            percent: Some(40),
        };

        assert_eq!(
            serde_json::to_value(&inner.state).ok(),
            Some(json!({
                "version": "0.3.0-dev.214",
                "commit": "abc",
                "stream": "development",
                "canChoose": true,
                "manual": true,
                "checkedAt": 1700,
                "activity": { "kind": "downloading", "version": "0.3.0-dev.215", "percent": 40 },
            }))
        );
    }

    #[test]
    fn a_local_build_has_no_commit_and_nothing_checked_yet() {
        let value = serde_json::to_value(&inner().state).ok();

        assert_eq!(
            value,
            Some(json!({
                "version": "0.2.0",
                "commit": null,
                "stream": "stable",
                "canChoose": true,
                "manual": false,
                "checkedAt": null,
                "activity": { "kind": "idle" },
            }))
        );
    }

    #[test]
    fn every_activity_serialises_as_the_window_expects() {
        let version = || "1.0.0".to_owned();
        let cases = [
            (Activity::Checking, json!({ "kind": "checking" })),
            (Activity::UpToDate, json!({ "kind": "upToDate" })),
            (
                Activity::Downloading {
                    version: version(),
                    percent: None,
                },
                json!({ "kind": "downloading", "version": "1.0.0", "percent": null }),
            ),
            (
                Activity::Ready { version: version() },
                json!({ "kind": "ready", "version": "1.0.0" }),
            ),
            (
                Activity::Failed {
                    reason: FailReason::Offline,
                },
                json!({ "kind": "failed", "reason": "offline" }),
            ),
            (
                Activity::Failed {
                    reason: FailReason::Unreachable,
                },
                json!({ "kind": "failed", "reason": "unreachable" }),
            ),
            (Activity::NoRelease, json!({ "kind": "noRelease" })),
            (
                Activity::Installing { version: version() },
                json!({ "kind": "installing", "version": "1.0.0" }),
            ),
            (
                Activity::InstallFailed { version: version() },
                json!({ "kind": "installFailed", "version": "1.0.0" }),
            ),
        ];

        for (activity, expected) in cases {
            assert_eq!(serde_json::to_value(&activity).ok(), Some(expected));
        }
    }

    #[test]
    fn a_missing_release_is_not_a_failure() {
        assert_eq!(
            failure_activity(&Error::ReleaseNotFound),
            Activity::NoRelease
        );
    }

    #[tokio::test]
    async fn a_refused_connection_reads_as_offline() {
        // Port 1 on this machine: nothing listens there.
        let error = reqwest::get("http://127.0.0.1:1").await.err();

        assert_eq!(
            error.map(|error| failure_activity(&Error::Reqwest(error))),
            Some(Activity::Failed {
                reason: FailReason::Offline
            })
        );
    }

    #[test]
    fn any_other_error_reads_as_unreachable() {
        assert_eq!(
            failure_activity(&Error::Network("status 500".to_owned())),
            Activity::Failed {
                reason: FailReason::Unreachable
            }
        );
    }

    #[test]
    fn percent_is_whole_and_unknown_without_a_length() {
        assert_eq!(percent_of(1, Some(3)), Some(33));
        assert_eq!(percent_of(3, Some(3)), Some(100));
        assert_eq!(percent_of(4, Some(3)), Some(100));
        assert_eq!(percent_of(3, Some(0)), None);
        assert_eq!(percent_of(3, None), None);
    }

    #[test]
    fn a_timed_check_is_not_manual_even_after_a_manual_one() {
        let mut inner = inner();
        inner.check_requested = true;
        assert!(matches!(inner.next_job(false), Some(Job::Check)));
        assert!(inner.state.manual);

        assert!(matches!(inner.next_job(true), Some(Job::Check)));
        assert!(!inner.state.manual);
        assert_eq!(inner.state.activity, Activity::Checking);
    }

    #[test]
    fn nothing_to_do_is_no_job() {
        assert!(inner().next_job(false).is_none());
    }

    #[test]
    fn a_request_during_a_check_runs_after_it() {
        let mut inner = inner();
        assert!(matches!(inner.next_job(true), Some(Job::Check)));
        inner.check_requested = true;

        inner.finish_check(Activity::UpToDate, 1);

        assert!(matches!(inner.next_job(false), Some(Job::Check)));
        assert!(inner.state.manual);
    }

    #[test]
    fn a_request_during_a_timed_job_shows_at_once_and_through_the_check_it_queues() {
        for request in [
            Inner::request_check as fn(&mut Inner),
            |inner: &mut Inner| {
                inner.choose_stream(Stream::Development);
            },
        ] {
            let mut inner = inner();
            assert!(matches!(inner.next_job(true), Some(Job::Check)));
            assert!(inner.found_update("0.3.0", 1));
            assert!(!inner.state.manual);

            request(&mut inner);
            assert!(inner.state.manual);
            assert!(matches!(inner.state.activity, Activity::Downloading { .. }));

            inner.settle(Activity::Failed {
                reason: FailReason::Offline,
            });
            assert!(inner.state.manual);

            assert!(matches!(inner.next_job(false), Some(Job::Check)));
            assert!(inner.state.manual);

            inner.finish_check(Activity::UpToDate, 2);
            assert!(inner.state.manual);

            assert!(matches!(inner.next_job(true), Some(Job::Check)));
            assert!(!inner.state.manual);
        }
    }

    #[test]
    fn a_finished_check_says_how_it_ended_and_when() {
        let mut inner = inner();

        inner.finish_check(Activity::UpToDate, 1700);

        assert_eq!(inner.state.activity, Activity::UpToDate);
        assert_eq!(inner.state.checked_at, Some(1700));
    }

    #[test]
    fn nothing_a_later_check_ends_in_loses_a_ready_update() {
        for outcome in [
            Activity::UpToDate,
            Activity::NoRelease,
            Activity::Failed {
                reason: FailReason::Offline,
            },
            Activity::Failed {
                reason: FailReason::Unreachable,
            },
        ] {
            let mut inner = ready_inner();
            inner.check_requested = true;
            assert!(matches!(inner.next_job(false), Some(Job::Check)));

            inner.finish_check(outcome, 1700);

            assert_eq!(inner.state.activity, ready_activity());
            assert_eq!(inner.state.checked_at, Some(1700));
        }
    }

    #[test]
    fn a_failed_download_of_a_newer_update_keeps_the_ready_one() {
        let mut inner = ready_inner();
        assert!(inner.found_update("0.4.0", 1700));
        assert_eq!(
            inner.state.activity,
            Activity::Downloading {
                version: "0.4.0".to_owned(),
                percent: None
            }
        );

        inner.settle(Activity::Failed {
            reason: FailReason::Unreachable,
        });

        assert_eq!(inner.state.activity, ready_activity());
    }

    #[test]
    fn the_version_already_ready_is_not_downloaded_again() {
        let mut inner = ready_inner();

        assert!(!inner.found_update("0.3.0", 1700));

        assert_eq!(inner.state.activity, ready_activity());
        assert_eq!(inner.state.checked_at, Some(1700));
    }

    #[test]
    fn a_newer_download_replaces_the_ready_update() {
        let mut inner = ready_inner();

        inner.set_ready(Ready {
            version: "0.4.0".to_owned(),
            package: None,
        });

        assert_eq!(
            inner.state.activity,
            Activity::Ready {
                version: "0.4.0".to_owned()
            }
        );
    }

    #[test]
    fn restarting_needs_a_ready_update() {
        assert!(!inner().request_restart());
    }

    #[test]
    fn an_update_already_installed_restarts_right_away() {
        assert!(ready_inner().request_restart());
    }

    #[test]
    fn restarting_does_nothing_while_the_update_is_not_on_offer() {
        for activity in [
            Activity::Checking,
            Activity::Downloading {
                version: "0.4.0".to_owned(),
                percent: None,
            },
            Activity::Installing {
                version: "0.3.0".to_owned(),
            },
        ] {
            let mut inner = ready_inner();
            inner.state.activity = activity.clone();

            assert!(!inner.request_restart());

            assert_eq!(inner.state.activity, activity);
            assert!(inner.install_requested.is_none());
        }
    }

    #[test]
    fn a_failed_install_can_be_retried() {
        let mut inner = ready_inner();
        inner.state.activity = Activity::InstallFailed {
            version: "0.3.0".to_owned(),
        };

        assert!(inner.request_restart());
    }
}
