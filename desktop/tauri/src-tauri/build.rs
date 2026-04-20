fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();

    // The GNU fallback build avoids the Windows resource compiler step because
    // rc.exe breaks on this workspace/toolchain combination. The app still
    // builds and runs, and the bundle icon remains configured in tauri.conf.json.
    if target_os == "windows" && target_env == "gnu" {
        return;
    }

    tauri_build::build()
}
