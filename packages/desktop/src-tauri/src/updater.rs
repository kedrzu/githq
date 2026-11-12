//! Keeping the app up to date from GitHub Releases, on the stream the user follows: Stable, or Development with the
//! builds from `main`. One task checks at launch and on a timer, serially, and downloads what it finds in the background,
//! its signature always verified by the plugin. The update is then offered to the user, who restarts when they choose.
//! Nothing restarts on its own.
//!
//! The timed checks go on while an update is on offer, so that several builds landing one after another cost one restart,
//! into the newest. Such a check is quiet: the offer stays as it is until a newer update is ready and takes its place.
//! Restart takes whatever is ready when it runs; asked for while a job is under way, it waits for that job.
//!
//! On macOS the download is installed at once: the plugin replaces the app on disk and the running one goes on, so the
//! new version starts at the next launch, whether the user restarts now or quits later. If that fails, because the app is
//! somewhere only an administrator may replace it and they refused the prompt, say, the package is kept and the update is
//! ready all the same: timed checks stop, so nothing asks again unprompted, and Restart installs it, where a failure shows
//! as `InstallFailed`. A failed install is not a failed check. On Linux and Windows it installs only at the user's restart:
//! Linux may ask for an administrator password, which the user can refuse and retry, and the Windows installer quits the
//! app.
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
const STABLE_INTERVAL: Duration = Duration::from_secs(60 * 60);

/// How long between two timed checks on Development, which delivers what was just merged.
const DEVELOPMENT_INTERVAL: Duration = Duration::from_secs(5 * 60);

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

/// The downloaded update that `update_restart` installs. Its install is the plugin's, which verifies the signature again.
struct Package {
    install: Box<dyn Fn() -> tauri_plugin_updater::Result<()> + Send + Sync>,
}

/// A downloaded and verified update.
struct Ready {
    version: String,
    /// What is still to be installed; `None` once it is, which on macOS it usually is by the time it's ready.
    package: Option<Arc<Package>>,
}

/// One piece of work for the task that checks.
enum Job {
    Check,
    Install {
        version: String,
        package: Arc<Package>,
    },
    /// Restart into an update installed already.
    Restart,
}

/// What happens to the state, free of the app so that it can be tested.
struct Inner {
    /// The running version, which [`UpdateState`] carries only as text.
    running: Version,
    state: UpdateState,
    ready: Option<Ready>,
    /// The user asked for a check that hasn't started.
    check_requested: bool,
    /// The user asked to restart, and the job under way has to end first; it then runs into whatever is ready.
    restart_requested: bool,
    /// The check under way is a timed one behind an update on offer: it leaves the offer as it is, unless it readies a
    /// newer update.
    quiet: bool,
    /// The app on disk is being replaced (macOS), so restarting has to wait.
    replacing: bool,
    /// Downloads are installed at once (macOS): a package still waiting means installing failed, likely at a refused
    /// administrator prompt.
    installs_on_download: bool,
}

impl Inner {
    fn new(version: &Version, commit: Option<&str>, stream: Stream, can_choose: bool) -> Self {
        Self {
            running: version.clone(),
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
            restart_requested: false,
            quiet: false,
            replacing: false,
            installs_on_download: cfg!(target_os = "macos"),
        }
    }

    /// The user asked for a check. It runs after the job under way, and that job shows as asked for from here on too, so
    /// whoever pressed the button sees it through; a quiet one shows as checking, unless a restart waits for it.
    fn request_check(&mut self) {
        self.check_requested = true;
        self.state.manual = true;
        if self.quiet && !self.restart_requested {
            self.quiet = false;
            self.state.activity = Activity::Checking;
        }
    }

