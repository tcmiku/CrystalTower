#!/usr/bin/env python3
"""Shared helpers for the game-animation-frames deterministic pipeline."""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

from PIL import Image


CLIP_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LOOP_MODES = {"loop", "once", "ping-pong", "hold-last"}
NORMALIZATION_MODES = {"shared-fit", "stable-slots"}
ROOT_MOTION_MODES = {"in-place", "authored", "metadata"}
DIRECTION_MODES = {"screen-space", "world-space", "character-relative", "none"}
EXPORT_MODES = {"frames", "atlas", "atlas-and-frames"}


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def slugify(value: str, fallback: str = "animation") -> str:
    result = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return result or fallback


def parse_frame_size(value: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*[xX]\s*(\d+)\s*", value)
    if not match:
        raise ValueError(f"Frame size must look like 256x256, got {value!r}")
    width, height = int(match.group(1)), int(match.group(2))
    if not (8 <= width <= 4096 and 8 <= height <= 4096):
        raise ValueError("Frame dimensions must each be between 8 and 4096 pixels")
    return width, height


def parse_color(value: str) -> tuple[int, int, int]:
    text = value.strip().lstrip("#")
    if len(text) == 3:
        text = "".join(ch * 2 for ch in text)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", text):
        raise ValueError(f"Expected an RGB hex color, got {value!r}")
    return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))


def color_hex(rgb: Iterable[int]) -> str:
    r, g, b = rgb
    return f"#{int(r):02X}{int(g):02X}{int(b):02X}"


def frame_durations(clip: dict[str, Any]) -> list[int]:
    count = int(clip["frame_count"])
    explicit = clip.get("durations_ms")
    if explicit is not None:
        return [int(value) for value in explicit]
    fps = float(clip.get("fps", 12))
    duration = max(1, round(1000.0 / fps))
    return [duration] * count


def next_power_of_two(value: int) -> int:
    if value <= 1:
        return 1
    return 1 << math.ceil(math.log2(value))


def load_rgba(path: Path) -> Image.Image:
    with Image.open(path) as source:
        return source.convert("RGBA")


def frame_paths(run_dir: Path, clip: dict[str, Any]) -> list[Path]:
    clip_dir = run_dir / "frames" / str(clip["id"])
    return [clip_dir / f"{index:03d}.png" for index in range(int(clip["frame_count"]))]


def clip_events_by_frame(clip: dict[str, Any]) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = {}
    for event in clip.get("events", []):
        frame = int(event["frame"])
        result.setdefault(frame, []).append(event)
    return result


