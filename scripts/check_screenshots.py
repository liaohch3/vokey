#!/usr/bin/env python3
"""截图质量检查 — 用于 PR 证据图片。"""

from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

MIN_DESKTOP_WIDTH = 1280
MIN_DIMENSION = 400
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def iter_image_files(paths: list[Path]) -> list[Path]:
    files: set[Path] = set()
    for path in paths:
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.add(path)
        elif path.is_dir():
            for child in path.rglob("*"):
                if child.is_file() and child.suffix.lower() in SUPPORTED_EXTENSIONS:
                    files.add(child)
    return sorted(files)


def parse_png_dimensions(raw: bytes) -> tuple[int, int]:
    if not raw.startswith(b"\x89PNG\r\n\x1a\n") or raw[12:16] != b"IHDR":
        raise ValueError("not a PNG")
    w, h = struct.unpack(">II", raw[16:24])
    return w, h


def parse_jpeg_dimensions(raw: bytes) -> tuple[int, int]:
    if len(raw) < 4 or raw[0:2] != b"\xff\xd8":
        raise ValueError("not a JPEG")
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    i = 2
    while i + 9 < len(raw):
        if raw[i] != 0xFF:
            i += 1
            continue
        marker = raw[i + 1]
        i += 2
        if marker in sof and i + 7 <= len(raw):
            h, w = struct.unpack(">HH", raw[i + 3 : i + 7])
            return w, h
        if i + 2 <= len(raw):
            seg_len = struct.unpack(">H", raw[i : i + 2])[0]
            i += seg_len
    raise ValueError("could not parse JPEG dimensions")


def get_dimensions(raw: bytes, ext: str) -> tuple[int, int]:
    ext = ext.lower()
    if ext == ".png":
        return parse_png_dimensions(raw)
    if ext in {".jpg", ".jpeg"}:
        return parse_jpeg_dimensions(raw)
    if ext == ".gif" and len(raw) >= 10:
        w, h = struct.unpack("<HH", raw[6:10])
        return w, h
    raise ValueError(f"unsupported: {ext}")


def check_file(path: Path) -> tuple[str, str]:
    """返回 (status, message)。status: PASS / WARN / FAIL"""
    try:
        raw = path.read_bytes()
    except OSError as e:
        return "FAIL", f"cannot read ({e})"

    if len(raw) > MAX_FILE_SIZE_BYTES:
        return "WARN", f"large file ({len(raw) / 1024 / 1024:.1f}MB)"

    try:
        w, h = get_dimensions(raw, path.suffix)
    except ValueError as e:
        return "FAIL", str(e)

    issues: list[str] = []
    if w < MIN_DIMENSION or h < MIN_DIMENSION:
        issues.append(f"too small ({w}x{h}, min {MIN_DIMENSION})")
    if w < MIN_DESKTOP_WIDTH:
        issues.append(f"narrow viewport ({w}px < {MIN_DESKTOP_WIDTH}px)")

    if issues:
        return "WARN", f"{w}x{h}: {'; '.join(issues)}"
    return "PASS", f"{w}x{h}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args(argv)

    files = iter_image_files(args.paths)
    if not files:
        print("[WARN] No image files found")
        return 0

    fail = 0
    for f in files:
        status, msg = check_file(f)
        print(f"[{status}] {f}: {msg}")
        if status == "FAIL":
            fail += 1

    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
