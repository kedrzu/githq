//! Reading a job's log for the app. GitHub answers `GET /repos/{o}/{r}/actions/jobs/{id}/logs` with a redirect to a blob
//! on Azure Storage, which the window's content security policy does not let it reach, on purpose: opening the policy
//! would open every Azure Storage account to the webview, which holds the token (actions D3 in `docs/design/actions`).
//!
//! This is not a general fetch: the command can ask for that one address only, and follows one redirect, to a blob
//! only. A renamed or moved repository's address takes one hop more, within the API, to the same job's log under the
//! repository's id. The token goes to GitHub and never to the blob. The log stays in memory, on its way to the window:
//! it is neither logged nor written anywhere, and the blob's signed address is not logged either.

use std::collections::BTreeMap;
use std::time::Duration;

use reqwest::header::{HeaderMap, ACCEPT, LOCATION};
use reqwest::{Client, Response, StatusCode, Url};
use serde::Serialize;
use tauri::State;

/// Where GitHub's REST API lives.
const API_URL: &str = "https://api.github.com";

/// What a blob's host ends with: Azure Storage's blob service, where GitHub keeps the logs.
const BLOB_HOST_SUFFIX: &str = ".blob.core.windows.net";

/// The longest answer read: past it the read fails rather than exhaust the memory.
const MAX_ANSWER_BYTES: usize = 256 * 1024 * 1024;

/// GitHub refuses a request without a user agent; the webview sends its own.
const USER_AGENT: &str = "githq-desktop";

/// What the web app asks GitHub's REST API for (`createGitHubRestRequester`).
const GITHUB_JSON: &str = "application/vnd.github+json";

/// How long to wait for a connection, and for the next bytes of an answer, before calling GitHub out of reach.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
const READ_TIMEOUT: Duration = Duration::from_secs(60);

/// The headers of GitHub's answer the app reads: the allowance and when to try again (`sendGitHubRequest`).
const ALLOWANCE_HEADERS: [&str; 5] = [
    "x-ratelimit-resource",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "retry-after",
];

/// The longest a GitHub account's and a repository's name can be.
const MAX_OWNER_LENGTH: usize = 39;
const MAX_NAME_LENGTH: usize = 100;

/// Why no answer can be given. Serialised for the app as the bare code.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum JobLogError {
    /// The owner or name is not one GitHub could have: nothing was asked.
    Invalid,
    /// GitHub redirected somewhere other than to a blob over https or a moved repository's same log, or redirected
    /// again after that hop, or the blob redirected in turn.
    Refused,
    /// The answer is longer than [`MAX_ANSWER_BYTES`].
    TooLarge,
    /// GitHub or the blob could not be reached, or stopped answering.
    Offline,
    /// An answer that is neither a log, nor a redirect, nor a refusal.
    Failed,
}

/// An answer that was read: a log (200) or a refusal (4xx, 5xx), for the app to treat as any other answer of GitHub's.
#[derive(PartialEq, Eq, Serialize)]
pub struct JobLogAnswer {
    pub status: u16,
    /// The [`ALLOWANCE_HEADERS`] GitHub sent; none from a blob, which is not GitHub's API and has no allowance to tell.
    pub headers: BTreeMap<&'static str, String>,
    /// The log, or GitHub's words for its refusal; empty for a blob's refusal, whose words may quote its signature.
    pub text: String,
}

/// Hand-written so that no `{:?}` can put a log in a log.
impl std::fmt::Debug for JobLogAnswer {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("JobLogAnswer")
            .field("status", &self.status)
            .field("headers", &self.headers)
            .field("text_bytes", &self.text.len())
            .finish()
    }
}

/// Reads job logs, managed by Tauri.
pub struct JobLogs {
    http: Client,
    api_url: String,
    /// Whether a redirect may be followed to this address; tests with a local server say what stands for a blob.
    is_blob: fn(&Url) -> bool,
    max_answer_bytes: usize,
}

