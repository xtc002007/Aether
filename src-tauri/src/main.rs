#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aether_lib::commands::{self, AppState};
use aether_lib::db::Database;
use aether_lib::scheduler::Scheduler;
use std::sync::Arc;
use tauri::Manager;

fn main() {
    env_logger::init();

    let app_data_dir = get_app_data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("./data"));

    let db = Database::new(app_data_dir).expect("Failed to initialize database");
    let settings = load_scheduler_settings(&db);
    let scheduler = Arc::new(Scheduler::new(settings));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(move |app| {
            app.manage(AppState {
                db,
                scheduler,
                app_handle: app.handle().clone(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project::get_projects,
            commands::project::get_project,
            commands::project::create_project,
            commands::project::update_project,
            commands::project::delete_project,
            commands::analysis::analyze_idea,
            commands::analysis::re_evaluate,
            commands::analysis::resume_analysis,
            commands::config::get_settings,
            commands::config::update_settings,
            commands::config::get_platform_configs,
            commands::config::update_platform_config,
            commands::config::save_api_key,
            commands::config::get_api_key,
            commands::config::clear_cache,
            commands::config::get_project_platform_overrides,
            commands::config::set_project_platform_override,
            commands::config::reset_project_platform_override,
            commands::project::add_competitor,
            commands::project::delete_competitor,
            commands::project::move_competitor_group,
            commands::project::add_user_voice,
            commands::project::delete_user_voice,
            commands::snapshot::create_snapshot,
            commands::snapshot::list_snapshots,
            commands::snapshot::get_snapshot,
            commands::snapshot::restore_snapshot,
            commands::snapshot::delete_snapshot,
            commands::snapshot::get_snapshot_counts,
            commands::export::export_report,
            commands::export::get_export_history,
            commands::modeling::reanalyze_idea_model,
            commands::analysis::cancel_analysis,
            commands::analysis::search_documents,
            commands::project::get_stats,
            commands::project::get_competitor_evidence,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch Aether application");
}

fn load_scheduler_settings(db: &Database) -> usize {
    let conn = db.conn.lock().unwrap();
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'global_max_concurrent'",
        [],
        |row| {
            let val: String = row.get(0)?;
            Ok(val.parse::<usize>().unwrap_or(8))
        },
    ).unwrap_or(8)
}

fn get_app_data_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("Aether"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|p| {
            std::path::PathBuf::from(p)
                .join("Library")
                .join("Application Support")
                .join("Aether")
        })
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join(".aether"))
    }
}
