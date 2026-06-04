use crate::adapters::{get_adapter, SearchResult};
use crate::config::system_default_platforms;
use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;
use tokio::sync::{Mutex, Semaphore};
use tokio::time::{sleep, Duration, timeout};

#[derive(Debug, Clone)]
pub struct TaskProgress {
    pub platform: String,
    pub query: String,
    pub status: SearchTaskStatus,
    pub count: i32,
    pub duration_ms: i64,
    pub logs: String,
    pub retry_count: i32,
    pub results: Vec<SearchResult>,
}

pub struct Scheduler {
    pub global_semaphore: Arc<Semaphore>,
    pub platform_semaphores: HashMap<String, Arc<Semaphore>>,
    pub progress: Arc<Mutex<Vec<TaskProgress>>>,
    pub cancelled: Arc<Mutex<bool>>,
    pub project_cancel_tokens: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
    /// P1-1: Per-platform rate limit tracking. Maps platform name → last request Instant.
    pub rate_limits: Arc<Mutex<HashMap<String, std::time::Instant>>>,
}

impl Scheduler {
    pub fn new(global_max: usize) -> Self {
        let mut platform_semaphores = HashMap::new();
        for pf in system_default_platforms() {
            platform_semaphores.insert(
                pf.name.clone(),
                Arc::new(Semaphore::new(pf.max_concurrency as usize)),
            );
        }
        Self {
            global_semaphore: Arc::new(Semaphore::new(global_max)),
            platform_semaphores,
            progress: Arc::new(Mutex::new(Vec::new())),
            cancelled: Arc::new(Mutex::new(false)),
            project_cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
            rate_limits: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn cancel_all(&self) {
        *self.cancelled.lock().await = true;
    }

    pub async fn is_cancelled(&self) -> bool {
        *self.cancelled.lock().await
    }

    /// Cancel a specific project's running tasks.
    pub async fn cancel_project(&self, project_id: &str) {
        let mut tokens = self.project_cancel_tokens.lock().await;
        if let Some(token) = tokens.get(project_id) {
            token.store(true, Ordering::SeqCst);
        } else {
            tokens.insert(project_id.to_string(), Arc::new(AtomicBool::new(true)));
        }
    }

    /// Check if a specific project is cancelled.
    pub async fn is_project_cancelled(&self, project_id: &str) -> bool {
        let tokens = self.project_cancel_tokens.lock().await;
        tokens.get(project_id).map(|t| t.load(Ordering::SeqCst)).unwrap_or(false)
    }

    /// Reset cancellation for a project (so it can be re-run).
    pub async fn reset_project(&self, project_id: &str) {
        let mut tokens = self.project_cancel_tokens.lock().await;
        tokens.remove(project_id);
    }

    pub async fn run_platform_queries(
        &self,
        platform: &str,
        queries: Vec<String>,
        config: &PlatformConfig,
        project_id: &str,
        app_handle: Option<&tauri::AppHandle>,
    ) -> Vec<TaskProgress> {
        let adapter = match get_adapter(platform) {
            Some(a) => Arc::new(a),
            None => {
                return queries.iter().map(|q| TaskProgress {
                    platform: platform.to_string(),
                    query: q.clone(),
                    status: SearchTaskStatus::Empty,
                    count: 0,
                    duration_ms: 0,
                    logs: format!("No adapter available for platform: {} — API key may be required", platform),
                    retry_count: 0,
                    results: Vec::new(),
                }).collect();
            }
        };

        let pf_sem = self.platform_semaphores.get(platform)
            .cloned()
            .unwrap_or_else(|| Arc::new(Semaphore::new(1)));

        let platform_name = platform.to_string();
        // Register cancel token for this project
        {
            let mut tokens = self.project_cancel_tokens.lock().await;
            tokens.entry(project_id.to_string()).or_insert_with(|| Arc::new(AtomicBool::new(false)));
        }

        let mut tasks = Vec::new();
        for query in queries {
            if self.is_cancelled().await || self.is_project_cancelled(project_id).await { break; }
            let adapter = adapter.clone();
            let config = config.clone();
            let progress = self.progress.clone();
            let global_perm = self.global_semaphore.clone();
            let pf_perm = pf_sem.clone();
            let pf_name = platform_name.clone();
            let rate_limits = self.rate_limits.clone();

            let handle = tokio::spawn(async move {
                let _global_guard = global_perm.acquire().await;
                let _pf_guard = pf_perm.acquire().await;

                // P1-1: Token bucket rate limiting per platform
                {
                    let mut limits = rate_limits.lock().await;
                    let min_interval = if config.rate_limit_rps > 0.0 {
                        std::time::Duration::from_secs_f64(1.0 / config.rate_limit_rps)
                    } else {
                        std::time::Duration::ZERO
                    };
                    if let Some(last) = limits.get(&pf_name) {
                        let elapsed = last.elapsed();
                        if elapsed < min_interval {
                            sleep(Duration::from_millis((min_interval - elapsed).as_millis() as u64)).await;
                        }
                    }
                    limits.insert(pf_name.clone(), std::time::Instant::now());
                }

                let start = std::time::Instant::now();
                let mut retries = 0;
                let max_retries = config.retry_count;

                loop {
                    match timeout(
                        Duration::from_millis(config.timeout_ms as u64),
                        adapter.search(&query, &config),
                    ).await {
                        Ok(Ok(search_results)) => {
                            let elapsed = start.elapsed().as_millis() as i64;
                            let result_count = search_results.len() as i32;
                            let status = if result_count == 0 {
                                SearchTaskStatus::Empty
                            } else {
                                SearchTaskStatus::Success
                            };
                            let logs = if result_count == 0 {
                                format!("No results found — adapter may need API key or query returned nothing")
                            } else {
                                format!("Retrieved {} results", result_count)
                            };
                            let tp = TaskProgress {
                                platform: pf_name.clone(),
                                query: query.clone(),
                                status,
                                count: result_count,
                                duration_ms: elapsed,
                                logs,
                                retry_count: retries,
                                results: search_results,
                            };
                            progress.lock().await.push(tp.clone());
                            return tp;
                        }
                        Ok(Err(e)) => {
                            retries += 1;
                            if retries > max_retries {
                                let tp = TaskProgress {
                                    platform: pf_name.clone(),
                                    query: query.clone(),
                                    status: SearchTaskStatus::Failed,
                                    count: 0,
                                    duration_ms: start.elapsed().as_millis() as i64,
                                    logs: e,
                                    retry_count: retries,
                                    results: Vec::new(),
                                };
                                progress.lock().await.push(tp.clone());
                                return tp;
                            }
                            let backoff_ms = 2u64.pow(retries as u32) * 1000;
                            sleep(Duration::from_millis(backoff_ms)).await;
                        }
                        Err(_) => {
                            retries += 1;
                            if retries > max_retries {
                                let tp = TaskProgress {
                                    platform: pf_name.clone(),
                                    query: query.clone(),
                                    status: SearchTaskStatus::Failed,
                                    count: 0,
                                    duration_ms: start.elapsed().as_millis() as i64,
                                    logs: "Timeout".to_string(),
                                    retry_count: retries,
                                    results: Vec::new(),
                                };
                                progress.lock().await.push(tp.clone());
                                return tp;
                            }
                        }
                    }
                }
            });
            tasks.push(handle);
        }

        let mut results = Vec::new();
        for task in tasks {
            if let Ok(tp) = task.await {
                // A5: Emit per-query task-progress event to frontend
                if let Some(ref ah) = app_handle {
                    let _ = ah.emit("task-progress", serde_json::json!({
                        "platform": tp.platform,
                        "query": tp.query,
                        "status": serde_json::to_string(&tp.status).unwrap_or_default().trim_matches('"'),
                        "count": tp.count,
                        "durationMs": tp.duration_ms,
                        "logs": tp.logs,
                        "retryCount": tp.retry_count,
                    }));
                }
                results.push(tp);
            }
        }
        results
    }
}
