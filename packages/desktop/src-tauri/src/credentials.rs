//! Where the desktop app keeps the user's GitHub token: the OS credential store (Keychain on macOS, Credential
//! Manager on Windows, the Secret Service on Linux) and nowhere else. When the store is unavailable — a Linux
//! desktop without a Secret Service, a locked or refused keychain — the token lives in this process's memory for
//! the rest of the run and the user signs in again next time. It is never written to a file.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};

use serde::Serialize;
use tauri::State;

/// The service the token is filed under in the credential store: the app's identifier (`tauri.conf.json`).
const SERVICE: &str = "dev.githq.desktop";

/// The account the token is filed under in the credential store.
const ACCOUNT: &str = "github-token";

/// Why a credential store could not do what was asked; only ever logged.
#[derive(Debug)]
pub struct StoreError(String);

impl std::fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

/// A place that keeps one secret across runs of the app.
pub trait SecretStore: Send + Sync {
    /// The stored secret, or `None` when there is none.
    fn load(&self) -> Result<Option<String>, StoreError>;
    /// Stores the secret, replacing any earlier one.
    fn save(&self, secret: &str) -> Result<(), StoreError>;
    /// Removes the secret; removing one that is not there is not an error.
    fn delete(&self) -> Result<(), StoreError>;
}

/// The OS credential store, through `keyring`.
pub struct KeyringStore {
    service: &'static str,
    account: &'static str,
}

impl KeyringStore {
    fn entry(&self) -> Result<keyring::Entry, StoreError> {
        keyring::Entry::new(self.service, self.account).map_err(keyring_error)
    }
}

impl SecretStore for KeyringStore {
    fn load(&self) -> Result<Option<String>, StoreError> {
        match self.entry()?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(keyring_error(error)),
        }
    }

    fn save(&self, secret: &str) -> Result<(), StoreError> {
        self.entry()?.set_password(secret).map_err(keyring_error)
    }

    fn delete(&self) -> Result<(), StoreError> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(keyring_error(error)),
        }
    }
}

fn keyring_error(error: keyring::Error) -> StoreError {
    StoreError(error.to_string())
}

/// What `token_load` answers.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct LoadedToken {
    /// The token kept from an earlier sign-in, if any.
    pub token: Option<String>,
    /// Whether the credential store works; `false` means a token saved now is gone when the app quits.
    pub keychain: bool,
}

/// The token's keeper: the credential store while it works, this process's memory from its first failure on.
pub struct Credentials {
    store: Box<dyn SecretStore>,
    /// Whether the store has not failed yet. Once it has, it is not asked again this run, so the app does not keep
    /// a token in memory and a stale one in the store at the same time.
    store_works: AtomicBool,
    /// The token while the store does not work.
    memory: Mutex<Option<String>>,
}

impl Credentials {
    /// The token's keeper backed by the OS credential store.
    pub fn os() -> Self {
        Self::new(Box::new(KeyringStore {
            service: SERVICE,
            account: ACCOUNT,
        }))
    }

    /// The token's keeper backed by `store`.
    pub fn new(store: Box<dyn SecretStore>) -> Self {
        Self {
            store,
            store_works: AtomicBool::new(true),
            memory: Mutex::new(None),
        }
    }

    /// The kept token and whether the credential store works.
    pub fn load(&self) -> LoadedToken {
        if self.store_works() {
            match self.store.load() {
                Ok(token) => {
                    return LoadedToken {
                        token,
                        keychain: true,
                    }
                }
                Err(error) => self.fall_back("read", &error),
            }
        }

        LoadedToken {
            token: self.memory().clone(),
            keychain: false,
        }
    }

    /// Keeps the token; `false` means the credential store does not work and the token is kept in memory only.
    pub fn save(&self, token: &str) -> bool {
        if self.store_works() {
            match self.store.save(token) {
                Ok(()) => return true,
                Err(error) => {
                    self.fall_back("write", &error);
                    // Whatever an earlier run stored must not come back as the user next time; if the store
                    // cannot even delete, there is nothing more to do about it.
                    if let Err(error) = self.store.delete() {
                        eprintln!("Could not clear the credential store either: {error}");
                    }
                }
            }
        }

        *self.memory() = Some(token.to_owned());
        false
    }

    /// Forgets the token, wherever it is kept.
    pub fn delete(&self) {
        *self.memory() = None;

        if self.store_works() {
            if let Err(error) = self.store.delete() {
                self.fall_back("delete from", &error);
            }
        }
    }