    /// The next piece of work, if there is any; `due` says the timer ran out. A waiting restart goes first. A check in
    /// progress shows from here on, in one step with taking it, so that a restart can't slip in between; a quiet one
    /// leaves the offer on show, and Restart then waits for it.
    fn next_job(&mut self, due: bool) -> Option<Job> {
        if std::mem::take(&mut self.restart_requested) {
            if let Some(ready) = &self.ready {
                let version = ready.version.clone();
                self.state.activity = Activity::Installing {
                    version: version.clone(),
                };
                return Some(match &ready.package {
                    Some(package) => Job::Install {
                        version,
                        package: Arc::clone(package),
                    },
                    None => Job::Restart,
                });
            }
        }
        if !self.check_requested && !due {
            return None;
        }

        self.state.manual = self.check_requested;
        self.quiet = !self.check_requested && self.ready.is_some();
        self.check_requested = false;
        if !self.quiet {
            self.state.activity = Activity::Checking;
        }
        Some(Job::Check)
    }

    /// How a check or a download ended, unless an update is ready: that one stays on offer, unless the stream the user is
    /// on now wouldn't take it. A restart waiting for the job goes on showing; a failed install of the update still on
    /// offer too, since nothing has tried it again.
    fn settle(&mut self, activity: Activity) {
        self.drop_unwanted_update();
        self.quiet = false;
        self.replacing = false;
        let Some(ready) = &self.ready else {
            self.restart_requested = false;
            self.state.activity = activity;
            return;
        };

        let version = ready.version.clone();
        self.state.activity = if self.restart_requested {
            Activity::Installing { version }
        } else if matches!(&self.state.activity, Activity::InstallFailed { version: failed } if *failed == version)
        {
            Activity::InstallFailed { version }
        } else {
            Activity::Ready { version }
        };
    }

    /// Drops a waiting update the stream wouldn't accept, one from the stream the user left. Only while it can still be
    /// dropped: one already installed on macOS is what runs next, whatever the stream (D5).
    fn drop_unwanted_update(&mut self) {
        let unwanted = self.ready.as_ref().is_some_and(|ready| {
            ready.package.is_some()
                && Version::parse(&ready.version)
                    .is_ok_and(|waiting| !is_update(self.state.stream, &self.running, &waiting))
        });
        if unwanted {
            self.ready = None;
        }
    }

    /// How long until the next timed check. They go on behind an update on offer, since a newer one may follow; only
    /// one that failed to install at download stops them, so that nothing asks for an administrator again unprompted.
    fn timed_check_interval(&self) -> Option<Duration> {
        let install_failed = self.installs_on_download
            && self
                .ready
                .as_ref()
                .is_some_and(|ready| ready.package.is_some());

        (!install_failed).then(|| check_interval(self.state.stream))
    }

    /// A check found nothing to download, or failed.
    fn finish_check(&mut self, activity: Activity, at: u64) {
        self.state.checked_at = Some(at);
        self.settle(activity);
    }

    /// A check found this version. Answers whether to download it: only if it's an update over the one already ready,
    /// so that an older build never takes a newer one's place.
    fn found_update(&mut self, version: &str, at: u64) -> bool {
        let stream = self.state.stream;
        let wanted = self.ready.as_ref().is_none_or(|ready| {
            ready.version != version
                && match (Version::parse(&ready.version), Version::parse(version)) {
                    (Ok(ready), Ok(found)) => is_update(stream, &ready, &found),
                    _ => true,
                }
        });
        if !wanted {
            self.finish_check(Activity::UpToDate, at);
            return false;
        }

        self.state.checked_at = Some(at);
        self.show_download(version, None);
        true
    }

