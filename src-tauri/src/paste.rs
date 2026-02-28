use std::borrow::Cow;
use std::fmt;
use std::thread;
use std::time::Duration;

use arboard::Clipboard;
use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGEventType};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

#[derive(Debug)]
pub enum PasteError {
    Clipboard(arboard::Error),
    #[cfg(not(target_os = "macos"))]
    UnsupportedPlatform,
    EventSourceUnavailable,
    EventCreationFailed(&'static str),
    AccessibilityNotGranted,
}

impl fmt::Display for PasteError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Clipboard(err) => write!(f, "clipboard error: {err}"),
            #[cfg(not(target_os = "macos"))]
            Self::UnsupportedPlatform => {
                write!(f, "keyboard paste simulation is only supported on macOS")
            }
            Self::EventSourceUnavailable => write!(f, "failed to create macOS event source"),
            Self::EventCreationFailed(kind) => {
                write!(f, "failed to create macOS keyboard event: {kind}")
            }
            Self::AccessibilityNotGranted => write!(
                f,
                "macOS Accessibility permission is required to simulate Cmd+V"
            ),
        }
    }
}

impl std::error::Error for PasteError {}

impl From<arboard::Error> for PasteError {
    fn from(value: arboard::Error) -> Self {
        Self::Clipboard(value)
    }
}

#[derive(Default)]
struct ClipboardRestoreGuard {
    original_content: ClipboardContent,
}

#[derive(Default)]
enum ClipboardContent {
    #[default]
    Empty,
    Text(String),
    Image {
        width: usize,
        height: usize,
        bytes: Vec<u8>,
    },
}

impl ClipboardRestoreGuard {
    fn capture(clipboard: &mut Clipboard) -> Self {
        if let Ok(text) = clipboard.get_text() {
            return Self {
                original_content: ClipboardContent::Text(text),
            };
        }

        if let Ok(image) = clipboard.get_image() {
            return Self {
                original_content: ClipboardContent::Image {
                    width: image.width,
                    height: image.height,
                    bytes: image.bytes.into_owned(),
                },
            };
        }

        Self {
            original_content: ClipboardContent::Empty,
        }
    }

    fn restore(&self, clipboard: &mut Clipboard) {
        match &self.original_content {
            ClipboardContent::Empty => {
                if let Err(err) = clipboard.clear() {
                    log::warn!("failed to clear clipboard after paste: {err}");
                }
            }
            ClipboardContent::Text(text) => {
                if let Err(err) = clipboard.set_text(text.clone()) {
                    log::warn!("failed to restore previous clipboard text: {err}");
                }
            }
            ClipboardContent::Image {
                width,
                height,
                bytes,
            } => {
                if let Err(err) = clipboard.set_image(arboard::ImageData {
                    width: *width,
                    height: *height,
                    bytes: Cow::Borrowed(bytes),
                }) {
                    log::warn!("failed to restore previous clipboard image: {err}");
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub fn paste_text(text: &str) -> Result<(), PasteError> {
    let mut clipboard = Clipboard::new()?;
    let restore_guard = ClipboardRestoreGuard::capture(&mut clipboard);
    clipboard.set_text(text.to_string())?;

    if !is_accessibility_trusted() {
        log::error!(
            "Accessibility permission missing: grant access for this app in System Settings > Privacy & Security > Accessibility."
        );
        return Err(PasteError::AccessibilityNotGranted);
    }

    simulate_cmd_v()?;
    thread::sleep(Duration::from_millis(150));
    restore_guard.restore(&mut clipboard);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn paste_text(_text: &str) -> Result<(), PasteError> {
    Err(PasteError::UnsupportedPlatform)
}

pub fn copy_to_clipboard(text: &str) -> Result<(), PasteError> {
    let mut clipboard = Clipboard::new()?;
    clipboard.set_text(text.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn simulate_cmd_v() -> Result<(), PasteError> {
    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| PasteError::EventSourceUnavailable)?;

    let key_down = build_key_event(source.clone(), CGEventType::KeyDown)?;
    key_down.post(CGEventTapLocation::HID);

    let key_up = build_key_event(source, CGEventType::KeyUp)?;
    key_up.post(CGEventTapLocation::HID);

    Ok(())
}

#[cfg(target_os = "macos")]
fn build_key_event(source: CGEventSource, event_type: CGEventType) -> Result<CGEvent, PasteError> {
    const KEY_V: u16 = 9;
    let is_key_down = matches!(event_type, CGEventType::KeyDown);

    let event = CGEvent::new_keyboard_event(source, KEY_V, is_key_down).map_err(|_| {
        PasteError::EventCreationFailed(if is_key_down { "keydown" } else { "keyup" })
    })?;
    event.set_flags(CGEventFlags::CGEventFlagCommand);
    Ok(event)
}

#[cfg(target_os = "macos")]
fn is_accessibility_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrusted() -> bool;
}
