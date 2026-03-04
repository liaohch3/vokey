use std::fmt;
use std::fs;
use std::path::PathBuf;

#[derive(Debug)]
pub enum DictionaryError {
    HomeDirNotFound,
    Io(std::io::Error),
}

impl fmt::Display for DictionaryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HomeDirNotFound => write!(f, "home directory is not available"),
            Self::Io(err) => write!(f, "failed to access dictionary file: {err}"),
        }
    }
}

impl std::error::Error for DictionaryError {}

pub fn dictionary_path() -> Result<PathBuf, DictionaryError> {
    let home = dirs::home_dir().ok_or(DictionaryError::HomeDirNotFound)?;
    Ok(home.join(".vokey").join("dictionary.txt"))
}

pub fn load_dictionary_text() -> Result<String, DictionaryError> {
    let path = dictionary_path()?;
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(DictionaryError::Io)
}

pub fn save_dictionary_text(content: &str) -> Result<(), DictionaryError> {
    let path = dictionary_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(DictionaryError::Io)?;
    }

    fs::write(path, content).map_err(DictionaryError::Io)
}

pub fn parse_dictionary_terms(content: &str) -> Vec<String> {
    let mut terms = Vec::<String>::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let candidate = if let Some((_, corrected)) = trimmed.split_once("->") {
            corrected.trim()
        } else {
            trimmed
        };

        if candidate.is_empty() {
            continue;
        }

        let candidate_owned = candidate.to_string();
        if !terms.contains(&candidate_owned) {
            terms.push(candidate_owned);
        }
    }
    terms
}
