#!/usr/bin/env python3
"""Automated UI screenshot capture for Vokey.

Usage:
    python3 scripts/screenshot.py [--out DIR] [--port PORT]

Builds the frontend, serves it via Python's http.server, then uses
Playwright headless Chromium to capture key pages.
"""

import argparse
import http.server
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

VIEWPORT = {"width": 1280, "height": 900}
PAGES = [
    {"name": "home", "nav": None, "scroll_to": None},
    {"name": "settings-full", "nav": "Settings", "scroll_to": None},
    {"name": "settings-stt", "nav": "Settings", "scroll_to": "STT Provider"},
    {"name": "settings-llm", "nav": "Settings", "scroll_to": "LLM Provider"},
]


def build_frontend(project_root: Path) -> Path:
    """Run npm build and return dist directory."""
    frontend = project_root / "frontend"
    print("📦 Building frontend...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=frontend,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"❌ Build failed:\n{result.stderr}")
        sys.exit(1)
    dist = frontend / "dist"
    if not dist.exists():
        print("❌ dist/ directory not found after build")
        sys.exit(1)
    print("✅ Build complete")
    return dist


def start_server(dist: Path, port: int) -> threading.Thread:
    """Start a background HTTP server serving dist/."""
    handler = http.server.SimpleHTTPRequestHandler

    class QuietHandler(handler):
        def log_message(self, format, *args):
            pass  # suppress logs

    os.chdir(dist)
    server = http.server.HTTPServer(("127.0.0.1", port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    # Wait for server to be ready
    time.sleep(1)
    return thread


def capture_screenshots(port: int, out_dir: Path):
    """Use Playwright to capture screenshots."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ playwright not installed. Run: pip install playwright && playwright install chromium")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    url = f"http://127.0.0.1:{port}/"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-proxy-server"])
        page = browser.new_page(viewport=VIEWPORT)

        for spec in PAGES:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1500)

            # Navigate if needed
            if spec["nav"]:
                page.click(f"text={spec['nav']}")
                page.wait_for_timeout(800)

            # Scroll to element if needed
            if spec["scroll_to"]:
                el = page.query_selector(f"text={spec['scroll_to']}")
                if el:
                    el.scroll_into_view_if_needed()
                    page.wait_for_timeout(500)

            out_path = out_dir / f"{spec['name']}.png"
            if spec["scroll_to"]:
                page.screenshot(path=str(out_path))
            elif spec["nav"]:
                page.screenshot(path=str(out_path), full_page=True)
            else:
                page.screenshot(path=str(out_path))

            print(f"📸 {out_path}")

        page.close()
        browser.close()

    print(f"\n✅ {len(PAGES)} screenshots saved to {out_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Capture Vokey UI screenshots")
    parser.add_argument("--out", default="docs/screenshots", help="Output directory")
    parser.add_argument("--port", type=int, default=5199, help="HTTP server port")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    out_dir = project_root / args.out

    dist = build_frontend(project_root)
    start_server(dist, args.port)
    capture_screenshots(args.port, out_dir)


if __name__ == "__main__":
    main()
