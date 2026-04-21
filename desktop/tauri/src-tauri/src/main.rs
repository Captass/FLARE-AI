#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

const FLARE_NATIVE_AUTH_EVENT: &str = "flare-native-auth-url";

struct PendingNativeAuthUrl(Mutex<Option<String>>);

#[cfg(target_os = "windows")]
fn register_windows_deep_link_protocol() {
    use std::env;
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};

    let executable_path = match env::current_exe() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("failed to resolve executable path for deep link registration: {error}");
            return;
        }
    };

    let command = format!("\"{}\" \"%1\"", executable_path.display());
    let icon = format!("\"{}\",0", executable_path.display());
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let (scheme_key, _) = match hkcu.create_subkey("Software\\Classes\\flareai") {
        Ok(entry) => entry,
        Err(error) => {
            eprintln!("failed to create deep link registry key: {error}");
            return;
        }
    };

    if let Err(error) = scheme_key.set_value("", &"URL:FLARE AI Protocol") {
        eprintln!("failed to set deep link description: {error}");
    }
    if let Err(error) = scheme_key.set_value("URL Protocol", &"") {
        eprintln!("failed to set deep link URL protocol flag: {error}");
    }

    if let Ok((default_icon_key, _)) = scheme_key.create_subkey("DefaultIcon") {
        if let Err(error) = default_icon_key.set_value("", &icon) {
            eprintln!("failed to set deep link icon: {error}");
        }
    }

    match scheme_key.create_subkey("shell\\open\\command") {
        Ok((command_key, _)) => {
            if let Err(error) = command_key.set_value("", &command) {
                eprintln!("failed to set deep link command: {error}");
            }
        }
        Err(error) => eprintln!("failed to create deep link command key: {error}"),
    }
}

fn extract_native_auth_url() -> Option<String> {
    std::env::args().find(|arg| arg.starts_with("flareai://"))
}

fn main() {
    #[cfg(target_os = "windows")]
    register_windows_deep_link_protocol();

    tauri::Builder::default()
        .manage(PendingNativeAuthUrl(Mutex::new(extract_native_auth_url())))
        .on_page_load(|window, _payload| {
            let state = window.state::<PendingNativeAuthUrl>();
            let native_auth_url = state.0.lock().ok().and_then(|mut guard| guard.take());

            if let Some(native_auth_url) = native_auth_url {
                if let Ok(payload) = serde_json::to_string(&native_auth_url) {
                    let _ = window.eval(&format!(
                        "window.__FLARE_NATIVE_AUTH_URL__ = {payload}; window.dispatchEvent(new CustomEvent('{FLARE_NATIVE_AUTH_EVENT}', {{ detail: {payload} }}));"
                    ));
                }
                let _ = window.emit(FLARE_NATIVE_AUTH_EVENT, native_auth_url);
            }
        })
        .setup(|app| {
            let state = app.state::<PendingNativeAuthUrl>();
            let has_pending_url = state
                .0
                .lock()
                .map(|guard| guard.is_some())
                .unwrap_or(false);

            if has_pending_url {
                if let Some(main_window) = app.get_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.set_focus();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run FLARE AI desktop shell");
}