    fn store_works(&self) -> bool {
        self.store_works.load(Ordering::SeqCst)
    }

    fn fall_back(&self, action: &str, error: &StoreError) {
        eprintln!("Could not {action} the credential store, keeping the token in memory from now on: {error}");
        self.store_works.store(false, Ordering::SeqCst);
    }

    fn memory(&self) -> std::sync::MutexGuard<'_, Option<String>> {
        // The guarded value is a plain `Option`, whole at every point a panic could leave it.
        self.memory.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

// The commands run off the main thread (`async`): a credential store may block on a prompt to the user.

/// The token kept from an earlier sign-in, if any, and whether the credential store works.
#[tauri::command(async)]
pub fn token_load(credentials: State<'_, Credentials>) -> LoadedToken {
    credentials.load()
}

/// Keeps the token; `false` means the credential store does not work and it is kept in memory for this run only.
#[tauri::command(async)]
pub fn token_save(credentials: State<'_, Credentials>, token: String) -> bool {
    credentials.save(&token)
}

/// Forgets the token.
#[tauri::command(async)]
pub fn token_delete(credentials: State<'_, Credentials>) {
    credentials.delete();
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::*;

    /// A store that works, and whose contents a test can look at.
    #[derive(Clone, Default)]
    struct WorkingStore(Arc<Mutex<Option<String>>>);

    impl SecretStore for WorkingStore {
        fn load(&self) -> Result<Option<String>, StoreError> {
            Ok(self
                .0
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .clone())
        }

        fn save(&self, secret: &str) -> Result<(), StoreError> {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner) = Some(secret.to_owned());
            Ok(())
        }

        fn delete(&self) -> Result<(), StoreError> {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner) = None;
            Ok(())
        }
    }

    /// A store that fails at everything, counting the attempts.
    #[derive(Clone, Default)]
    struct BrokenStore(Arc<Mutex<u32>>);

    impl BrokenStore {
        fn fail(&self) -> StoreError {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner) += 1;
            StoreError("no keychain".to_owned())
        }

        fn attempts(&self) -> u32 {
            *self.0.lock().unwrap_or_else(PoisonError::into_inner)
        }
    }

    impl SecretStore for BrokenStore {
        fn load(&self) -> Result<Option<String>, StoreError> {
            Err(self.fail())
        }

        fn save(&self, _secret: &str) -> Result<(), StoreError> {
            Err(self.fail())
        }

        fn delete(&self) -> Result<(), StoreError> {
            Err(self.fail())
        }
    }

    #[test]
    fn keeps_the_token_in_the_store_when_it_works() {
        let store = WorkingStore::default();
        let credentials = Credentials::new(Box::new(store.clone()));

        assert_eq!(
            credentials.load(),
            LoadedToken {
                token: None,
                keychain: true
            }
        );
        assert!(credentials.save("gho_secret"));
        assert_eq!(store.load().ok().flatten().as_deref(), Some("gho_secret"));
        assert!(
            credentials.memory().is_none(),
            "the token must not be kept in memory as well"
        );

        // A new run reads it back from the store.
        let next_run = Credentials::new(Box::new(store.clone()));
        assert_eq!(
            next_run.load(),
            LoadedToken {
                token: Some("gho_secret".to_owned()),
                keychain: true
            }
        );

        next_run.delete();
        assert_eq!(store.load().ok().flatten(), None);
    }

    #[test]
    fn keeps_the_token_in_memory_only_when_the_store_fails() {
        let store = BrokenStore::default();
        let credentials = Credentials::new(Box::new(store.clone()));

        assert!(!credentials.save("gho_secret"));
        assert_eq!(
            credentials.load(),
            LoadedToken {
                token: Some("gho_secret".to_owned()),
                keychain: false
            }
        );

        credentials.delete();
        assert_eq!(
            credentials.load(),
            LoadedToken {
                token: None,
                keychain: false
            }
        );

        // The failed write and the clean-up after it; the store is not asked again this run.
        assert_eq!(store.attempts(), 2);
    }

    #[test]
    fn reports_no_keychain_from_the_first_failed_read_on() {
        let store = BrokenStore::default();
        let credentials = Credentials::new(Box::new(store.clone()));

        assert_eq!(
            credentials.load(),
            LoadedToken {
                token: None,
                keychain: false
            }
        );
        assert!(!credentials.save("gho_secret"));
        assert_eq!(
            credentials.load(),
            LoadedToken {
                token: Some("gho_secret".to_owned()),
                keychain: false
            }
        );
        assert_eq!(store.attempts(), 1);
    }
}
