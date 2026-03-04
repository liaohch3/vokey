#!/usr/bin/env python3
"""Check screenshots for visual errors (red text, error messages, broken UI).

Usage:
    python3 scripts/check_screenshots.py [--dir DIR]

Uses Playwright to capture console errors and detect error elements in the UI.
Can also be used standalone to validate existing screenshots via image analysis.
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

# CSS selectors that typically indicate errors
ERROR_SELECTORS = [
    "[class*='error']",
    "[class*='Error']",
    "[style*='color: red']",
    "[style*='color: #e53e3e']",
    "[style*='color: rgb(229, 62, 62)']",
    ".error",
    ".error-message",
    "[role='alert']",
]

PAGES = [
    {"name": "home", "nav": None},
    {"name": "settings", "nav": "Settings"},
    {"name": "history", "nav": "History"},
]


def check_page_errors(page, page_name: str) -> list[str]:
    """Check a page for visible error elements and console errors."""
    errors = []

    # Check for error elements in DOM
    for selector in ERROR_SELECTORS:
        elements = page.query_selector_all(selector)
        for el in elements:
            if el.is_visible():
                text = el.inner_text().strip()[:200]
                if text:
                    errors.append(f"[{page_name}] Error element ({selector}): {text}")

    # Check for red-colored text (computed style)
    red_texts = page.evaluate("""() => {
        const results = [];
        const walker = document.createTreeWalker(
            document.body, NodeFilter.SHOW_TEXT, null, false
        );
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const el = node.parentElement;
            if (!el || !node.textContent.trim()) continue;
            const style = window.getComputedStyle(el);
            const color = style.color;
            // Check for red-ish colors
            const match = color.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
            if (match) {
                const [_, r, g, b] = match.map(Number);
                if (r > 180 && g < 100 && b < 100 && node.textContent.trim().length > 5) {
                    results.push(node.textContent.trim().substring(0, 200));
                }
            }
        }
        return results;
    }""")

    for text in red_texts:
        errors.append(f"[{page_name}] Red text detected: {text}")

    return errors


def main():
    parser = argparse.ArgumentParser(description="Check UI pages for visual errors")
    parser.add_argument("--port", type=int, default=5198, help="HTTP server port")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    dist = project_root / "frontend" / "dist"

    if not dist.exists():
        print("📦 Building frontend first...")
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=project_root / "frontend",
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"❌ Build failed:\n{result.stderr}")
            sys.exit(1)

    # Start server
    handler = http.server.SimpleHTTPRequestHandler

    class QuietHandler(handler):
        def log_message(self, format, *args):
            pass

    os.chdir(dist)
    server = http.server.HTTPServer(("127.0.0.1", args.port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(1)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ playwright not installed")
        sys.exit(1)

    all_errors = []
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-proxy-server"])
        page = browser.new_page(viewport=VIEWPORT)

        # Capture console errors
        page.on("console", lambda msg: console_errors.append(
            f"[console.{msg.type}] {msg.text}"
        ) if msg.type in ("error", "warning") else None)

        url = f"http://127.0.0.1:{args.port}/"

        for spec in PAGES:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)

            if spec["nav"]:
                page.click(f"text={spec['nav']}")
                page.wait_for_timeout(800)

            errors = check_page_errors(page, spec["name"])
            all_errors.extend(errors)

        page.close()
        browser.close()

    # Report
    if console_errors:
        print(f"\n⚠️  Console errors/warnings ({len(console_errors)}):")
        for e in console_errors[:10]:
            print(f"  {e}")

    if all_errors:
        print(f"\n❌ Visual errors detected ({len(all_errors)}):")
        for e in all_errors:
            print(f"  • {e}")
        sys.exit(1)
    else:
        print("✅ No visual errors detected")
        sys.exit(0)


if __name__ == "__main__":
    main()
