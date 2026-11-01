//! Signing in to GitHub with the OAuth device flow
//! (docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow): the app asks GitHub
//! for a code, the user types it on github.com in their browser, and the app polls GitHub until the user has
//! approved it. Nothing but the app and GitHub takes part — no client secret, no server of ours, no redirect back.
//!
//! The app drives it with two commands: `device_start` gets the code to show, `device_finish` waits for the token.
//! Only one attempt is live at a time: starting again supersedes the previous one, and a `device_finish` still
//! waiting on it answers `superseded`.

use std::future::Future;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize, Serializer};
use tauri::State;
use tokio::sync::{oneshot, Mutex};

/// The scopes githq asks GitHub for. The same list as `OAUTH_SCOPES` in `packages/github/src/oauth.ts`, which the
/// web app's sign-in asks for; keep the two in step.
const SCOPES: &str = "repo project read:org";

/// The client ID of githq's OAuth App, compiled in from the environment (`.env`, exported by the root `dev:desktop`
/// and `build:desktop` scripts). A build without it cannot sign in with the device flow.
const CLIENT_ID: Option<&str> = option_env!("GITHQ_GITHUB_CLIENT_ID");

/// Where GitHub's OAuth endpoints live.
const GITHUB_URL: &str = "https://github.com";

/// What GitHub's `grant_type` for polling the device flow is.
const DEVICE_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:device_code";

/// How much longer to wait between polls after each `slow_down`.
const SLOW_DOWN_STEP: Duration = Duration::from_secs(5);

/// Why a sign-in did not end with a token. Serialised for the app as the bare code (`"expired"`, …); the details
/// of `failed` only go to the log.
#[derive(Debug, PartialEq, Eq)]
pub enum SignInError {
    /// The code expired before the user approved it.
    Expired,
    /// The user declined on GitHub.
    Denied,
    /// GitHub could not be reached.
    Offline,
    /// A newer sign-in attempt replaced this one.
    Superseded,
    /// Anything else: a build without a client ID, no attempt to finish, or an answer from GitHub the flow does not
    /// expect (`device_flow_disabled`, `incorrect_client_credentials`, …), described for the log.
    Failed(String),
}

impl SignInError {
    /// The code the app receives.
    fn code(&self) -> &'static str {
        match self {
            Self::Expired => "expired",
            Self::Denied => "denied",
            Self::Offline => "offline",
            Self::Superseded => "superseded",
            Self::Failed(_) => "failed",
        }
    }
}

impl std::fmt::Display for SignInError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Failed(reason) => write!(formatter, "failed: {reason}"),
            other => formatter.write_str(other.code()),
        }
    }
}

impl std::error::Error for SignInError {}

impl Serialize for SignInError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.code())
    }
}

/// What `device_start` answers: what to show the user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCode {
    /// The code the user types on GitHub.
    pub user_code: String,
    /// The page they type it on.
    pub verification_uri: String,
    /// How many seconds the code is valid for, as GitHub said.
    pub expires_in: u64,
}

/// What `device_finish` answers on success.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Grant {
    pub token: String,
    /// The scopes GitHub granted, comma-separated as GitHub sends them.
    pub scope: String,
}

/// GitHub's answer to `POST /login/device/code`; on failure it carries `error` instead.
#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    expires_in: Option<u64>,
    interval: Option<u64>,
    error: Option<String>,
    error_description: Option<String>,
}

/// GitHub's answer to `POST /login/oauth/access_token`: the token, or an `error`.
#[derive(Debug, Default, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    /// With `slow_down`: the interval to keep from now on.
    interval: Option<u64>,
}

/// A started sign-in waiting for the user.
#[derive(Debug, Clone)]
struct Authorization {
    device_code: String,
    /// How long to wait between polls.
    interval: Duration,
    /// When the code stops being valid.
    expires_at: Instant,
}

/// What to do after a poll.
#[derive(Debug, PartialEq, Eq)]
enum Step {
    /// Done: the user approved.
    Granted(Grant),
    /// Not yet: poll again after this long.
    Wait(Duration),
    /// Done: no token.
    Stop(SignInError),
}

