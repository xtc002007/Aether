//! Command modules — each domain has its own file.
//! This is the re-export hub.

pub mod project;
pub mod analysis;
pub mod config;
pub mod snapshot;
pub mod export;
pub mod modeling;

use crate::db::Database;
use crate::scheduler::Scheduler;
use std::sync::Arc;
use tauri::AppHandle;

pub struct AppState {
    pub db: Database,
    pub scheduler: Arc<Scheduler>,
    pub app_handle: AppHandle,
}

// Re-export LLM helpers for use by dependent modules
pub use crate::worker::{try_llm_model_idea, fallback_idea_model, keyword_from_statement};
