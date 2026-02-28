use std::fmt;
use std::io::Cursor;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SampleRate, Stream, StreamConfig, SupportedStreamConfigRange};

const TARGET_SAMPLE_RATE: u32 = 16_000;
const TARGET_CHANNELS: u16 = 1;

#[derive(Debug)]
pub enum AudioError {
    AlreadyRecording,
    NotRecording,
    NoInputDevice,
    DefaultInputConfig(cpal::DefaultStreamConfigError),
    SupportedInputConfigs(cpal::SupportedStreamConfigsError),
    BuildStream(cpal::BuildStreamError),
    PlayStream(cpal::PlayStreamError),
    BufferLock,
    EncodeWav(hound::Error),
}

impl fmt::Display for AudioError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AlreadyRecording => write!(f, "audio recorder is already recording"),
            Self::NotRecording => write!(f, "audio recorder is not recording"),
            Self::NoInputDevice => write!(f, "no default input audio device is available"),
            Self::DefaultInputConfig(err) => {
                write!(f, "failed to query default input config: {err}")
            }
            Self::SupportedInputConfigs(err) => {
                write!(f, "failed to query supported input configs: {err}")
            }
            Self::BuildStream(err) => write!(f, "failed to build input stream: {err}"),
            Self::PlayStream(err) => write!(f, "failed to start input stream: {err}"),
            Self::BufferLock => write!(f, "failed to lock recorder buffer"),
            Self::EncodeWav(err) => write!(f, "failed to encode WAV buffer: {err}"),
        }
    }
}

impl std::error::Error for AudioError {}

struct ActiveRecording {
    stream: Stream,
    samples: Arc<Mutex<Vec<i16>>>,
    input_sample_rate: u32,
}

#[derive(Default)]
pub struct AudioRecorder {
    active: Option<ActiveRecording>,
}

