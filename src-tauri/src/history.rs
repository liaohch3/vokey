use std::fmt;
use std::path::PathBuf;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug)]
pub enum HistoryError {
    HomeDirNotFound,
    Io(std::io::Error),
    Sql(rusqlite::Error),
}

impl fmt::Display for HistoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HomeDirNotFound => write!(f, "home directory is not available"),
            Self::Io(err) => write!(f, "failed to access history database file: {err}"),
            Self::Sql(err) => write!(f, "history database error: {err}"),
        }
    }
}

impl std::error::Error for HistoryError {}

impl From<rusqlite::Error> for HistoryError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sql(value)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub timestamp: String,
    pub mode: String,
    pub raw_text: String,
    pub polished_text: String,
    pub stt_provider: String,
    pub llm_provider: String,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewHistoryEntry {
    pub timestamp: String,
    pub mode: String,
    pub raw_text: String,
    pub polished_text: String,
    pub stt_provider: String,
    pub llm_provider: String,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyHistoryEntry {
    pub timestamp: String,
    pub raw_text: String,
    pub polished_text: String,
}

pub fn db_path() -> Result<PathBuf, HistoryError> {
    let home = dirs::home_dir().ok_or(HistoryError::HomeDirNotFound)?;
    Ok(home.join(".vokey").join("history.db"))
}

fn connect() -> Result<Connection, HistoryError> {
    let path = db_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(HistoryError::Io)?;
    }

    let conn = Connection::open(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS transcriptions(
            id INTEGER PRIMARY KEY,
            timestamp TEXT NOT NULL,
            mode TEXT NOT NULL,
            raw_text TEXT NOT NULL,
            polished_text TEXT NOT NULL,
            stt_provider TEXT NOT NULL,
            llm_provider TEXT NOT NULL,
            duration_ms INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(conn)
}

pub fn insert_history(entry: &NewHistoryEntry) -> Result<i64, HistoryError> {
    let conn = connect()?;
    conn.execute(
        "INSERT INTO transcriptions(timestamp, mode, raw_text, polished_text, stt_provider, llm_provider, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            entry.timestamp,
            entry.mode,
            entry.raw_text,
            entry.polished_text,
            entry.stt_provider,
            entry.llm_provider,
            entry.duration_ms
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_history() -> Result<Vec<HistoryEntry>, HistoryError> {
    let conn = connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, mode, raw_text, polished_text, stt_provider, llm_provider, duration_ms
         FROM transcriptions
         ORDER BY datetime(timestamp) DESC, id DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(HistoryEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            mode: row.get(2)?,
            raw_text: row.get(3)?,
            polished_text: row.get(4)?,
            stt_provider: row.get(5)?,
            llm_provider: row.get(6)?,
            duration_ms: row.get(7)?,
        })
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

pub fn clear_history() -> Result<(), HistoryError> {
    let conn = connect()?;
    conn.execute("DELETE FROM transcriptions", [])?;
    Ok(())
}

pub fn delete_entry(id: i64) -> Result<(), HistoryError> {
    let conn = connect()?;
    conn.execute("DELETE FROM transcriptions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn import_legacy_history(entries: &[LegacyHistoryEntry]) -> Result<usize, HistoryError> {
    if entries.is_empty() {
        return Ok(0);
    }

    let mut conn = connect()?;
    let existing_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM transcriptions", [], |row| row.get(0))?;
    if existing_count > 0 {
        return Ok(0);
    }

    let tx = conn.transaction()?;
    let mut inserted = 0usize;
    for entry in entries {
        tx.execute(
            "INSERT INTO transcriptions(timestamp, mode, raw_text, polished_text, stt_provider, llm_provider, duration_ms)
             VALUES (?1, 'dictation', ?2, ?3, 'unknown', 'unknown', 0)",
            params![entry.timestamp, entry.raw_text, entry.polished_text],
        )?;
        inserted += 1;
    }
    tx.commit()?;
    Ok(inserted)
}