impl JobLogs {
    /// Job logs read from GitHub.
    pub fn github() -> Self {
        Self::new(API_URL, is_blob_url, MAX_ANSWER_BYTES)
    }

    fn new(api_url: &str, is_blob: fn(&Url) -> bool, max_answer_bytes: usize) -> Self {
        Self {
            http: Client::builder()
                // Followed by hand: the default would follow to any host, and this client must not decide that.
                .redirect(reqwest::redirect::Policy::none())
                .user_agent(USER_AGENT)
                .connect_timeout(CONNECT_TIMEOUT)
                .read_timeout(READ_TIMEOUT)
                .build()
                .expect("the HTTP client needs nothing that can fail here"),
            api_url: api_url.to_owned(),
            is_blob,
            max_answer_bytes,
        }
    }

    /// Reads the log of a job: GitHub's answer, or the blob's it redirects to.
    pub async fn read(
        &self,
        owner: &str,
        name: &str,
        job_id: u64,
        token: &str,
    ) -> Result<JobLogAnswer, JobLogError> {
        if !is_owner(owner) || !is_name(name) {
            return Err(JobLogError::Invalid);
        }

        let url = format!(
            "{}/repos/{owner}/{name}/actions/jobs/{job_id}/logs",
            self.api_url
        );
        let answer = self.ask_github(url, token).await?;
        let answer = match self.moved_log_url(&answer, job_id) {
            Some(moved) => self.ask_github(moved, token).await?,
            None => answer,
        };

        if answer.status().is_redirection() {
            return self.read_blob(&answer).await;
        }
        if !is_readable(answer.status()) {
            return Err(JobLogError::Failed);
        }

        Ok(JobLogAnswer {
            status: answer.status().as_u16(),
            headers: read_allowance(answer.headers()),
            text: self.read_text(answer).await?,
        })
    }

    /// Asks GitHub's API for a job's log, with the token.
    async fn ask_github(
        &self,
        url: impl reqwest::IntoUrl,
        token: &str,
    ) -> Result<Response, JobLogError> {
        self.http
            .get(url)
            .bearer_auth(token)
            .header(ACCEPT, GITHUB_JSON)
            .send()
            .await
            .map_err(offline)
    }

    /// Where a redirect leads, if it is GitHub's for a renamed or moved repository: to the same job's log under the
    /// repository's id, on the API itself. Anything else is no such thing, and is left to [`Self::read_blob`].
    fn moved_log_url(&self, redirect: &Response, job_id: u64) -> Option<Url> {
        if !matches!(
            redirect.status(),
            StatusCode::MOVED_PERMANENTLY | StatusCode::FOUND | StatusCode::TEMPORARY_REDIRECT
        ) {
            return None;
        }

        let api = Url::parse(&self.api_url).ok()?;
        let target = read_location(redirect)?;
        is_moved_log_url(&target, &api, job_id).then_some(target)
    }

    /// Follows GitHub's redirect to the blob, without the token.
    async fn read_blob(&self, redirect: &Response) -> Result<JobLogAnswer, JobLogError> {
        let url = self.redirect_target(redirect)?;
        let answer = self.http.get(url).send().await.map_err(offline)?;
        let status = answer.status();

        if status.is_redirection() {
            eprintln!("A job log's blob redirected again ({status}): refused");
            return Err(JobLogError::Refused);
        }
        if !is_readable(status) {
            return Err(JobLogError::Failed);
        }

        Ok(JobLogAnswer {
            status: status.as_u16(),
            headers: BTreeMap::new(),
            text: if status == StatusCode::OK {
                self.read_text(answer).await?
            } else {
                String::new()
            },
        })
    }

