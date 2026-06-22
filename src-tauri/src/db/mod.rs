use rusqlite::{Connection, Result as SqliteResult, params};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::models::ProjectSnapshot;

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> SqliteResult<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("aether.db");
        let conn = Connection::open(&db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self { conn: Arc::new(Mutex::new(conn)) };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        // Bootstrap: ensure migrations_log exists with all required columns.
        // If an old version of the table exists without 'description', recreate it.
        let needs_recreate = match conn.prepare("SELECT description FROM migrations_log LIMIT 0") {
            Ok(_) => false,
            Err(_) => true,
        };
        if needs_recreate {
            log::warn!("Old migrations_log table detected (missing 'description' column), recreating...");
            conn.execute_batch("DROP TABLE IF EXISTS migrations_log;")?;
        }
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS migrations_log (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL);"
        )?;
        // Get applied versions
        let mut stmt = conn.prepare("SELECT version FROM migrations_log ORDER BY version")?;
        let applied: Vec<i32> = stmt.query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok()).collect();
        // Run unapplied migrations in order
        for (version, description, sql) in MIGRATION_VERSIONS {
            if applied.contains(&version) { continue; }
            conn.execute_batch(sql)?;
            let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            conn.execute(
                "INSERT INTO migrations_log (version, description, applied_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![version, description, now],
            )?;
            log::info!("Applied migration v{}: {}", version, description);
        }
        Ok(())
    }

    pub fn insert_search_result(
        &self,
        project_id: &str,
        platform: &str,
        query_text: &str,
        result_json: &str,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let id = format!("sr-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT OR REPLACE INTO search_results (id, project_id, platform, query_text, result_json, captured_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, platform, query_text, result_json, now],
        )?;
        Ok(())
    }

    pub fn insert_raw_document(
        &self,
        project_id: &str,
        platform: &str,
        url: &str,
        title: &str,
        content_html: &str,
        content_text: &str,
        metadata_json: &str,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        let id = format!("doc-{}", uuid::Uuid::new_v4());
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        // Insert into raw_documents
        conn.execute(
            "INSERT INTO raw_documents (id, project_id, platform, url, title, content_html, content_text, metadata_json, captured_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, project_id, platform, url, title, content_html, content_text, metadata_json, now],
        )?;

        // Sync to FTS5 index — fts5 content table auto-syncs via triggers, but we need to ensure the rowid
        // Since we use content='raw_documents', FTS5 reads directly from the table.
        // For fts5 external content tables, we need to rebuild after insert.
        // Use INSERT into the FTS5 table explicitly to keep it in sync.
        let rowid: i64 = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO documents_fts(rowid, title, content_text, platform, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![rowid, title, content_text, platform, url],
        )?;

        Ok(())
    }

    pub fn search_fts(&self, query: &str) -> SqliteResult<Vec<(String, String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT title, content_text, platform FROM documents_fts WHERE documents_fts MATCH ?1 LIMIT 50"
        )?;
        let results = stmt.query_map(params![query], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();
        Ok(results)
    }

    // ── Snapshot helpers ──

    pub fn insert_snapshot(&self, snap: &ProjectSnapshot) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO project_snapshots (id, project_id, version_number, snapshot_type, label, description, project_json, checkpoint_stage, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                snap.id, snap.project_id, snap.version_number,
                serde_json::to_string(&snap.snapshot_type).unwrap_or_default().trim_matches('"'),
                snap.label, snap.description, snap.project_json,
                snap.checkpoint_stage, snap.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_snapshots(&self, project_id: &str) -> SqliteResult<Vec<ProjectSnapshot>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, version_number, snapshot_type, label, description, project_json, checkpoint_stage, created_at FROM project_snapshots WHERE project_id = ?1 ORDER BY version_number DESC"
        )?;
        let results = stmt.query_map(params![project_id], |row| {
            let st_str: String = row.get(3).unwrap_or_else(|_| "auto".to_string());
            let snapshot_type: String = serde_json::from_str(&format!("\"{}\"", st_str)).unwrap_or_else(|_| "auto".to_string());
            Ok(ProjectSnapshot {
                id: row.get(0)?,
                project_id: row.get(1)?,
                version_number: row.get(2)?,
                snapshot_type: serde_json::from_str(&format!("\"{}\"", snapshot_type)).unwrap_or(crate::models::SnapshotType::Auto),
                label: row.get(4).unwrap_or_default(),
                description: row.get(5).unwrap_or_default(),
                project_json: row.get(6).unwrap_or_default(),
                checkpoint_stage: row.get(7).unwrap_or(None),
                created_at: row.get(8).unwrap_or_default(),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        Ok(results)
    }

    pub fn get_snapshot(&self, snapshot_id: &str) -> SqliteResult<ProjectSnapshot> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, project_id, version_number, snapshot_type, label, description, project_json, checkpoint_stage, created_at FROM project_snapshots WHERE id = ?1",
            params![snapshot_id],
            |row| {
                let st_str: String = row.get(3).unwrap_or_else(|_| "auto".to_string());
                let snapshot_type: String = serde_json::from_str(&format!("\"{}\"", st_str)).unwrap_or_else(|_| "auto".to_string());
                Ok(ProjectSnapshot {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    version_number: row.get(2)?,
                    snapshot_type: serde_json::from_str(&format!("\"{}\"", snapshot_type)).unwrap_or(crate::models::SnapshotType::Auto),
                    label: row.get(4).unwrap_or_default(),
                    description: row.get(5).unwrap_or_default(),
                    project_json: row.get(6).unwrap_or_default(),
                    checkpoint_stage: row.get(7).unwrap_or(None),
                    created_at: row.get(8).unwrap_or_default(),
                })
            },
        )
    }

    pub fn delete_snapshot(&self, snapshot_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM project_snapshots WHERE id = ?1", params![snapshot_id])?;
        Ok(())
    }

    pub fn delete_project_snapshots(&self, project_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM project_snapshots WHERE project_id = ?1", params![project_id])?;
        Ok(())
    }

    pub fn get_latest_snapshot_version(&self, project_id: &str) -> SqliteResult<Option<i32>> {
        let conn = self.conn.lock().unwrap();
        let result: Option<i32> = conn.query_row(
            "SELECT MAX(version_number) FROM project_snapshots WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        ).unwrap_or(None);
        Ok(result)
    }

    /// Load merged platform configs: system defaults → user overrides → project overrides.
    pub fn load_platform_configs(&self, project_id: &str) -> SqliteResult<Vec<crate::models::PlatformConfig>> {
        use crate::config::system_default_platforms;
        let conn = self.conn.lock().unwrap();
        let defaults = system_default_platforms();

        // Load user-saved overrides from platform_configs table
        let mut stmt = conn.prepare("SELECT name, config_json FROM platform_configs")?;
        let user_overrides: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        // Load project-specific overrides
        let mut proj_stmt = conn.prepare(
            "SELECT platform_name, override_json FROM project_platform_overrides WHERE project_id = ?1"
        )?;
        let proj_overrides: Vec<(String, String)> = proj_stmt
            .query_map(rusqlite::params![project_id], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        let mut configs = Vec::new();
        for mut cfg in defaults {
            // Layer 1: user overrides from platform_configs
            if let Some((_, json)) = user_overrides.iter().find(|(n, _)| n == &cfg.name) {
                if let Ok(override_cfg) = serde_json::from_str::<crate::models::PlatformConfig>(json) {
                    cfg = override_cfg;
                }
            }
            // Layer 2: project-specific overrides
            if let Some((_, json)) = proj_overrides.iter().find(|(n, _)| n == &cfg.name) {
                if let Ok(proj_override) = serde_json::from_str::<serde_json::Value>(json) {
                    if let Ok(merged) = serde_json::from_str::<crate::models::PlatformConfig>(
                        &serde_json::to_string(&cfg).unwrap_or_default()
                    ) {
                        // Apply project override fields on top of current config
                        cfg = apply_override_fields(merged, proj_override);
                    }
                }
            }
            configs.push(cfg);
        }
        Ok(configs)
    }

    pub fn prune_snapshots(&self, project_id: &str, max_snapshots: i32) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM project_snapshots WHERE id IN (
                SELECT id FROM project_snapshots WHERE project_id = ?1 AND snapshot_type != 'manual'
                ORDER BY version_number DESC
                LIMIT -1 OFFSET ?2
            )",
            params![project_id, max_snapshots],
        )?;
        Ok(())
    }
}

