fn main() {
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
            "update_status",
            "update_restart",
        ]),
    ))
    .expect("the Tauri build step failed");
}
