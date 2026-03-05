# Changelog

All notable changes to Vokey will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- First-run onboarding wizard (#9)
- Personal dictionary with Settings editor (#8)
- History persistence via SQLite (#7)
- Release workflow for cross-platform builds
- Version bump script (`scripts/version-bump.sh`)

## [0.1.0] - 2026-03-05

### Added
- Core voice input pipeline: hotkey -> record -> STT -> LLM polish -> paste
- OpenAI Whisper STT provider
- OpenAI / Anthropic LLM providers
- macOS global shortcut support
- TOML-based configuration (`~/.vokey/config.toml`)
- CI pipeline (Rust lint/test, frontend lint/build, PR quality checks)