    /// Where a redirect leads, if it may be followed.
    fn redirect_target(&self, redirect: &Response) -> Result<Url, JobLogError> {
        let target = read_location(redirect).ok_or_else(|| {
            eprintln!("GitHub redirected a job's log without a usable address: refused");
            JobLogError::Refused
        })?;

        if !(self.is_blob)(&target) {
            eprintln!(
                "GitHub redirected a job's log to {} on {}: refused",
                target.scheme(),
                target.host_str().unwrap_or("no host")
            );
            return Err(JobLogError::Refused);
        }

        Ok(target)
    }

    /// The answer's body as text, invalid UTF-8 replaced as `fetch` does. The bytes are counted as they come, so the limit
    /// holds whatever length the answer announces.
    async fn read_text(&self, mut answer: Response) -> Result<String, JobLogError> {
        let mut bytes = Vec::new();
        while let Some(chunk) = answer.chunk().await.map_err(offline)? {
            if bytes.len() + chunk.len() > self.max_answer_bytes {
                return Err(JobLogError::TooLarge);
            }
            bytes.extend_from_slice(&chunk);
        }

        Ok(String::from_utf8(bytes)
            .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned()))
    }
}

/// Reads a job's log from GitHub, the one thing it can ask for. The token is the one the window asks GitHub with.
#[tauri::command]
pub async fn read_job_log(
    logs: State<'_, JobLogs>,
    owner: String,
    name: String,
    job_id: u64,
    token: String,
) -> Result<JobLogAnswer, JobLogError> {
    logs.read(&owner, &name, job_id, &token).await
}

/// A failure to talk to GitHub or the blob, logged without the address: the blob's carries its signature.
fn offline(error: reqwest::Error) -> JobLogError {
    eprintln!("Could not read a job's log: {}", describe(error));
    JobLogError::Offline
}

fn describe(error: reqwest::Error) -> String {
    error.without_url().to_string()
}

/// Whether the status is one the app can take as an answer: anything else on this endpoint means nothing to it.
fn is_readable(status: StatusCode) -> bool {
    status == StatusCode::OK || status.is_client_error() || status.is_server_error()
}

fn read_allowance(headers: &HeaderMap) -> BTreeMap<&'static str, String> {
    ALLOWANCE_HEADERS
        .into_iter()
        .filter_map(|name| {
            let value = headers.get(name)?.to_str().ok()?;
            Some((name, value.to_owned()))
        })
        .collect()
}

fn read_location(redirect: &Response) -> Option<Url> {
    let location = redirect.headers().get(LOCATION)?.to_str().ok()?;
    redirect.url().join(location).ok()
}

/// Whether the address is the same job's log under a repository's numeric id, on the API and nothing past the path:
/// the token goes there too.
fn is_moved_log_url(url: &Url, api: &Url, job_id: u64) -> bool {
    let log = format!("/actions/jobs/{job_id}/logs");
    url.origin() == api.origin()
        && url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url
            .path()
            .strip_prefix("/repositories/")
            .and_then(|path| path.strip_suffix(log.as_str()))
            .is_some_and(|id| !id.is_empty() && id.bytes().all(|byte| byte.is_ascii_digit()))
}

/// Whether the address is a blob's, the one place a job's log may lead to: over https, on the standard port, naming
/// no user.
fn is_blob_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url.host_str().is_some_and(|host| {
            host.len() > BLOB_HOST_SUFFIX.len() && host.ends_with(BLOB_HOST_SUFFIX)
        })
}