def validate_spec(spec: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if spec.get("schema_version") != 1:
        errors.append("schema_version must be 1")

    project = spec.get("project")
    subject = spec.get("subject")
    canvas = spec.get("canvas")
    directions = spec.get("directions")
    clips = spec.get("clips")
    export = spec.get("export")
    if not isinstance(project, dict) or not project.get("id"):
        errors.append("project.id is required")
    if not isinstance(subject, dict) or not subject.get("id"):
        errors.append("subject.id is required")
    if not isinstance(canvas, dict):
        errors.append("canvas object is required")
        canvas = {}
    if not isinstance(directions, dict):
        errors.append("directions object is required")
        directions = {}
    if not isinstance(clips, list) or not clips:
        errors.append("clips must be a non-empty array")
        clips = []
    if not isinstance(export, dict):
        errors.append("export object is required")
        export = {}

    for field in ("frame_width", "frame_height"):
        value = canvas.get(field)
        if not isinstance(value, int) or not (8 <= value <= 4096):
            errors.append(f"canvas.{field} must be an integer from 8 to 4096")
    padding = canvas.get("padding", 0)
    if not isinstance(padding, int) or padding < 0:
        errors.append("canvas.padding must be a non-negative integer")
    if not isinstance(canvas.get("pixel_art", False), bool):
        errors.append("canvas.pixel_art must be true or false")
    pivot = canvas.get("pivot", {})
    if not isinstance(pivot, dict):
        errors.append("canvas.pivot must be an object")
    else:
        for axis in ("x", "y"):
            value = pivot.get(axis)
            if not isinstance(value, (int, float)) or not 0 <= float(value) <= 1:
                errors.append(f"canvas.pivot.{axis} must be between 0 and 1")
    background = canvas.get("background", {})
    if not isinstance(background, dict) or background.get("mode") not in {"chroma", "transparent", "none"}:
        errors.append("canvas.background.mode must be chroma, transparent, or none")
    elif background.get("mode") == "chroma":
        try:
            parse_color(str(background.get("color", "")))
        except ValueError as exc:
            errors.append(f"canvas.background.color: {exc}")

    if directions.get("mode") not in DIRECTION_MODES:
        errors.append(f"directions.mode must be one of {sorted(DIRECTION_MODES)}")
    if directions.get("mode") == "world-space" and not directions.get("camera_mapping"):
        errors.append("directions.camera_mapping is required for world-space directions")
    direction_values = directions.get("values", [])
    if not isinstance(direction_values, list):
        errors.append("directions.values must be an array")
        direction_values = []

    seen: set[str] = set()
    for index, clip in enumerate(clips):
        prefix = f"clips[{index}]"
        if not isinstance(clip, dict):
            errors.append(f"{prefix} must be an object")
            continue
        clip_id = clip.get("id")
        if not isinstance(clip_id, str) or not CLIP_ID_RE.fullmatch(clip_id):
            errors.append(f"{prefix}.id must be unique lowercase hyphen-case")
        elif clip_id in seen:
            errors.append(f"duplicate clip id: {clip_id}")
        else:
            seen.add(clip_id)
        if not clip.get("action"):
            errors.append(f"{prefix}.action is required")
        count = clip.get("frame_count")
        if not isinstance(count, int) or not (1 <= count <= 128):
            errors.append(f"{prefix}.frame_count must be an integer from 1 to 128")
            count = 0
        if clip.get("loop") not in LOOP_MODES:
            errors.append(f"{prefix}.loop must be one of {sorted(LOOP_MODES)}")
        if clip.get("normalization") not in NORMALIZATION_MODES:
            errors.append(f"{prefix}.normalization must be one of {sorted(NORMALIZATION_MODES)}")
        if clip.get("root_motion") not in ROOT_MOTION_MODES:
            errors.append(f"{prefix}.root_motion must be one of {sorted(ROOT_MOTION_MODES)}")
        if directions.get("mode") == "none" and clip.get("direction") is not None:
            errors.append(f"{prefix}.direction must be null when directions.mode is none")
        if clip.get("direction") is not None and direction_values and clip.get("direction") not in direction_values:
            errors.append(f"{prefix}.direction is not listed in directions.values")
        clip_pivot = clip.get("pivot")
        if clip_pivot is not None:
            if not isinstance(clip_pivot, dict):
                errors.append(f"{prefix}.pivot must be an object")
            else:
                for axis in ("x", "y"):
                    value = clip_pivot.get(axis)
                    if not isinstance(value, (int, float)) or not 0 <= float(value) <= 1:
                        errors.append(f"{prefix}.pivot.{axis} must be between 0 and 1")
        root_track = clip.get("root_motion_track")
        if clip.get("root_motion") == "metadata":
            if not isinstance(root_track, list) or len(root_track) != count:
                errors.append(f"{prefix}.root_motion_track must contain one point per frame for metadata root motion")
            else:
                for point_index, point in enumerate(root_track):
                    if not isinstance(point, dict) or any(not isinstance(point.get(axis), (int, float)) for axis in ("x", "y")):
                        errors.append(f"{prefix}.root_motion_track[{point_index}] requires numeric x and y")
        durations = clip.get("durations_ms")
        fps = clip.get("fps")
        if durations is not None:
            if not isinstance(durations, list) or len(durations) != count or any(
                not isinstance(value, int) or value <= 0 for value in durations
            ):
                errors.append(f"{prefix}.durations_ms must contain one positive integer per frame")
        elif not isinstance(fps, (int, float)) or float(fps) <= 0:
            errors.append(f"{prefix} requires positive fps or valid durations_ms")
        for event_index, event in enumerate(clip.get("events", [])):
            if not isinstance(event, dict) or not isinstance(event.get("frame"), int):
                errors.append(f"{prefix}.events[{event_index}] requires an integer frame")
            elif not 0 <= event["frame"] < count:
                errors.append(f"{prefix}.events[{event_index}].frame is outside the clip")
        for beat_index, beat in enumerate(clip.get("semantic_beats", [])):
            if not isinstance(beat, dict) or not beat.get("name") or not isinstance(beat.get("frames"), list):
                errors.append(f"{prefix}.semantic_beats[{beat_index}] is invalid")
                continue
            if any(not isinstance(frame, int) or not 0 <= frame < count for frame in beat["frames"]):
                errors.append(f"{prefix}.semantic_beats[{beat_index}] contains an invalid frame")

    if export.get("mode") not in EXPORT_MODES:
        errors.append(f"export.mode must be one of {sorted(EXPORT_MODES)}")
    atlas = export.get("atlas", {})
    if export.get("mode") in {"atlas", "atlas-and-frames"}:
        if not isinstance(atlas, dict):
            errors.append("export.atlas must be an object when atlas output is requested")
        else:
            if atlas.get("layout", "rows-by-clip") != "rows-by-clip":
                errors.append("only export.atlas.layout=rows-by-clip is supported")
            for field in ("max_width", "max_height"):
                value = atlas.get(field, 4096)
                if not isinstance(value, int) or value < 8:
                    errors.append(f"export.atlas.{field} must be an integer of at least 8")
            if atlas.get("format", "png") not in {"png", "webp", "both"}:
                errors.append("export.atlas.format must be png, webp, or both")
    return errors


def require_valid_spec(spec: dict[str, Any]) -> None:
    errors = validate_spec(spec)
    if errors:
        joined = "\n- ".join(errors)
        raise ValueError(f"Invalid animation spec:\n- {joined}")