impl AudioRecorder {
    pub fn start_recording(&mut self) -> Result<(), AudioError> {
        if self.active.is_some() {
            return Err(AudioError::AlreadyRecording);
        }

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or(AudioError::NoInputDevice)?;

        let (stream_config, sample_format) = select_stream_config(&device)?;
        let samples = Arc::new(Mutex::new(Vec::new()));

        let stream =
            build_input_stream(&device, &stream_config, sample_format, Arc::clone(&samples))?;
        stream.play().map_err(AudioError::PlayStream)?;

        self.active = Some(ActiveRecording {
            stream,
            samples,
            input_sample_rate: stream_config.sample_rate.0,
        });

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<Vec<u8>, AudioError> {
        let active = self.active.take().ok_or(AudioError::NotRecording)?;

        // Dropping the stream stops audio capture before we encode.
        let ActiveRecording {
            stream,
            samples,
            input_sample_rate,
        } = active;
        drop(stream);

        let recorded_samples = {
            let guard = samples.lock().map_err(|_| AudioError::BufferLock)?;
            guard.clone()
        };

        let normalized_samples = if input_sample_rate == TARGET_SAMPLE_RATE {
            recorded_samples
        } else {
            resample_linear(&recorded_samples, input_sample_rate, TARGET_SAMPLE_RATE)
        };

        encode_wav_mono_16k(&normalized_samples)
    }

    #[cfg(test)]
    pub fn push_silence_for_test(&mut self, duration_secs: u32) -> Result<(), AudioError> {
        let active = self.active.as_ref().ok_or(AudioError::NotRecording)?;
        let silence_samples = (TARGET_SAMPLE_RATE * duration_secs) as usize;
        let mut guard = active.samples.lock().map_err(|_| AudioError::BufferLock)?;
        guard.extend(std::iter::repeat_n(0_i16, silence_samples));
        Ok(())
    }
}

fn select_stream_config(device: &cpal::Device) -> Result<(StreamConfig, SampleFormat), AudioError> {
    let mut supported = device
        .supported_input_configs()
        .map_err(AudioError::SupportedInputConfigs)?;

    let preferred = supported.find_map(|config| choose_target_rate(config, TARGET_SAMPLE_RATE));
    if let Some((config, sample_format)) = preferred {
        return Ok((config, sample_format));
    }

    let default = device
        .default_input_config()
        .map_err(AudioError::DefaultInputConfig)?;
    Ok((default.config(), default.sample_format()))
}

fn choose_target_rate(
    config: SupportedStreamConfigRange,
    target_rate: u32,
) -> Option<(StreamConfig, SampleFormat)> {
    if config.channels() != TARGET_CHANNELS {
        return None;
    }

    if config.min_sample_rate().0 <= target_rate && config.max_sample_rate().0 >= target_rate {
        let with_rate = config.with_sample_rate(SampleRate(target_rate));
        return Some((with_rate.config(), with_rate.sample_format()));
    }

    None
}

fn build_input_stream(
    device: &cpal::Device,
    stream_config: &StreamConfig,
    sample_format: SampleFormat,
    samples: Arc<Mutex<Vec<i16>>>,
) -> Result<Stream, AudioError> {
    let channels = stream_config.channels as usize;
    let err_handler = |err| {
        log::error!("audio input stream error: {err}");
    };

    match sample_format {
        SampleFormat::I16 => device
            .build_input_stream(
                stream_config,
                move |data: &[i16], _| push_input_samples(data, channels, &samples),
                err_handler,
                None,
            )
            .map_err(AudioError::BuildStream),
        SampleFormat::U16 => device
            .build_input_stream(
                stream_config,
                move |data: &[u16], _| push_input_samples(data, channels, &samples),
                err_handler,
                None,
            )
            .map_err(AudioError::BuildStream),
        SampleFormat::F32 => device
            .build_input_stream(
                stream_config,
                move |data: &[f32], _| push_input_samples(data, channels, &samples),
                err_handler,
                None,
            )
            .map_err(AudioError::BuildStream),
        _ => Err(AudioError::BuildStream(
            cpal::BuildStreamError::StreamConfigNotSupported,
        )),
    }
}

fn push_input_samples<T>(input: &[T], channels: usize, samples: &Arc<Mutex<Vec<i16>>>)
where
    T: cpal::Sample + cpal::SizedSample,
    i16: cpal::FromSample<T>,
{
    let mut guard = match samples.lock() {
        Ok(guard) => guard,
        Err(_) => {
            log::error!("audio sample buffer lock poisoned");
            return;
        }
    };

    for frame in input.chunks(channels.max(1)) {
        guard.push(frame[0].to_sample::<i16>());
    }
}

fn resample_linear(input: &[i16], input_rate: u32, output_rate: u32) -> Vec<i16> {
    if input.is_empty() || input_rate == output_rate {
        return input.to_vec();
    }

    let output_len = ((input.len() as u64) * (output_rate as u64) / (input_rate as u64)) as usize;
    let ratio = input_rate as f64 / output_rate as f64;

    let mut output = Vec::with_capacity(output_len);
    for index in 0..output_len {
        let src_pos = index as f64 * ratio;
        let left = src_pos.floor() as usize;
        let right = (left + 1).min(input.len().saturating_sub(1));
        let frac = src_pos - left as f64;

        let left_sample = input[left] as f64;
        let right_sample = input[right] as f64;
        let interpolated = left_sample + (right_sample - left_sample) * frac;
        output.push(interpolated.round() as i16);
    }

    output
}

fn encode_wav_mono_16k(samples: &[i16]) -> Result<Vec<u8>, AudioError> {
    let spec = hound::WavSpec {
        channels: TARGET_CHANNELS,
        sample_rate: TARGET_SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec).map_err(AudioError::EncodeWav)?;
        for sample in samples {
            writer
                .write_sample(*sample)
                .map_err(AudioError::EncodeWav)?;
        }
        writer.finalize().map_err(AudioError::EncodeWav)?;
    }

    Ok(cursor.into_inner())
}

#[cfg(test)]
mod tests {
    use super::AudioRecorder;

    #[test]
    fn audio_recorder_returns_valid_wav_header() {
        let mut recorder = AudioRecorder::default();

        if recorder.start_recording().is_err() {
            // Environments without input devices cannot run this hardware-bound path.
            return;
        }

        recorder
            .push_silence_for_test(1)
            .expect("failed to add silence");
        let wav = recorder.stop_recording().expect("failed to stop recorder");

        assert!(wav.len() > 44);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        assert_eq!(&wav[12..16], b"fmt ");

        let channels = u16::from_le_bytes([wav[22], wav[23]]);
        let sample_rate = u32::from_le_bytes([wav[24], wav[25], wav[26], wav[27]]);
        let bits_per_sample = u16::from_le_bytes([wav[34], wav[35]]);

        assert_eq!(channels, 1);
        assert_eq!(sample_rate, 16_000);
        assert_eq!(bits_per_sample, 16);
    }
}

/// Request microphone permission on macOS.
/// Must be called before any cpal operations.
#[cfg(target_os = "macos")]
pub fn request_microphone_permission() {
    use std::process::Command;
    // Use a tiny Swift snippet via osascript to trigger the permission dialog
    let _ = Command::new("osascript")
        .args([
            "-e",
            r#"do shell script "swift -e 'import AVFoundation; AVCaptureDevice.requestAccess(for: .audio) { _ in }; Thread.sleep(forTimeInterval: 1)'"#,
        ])
        .output();
}

#[cfg(not(target_os = "macos"))]
pub fn request_microphone_permission() {}
