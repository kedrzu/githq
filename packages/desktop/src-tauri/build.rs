/// The OAuth App client IDs, shared with the TypeScript side (`getOAuthClientId`).
const CLIENT_IDS: &str = "../../github/src/oauthClientIds.json";

/// Compiles in the client ID of the environment `GITHQ_ENV` names, `dev` by default (`device_flow.rs`).
fn set_client_id() {
    println!("cargo:rerun-if-env-changed=GITHQ_ENV");
    println!("cargo:rerun-if-changed={CLIENT_IDS}");

    let env = std::env::var("GITHQ_ENV").unwrap_or_else(|_| "dev".to_owned());
    let file = std::fs::read_to_string(CLIENT_IDS).expect("the OAuth client IDs cannot be read");
    let ids: serde_json::Value =
        serde_json::from_str(&file).expect("the OAuth client IDs are not JSON");
    let id = ids[env.as_str()]
        .as_str()
        .unwrap_or_else(|| panic!("GITHQ_ENV={env} names no OAuth App"));

    println!("cargo:rustc-env=GITHQ_GITHUB_CLIENT_ID={id}");
}

fn main() {
    set_client_id();

    // The app's own commands. Listing them makes Tauri check them against the capabilities, so a window can only call
    // the ones `capabilities/default.json` allows (`allow-<command>`).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "token_load",
            "token_save",
            "token_delete",
            "device_start",
            "device_finish",
            "open_external",
            "read_job_log",
            "update_status",
            "update_restart",
        ]),
    ))
    .expect("the Tauri build step failed");
}