fn apply_override_fields(mut base: crate::models::PlatformConfig, overrides: serde_json::Value) -> crate::models::PlatformConfig {
    if let Some(v) = overrides.get("enabled").and_then(|v| v.as_bool()) { base.enabled = v; }
    if let Some(v) = overrides.get("priority").and_then(|v| v.as_i64()) { base.priority = v as i32; }
    if let Some(v) = overrides.get("rate_limit_rps").and_then(|v| v.as_f64()) { base.rate_limit_rps = v; }
    if let Some(v) = overrides.get("timeout_ms").and_then(|v| v.as_i64()) { base.timeout_ms = v; }
    if let Some(v) = overrides.get("max_pages").and_then(|v| v.as_i64()) { base.max_pages = v as i32; }
    if let Some(v) = overrides.get("max_results").and_then(|v| v.as_i64()) { base.max_results = v as i32; }
    if let Some(v) = overrides.get("max_concurrency").and_then(|v| v.as_i64()) { base.max_concurrency = v as i32; }
    if let Some(v) = overrides.get("retry_count").and_then(|v| v.as_i64()) { base.retry_count = v as i32; }
    if let Some(v) = overrides.get("backoff_strategy").and_then(|v| v.as_str()) { base.backoff_strategy = v.to_string(); }
    if let Some(v) = overrides.get("default_region").and_then(|v| v.as_str()) { base.default_region = v.to_string(); }
    if let Some(v) = overrides.get("default_language").and_then(|v| v.as_str()) { base.default_language = v.to_string(); }
    if let Some(v) = overrides.get("participate_quick").and_then(|v| v.as_bool()) { base.participate_quick = v; }
    if let Some(v) = overrides.get("participate_deep").and_then(|v| v.as_bool()) { base.participate_deep = v; }
    base
}

