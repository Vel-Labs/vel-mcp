# Vel Glasses — Video

Use this skill when the user provides a video file and asks what happens in it, when something appears, or for any temporal visual analysis.

## Tool

`glasses.video_scan` — samples frames at intervals, optionally runs per-frame locate, and produces a temporal summary via grid compositing. Always pass bounded parameters:

```
fps: 1 or 2
maxFrames: 8-16 for short clips
maxDurationSec: video length + buffer
maxBytes: 250MB default (larger rejected)
```

## What to expect

- Frames: timestamped PNG artifacts
- Events: per-frame locate results if a query is provided
- Temporal summary: VLM-generated description of what changed across frames (requires VEL_VISION_VLM_MODEL)

## Limitations

- Bounded: max 60 frames, 600s, 250MB. Not for long-form video.
- Temporal reasoning requires a general VLM. Without one, only frame manifests + locate events.
- Shorter videos (under 30s, single subject) produce better results.
- Scene-change detection is not yet implemented — sampling is interval-based.
- ffmpeg/ffprobe must be on PATH.
