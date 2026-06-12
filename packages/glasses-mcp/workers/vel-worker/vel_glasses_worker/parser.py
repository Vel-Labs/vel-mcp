import re
from typing import Any

BOX_RE = re.compile(r"(?:<ref>(?P<label>.*?)</ref>)?\s*<box><(?P<x1>\d+)><(?P<y1>\d+)><(?P<x2>\d+)><(?P<y2>\d+)></box>")
POINT_RE = re.compile(r"(?:<ref>(?P<label>.*?)</ref>)?\s*<box><(?P<x>\d+)><(?P<y>\d+)></box>")


def parse_answer(answer: str) -> dict[str, Any]:
    if "<box>none</box>" in answer.lower():
        return {"matches": [], "noObject": True}
    boxes = []
    for match in BOX_RE.finditer(answer):
        boxes.append({
            "label": (match.group("label") or "object").strip(),
            "bboxNorm1000": [int(match.group("x1")), int(match.group("y1")), int(match.group("x2")), int(match.group("y2"))],
        })
    points = []
    if not boxes:
        for match in POINT_RE.finditer(answer):
            points.append({
                "label": (match.group("label") or "point").strip(),
                "centerNorm1000": [int(match.group("x")), int(match.group("y"))],
            })
    return {"matches": boxes or points, "noObject": False}
