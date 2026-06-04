use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub message: String,
    pub kind: String,
}

impl AppError {
    pub fn new(message: impl Into<String>) -> Self {
        Self { message: message.into(), kind: "general".into() }
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self { message: message.into(), kind: "database".into() }
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self { message: message.into(), kind: "not_found".into() }
    }

    pub fn parse(message: impl Into<String>) -> Self {
        Self { message: message.into(), kind: "parse".into() }
    }

    pub fn config(message: impl Into<String>) -> Self {
        Self { message: message.into(), kind: "config".into() }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.kind, self.message)
    }
}

impl From<String> for AppError {
    fn from(s: String) -> Self { Self::new(s) }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self { Self::new(s.to_string()) }
}

/// Convenience: convert Result<T, impl Into<AppError>> to Result<T, String> for Tauri commands.
pub trait IntoCommandResult<T> {
    fn cmd(self) -> Result<T, String>;
}

impl<T, E: Into<AppError>> IntoCommandResult<T> for Result<T, E> {
    fn cmd(self) -> Result<T, String> {
        self.map_err(|e| e.into().to_string())
    }
}
