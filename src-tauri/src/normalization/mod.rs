//! Normalization module — unifies heterogeneous platform data into a common format.
//! Handles URL cleaning, product name normalization, rating standardization,
//! date format unification, platform-specific field mapping, and entity disambiguation.

use crate::adapters::SearchResult;
use crate::llm::LlmProvider;

/// Clean a URL: strip tracking params, normalize domain, remove trailing slashes.
pub fn normalize_url(url: &str) -> String {
    if url.is_empty() {
        return String::new();
    }
    let cleaned = url.trim();
    // Strip common tracking params
    let cleaned = cleaned
        .split('?')
        .next()
        .unwrap_or(cleaned);
    // Strip fragments
    let cleaned = cleaned
        .split('#')
        .next()
        .unwrap_or(cleaned);
    cleaned.trim_end_matches('/').to_lowercase()
}

/// Normalize a product name to a canonical form for entity matching.
pub fn normalize_product_name(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .replace("  ", " ")
        .replace(" - ", " ")
        .replace(" | ", " ")
        .replace("–", "-")
        .replace("—", "-")
        .replace("®", "")
        .replace("™", "")
        .trim()
        .to_string()
}

/// Convert various rating scales to a 0-10 float.
pub fn normalize_rating(value: f64, scale: RatingScale) -> f64 {
    match scale {
        RatingScale::FiveStar => (value / 5.0) * 10.0,
        RatingScale::TenPoint => value,
        RatingScale::Percent => value / 10.0,
        RatingScale::HundredPercent => value / 10.0,
    }
}

#[derive(Debug, Clone, Copy)]
pub enum RatingScale {
    FiveStar,
    TenPoint,
    Percent,
    HundredPercent,
}

/// Detect rating scale from a platform name.
pub fn detect_rating_scale(platform: &str) -> RatingScale {
    match platform {
        "G2" | "G2 / Capterra" | "Capterra" => RatingScale::FiveStar,
        "App Store" | "Google Play" => RatingScale::FiveStar,
        "Product Hunt" => RatingScale::FiveStar,
        _ => RatingScale::FiveStar,
    }
}

/// Normalize date strings to "YYYY-MM-DD" format.
pub fn normalize_date(date_str: &str) -> String {
    if date_str.is_empty() {
        return String::new();
    }
    // Already in YYYY-MM-DD format?
    if date_str.len() >= 10 && date_str.chars().nth(4) == Some('-') {
        return date_str[..10].to_string();
    }
    // Try common formats
    let cleaned = date_str.trim();
    // "2024-01-15T12:00:00Z" → take date part
    if cleaned.contains('T') {
        return cleaned.split('T').next().unwrap_or(cleaned).to_string();
    }
    // "Jan 15, 2024" → try parsing
    if let Ok(dt) = chrono::NaiveDate::parse_from_str(cleaned, "%b %d, %Y") {
        return dt.format("%Y-%m-%d").to_string();
    }
    // "2024/01/15"
    if let Ok(dt) = chrono::NaiveDate::parse_from_str(cleaned, "%Y/%m/%d") {
        return dt.format("%Y-%m-%d").to_string();
    }
    // Return as-is if parsing fails
    cleaned.to_string()
}

/// Normalize a batch of search results — clean URLs, ratings, dates.
pub fn normalize_results(results: &[SearchResult], platform: &str) -> Vec<SearchResult> {
    let scale = detect_rating_scale(platform);
    results.iter().map(|r| {
        SearchResult {
            title: r.title.clone(),
            url: normalize_url(&r.url),
            summary: r.summary.clone(),
            rating: r.rating.map(|v| normalize_rating(v, scale)),
            review_count: r.review_count,
            date: r.date.as_ref().map(|d| normalize_date(d)),
            author: r.author.clone(),
            platform: r.platform.clone(),
            content_text: r.content_text.clone(),
        }
    }).collect()
}