/// The next step after GitHub answered a poll with `response`, polling every `interval` so far.
fn next_step(response: TokenResponse, interval: Duration) -> Step {
    if let Some(token) = response.access_token {
        return Step::Granted(Grant {
            token,
            scope: response.scope.unwrap_or_default(),
        });
    }

    match response.error.as_deref() {
        Some("authorization_pending") => Step::Wait(interval),
        // GitHub sends the new interval along; RFC 8628 says to add 5 s. Whichever is longer.
        Some("slow_down") => {
            let increased = interval + SLOW_DOWN_STEP;
            Step::Wait(
                response
                    .interval
                    .map(Duration::from_secs)
                    .map_or(increased, |sent| sent.max(increased)),
            )
        }
        Some("expired_token") => Step::Stop(SignInError::Expired),
        Some("access_denied") => Step::Stop(SignInError::Denied),
        Some(code) => Step::Stop(SignInError::Failed(describe_github_error(
            code,
            response.error_description,
        ))),
        None => Step::Stop(SignInError::Failed(
            "GitHub answered with neither a token nor an error".to_owned(),
        )),
    }
}

fn describe_github_error(code: &str, description: Option<String>) -> String {
    match description {
        Some(description) => format!("GitHub answered `{code}`: {description}"),
        None => format!("GitHub answered `{code}`"),
    }
}

/// The time the poll loop waits in; tests replace it to make the waits instant.
pub trait Clock: Send + Sync {
    fn now(&self) -> Instant;
    fn sleep(&self, duration: Duration) -> impl Future<Output = ()> + Send;
}

/// The real time.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> Instant {
        Instant::now()
    }

    fn sleep(&self, duration: Duration) -> impl Future<Output = ()> + Send {
        tokio::time::sleep(duration)
    }
}

/// GitHub's device flow endpoints.
struct GitHub {
    http: reqwest::Client,
    base_url: String,
    client_id: Option<String>,
}

impl GitHub {
    fn client_id(&self) -> Result<&str, SignInError> {
        self.client_id.as_deref().ok_or_else(|| {
            SignInError::Failed(
                "this build has no GitHub client ID (GITHQ_GITHUB_CLIENT_ID was not set)"
                    .to_owned(),
            )
        })
    }

    /// `POST`s a form to one of GitHub's OAuth endpoints and reads its JSON answer.
    async fn post<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        form: &[(&str, &str)],
    ) -> Result<T, SignInError> {
        let response = self
            .http
            .post(format!("{}{path}", self.base_url))
            .header(reqwest::header::ACCEPT, "application/json")
            .form(form)
            .send()
            .await
            .map_err(|error| {
                eprintln!("Could not reach GitHub for {path}: {error}");
                SignInError::Offline
            })?;

        let status = response.status();
        response.json().await.map_err(|error| {
            if error.is_decode() {
                SignInError::Failed(format!(
                    "GitHub answered {path} with {status} and no usable JSON: {error}"
                ))
            } else {
                eprintln!("Could not read GitHub's answer to {path}: {error}");
                SignInError::Offline
            }
        })
    }

    /// Asks GitHub for a device code to show the user.
    async fn request_code(
        &self,
        clock: &impl Clock,
    ) -> Result<(DeviceCode, Authorization), SignInError> {
        let client_id = self.client_id()?;
        let response: DeviceCodeResponse = self
            .post(
                "/login/device/code",
                &[("client_id", client_id), ("scope", SCOPES)],
            )
            .await?;

        if let Some(code) = response.error {
            return Err(SignInError::Failed(describe_github_error(
                &code,
                response.error_description,
            )));
        }

        let (
            Some(device_code),
            Some(user_code),
            Some(verification_uri),
            Some(expires_in),
            Some(interval),
        ) = (
            response.device_code,
            response.user_code,
            response.verification_uri,
            response.expires_in,
            response.interval,
        )
        else {
            return Err(SignInError::Failed(
                "GitHub's device code answer is missing fields".to_owned(),
            ));
        };

        let authorization = Authorization {
            device_code,
            interval: Duration::from_secs(interval),
            expires_at: clock.now() + Duration::from_secs(expires_in),
        };
        Ok((
            DeviceCode {
                user_code,
                verification_uri,
                expires_in,
            },
            authorization,
        ))
    }

    /// Polls GitHub until the user approves or declines, or the code expires.
    async fn poll(
        &self,
        authorization: &Authorization,
        clock: &impl Clock,
    ) -> Result<Grant, SignInError> {
        let client_id = self.client_id()?;
        let form = [
            ("client_id", client_id),
            ("device_code", authorization.device_code.as_str()),
            ("grant_type", DEVICE_GRANT_TYPE),
        ];
        let mut interval = authorization.interval;

        loop {
            clock.sleep(interval).await;
            // GitHub would answer `expired_token` by now; no need to ask.
            if clock.now() >= authorization.expires_at {
                return Err(SignInError::Expired);
            }

            let response: TokenResponse = self.post("/login/oauth/access_token", &form).await?;
            match next_step(response, interval) {
                Step::Granted(grant) => return Ok(grant),
                Step::Wait(next) => interval = next,
                Step::Stop(error) => return Err(error),
            }
        }
    }
}