    /// How far a download got, unless the check is quiet.
    fn show_download(&mut self, version: &str, percent: Option<u8>) {
        if !self.quiet {
            self.state.activity = Activity::Downloading {
                version: version.to_owned(),
                percent,
            };
        }
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
    /// when the update is installed already and nothing is replacing it on disk; otherwise the restart is queued, to run
    /// into whatever is ready once the job under way ends. Nothing happens unless the update is on offer: not while
    /// installing, so a second call changes nothing, and not while a check the user sees may be replacing it.
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
        if ready.package.is_none() && !self.replacing {
            return true;
        }

        self.restart_requested = true;
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
/// any stable release, even an older one, so leaving Development gets away from its bugs at once (D5). Stable never takes a
/// prerelease: its manifest offers none, but a build still waiting from Development is judged here too. The rule holds no
/// state, so it survives being offline or a failed download.
fn is_update(stream: Stream, current: &Version, release: &Version) -> bool {
    if stream == Stream::Stable && !release.pre.is_empty() {
        return false;
    }
    if stream == Stream::Stable && !current.pre.is_empty() {
        return true;
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
        Error::Reqwest(error) if error.is_connect() || error.is_timeout() => Activity::Failed {
            reason: FailReason::Offline,
        },
        _ => Activity::Failed {
            reason: FailReason::Unreachable,
        },
    }
}

/// What a manifest's status says when the plugin found no release: only a 404 means the stream has none. Anything else is
/// GitHub not answering as it should, a rate limit or an outage, which the next check retries.
fn status_activity(status: reqwest::StatusCode) -> Activity {
    if status == reqwest::StatusCode::NOT_FOUND {
        Activity::NoRelease
    } else {
        Activity::Failed {
            reason: FailReason::Unreachable,
        }
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
                Some(Job::Restart) => app.request_restart(),
                None => {}
            }
            due = wait(updates).await;
        }
    });
}

