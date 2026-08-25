#!/usr/bin/env python3
"""Assemble validated logical frames into deterministic paged atlases and metadata."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Any

from PIL import Image

from common import (
    clip_events_by_frame,
    frame_durations,
    frame_paths,
    load_rgba,
    next_power_of_two,
    read_json,
    require_valid_spec,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    return parser.parse_args()


def primary_extension(atlas_format: str) -> str:
    return "png" if atlas_format in {"png", "both"} else "webp"


def page_filename(index: int, count: int, extension: str) -> str:
    return f"atlas.{extension}" if count == 1 else f"atlas-{index}.{extension}"


def main() -> int:
    args = parse_args()
    try:
        run_dir = args.run_dir.resolve()
        spec = read_json(run_dir / "animation-spec.json")
        require_valid_spec(spec)
        if spec["export"]["mode"] == "frames":
            print("atlas=skipped (export.mode=frames)")
            return 0

        frame_width = int(spec["canvas"]["frame_width"])
        frame_height = int(spec["canvas"]["frame_height"])
        atlas_spec = spec["export"]["atlas"]
        max_width = int(atlas_spec.get("max_width", 4096))
        max_height = int(atlas_spec.get("max_height", 4096))
        columns = max_width // frame_width
        rows_per_page = max_height // frame_height
        if columns < 1 or rows_per_page < 1:
            raise ValueError("Atlas maximum dimensions are smaller than one logical frame")

        placements: list[dict[str, Any]] = []
        page_index = 0
        row = 0
        column = 0
        page_usage: list[dict[str, int]] = [{"rows": 0, "columns": 0}]
        clip_records: list[dict[str, Any]] = []
        for clip in spec["clips"]:
            if column:
                row += 1
                column = 0
            if row >= rows_per_page:
                page_index += 1
                row = 0
                page_usage.append({"rows": 0, "columns": 0})
            durations = frame_durations(clip)
            events = clip_events_by_frame(clip)
            pivot = clip.get("pivot", spec["canvas"]["pivot"])
            root_track = clip.get("root_motion_track")
            clip_keys: list[str] = []
            for index, path in enumerate(frame_paths(run_dir, clip)):
                if not path.is_file():
                    raise FileNotFoundError(f"Missing frame: {path}")
                if column >= columns:
                    row += 1
                    column = 0
                if row >= rows_per_page:
                    page_index += 1
                    row = 0
                    page_usage.append({"rows": 0, "columns": 0})
                key = f"{clip['id']}/{index:03d}"
                placement = {
                    "key": key,
                    "clip": clip["id"],
                    "index": index,
                    "page": page_index,
                    "rect": {
                        "x": column * frame_width,
                        "y": row * frame_height,
                        "w": frame_width,
                        "h": frame_height,
                    },
                    "duration_ms": durations[index],
                    "pivot": {"x": float(pivot["x"]), "y": float(pivot["y"])},
                    "events": events.get(index, []),
                    "root_motion": root_track[index] if root_track is not None else None,
                    "source": path.relative_to(run_dir).as_posix(),
                }
                placements.append(placement)
                clip_keys.append(key)
                page_usage[page_index]["rows"] = max(page_usage[page_index]["rows"], row + 1)
                page_usage[page_index]["columns"] = max(page_usage[page_index]["columns"], column + 1)
                column += 1
            clip_records.append(
                {
                    "id": clip["id"],
                    "action": clip["action"],
                    "direction": clip.get("direction"),
                    "loop": clip["loop"],
                    "root_motion": clip["root_motion"],
                    "frames": clip_keys,
                }
            )

        page_count = len(page_usage)
        atlas_format = atlas_spec.get("format", "png")
        power_of_two = bool(atlas_spec.get("power_of_two", False))
        output_dir = run_dir / "final"
        output_dir.mkdir(parents=True, exist_ok=True)
        page_canvases: list[Image.Image] = []
        page_records: list[dict[str, Any]] = []
        for index, usage in enumerate(page_usage):
            used_width = max(1, usage["columns"] * frame_width)
            used_height = max(1, usage["rows"] * frame_height)
            width = next_power_of_two(used_width) if power_of_two else used_width
            height = next_power_of_two(used_height) if power_of_two else used_height
            if width > max_width or height > max_height:
                raise ValueError(
                    f"Page {index} would be {width}x{height}, exceeding {max_width}x{max_height}; adjust limits or disable power-of-two"
                )
            page_canvases.append(Image.new("RGBA", (width, height), (0, 0, 0, 0)))
            page_records.append(
                {
                    "index": index,
                    "size": {"w": width, "h": height},
                    "used_size": {"w": used_width, "h": used_height},
                    "images": {},
                }
            )

        for placement in placements:
            source_path = run_dir / placement["source"]
            image = load_rgba(source_path)
            if image.size != (frame_width, frame_height):
                raise ValueError(f"Wrong logical frame size at {source_path}: {image.size}")
            rect = placement["rect"]
            page_canvases[placement["page"]].alpha_composite(image, dest=(rect["x"], rect["y"]))

        for index, canvas in enumerate(page_canvases):
            if atlas_format in {"png", "both"}:
                name = page_filename(index, page_count, "png")
                canvas.save(output_dir / name)
                page_records[index]["images"]["png"] = name
            if atlas_format in {"webp", "both"}:
                name = page_filename(index, page_count, "webp")
                canvas.save(output_dir / name, format="WEBP", lossless=True, method=6)
                page_records[index]["images"]["webp"] = name

        extension = primary_extension(atlas_format)
        for placement in placements:
            placement["image"] = page_records[placement["page"]]["images"][extension]

        metadata = {
            "schema_version": 1,
            "project": spec["project"],
            "subject": {"id": spec["subject"]["id"], "display_name": spec["subject"]["display_name"]},
            "frame_canvas": {"w": frame_width, "h": frame_height},
            "coordinate_system": "top-left pixels; normalized pivots use top-left origin",
            "pages": page_records,
            "frames": placements,
            "clips": clip_records,
        }
        if page_count == 1:
            metadata["image"] = page_records[0]["images"][extension]
            metadata["size"] = page_records[0]["size"]
        write_json(output_dir / "atlas.json", metadata)
        print(f"pages={page_count}")
        print(f"frames={len(placements)}")
        print(f"metadata={output_dir / 'atlas.json'}")
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
