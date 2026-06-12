# NVIDIA Eagle / LocateAnything integration notes

## Purpose in VEL

LocateAnything is the preferred first real provider for `vel-glasses-mcp` because it is designed for grounding/localization rather than only captioning. It should power:

- `glasses.locate`
- `glasses.ocr` text localization mode
- `glasses.inspect_region`
- GUI element grounding
- dense object detection
- point-based localization

## Source locations

- Repo: `https://github.com/NVlabs/Eagle`
- LocateAnything README path: `Embodied/README.md`
- Model: `https://huggingface.co/nvidia/LocateAnything-3B`
- Project page: `https://research.nvidia.com/labs/lpr/locate-anything/`

## Capabilities to map into VEL

LocateAnything documentation describes support for:

- referring-expression grounding
- multi-object detection
- GUI element grounding
- text/OCR localization
- document/layout grounding
- point-based localization

## Installation contract for VEL

VEL should not vendor the Eagle repo. The user should install it separately:

```bash
git clone https://github.com/NVlabs/Eagle.git eagle
cd eagle/Embodied
pip install -e .
```

Then configure:

```yaml
modules:
  glasses:
    providers:
      locate-anything:
        enabled: true
        repoPath: "/absolute/path/to/eagle/Embodied"
        model: "nvidia/LocateAnything-3B"
        python: "python"
        attnImplementation: "sdpa"
```

## Worker API functions to call

The README quick start references a `LocateAnythingWorker` class with methods:

```python
worker.detect(img, ["person", "car"])
worker.ground_multi(img, "people wearing red shirts")
worker.detect_text(img)
worker.ground_gui(img, "the search button", output_type="point")
worker.point(img, "the traffic light")
```

VEL maps these to provider operations:

| VEL op | LocateAnything worker method |
|---|---|
| `detect` | `detect` |
| `locate` with phrase/object | `ground_multi` |
| `ocr` region/text localization | `detect_text` |
| `locate` with `targetType=gui` | `ground_gui` |
| `locate` with `outputType=point` | `point` or `ground_gui(..., output_type="point")` |

## Output parsing

LocateAnything outputs special tokens:

```text
<ref>label</ref><box><x1><y1><x2><y2></box>
<box><x><y></box>
<box>none</box>
```

Coordinates are integer tokens in `[0, 1000]`. VEL should preserve the normalized coordinates and compute pixels when image dimensions are known.

## Hardware notes

- Start with `attnImplementation: sdpa` as conservative default.
- MagiAttention is intended for Hopper/Blackwell long-context setups.
- For non-Hopper/Blackwell GPUs, the Eagle README notes SDPA fallback with shorter sequence support.

## License note

The Hugging Face model card says LocateAnything-3B is non-commercial and intended for academic/non-profit research use. VEL should:

- not download it automatically without explicit confirmation;
- not bundle weights;
- mark provider config as `licenseMode: non-commercial-research-only`;
- allow alternate commercial providers through the same provider contract.

## MVP integration plan

1. Implement parser and mock tests.
2. Implement Python JSONL worker with import-time dependency detection.
3. Implement Node provider that talks to the worker.
4. Add setup validation: repo path exists, worker import succeeds, model available.
5. Add evals for GUI grounding and OCR localization.