/// Waits for a request or the next timed check, and answers whether a timed check is due.
async fn wait(updates: &Updates) -> bool {
    let interval = updates.lock().timed_check_interval();

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
        Err(activity) => {
            updates.change(app, |inner| inner.finish_check(activity, now_ms()));
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

/// Asks for the stream's manifest: the update it offers if any, or what the window is told about why not.
async fn find_update(app: &AppHandle, stream: Stream) -> Result<Option<Update>, Activity> {
    let manifest =
        manifest_url(stream, since_epoch().as_secs()).map_err(|error| check_failed(&error))?;

    match ask_plugin(app, stream, manifest.clone()).await {
        Err(Error::ReleaseNotFound) => Err(manifest_activity(manifest).await),
        Err(error) => Err(check_failed(&error)),
        Ok(update) => Ok(update),
    }
}

fn check_failed(error: &Error) -> Activity {
    eprintln!("Could not check for updates, retrying later: {error}");
    failure_activity(error)
}

async fn ask_plugin(
    app: &AppHandle,
    stream: Stream,
    manifest: Url,
) -> tauri_plugin_updater::Result<Option<Update>> {
    app.updater_builder()
        .endpoints(vec![manifest])?
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

/// The plugin says `ReleaseNotFound` for any status but a success, and drops the status: asks the manifest once more for it.
async fn manifest_activity(manifest: Url) -> Activity {
    match manifest_status(manifest).await {
        Ok(status) => {
            let activity = status_activity(status);
            if activity != Activity::NoRelease {
                eprintln!(
                    "Could not check for updates, retrying later: the manifest answered {status}"
                );
            }
            activity
        }
        Err(error) => check_failed(&Error::Reqwest(error)),
    }
}

async fn manifest_status(manifest: Url) -> reqwest::Result<reqwest::StatusCode> {
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .build()?;

    Ok(client.get(manifest).send().await?.status())
}

/// Downloads the update, which verifies it, and readies it; on macOS that includes trying to install it.
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
                    updates.change(app, |inner| inner.show_download(&version, percent));
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

    let package = Arc::new(Package {
        install: Box::new(move || update.install(&bytes)),
    });
    let package = if cfg!(target_os = "macos") {
        updates.lock().replacing = true;
        install_now(package).await
    } else {
        Some(package)
    };

    updates.change(app, |inner| inner.set_ready(Ready { version, package }));
    Ok(())
}

/// Installs right after the download, which replaces the app on disk while the running one goes on until the user restarts
/// or quits. Answers what is still to be installed: the package when that failed, for the user's restart to try again.
async fn install_now(package: Arc<Package>) -> Option<Arc<Package>> {
    match run_install(Arc::clone(&package)).await {
        Ok(()) => None,
        Err(error) => {
            eprintln!("Could not install the update, leaving it for the restart: {error}");
            Some(package)
        }
    }
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
    tauri::async_runtime::spawn_blocking(move || (package.install)()).await?
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
    use wiremock::matchers::{method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

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

    fn package() -> Option<Arc<Package>> {
        Some(Arc::new(Package {
            install: Box::new(|| Ok(())),
        }))
    }

    /// A Development build on Development with `waiting` downloaded, `package` being what's left of installing it.
    fn waiting_inner(waiting: &str, package: Option<Arc<Package>>) -> Inner {
        let mut inner = Inner::new(&version("0.3.0-dev.214"), None, Stream::Development, true);
        inner.set_ready(Ready {
            version: waiting.to_owned(),
            package,
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
    fn stable_never_takes_a_development_build_even_a_greater_one() {
        assert!(!takes(Stream::Stable, "0.2.0", "0.3.0-dev.215"));
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
    fn only_a_404_from_the_manifest_means_no_release() {
        assert_eq!(
            status_activity(reqwest::StatusCode::NOT_FOUND),
            Activity::NoRelease
        );

        for status in [
            reqwest::StatusCode::OK,
            reqwest::StatusCode::FORBIDDEN,
            reqwest::StatusCode::TOO_MANY_REQUESTS,
            reqwest::StatusCode::BAD_GATEWAY,
        ] {
            assert_eq!(
                status_activity(status),
                Activity::Failed {
                    reason: FailReason::Unreachable
                }
            );
        }
    }

    #[tokio::test]
    async fn the_manifest_is_asked_once_for_its_status() {
        for (status, expected) in [
            (404, Activity::NoRelease),
            (
                503,
                Activity::Failed {
                    reason: FailReason::Unreachable,
                },
            ),
        ] {
            let server = MockServer::start().await;
            Mock::given(method("GET"))
                .and(path("/latest.json"))
                .and(query_param("t", "1700"))
                .respond_with(ResponseTemplate::new(status))
                .expect(1)
                .mount(&server)
                .await;
            let manifest = format!("{}/latest.json?t=1700", server.uri());

            assert_eq!(
                manifest_activity(Url::parse(&manifest).unwrap_or_else(|error| panic!("{error}")))
                    .await,
                expected
            );
        }
    }

    #[tokio::test]
    async fn no_answer_from_the_manifest_is_classified_as_any_failure() {
        // Port 1 on this machine: nothing listens there.
        let manifest = Url::parse("http://127.0.0.1:1/latest.json");

        assert_eq!(
            manifest_activity(manifest.unwrap_or_else(|error| panic!("{error}"))).await,
            Activity::Failed {
                reason: FailReason::Offline
            }
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
    fn switching_back_drops_a_waiting_update_the_stream_would_not_take() {
        for outcome in [
            Activity::UpToDate,
            Activity::Failed {
                reason: FailReason::Offline,
            },
        ] {
            let mut inner = Inner::new(&version("0.3.0-dev.214"), None, Stream::Stable, true);
            inner.set_ready(Ready {
                version: "0.2.0".to_owned(),
                package: package(),
            });
            assert!(inner.ready.is_some());

            assert!(inner.choose_stream(Stream::Development));
            assert!(matches!(inner.next_job(false), Some(Job::Check)));

            inner.finish_check(outcome.clone(), 1700);

            assert!(inner.ready.is_none());
            assert_eq!(inner.state.activity, outcome);
            assert!(inner.timed_check_interval().is_some());
        }
    }

    #[test]
    fn leaving_development_drops_a_waiting_build_even_if_the_download_of_stable_fails() {
        let mut inner = waiting_inner("0.3.0-dev.216", package());
        assert!(inner.choose_stream(Stream::Stable));
        assert!(matches!(inner.next_job(false), Some(Job::Check)));
        assert!(inner.found_update("0.2.0", 1700));

        let failed = Activity::Failed {
            reason: FailReason::Unreachable,
        };
        inner.settle(failed.clone());

        assert!(inner.ready.is_none());
        assert_eq!(inner.state.activity, failed);
    }

    #[test]
    fn a_waiting_update_the_stream_still_takes_stays_on_offer() {
        let mut inner = waiting_inner("0.3.0-dev.216", package());
        assert!(matches!(inner.next_job(true), Some(Job::Check)));

        inner.finish_check(Activity::UpToDate, 1700);

        assert_eq!(
            inner.state.activity,
            Activity::Ready {
                version: "0.3.0-dev.216".to_owned()
            }
        );
    }

    #[test]
    fn an_update_already_installed_stays_whatever_the_stream() {
        let mut inner = waiting_inner("0.3.0-dev.216", None);
        assert!(inner.choose_stream(Stream::Stable));
        assert!(matches!(inner.next_job(false), Some(Job::Check)));

        inner.finish_check(Activity::UpToDate, 1700);

        assert_eq!(
            inner.state.activity,
            Activity::Ready {
                version: "0.3.0-dev.216".to_owned()
            }
        );
    }

    #[tokio::test]
    async fn a_failed_install_after_the_download_keeps_the_package_for_the_restart() {
        let refused = Arc::new(Package {
            install: Box::new(|| Err(Error::Network("refused".to_owned()))),
        });
        let kept = install_now(refused).await;
        assert!(kept.is_some());

        let mut inner = waiting_inner("0.3.0-dev.216", kept);
        inner.installs_on_download = true;
        assert_eq!(
            inner.state.activity,
            Activity::Ready {
                version: "0.3.0-dev.216".to_owned()
            }
        );
        assert_eq!(inner.timed_check_interval(), None);

        assert!(!inner.request_restart());
        assert_eq!(
            inner.state.activity,
            Activity::Installing {
                version: "0.3.0-dev.216".to_owned()
            }
        );
        assert!(matches!(inner.next_job(false), Some(Job::Install { .. })));
    }

    #[tokio::test]
    async fn an_install_that_worked_leaves_nothing_to_install() {
        let package = Arc::new(Package {
            install: Box::new(|| Ok(())),
        });

        assert!(install_now(package).await.is_none());
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
            assert!(!inner.restart_requested);
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

    /// A timed check behind the ready 0.3.0, taken.
    fn quiet_inner(package: Option<Arc<Package>>) -> Inner {
        let mut inner = inner();
        inner.set_ready(Ready {
            version: "0.3.0".to_owned(),
            package,
        });
        assert!(matches!(inner.next_job(true), Some(Job::Check)));
        assert!(inner.quiet);
        inner
    }

    fn installing(version: &str) -> Activity {
        Activity::Installing {
            version: version.to_owned(),
        }
    }

    #[test]
    fn timed_checks_go_on_behind_an_update_on_offer() {
        for installs_on_download in [false, true] {
            let mut installed = ready_inner();
            installed.installs_on_download = installs_on_download;
            assert_eq!(
                installed.timed_check_interval(),
                Some(check_interval(Stream::Stable))
            );
        }

        let mut waiting = waiting_inner("0.3.0-dev.216", package());
        waiting.installs_on_download = false;
        assert_eq!(
            waiting.timed_check_interval(),
            Some(check_interval(Stream::Development))
        );
    }

    #[test]
    fn a_quiet_check_leaves_the_offer_as_it_is_whatever_it_ends_in() {
        for outcome in [
            Activity::UpToDate,
            Activity::NoRelease,
            Activity::Failed {
                reason: FailReason::Offline,
            },
        ] {
            let mut inner = quiet_inner(None);
            assert_eq!(inner.state.activity, ready_activity());

            assert!(inner.found_update("0.4.0", 1700));
            inner.show_download("0.4.0", Some(50));
            assert_eq!(inner.state.activity, ready_activity());

            inner.settle(outcome);
            assert_eq!(inner.state.activity, ready_activity());
            assert!(!inner.quiet);
        }
    }

    #[test]
    fn a_quiet_check_offers_the_newer_update_once_it_is_ready() {
        let mut inner = quiet_inner(None);
        assert!(inner.found_update("0.4.0", 1700));

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
    fn a_quiet_check_keeps_a_failed_install_on_offer() {
        let mut inner = inner();
        inner.set_ready(Ready {
            version: "0.3.0".to_owned(),
            package: package(),
        });
        let failed = Activity::InstallFailed {
            version: "0.3.0".to_owned(),
        };
        inner.state.activity = failed.clone();
        assert!(matches!(inner.next_job(true), Some(Job::Check)));
        assert_eq!(inner.state.activity, failed);

        inner.finish_check(Activity::UpToDate, 1700);

        assert_eq!(inner.state.activity, failed);
    }

    #[test]
    fn an_older_build_never_takes_the_place_of_the_ready_one() {
        let mut inner = quiet_inner(None);

        assert!(!inner.found_update("0.2.5", 1700));

        assert_eq!(inner.state.activity, ready_activity());
        assert!(inner.found_update("0.3.1", 1800));
    }

    #[test]
    fn a_manual_check_during_a_quiet_one_shows_at_once() {
        let mut inner = quiet_inner(None);

        inner.request_check();

        assert!(!inner.quiet);
        assert!(inner.state.manual);
        assert_eq!(inner.state.activity, Activity::Checking);
    }

    #[test]
    fn restarting_during_a_quiet_download_of_an_installed_update_is_immediate() {
        let mut inner = quiet_inner(None);
        assert!(inner.found_update("0.4.0", 1700));

        assert!(inner.request_restart());
    }

    #[test]
    fn restarting_while_the_app_on_disk_is_replaced_waits_and_takes_the_newer_update() {
        let mut inner = quiet_inner(None);
        assert!(inner.found_update("0.4.0", 1700));
        inner.replacing = true;

        assert!(!inner.request_restart());
        assert_eq!(inner.state.activity, installing("0.3.0"));
        // A second press changes nothing.
        assert!(!inner.request_restart());

        inner.set_ready(Ready {
            version: "0.4.0".to_owned(),
            package: None,
        });
        assert_eq!(inner.state.activity, installing("0.4.0"));

        assert!(matches!(inner.next_job(true), Some(Job::Restart)));
        assert_eq!(inner.state.activity, installing("0.4.0"));
    }

    #[test]
    fn restarting_during_a_quiet_job_installs_the_newest_package_once_it_ends() {
        let mut inner = quiet_inner(package());
        assert!(inner.found_update("0.4.0", 1700));

        assert!(!inner.request_restart());
        // A check asked for meanwhile doesn't hide the waiting restart.
        inner.request_check();
        assert_eq!(inner.state.activity, installing("0.3.0"));

        inner.set_ready(Ready {
            version: "0.4.0".to_owned(),
            package: package(),
        });
        assert_eq!(inner.state.activity, installing("0.4.0"));

        match inner.next_job(false) {
            Some(Job::Install { version, .. }) => assert_eq!(version, "0.4.0"),
            _ => panic!("expected the install of 0.4.0"),
        }
    }

    #[test]
    fn a_waiting_restart_ends_when_its_update_is_dropped() {
        let mut inner = Inner::new(&version("0.3.0-dev.214"), None, Stream::Stable, true);
        inner.set_ready(Ready {
            version: "0.2.0".to_owned(),
            package: package(),
        });
        assert!(!inner.request_restart());
        inner.state.stream = Stream::Development;

        inner.finish_check(Activity::UpToDate, 1700);

        assert!(inner.ready.is_none());
        assert!(!inner.restart_requested);
        assert_eq!(inner.state.activity, Activity::UpToDate);
        assert!(inner.next_job(false).is_none());
    }
}