/// Whether it can be a GitHub account's name: letters, digits, `-`, and `_` for managed users.
fn is_owner(owner: &str) -> bool {
    !owner.is_empty()
        && owner.len() <= MAX_OWNER_LENGTH
        && owner
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

/// Whether it can be a repository's name: letters, digits, `-`, `_` and `.`; never one that means a folder in a path.
fn is_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME_LENGTH
        && name != "."
        && !name.contains("..")
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

#[cfg(test)]
mod tests {
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, Request, ResponseTemplate};

    use super::*;

    const TOKEN: &str = "gho_secret";
    const LOG_PATH: &str = "/repos/acme/web/actions/jobs/125492293728/logs";
    const BLOB_PATH: &str = "/results/job-logs.txt";
    const SIGNED_QUERY: &str = "?sig=blob-signature";

    /// Stands in for a blob's host: the tests' servers are local and over http.
    fn is_local(url: &Url) -> bool {
        url.host_str() == Some("127.0.0.1")
    }

    fn logs(api: &MockServer) -> JobLogs {
        JobLogs::new(&api.uri(), is_local, 1024)
    }

    async fn read(logs: &JobLogs) -> Result<JobLogAnswer, JobLogError> {
        logs.read("acme", "web", 125_492_293_728, TOKEN).await
    }

    async fn answer(server: &MockServer, at: &str, response: ResponseTemplate) {
        Mock::given(method("GET"))
            .and(path(at))
            .respond_with(response)
            .mount(server)
            .await;
    }

    fn redirect_to(location: &str) -> ResponseTemplate {
        ResponseTemplate::new(302).insert_header("location", location)
    }

    fn blob_url(blob: &MockServer) -> String {
        format!("{}{BLOB_PATH}{SIGNED_QUERY}", blob.uri())
    }

    async fn requests(server: &MockServer) -> Vec<Request> {
        server.received_requests().await.unwrap_or_default()
    }

    fn authorization(request: &Request) -> Option<&str> {
        request
            .headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
    }

    fn url(address: &str) -> Url {
        Url::parse(address).expect("the test's address")
    }

    #[tokio::test]
    async fn sends_the_token_to_github_and_never_to_the_blob() {
        let api = MockServer::start().await;
        let blob = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&blob))).await;
        answer(
            &blob,
            BLOB_PATH,
            ResponseTemplate::new(200).set_body_string("2026-11-02 the log"),
        )
        .await;

        let answer = read(&logs(&api)).await;

        assert_eq!(
            answer,
            Ok(JobLogAnswer {
                status: 200,
                headers: BTreeMap::new(),
                text: "2026-11-02 the log".to_owned(),
            })
        );
        let asked_github = requests(&api).await;
        assert_eq!(asked_github.len(), 1);
        assert_eq!(authorization(&asked_github[0]), Some("Bearer gho_secret"));
        let asked_blob = requests(&blob).await;
        assert_eq!(asked_blob.len(), 1);
        assert_eq!(authorization(&asked_blob[0]), None);
        assert_eq!(asked_blob[0].url.query(), Some("sig=blob-signature"));
    }

    #[tokio::test]
    async fn asks_github_for_that_one_address_as_github_wants_it() {
        let api = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path(LOG_PATH))
            .and(header("accept", GITHUB_JSON))
            .and(header("user-agent", USER_AGENT))
            .respond_with(ResponseTemplate::new(200).set_body_string("a log"))
            .mount(&api)
            .await;

        let answer = read(&logs(&api)).await.map(|answer| answer.text);

        assert_eq!(answer, Ok("a log".to_owned()));
        assert_eq!(requests(&api).await[0].url.query(), None);
    }

    #[tokio::test]
    async fn asks_nothing_for_an_owner_or_name_github_could_not_have() {
        let api = MockServer::start().await;
        let logs = logs(&api);

        for (owner, name) in [
            ("acme/evil", "web"),
            ("acme", "web/../../user"),
            ("..", "web"),
            ("acme", ".."),
            ("acme", "."),
            ("acme", "web?x=1"),
            ("acme", "web#x"),
            ("acme", "web%2f..%2fuser"),
            ("ac me", "web"),
            ("acme", "web\\x"),
            ("acmé", "web"),
            ("", "web"),
            ("acme", ""),
        ] {
            assert_eq!(
                logs.read(owner, name, 1, TOKEN).await,
                Err(JobLogError::Invalid),
                "{owner}/{name}"
            );
        }
        assert!(requests(&api).await.is_empty());
    }

    #[test]
    fn takes_the_names_github_allows() {
        assert!(is_owner("kedrzu"));
        assert!(is_owner("some-org"));
        assert!(is_owner("managed_user"));
        assert!(!is_owner(&"a".repeat(40)));
        assert!(is_name("githq"));
        assert!(is_name("kedrzu.github.io"));
        assert!(is_name(".github"));
        assert!(is_name("a_b-c.d"));
        assert!(!is_name(&"a".repeat(101)));
    }

    #[test]
    fn a_blob_is_an_https_address_on_azure_s_blob_host_and_nothing_else() {
        assert!(is_blob_url(&url(
            "https://productionresultssa9.blob.core.windows.net/actions-results/job-logs.txt?sig=x"
        )));

        for address in [
            "http://productionresultssa9.blob.core.windows.net/log",
            "https://blob.core.windows.net/log",
            "https://evilblob.core.windows.net/log",
            "https://a.blob.core.windows.net.evil.example/log",
            "https://evil.example/a.blob.core.windows.net",
            "https://evil.example/?a.blob.core.windows.net",
            "https://evil.example#a.blob.core.windows.net",
            "https://a.blob.core.windows.net@evil.example/log",
            "https://user@a.blob.core.windows.net/log",
            "https://a.blob.core.windows.net:8443/log",
            "https://api.github.com/log",
            "ftp://a.blob.core.windows.net/log",
        ] {
            assert!(!is_blob_url(&url(address)), "{address}");
        }
    }

    #[tokio::test]
    async fn refuses_a_redirect_anywhere_but_to_a_blob() {
        let api = MockServer::start().await;
        let elsewhere = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&elsewhere))).await;
        // The real rule, to which a local server over http is no blob.
        let logs = JobLogs::new(&api.uri(), is_blob_url, 1024);

        assert_eq!(read(&logs).await, Err(JobLogError::Refused));
        assert!(requests(&elsewhere).await.is_empty());
    }

    #[tokio::test]
    async fn refuses_a_redirect_it_cannot_read() {
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, ResponseTemplate::new(302)).await;

        assert_eq!(read(&logs(&api)).await, Err(JobLogError::Refused));
    }

    #[tokio::test]
    async fn a_redirect_within_github_is_refused_too() {
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to("/somewhere/else")).await;
        let logs = JobLogs::new(&api.uri(), is_blob_url, 1024);

        assert_eq!(read(&logs).await, Err(JobLogError::Refused));
        assert_eq!(requests(&api).await.len(), 1);
    }

    const MOVED_PATH: &str = "/repositories/70107786/actions/jobs/125492293728/logs";

    /// The real rule for the blob: to it a local server over http is none, so the only way on is the hop.
    fn logs_with_real_blob_rule(api: &MockServer) -> JobLogs {
        JobLogs::new(&api.uri(), is_blob_url, 1024)
    }

    fn moved_to(location: &str) -> ResponseTemplate {
        ResponseTemplate::new(301).insert_header("location", location)
    }

    #[tokio::test]
    async fn a_moved_repository_s_log_takes_one_hop_within_the_api_with_the_token_and_the_blob_without(
    ) {
        for status in [301, 302, 307] {
            let api = MockServer::start().await;
            let blob = MockServer::start().await;
            answer(
                &api,
                LOG_PATH,
                ResponseTemplate::new(status)
                    .insert_header("location", format!("{}{MOVED_PATH}", api.uri())),
            )
            .await;
            answer(&api, MOVED_PATH, redirect_to(&blob_url(&blob))).await;
            answer(
                &blob,
                BLOB_PATH,
                ResponseTemplate::new(200).set_body_string("the log"),
            )
            .await;

            let answer = read(&logs(&api)).await.map(|answer| answer.text);

            assert_eq!(answer, Ok("the log".to_owned()), "{status}");
            let asked_github = requests(&api).await;
            assert_eq!(asked_github.len(), 2);
            assert_eq!(asked_github[1].url.path(), MOVED_PATH);
            assert_eq!(authorization(&asked_github[0]), Some("Bearer gho_secret"));
            assert_eq!(authorization(&asked_github[1]), Some("Bearer gho_secret"));
            let asked_blob = requests(&blob).await;
            assert_eq!(asked_blob.len(), 1);
            assert_eq!(authorization(&asked_blob[0]), None);
        }
    }

    #[tokio::test]
    async fn a_moved_repository_s_refusal_is_github_s_answer_as_ever() {
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, moved_to(MOVED_PATH)).await;
        answer(
            &api,
            MOVED_PATH,
            ResponseTemplate::new(410)
                .insert_header("x-ratelimit-remaining", "7")
                .set_body_string("gone"),
        )
        .await;

        assert_eq!(
            read(&logs_with_real_blob_rule(&api)).await,
            Ok(JobLogAnswer {
                status: 410,
                headers: BTreeMap::from([("x-ratelimit-remaining", "7".to_owned())]),
                text: "gone".to_owned(),
            })
        );
    }

    #[tokio::test]
    async fn refuses_a_hop_to_another_job() {
        let api = MockServer::start().await;
        answer(
            &api,
            LOG_PATH,
            moved_to("/repositories/70107786/actions/jobs/999/logs"),
        )
        .await;

        assert_eq!(
            read(&logs_with_real_blob_rule(&api)).await,
            Err(JobLogError::Refused)
        );
        assert_eq!(requests(&api).await.len(), 1);
    }

    #[tokio::test]
    async fn refuses_a_hop_to_another_host_and_sends_it_no_token() {
        let api = MockServer::start().await;
        let elsewhere = MockServer::start().await;
        answer(
            &api,
            LOG_PATH,
            moved_to(&format!("{}{MOVED_PATH}", elsewhere.uri())),
        )
        .await;

        assert_eq!(
            read(&logs_with_real_blob_rule(&api)).await,
            Err(JobLogError::Refused)
        );
        assert!(requests(&elsewhere).await.is_empty());
    }

    #[tokio::test]
    async fn refuses_a_hop_by_any_other_status() {
        for status in [300, 303, 308] {
            let api = MockServer::start().await;
            answer(
                &api,
                LOG_PATH,
                ResponseTemplate::new(status).insert_header("location", MOVED_PATH),
            )
            .await;

            assert_eq!(
                read(&logs_with_real_blob_rule(&api)).await,
                Err(JobLogError::Refused),
                "{status}"
            );
            assert_eq!(requests(&api).await.len(), 1, "{status}");
        }
    }

    #[tokio::test]
    async fn refuses_a_hop_to_any_other_path() {
        let api = MockServer::start().await;
        let logs = logs_with_real_blob_rule(&api);
        for location in [
            "/user",
            "/repos/acme/renamed/actions/jobs/125492293728/logs",
            "/repositories/actions/jobs/125492293728/logs",
            "/repositories/abc/actions/jobs/125492293728/logs",
            "/repositories/1/2/actions/jobs/125492293728/logs",
            "/repositories/70107786/actions/jobs/125492293728/logs/",
            "/repositories/70107786/actions/jobs/125492293728/logs/more",
            "/repositories/70107786/actions/jobs/0125492293728/logs",
            "/repositories/70107786/actions/runs/125492293728/logs",
            "/repositories/%37/actions/jobs/125492293728/logs",
            "/repositories/70107786/actions/jobs/125492293728/logs?x=1",
            "/repositories/70107786/actions/jobs/125492293728/logs#x",
        ] {
            api.reset().await;
            answer(&api, LOG_PATH, moved_to(location)).await;

            assert_eq!(read(&logs).await, Err(JobLogError::Refused), "{location}");
            assert_eq!(requests(&api).await.len(), 1, "{location}");
        }
    }

    #[tokio::test]
    async fn refuses_a_hop_that_names_a_user() {
        let api = MockServer::start().await;
        let address = api.uri().replace("http://", "http://user:secret@");
        answer(&api, LOG_PATH, moved_to(&format!("{address}{MOVED_PATH}"))).await;

        assert_eq!(
            read(&logs_with_real_blob_rule(&api)).await,
            Err(JobLogError::Refused)
        );
        assert_eq!(requests(&api).await.len(), 1);
    }

    #[tokio::test]
    async fn refuses_a_second_hop_within_the_api() {
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, moved_to(MOVED_PATH)).await;
        let further = "/repositories/70107787/actions/jobs/125492293728/logs";
        answer(&api, MOVED_PATH, moved_to(further)).await;

        assert_eq!(
            read(&logs_with_real_blob_rule(&api)).await,
            Err(JobLogError::Refused)
        );
        assert_eq!(requests(&api).await.len(), 2);
    }

    #[tokio::test]
    async fn follows_one_redirect_only() {
        let api = MockServer::start().await;
        let blob = MockServer::start().await;
        let further = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&blob))).await;
        answer(&blob, BLOB_PATH, redirect_to(&blob_url(&further))).await;

        assert_eq!(read(&logs(&api)).await, Err(JobLogError::Refused));
        assert!(requests(&further).await.is_empty());
    }

    #[tokio::test]
    async fn a_refusal_keeps_its_status_github_s_words_and_the_allowance() {
        for status in [401, 403, 404, 410, 429, 500, 502] {
            let api = MockServer::start().await;
            answer(
                &api,
                LOG_PATH,
                ResponseTemplate::new(status)
                    .insert_header("x-ratelimit-resource", "core")
                    .insert_header("x-ratelimit-limit", "5000")
                    .insert_header("x-ratelimit-remaining", "0")
                    .insert_header("x-ratelimit-reset", "1790000000")
                    .insert_header("retry-after", "60")
                    .insert_header("set-cookie", "not=forwarded")
                    .set_body_string("{\"message\":\"No\"}"),
            )
            .await;

            assert_eq!(
                read(&logs(&api)).await,
                Ok(JobLogAnswer {
                    status,
                    headers: BTreeMap::from([
                        ("retry-after", "60".to_owned()),
                        ("x-ratelimit-limit", "5000".to_owned()),
                        ("x-ratelimit-remaining", "0".to_owned()),
                        ("x-ratelimit-reset", "1790000000".to_owned()),
                        ("x-ratelimit-resource", "core".to_owned()),
                    ]),
                    text: "{\"message\":\"No\"}".to_owned(),
                })
            );
        }
    }

    #[tokio::test]
    async fn a_blob_s_refusal_keeps_its_status_and_nothing_else() {
        let api = MockServer::start().await;
        let blob = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&blob))).await;
        answer(
            &blob,
            BLOB_PATH,
            ResponseTemplate::new(403)
                .insert_header("x-ratelimit-remaining", "0")
                .set_body_string("<Error>signature blob-signature</Error>"),
        )
        .await;

        assert_eq!(
            read(&logs(&api)).await,
            Ok(JobLogAnswer {
                status: 403,
                headers: BTreeMap::new(),
                text: String::new(),
            })
        );
    }

    #[tokio::test]
    async fn an_answer_that_is_no_log_and_no_refusal_fails() {
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, ResponseTemplate::new(204)).await;

        assert_eq!(read(&logs(&api)).await, Err(JobLogError::Failed));
    }

    #[tokio::test]
    async fn reads_up_to_the_limit_and_fails_past_it() {
        let blob = MockServer::start().await;
        let api = MockServer::start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&blob))).await;
        answer(
            &blob,
            BLOB_PATH,
            ResponseTemplate::new(200).set_body_string("a".repeat(1024)),
        )
        .await;

        let at_the_limit = JobLogs::new(&api.uri(), is_local, 1024);
        assert_eq!(
            read(&at_the_limit).await.map(|answer| answer.text.len()),
            Ok(1024)
        );

        let past_it = JobLogs::new(&api.uri(), is_local, 1023);
        assert_eq!(read(&past_it).await, Err(JobLogError::TooLarge));
    }

    #[tokio::test]
    async fn the_limit_holds_for_github_s_own_answers_too() {
        let api = MockServer::start().await;
        answer(
            &api,
            LOG_PATH,
            ResponseTemplate::new(500).set_body_string("a".repeat(1025)),
        )
        .await;

        assert_eq!(read(&logs(&api)).await, Err(JobLogError::TooLarge));
    }

    #[tokio::test]
    async fn replaces_what_is_not_utf_8_as_fetch_does() {
        let api = MockServer::start().await;
        answer(
            &api,
            LOG_PATH,
            ResponseTemplate::new(200).set_body_bytes(b"caf\xE9 \xF0\x9F\x8D\xB5".to_vec()),
        )
        .await;

        assert_eq!(
            read(&logs(&api)).await.map(|answer| answer.text),
            Ok("caf\u{FFFD} \u{1F375}".to_owned())
        );
    }

    #[tokio::test]
    async fn is_offline_when_github_or_the_blob_cannot_be_reached() {
        let api = MockServer::builder().start().await;
        let blob = MockServer::builder().start().await;
        answer(&api, LOG_PATH, redirect_to(&blob_url(&blob))).await;
        let logs = logs(&api);

        drop(blob);
        assert_eq!(read(&logs).await, Err(JobLogError::Offline));

        drop(api);
        assert_eq!(read(&logs).await, Err(JobLogError::Offline));
    }

    #[tokio::test]
    async fn what_is_logged_of_a_failure_has_no_signature() {
        let blob = MockServer::builder().start().await;
        let address = blob_url(&blob);
        drop(blob);

        let error = Client::new()
            .get(&address)
            .send()
            .await
            .expect_err("nothing listens there any more");

        assert!(error.to_string().contains("blob-signature"));
        assert!(!describe(error).contains("blob-signature"));
    }

    #[test]
    fn the_debug_form_of_an_answer_has_no_log_in_it() {
        let answer = JobLogAnswer {
            status: 200,
            headers: BTreeMap::new(),
            text: "the log of a private repository".to_owned(),
        };

        assert!(!format!("{answer:?}").contains("private repository"));
    }

    #[test]
    fn the_app_gets_an_answer_and_its_errors_as_it_expects_them() {
        let answer = JobLogAnswer {
            status: 502,
            headers: BTreeMap::from([("retry-after", "60".to_owned())]),
            text: "No".to_owned(),
        };
        assert_eq!(
            serde_json::to_value(&answer).ok(),
            Some(serde_json::json!({
                "status": 502,
                "headers": { "retry-after": "60" },
                "text": "No",
            }))
        );

        let codes = [
            JobLogError::Invalid,
            JobLogError::Refused,
            JobLogError::TooLarge,
            JobLogError::Offline,
            JobLogError::Failed,
        ]
        .map(|error| serde_json::to_string(&error).unwrap_or_default());
        assert_eq!(
            codes,
            [
                "\"invalid\"",
                "\"refused\"",
                "\"tooLarge\"",
                "\"offline\"",
                "\"failed\""
            ]
        );
    }

    /// The whole point of the native command: the window's policy stays closed to Azure Storage (actions D3).
    #[test]
    fn the_window_s_content_security_policy_is_unchanged() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("the app's config");

        assert_eq!(
            config["app"]["security"]["csp"],
            serde_json::json!({
                "default-src": "'self'",
                "connect-src": "ipc: http://ipc.localhost https://api.github.com",
                "font-src": "'self' data:",
                "img-src": "'self' data: https://avatars.githubusercontent.com https://*.githubusercontent.com https://github.com",
                "worker-src": "'self'",
            })
        );
    }
}