/// The live sign-in attempt, if any.
#[derive(Default)]
struct Attempt {
    /// Counts the starts, so a start that finishes after a newer one does not install itself.
    generation: u64,
    /// The started sign-in, until a `device_finish` takes it, and the signal it is superseded by: the sender
    /// below being dropped.
    waiting: Option<(Authorization, oneshot::Receiver<()>)>,
    /// Dropped to supersede the attempt.
    supersede: Option<oneshot::Sender<()>>,
}

/// The device flow's state, managed by Tauri.
pub struct DeviceFlow<C: Clock = SystemClock> {
    github: GitHub,
    clock: C,
    attempt: Mutex<Attempt>,
}

impl DeviceFlow {
    /// The device flow against github.com with the client ID this build was given.
    pub fn github() -> Self {
        Self::new(GITHUB_URL, CLIENT_ID, SystemClock)
    }
}

impl<C: Clock> DeviceFlow<C> {
    fn new(base_url: &str, client_id: Option<&str>, clock: C) -> Self {
        Self {
            github: GitHub {
                http: reqwest::Client::new(),
                base_url: base_url.to_owned(),
                client_id: client_id.map(str::to_owned),
            },
            clock,
            attempt: Mutex::new(Attempt::default()),
        }
    }

    /// Starts a sign-in, superseding any live one.
    pub async fn start(&self) -> Result<DeviceCode, SignInError> {
        let generation = {
            let mut attempt = self.attempt.lock().await;
            attempt.generation += 1;
            attempt.waiting = None;
            attempt.supersede = None;
            attempt.generation
        };

        let (code, authorization) = self.github.request_code(&self.clock).await?;

        let mut attempt = self.attempt.lock().await;
        if attempt.generation != generation {
            return Err(SignInError::Superseded);
        }
        let (supersede, superseded) = oneshot::channel();
        attempt.waiting = Some((authorization, superseded));
        attempt.supersede = Some(supersede);
        Ok(code)
    }

    /// Waits for the user to approve the started sign-in.
    pub async fn finish(&self) -> Result<Grant, SignInError> {
        let Some((authorization, superseded)) = self.attempt.lock().await.waiting.take() else {
            return Err(SignInError::Failed(
                "there is no started sign-in to finish".to_owned(),
            ));
        };

        tokio::select! {
            result = self.github.poll(&authorization, &self.clock) => result,
            _ = superseded => Err(SignInError::Superseded),
        }
    }
}

/// Starts signing in with the device flow: the code to show the user. Supersedes any sign-in already started.
#[tauri::command]
pub async fn device_start(flow: State<'_, DeviceFlow>) -> Result<DeviceCode, SignInError> {
    flow.start().await.inspect_err(log_failure)
}

/// Waits for the user to approve the started sign-in: the token and the scopes it was granted.
#[tauri::command]
pub async fn device_finish(flow: State<'_, DeviceFlow>) -> Result<Grant, SignInError> {
    flow.finish().await.inspect_err(log_failure)
}