/// Cluster similar product names to detect duplicates across platforms.
pub fn deduplicate_names(names: &[String]) -> Vec<Vec<String>> {
    let mut clusters: Vec<Vec<String>> = Vec::new();
    for name in names {
        let normalized = normalize_product_name(name);
        let mut found = false;
        for cluster in &mut clusters {
            if cluster.iter().any(|n| {
                let a = normalize_product_name(n);
                let b = &normalized;
                // Simple overlap: one contains the other or share significant tokens
                a.contains(b.as_str()) || b.contains(a.as_str())
                    || levenshtein_similarity(&a, b) > 0.7
            }) {
                cluster.push(name.clone());
                found = true;
                break;
            }
        }
        if !found {
            clusters.push(vec![name.clone()]);
        }
    }
    clusters
}

/// Simple Levenshtein similarity ratio (0.0–1.0).
fn levenshtein_similarity(a: &str, b: &str) -> f64 {
    let dist = levenshtein_distance(a, b) as f64;
    let max_len = a.len().max(b.len()) as f64;
    if max_len == 0.0 { 1.0 } else { 1.0 - dist / max_len }
}

fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let n = a_chars.len();
    let m = b_chars.len();
    let mut d = vec![vec![0usize; m + 1]; n + 1];
    for i in 0..=n { d[i][0] = i; }
    for j in 0..=m { d[0][j] = j; }
    for i in 1..=n {
        for j in 1..=m {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            d[i][j] = (d[i - 1][j] + 1).min(d[i][j - 1] + 1).min(d[i - 1][j - 1] + cost);
        }
    }
    d[n][m]
}

/// P2-2: LLM-assisted entity disambiguation.
/// Given a list of candidate product names, ask the LLM to merge variants
/// of the same product and split distinct products with similar names.
/// Falls back to string-similarity deduplication on LLM failure.
pub async fn try_llm_deduplicate_entities(names: &[String]) -> Vec<Vec<String>> {
    if names.len() <= 1 {
        return if names.is_empty() { vec![] } else { vec![names.to_vec()] };
    }

    match crate::llm::deepseek::DeepSeekProvider::from_env() {
        Ok(llm) => {
            let items: Vec<String> = names.iter().enumerate()
                .map(|(i, n)| format!("[{}] {}", i, n))
                .collect();
            let sys = crate::llm::json_system_prompt(
                r#"{"clusters":[{"canonical":"main product name","indices":[0,1,2]}]}"#
            );
            let prompt = format!(
                "Group these product names by entity. Variants of the SAME product (e.g. 'Notion', 'notion.so', 'Notion App') \
                should be merged into one cluster. DIFFERENT products (e.g. 'Notion' vs 'Notion AI' if they are separate) \
                should be in separate clusters. For each cluster, pick the shortest cleanest name as canonical.\n\n\
                Product names:\n{}",
                items.join("\n")
            );
            match llm.structured::<serde_json::Value>(&sys, &prompt).await {
                Ok(val) => {
                    if let Some(clusters) = val["clusters"].as_array() {
                        let mut result: Vec<Vec<String>> = Vec::new();
                        let mut assigned: std::collections::HashSet<usize> = std::collections::HashSet::new();
                        for cluster in clusters {
                            let indices: Vec<usize> = cluster["indices"].as_array()
                                .map(|a| a.iter().filter_map(|v| v.as_u64().map(|n| n as usize)).collect())
                                .unwrap_or_default();
                            let cluster_names: Vec<String> = indices.iter()
                                .filter_map(|&i| names.get(i).cloned())
                                .collect();
                            if !cluster_names.is_empty() {
                                for &i in &indices { assigned.insert(i); }
                                result.push(cluster_names);
                            }
                        }
                        // Add any unassigned names as individual clusters
                        for (i, name) in names.iter().enumerate() {
                            if !assigned.contains(&i) {
                                result.push(vec![name.clone()]);
                            }
                        }
                        if !result.is_empty() {
                            log::info!("LLM entity disambiguation: {} names → {} clusters", names.len(), result.len());
                            return result;
                        }
                    }
                }
                Err(e) => log::warn!("LLM entity dedup failed, falling back to rules: {}", e),
            }
        }
        Err(e) => log::warn!("DeepSeek unavailable for entity dedup, using rules: {}", e),
    }
    // Fallback to string similarity
    deduplicate_names(names)
}
