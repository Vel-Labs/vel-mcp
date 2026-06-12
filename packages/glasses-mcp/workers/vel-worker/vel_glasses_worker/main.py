from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

_worker: Any | None = None
FAKE_MODE = os.environ.get("FAKE_WORKER_MODE")


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def respond(request_id: str, ok: bool, result: Any = None, error: dict[str, Any] | None = None) -> None:
    print(json.dumps({"id": request_id, "ok": ok, "result": result, "error": error}, ensure_ascii=False), flush=True)


def load_worker() -> Any:
    global _worker
    if _worker is not None:
        return _worker

    import mlx.core as mx
    from mlx_vlm import load, generate

    model_id = os.environ.get("VEL_VISION_MODEL", "mlx-community/LocateAnything-3B-bf16")
    log(f"Loading model: {model_id}")

    try:
        model, processor = load(model_id, trust_remote_code=True)
    except Exception as exc:
        raise RuntimeError(
            f"Could not load model {model_id} via mlx-vlm. "
            f"Install mlx-vlm>=0.6.2: pip install 'mlx-vlm>=0.6.2' huggingface_hub"
        ) from exc

    class MLXVisionWorker:
        def __init__(self, model: Any, processor: Any) -> None:
            self.model = model
            self.processor = processor

        def _run(self, image: Any, prompt_text: str, max_tokens: int = 256) -> str:
            prompt = self.processor.apply_chat_template(
                [{"role": "user", "content": [
                    {"type": "image"},
                    {"type": "text", "text": prompt_text},
                ]}],
                add_generation_prompt=True,
            )
            result = generate(
                self.model, self.processor, prompt,
                image=image, max_tokens=max_tokens, temp=0.0, verbose=False,
            )
            return result.text if hasattr(result, "text") else str(result)

        # --- Grounding ops (LocateAnything — uses "detect:" / "point:" prefix) ---

        def ground_multi(self, image: Any, query: str) -> str:
            return self._run(image, f"detect: {query}")

        def ground_gui(self, image: Any, query: str, output_type: str = "box") -> str:
            return self._run(image, f"detect: {query}")

        def point(self, image: Any, query: str) -> str:
            return self._run(image, f"point: {query}")

        def detect_text(self, image: Any) -> str:
            return self._run(image, "detect: all text in this image")

        def detect(self, image: Any, labels: list[str]) -> str:
            return self._run(image, f"detect: {', '.join(labels)}")

        # --- VLM ops (Qwen3-VL — natural language prompts, no prefix) ---

        def describe(self, image: Any, prompt: str, max_tokens: int = 512) -> str:
            return self._run(image, prompt, max_tokens=max_tokens)

        def ask(self, image: Any, question: str, max_tokens: int = 512) -> str:
            return self._run(image, question, max_tokens=max_tokens)

    _worker = MLXVisionWorker(model, processor)
    return _worker


def open_image(image_ref: dict[str, Any]) -> Any:
    from PIL import Image
    kind = image_ref.get("kind")
    value = image_ref.get("value")
    if kind != "file_path":
        raise ValueError(f"LocateAnything worker MVP only supports file_path images, got {kind!r}")
    path = Path(value).expanduser().resolve()
    return Image.open(path).convert("RGB")


def handle_fake(request: dict[str, Any]) -> dict[str, Any]:
    op = request.get("op", "")
    query = request.get("query") or ""

    if op == "health":
        return {"status": "ok", "model": "fake-vision-model"}

    timing_ms = 1

    if op == "detect_text":
        answer = (
            '<ref>Search</ref><box><700><80><940><150></box>'
            '<ref>Submit</ref><box><700><820><940><900></box>'
            '<ref>Cancel</ref><box><500><820><680><900></box>'
        )
    elif op in ("ground_gui", "ground_multi"):
        answer = f'<ref>{query or "button"}</ref><box><700><80><940><150></box>'
    elif op == "point":
        answer = f'<ref>{query or "point"}</ref><box><500><500></box>'
    elif op == "detect":
        answer = '<ref>detected</ref><box><100><100><400><400></box>'
    elif op == "inspect":
        answer = (
            '<ref>Search</ref><box><700><80><940><150></box>'
            '<ref>Submit</ref><box><700><820><940><900></box>'
            '<ref>Cancel</ref><box><500><820><680><900></box>'
        )
    elif op == "describe":
        detail = request.get("detail", "medium")
        answer = f"[FAKE VLM] Image description (detail={detail}): A screenshot containing UI elements including buttons, text fields, and navigation elements."
    elif op == "ask":
        answer = f"[FAKE VLM] Answer to: {query}"
    else:
        raise ValueError(f"Unsupported op: {op}")

    return {"answer": answer, "timingMs": timing_ms}


def build_inspect_prompt(request: dict[str, Any]) -> str:
    detail = request.get("detail", "medium")
    include_objects = request.get("includeObjects", True)
    include_text = request.get("includeText", True)
    include_layout = request.get("includeLayout", True)
    query = request.get("query", "")

    detail_levels = {
        "low": "Give a brief, concise description.",
        "medium": "Give a moderately detailed description.",
        "high": "Give a thorough, highly detailed description. Note every element, its position, color, size, and state.",
    }
    detail_guide = detail_levels.get(detail, detail_levels["medium"])

    parts = [detail_guide]
    if include_objects:
        parts.append("Include all visible objects, UI elements, icons, buttons, text fields, and images.")
    if include_text:
        parts.append("Transcribe all visible text in its natural reading order.")
    if include_layout:
        parts.append("Describe the spatial layout: what is in the top, center, bottom, left, and right regions.")

    prompt = "Describe this image.\n\n" + " ".join(parts)

    if query:
        prompt = f"Focus on: {query}\n\n{prompt}"

    return prompt


def handle(request: dict[str, Any]) -> dict[str, Any]:
    op = request.get("op")

    if FAKE_MODE:
        return handle_fake(request)

    # Health check doesn't need model load
    if op == "health":
        model_id = os.environ.get("VEL_VISION_MODEL", "mlx-community/LocateAnything-3B-bf16")
        return {"status": "ok", "model": model_id}

    start = time.perf_counter()
    worker = load_worker()
    image = open_image(request["image"])
    query = request.get("query") or ""

    if op == "detect":
        labels = request.get("labels") or ([query] if query else [])
        answer = worker.detect(image, labels)
    elif op == "ground_multi":
        answer = worker.ground_multi(image, query)
    elif op == "detect_text":
        answer = worker.detect_text(image)
    elif op == "ground_gui":
        answer = worker.ground_gui(image, query, output_type=request.get("outputType", "box"))
    elif op == "point":
        answer = worker.point(image, query)
    elif op == "inspect":
        answer = worker.detect_text(image)
    elif op == "describe":
        prompt = build_inspect_prompt(request)
        answer = worker.describe(image, prompt)
    elif op == "ask":
        answer = worker.ask(image, query)
    else:
        raise ValueError(f"Unsupported op: {op}")

    return {"answer": answer, "timingMs": int((time.perf_counter() - start) * 1000)}


def main() -> None:
    log("VEL LocateAnything worker ready for JSONL requests")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            request_id = str(request.get("id", "unknown"))
            result = handle(request)
            respond(request_id, True, result=result)
        except Exception as exc:
            request_id = "unknown"
            try:
                request_id = str(json.loads(line).get("id", "unknown"))
            except Exception:
                pass
            respond(request_id, False, error={"code": exc.__class__.__name__, "message": str(exc)})


if __name__ == "__main__":
    main()