fn log_failure(error: &SignInError) {
    if let SignInError::Failed(_) = error {
        eprintln!("Signing in with GitHub {error}");
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex as StdMutex, PoisonError};

    use wiremock::matchers::{body_string_contains, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use super::*;

    /// A clock whose sleeps return at once, moving its time on and noting how long each was.
    #[derive(Clone)]
    struct InstantClock {
        start: Instant,
        state: Arc<StdMutex<(Duration, Vec<Duration>)>>,
    }

    impl InstantClock {
        fn new() -> Self {
            Self {
                start: Instant::now(),
                state: Arc::default(),
            }
        }

        fn sleeps(&self) -> Vec<Duration> {
            self.state
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .1
                .clone()
        }
    }

    impl Clock for InstantClock {
        fn now(&self) -> Instant {
            self.start + self.state.lock().unwrap_or_else(PoisonError::into_inner).0
        }

        fn sleep(&self, duration: Duration) -> impl Future<Output = ()> + Send {
            let mut state = self.state.lock().unwrap_or_else(PoisonError::into_inner);
            state.0 += duration;
            state.1.push(duration);
            std::future::ready(())
        }
    }

    fn secs(seconds: u64) -> Duration {
        Duration::from_secs(seconds)
    }

    fn device_code_body(expires_in: u64, interval: u64) -> serde_json::Value {
        serde_json::json!({
            "device_code": "device-123",
            "user_code": "ABCD-1234",
            "verification_uri": "https://github.com/login/device",
            "expires_in": expires_in,
            "interval": interval,
        })
    }

    async fn github_with_code(expires_in: u64, interval: u64) -> MockServer {
        // Not from wiremock's pool: dropping this one stops it, which is how a test takes GitHub offline.
        let server = MockServer::builder().start().await;
        Mock::given(method("POST"))
            .and(path("/login/device/code"))
            .and(header("accept", "application/json"))
            .and(body_string_contains("client_id=client-1"))
            .and(body_string_contains("scope=repo+project+read%3Aorg"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(device_code_body(expires_in, interval)),
            )
            .mount(&server)
            .await;
        server
    }

    /// Makes the token endpoint answer `bodies` in turn, the last one for good.
    async fn answer_polls(server: &MockServer, bodies: &[serde_json::Value]) {
        let (last, first) = bodies.split_last().expect("at least one answer");
        for body in first {
            Mock::given(method("POST"))
                .and(path("/login/oauth/access_token"))
                .and(body_string_contains("device_code=device-123"))
                .and(body_string_contains(
                    "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
                ))
                .respond_with(ResponseTemplate::new(200).set_body_json(body))
                .up_to_n_times(1)
                .with_priority(1)
                .mount(server)
                .await;
        }
        Mock::given(method("POST"))
            .and(path("/login/oauth/access_token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(last))
            .with_priority(2)
            .mount(server)
            .await;
    }

    fn flow(server: &MockServer, clock: &InstantClock) -> DeviceFlow<InstantClock> {
        DeviceFlow::new(&server.uri(), Some("client-1"), clock.clone())
    }

    fn pending() -> serde_json::Value {
        serde_json::json!({ "error": "authorization_pending" })
    }

    fn granted() -> serde_json::Value {
        serde_json::json!({ "access_token": "gho_token", "token_type": "bearer", "scope": "project,read:org,repo" })
    }

    #[tokio::test]
    async fn returns_the_token_and_its_scopes_after_waiting_the_interval() {
        let server = github_with_code(900, 5).await;
        answer_polls(&server, &[pending(), pending(), granted()]).await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);

        let code = flow.start().await;
        assert_eq!(
            code,
            Ok(DeviceCode {
                user_code: "ABCD-1234".to_owned(),
                verification_uri: "https://github.com/login/device".to_owned(),
                expires_in: 900,
            })
        );
        assert_eq!(
            flow.finish().await,
            Ok(Grant {
                token: "gho_token".to_owned(),
                scope: "project,read:org,repo".to_owned()
            })
        );
        assert_eq!(clock.sleeps(), vec![secs(5), secs(5), secs(5)]);
    }

    #[tokio::test]
    async fn waits_5_s_longer_after_each_slow_down() {
        let server = github_with_code(900, 5).await;
        let slow_down = serde_json::json!({ "error": "slow_down", "interval": 10 });
        let slow_down_without_interval = serde_json::json!({ "error": "slow_down" });
        answer_polls(
            &server,
            &[slow_down, pending(), slow_down_without_interval, granted()],
        )
        .await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);

        assert!(flow.start().await.is_ok());
        assert!(flow.finish().await.is_ok());
        assert_eq!(clock.sleeps(), vec![secs(5), secs(10), secs(10), secs(15)]);
    }

    #[tokio::test]
    async fn stops_when_github_says_the_code_expired() {
        let server = github_with_code(900, 5).await;
        answer_polls(
            &server,
            &[pending(), serde_json::json!({ "error": "expired_token" })],
        )
        .await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);

        assert!(flow.start().await.is_ok());
        assert_eq!(flow.finish().await, Err(SignInError::Expired));
    }

    #[tokio::test]
    async fn stops_when_the_user_declines() {
        let server = github_with_code(900, 5).await;
        answer_polls(&server, &[serde_json::json!({ "error": "access_denied" })]).await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);

        assert!(flow.start().await.is_ok());
        assert_eq!(flow.finish().await, Err(SignInError::Denied));
    }

    #[tokio::test]
    async fn stops_at_the_expiry_without_github_saying_so() {
        let server = github_with_code(20, 5).await;
        answer_polls(&server, &[pending()]).await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);

        assert!(flow.start().await.is_ok());
        assert_eq!(flow.finish().await, Err(SignInError::Expired));
        // Polled at 5, 10 and 15 s; at 20 s the code is no longer valid.
        let polls = server.received_requests().await.unwrap_or_default();
        assert_eq!(
            polls
                .iter()
                .filter(|request| request.url.path() == "/login/oauth/access_token")
                .count(),
            3
        );
    }

    #[tokio::test]
    async fn is_offline_when_github_cannot_be_reached() {
        let server = github_with_code(900, 5).await;
        let clock = InstantClock::new();
        let flow = flow(&server, &clock);
        assert!(flow.start().await.is_ok());

        // GitHub goes away while the user is approving.
        drop(server);
        assert_eq!(flow.finish().await, Err(SignInError::Offline));

        // And is not there when starting.
        assert_eq!(flow.start().await, Err(SignInError::Offline));
    }

    #[tokio::test]
    async fn a_new_start_supersedes_the_waiting_finish() {
        let server = github_with_code(900, 5).await;
        answer_polls(&server, &[granted()]).await;
        // Real time: the first finish is still in its first 5 s wait when the second start comes.
        let flow = DeviceFlow::new(&server.uri(), Some("client-1"), SystemClock);

        assert!(flow.start().await.is_ok());
        let first = flow.finish();
        tokio::pin!(first);
        // Lets the first finish take its attempt and begin waiting.
        tokio::select! {
            biased;
            result = &mut first => panic!("finished before being superseded: {result:?}"),
            () = std::future::ready(()) => {}
        }

        assert!(flow.start().await.is_ok());
        assert_eq!(first.await, Err(SignInError::Superseded));
    }

    #[tokio::test]
    async fn fails_without_a_client_id() {
        let server = github_with_code(900, 5).await;
        let flow = DeviceFlow::new(&server.uri(), None, InstantClock::new());

        assert!(matches!(flow.start().await, Err(SignInError::Failed(_))));
        assert!(server
            .received_requests()
            .await
            .unwrap_or_default()
            .is_empty());
    }

    #[test]
    fn serialises_errors_as_bare_codes() {
        let codes = [
            SignInError::Expired,
            SignInError::Denied,
            SignInError::Offline,
            SignInError::Superseded,
            SignInError::Failed("why".to_owned()),
        ]
        .map(|error| serde_json::to_string(&error).unwrap_or_default());

        assert_eq!(
            codes,
            [
                "\"expired\"",
                "\"denied\"",
                "\"offline\"",
                "\"superseded\"",
                "\"failed\""
            ]
        );
    }
}
