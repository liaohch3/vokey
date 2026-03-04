#!/usr/bin/env python3
"""Headless UI screenshots with macOS window chrome overlay.

Takes screenshots via Playwright (headless, zero mouse interference),
then composites a macOS-style title bar on top.

Usage:
    python3 scripts/screenshot-headless.py [--out DIR] [--url URL] [--no-chrome]

Requires: playwright, Pillow
"""

import argparse
import math
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ Pillow not installed: pip install Pillow")
    sys.exit(1)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("❌ playwright not installed: pip install playwright && playwright install chromium")
    sys.exit(1)


VIEWPORT = {"width": 900, "height": 620}
TITLE_BAR_HEIGHT = 28
CORNER_RADIUS = 10
BG_COLOR = (30, 30, 30)  # Dark title bar
TITLE_TEXT = "Vokey"

PAGES = [
    {"name": "home", "click": None},
    {"name": "history", "click": "History"},
    {"name": "settings", "click": "Settings"},
]


def add_macos_chrome(screenshot_path: Path, output_path: Path):
    """Add macOS-style window chrome (title bar + traffic lights) to a screenshot."""
    img = Image.open(screenshot_path)
    w, h = img.size

    # Create new image with title bar
    total_h = h + TITLE_BAR_HEIGHT
    result = Image.new("RGBA", (w, total_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(result)

    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [(0, 0), (w - 1, total_h - 1)],
        radius=CORNER_RADIUS,
        fill=BG_COLOR,
    )

    # Draw title bar
    draw.rectangle([(0, 0), (w, TITLE_BAR_HEIGHT)], fill=(38, 38, 38))
    # Round top corners
    draw.rounded_rectangle(
        [(0, 0), (w - 1, TITLE_BAR_HEIGHT + CORNER_RADIUS)],
        radius=CORNER_RADIUS,
        fill=(38, 38, 38),
    )
    draw.rectangle(
        [(0, CORNER_RADIUS), (w, TITLE_BAR_HEIGHT)],
        fill=(38, 38, 38),
    )

    # Traffic lights
    lights = [
        (20, TITLE_BAR_HEIGHT // 2, (255, 95, 86)),   # Close (red)
        (40, TITLE_BAR_HEIGHT // 2, (255, 189, 46)),   # Minimize (yellow)
        (60, TITLE_BAR_HEIGHT // 2, (39, 201, 63)),    # Maximize (green)
    ]
    for x, y, color in lights:
        draw.ellipse([(x - 6, y - 6), (x + 6, y + 6)], fill=color)

    # Title text
    try:
        font = ImageFont.truetype("/System/Library/Fonts/SFNSText.ttf", 13)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
        except (OSError, IOError):
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), TITLE_TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    draw.text(
        ((w - text_w) // 2, (TITLE_BAR_HEIGHT - 13) // 2),
        TITLE_TEXT,
        fill=(200, 200, 200),
        font=font,
    )

    # Paste screenshot below title bar
    result.paste(img, (0, TITLE_BAR_HEIGHT))

    # Add subtle shadow/border
    # (just a 1px border for now)
    border_draw = ImageDraw.Draw(result)
    border_draw.rounded_rectangle(
        [(0, 0), (w - 1, total_h - 1)],
        radius=CORNER_RADIUS,
        outline=(60, 60, 60),
        width=1,
    )

    result.save(output_path, "PNG")


def ensure_vite_running(project_root: Path) -> str:
    """Ensure Vite dev server is running, return URL."""
    import socket

    url = "http://127.0.0.1:5173"
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.connect(("127.0.0.1", 5173))
        sock.close()
        return url
    except ConnectionRefusedError:
        pass

    # Start Vite
    print("📦 Starting Vite dev server...")
    subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=project_root / "frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    import time
    for _ in range(20):
        time.sleep(1)
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect(("127.0.0.1", 5173))
            sock.close()
            return url
        except ConnectionRefusedError:
            continue
    print("❌ Vite dev server failed to start")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Headless screenshots with macOS chrome")
    parser.add_argument("--out", default="docs/screenshots", help="Output directory")
    parser.add_argument("--url", default=None, help="Frontend URL (default: auto-detect)")
    parser.add_argument("--no-chrome", action="store_true", help="Skip macOS window chrome overlay")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    out_dir = project_root / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    url = args.url or ensure_vite_running(project_root)
    print(f"🌐 Using frontend at {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-proxy-server"])
        page = browser.new_page(viewport=VIEWPORT)

        for spec in PAGES:
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(1500)

            if spec["click"]:
                page.click(f"text={spec['click']}")
                page.wait_for_timeout(800)

            raw_path = out_dir / f"_raw_{spec['name']}.png"
            final_path = out_dir / f"desktop-{spec['name']}.png"

            page.screenshot(path=str(raw_path))

            if args.no_chrome:
                raw_path.rename(final_path)
            else:
                add_macos_chrome(raw_path, final_path)
                raw_path.unlink()

            print(f"📸 {final_path}")

        page.close()
        browser.close()

    print(f"\n✅ {len(PAGES)} screenshots saved to {out_dir}/")


if __name__ == "__main__":
    main()