const MIGRATION_VERSIONS: &[(i32, &str, &str)] = &[
    (1, "Initial schema: projects, app_settings, search_results, raw_documents", r#"
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_results (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    query_text TEXT NOT NULL,
    result_json TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS raw_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    content_html TEXT,
    content_text TEXT,
    metadata_json TEXT,
    captured_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('language', 'zh'),
    ('theme', 'light'),
    ('global_max_concurrent', '8'),
    ('default_crawl_depth', 'quick'),
    ('auto_backup', 'true'),
    ('auto_update_enabled', 'true'),
    ('save_html', 'false'),
    ('sqlite_path', './data/aether.db'),
    ('log_level', 'info');
"#),
    (2, "Platform configs, FTS5, signals, competitors, voices, evaluation, reports", r#"
CREATE TABLE IF NOT EXISTS platform_configs (
    name TEXT PRIMARY KEY,
    config_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_platform_overrides (
    project_id TEXT NOT NULL,
    platform_name TEXT NOT NULL,
    override_json TEXT NOT NULL,
    PRIMARY KEY (project_id, platform_name),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    title, content_text, platform, url,
    content='raw_documents',
    content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    content TEXT NOT NULL,
    source_platform TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_timestamp TEXT,
    topic_tags TEXT,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    evidence_strength TEXT NOT NULL DEFAULT 'medium',
    confidence_score REAL NOT NULL DEFAULT 0.5,
    cross_platform_count INTEGER NOT NULL DEFAULT 1,
    representative_note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competitors_store (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '#',
    info_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_voices_store (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    content_json TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluation_cache (
    project_id TEXT PRIMARY KEY,
    evaluation_json TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    format TEXT NOT NULL,
    content TEXT NOT NULL,
    config_snapshot TEXT,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS config_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
"#),
    (3, "Project snapshots", r#"
CREATE TABLE IF NOT EXISTS project_snapshots (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    snapshot_type TEXT NOT NULL DEFAULT 'auto',
    label TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    project_json TEXT NOT NULL DEFAULT '{}',
    checkpoint_stage TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project_id ON project_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_version ON project_snapshots(project_id, version_number);
"#),
];
