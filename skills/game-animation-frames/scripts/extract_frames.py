#!/usr/bin/env python3
"""Extract, key, normalize, and provenance-track frames from one horizontal strip."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from common import color_hex, parse_color, parse_frame_size, read_json, require_valid_spec, write_json


def clear_hidden_rgb(array: np.ndarray) -> np.ndarray:
    result = array.copy()
    result[result[:, :, 3] == 0, :3] = 0
    return result


def remove_background(image: Image.Image, mode: str, key: tuple[int, int, int], threshold: int) -> Image.Image:
    array = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    if mode == "chroma":
        rgb = array[:, :, :3].astype(np.float32)
        key_array = np.asarray(key, dtype=np.float32).reshape((1, 1, 3))
        distance = np.sqrt(np.sum((rgb - key_array) ** 2, axis=2))
        inner = max(1.0, threshold * 0.55)
        outer = max(inner + 1.0, float(threshold))
        factor = np.clip((distance - inner) / (outer - inner), 0.0, 1.0)
        array[:, :, 3] = np.rint(array[:, :, 3].astype(np.float32) * factor).astype(np.uint8)
    elif mode not in {"transparent", "none"}:
        raise ValueError(f"Unsupported background mode: {mode}")
    return Image.fromarray(clear_hidden_rgb(array), mode="RGBA")


def alpha_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    ys, xs = np.nonzero(alpha > threshold)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def equal_slots(width: int, height: int, count: int) -> list[tuple[int, int, int, int]]:
    return [(round(index * width / count), 0, round((index + 1) * width / count), height) for index in range(count)]


def projection_groups(image: Image.Image, alpha_threshold: int, merge_gap: int) -> list[tuple[int, int, int, int]]:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    occupied = np.any(alpha > alpha_threshold, axis=0)
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for index, present in enumerate(occupied.tolist() + [False]):
        if present and start is None:
            start = index
        elif not present and start is not None:
            runs.append((start, index))
            start = None
    if not runs:
        return []
    merged: list[tuple[int, int]] = [runs[0]]
    for left, right in runs[1:]:
        prev_left, prev_right = merged[-1]
        if left - prev_right <= merge_gap:
            merged[-1] = (prev_left, right)
        else:
            merged.append((left, right))
    boxes: list[tuple[int, int, int, int]] = []
    for left, right in merged:
        local = alpha[:, left:right]
        ys, xs = np.nonzero(local > alpha_threshold)
        if len(xs):
            boxes.append((left + int(xs.min()), int(ys.min()), left + int(xs.max()) + 1, int(ys.max()) + 1))
    return boxes


def paste_rgba(canvas: Image.Image, sprite: Image.Image, x: int, y: int) -> None:
    canvas.alpha_composite(sprite, dest=(x, y))


def normalize_shared_fit(
    image: Image.Image,
    source_boxes: list[tuple[int, int, int, int]],
    frame_size: tuple[int, int],
    padding: int,
    pivot: tuple[float, float],
    anchor: str,
    resample: Image.Resampling,
) -> tuple[list[Image.Image], list[dict[str, Any]]]:
    crops: list[Image.Image] = []
    tight_boxes: list[tuple[int, int, int, int]] = []
    for source_box in source_boxes:
        source_crop = image.crop(source_box)
        local_box = alpha_bbox(source_crop)
        if local_box is None:
            raise ValueError(f"Empty pose in source box {source_box}")
        tight = (
            source_box[0] + local_box[0],
            source_box[1] + local_box[1],
            source_box[0] + local_box[2],
            source_box[1] + local_box[3],
        )
        tight_boxes.append(tight)
        crops.append(image.crop(tight))

    frame_width, frame_height = frame_size
    max_width = max(crop.width for crop in crops)
    max_height = max(crop.height for crop in crops)
    available_width = max(1, frame_width - 2 * padding)
    if anchor in {"bottom-center", "pivot"}:
        available_height = max(1, round(pivot[1] * frame_height) - padding)
    else:
        available_height = max(1, frame_height - 2 * padding)
    scale = min(available_width / max_width, available_height / max_height)
    if scale <= 0:
        raise ValueError("No room remains inside the target canvas after padding/pivot constraints")

    frames: list[Image.Image] = []
    records: list[dict[str, Any]] = []
    for index, (crop, source_box) in enumerate(zip(crops, tight_boxes)):
        size = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
        resized = crop.resize(size, resample=resample)
        canvas = Image.new("RGBA", frame_size, (0, 0, 0, 0))
        if anchor in {"bottom-center", "pivot"}:
            x = round(pivot[0] * frame_width - resized.width / 2)
            y = round(pivot[1] * frame_height - resized.height)
        else:
            x = round(pivot[0] * frame_width - resized.width / 2)
            y = round(pivot[1] * frame_height - resized.height / 2)
        paste_rgba(canvas, resized, x, y)
        visible = alpha_bbox(canvas)
        frames.append(canvas)
        records.append(
            {
                "index": index,
                "source_box": list(source_box),
                "scale": scale,
                "paste": [x, y],
                "visible_bbox": list(visible) if visible else None,
            }
        )
    return frames, records


def normalize_stable_slots(
    image: Image.Image,
    slots: list[tuple[int, int, int, int]],
    frame_size: tuple[int, int],
    resample: Image.Resampling,
) -> tuple[list[Image.Image], list[dict[str, Any]]]:
    frames: list[Image.Image] = []
    records: list[dict[str, Any]] = []
    frame_width, frame_height = frame_size
    for index, source_box in enumerate(slots):
        slot = image.crop(source_box)
        scale = min(frame_width / slot.width, frame_height / slot.height)
        size = (max(1, round(slot.width * scale)), max(1, round(slot.height * scale)))
        resized = slot.resize(size, resample=resample)
        canvas = Image.new("RGBA", frame_size, (0, 0, 0, 0))
        x = (frame_width - resized.width) // 2
        y = (frame_height - resized.height) // 2
        paste_rgba(canvas, resized, x, y)
        visible = alpha_bbox(canvas)
        if visible is None:
            raise ValueError(f"Frame {index} is empty after stable-slot extraction")
        frames.append(canvas)
        records.append(
            {
                "index": index,
                "source_box": list(source_box),
                "scale": scale,
                "paste": [x, y],
                "visible_bbox": list(visible),
            }
        )
    return frames, records


def parse_pivot(value: str) -> tuple[float, float]:
    try:
        x_text, y_text = value.split(",", 1)
        x, y = float(x_text), float(y_text)
    except Exception as exc:
        raise argparse.ArgumentTypeError("Pivot must be normalized X,Y, for example 0.5,0.9") from exc
    if not 0 <= x <= 1 or not 0 <= y <= 1:
        raise argparse.ArgumentTypeError("Pivot values must be between 0 and 1")
    return x, y


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, help="Read clip settings from animation-spec.json")
    parser.add_argument("--clip", help="Clip id used with --run-dir")
    parser.add_argument("--strip", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--frame-count", type=int)
    parser.add_argument("--frame-size", type=parse_frame_size)
    parser.add_argument("--method", choices=["auto", "projection", "slots"], default="auto")
    parser.add_argument("--normalization", choices=["shared-fit", "stable-slots"])
    parser.add_argument("--background", choices=["chroma", "transparent", "none"])
    parser.add_argument("--chroma-key")
    parser.add_argument("--chroma-threshold", type=int)
    parser.add_argument("--alpha-threshold", type=int, default=8)
    parser.add_argument("--padding", type=int)
    parser.add_argument("--pivot", type=parse_pivot)
    parser.add_argument("--anchor", choices=["pivot", "bottom-center", "center"])
    parser.add_argument("--pixel-art", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.run_dir:
            if not args.clip:
                raise ValueError("--clip is required with --run-dir")
            run_dir = args.run_dir.resolve()
            spec = read_json(run_dir / "animation-spec.json")
            require_valid_spec(spec)
            matches = [clip for clip in spec["clips"] if clip["id"] == args.clip]
            if not matches:
                raise ValueError(f"Unknown clip id: {args.clip}")
            clip = matches[0]
            canvas = spec["canvas"]
            background = canvas["background"]
            args.strip = args.strip or run_dir / "decoded" / f"{clip['id']}.png"
            args.output_dir = args.output_dir or run_dir / "frames" / clip["id"]
            args.frame_count = args.frame_count or int(clip["frame_count"])
            args.frame_size = args.frame_size or (int(canvas["frame_width"]), int(canvas["frame_height"]))
            args.normalization = args.normalization or clip["normalization"]
            args.background = args.background or background["mode"]
            args.chroma_key = args.chroma_key or background.get("color", "#FF00FF")
            args.chroma_threshold = args.chroma_threshold if args.chroma_threshold is not None else int(background.get("threshold", 72))
            args.padding = args.padding if args.padding is not None else int(canvas.get("padding", 12))
            selected_pivot = clip.get("pivot", canvas["pivot"])
            args.pivot = args.pivot or (float(selected_pivot["x"]), float(selected_pivot["y"]))
            args.anchor = args.anchor or clip.get("anchor", "pivot")
            args.pixel_art = args.pixel_art or bool(canvas.get("pixel_art", False))
        else:
            missing = [name for name in ("strip", "output_dir", "frame_count", "frame_size") if getattr(args, name) is None]
            if missing:
                raise ValueError(f"Direct mode requires: {', '.join('--' + name.replace('_', '-') for name in missing)}")
            args.normalization = args.normalization or "shared-fit"
            args.background = args.background or "chroma"
            args.chroma_key = args.chroma_key or "#FF00FF"
            args.chroma_threshold = args.chroma_threshold if args.chroma_threshold is not None else 72
            args.padding = args.padding if args.padding is not None else 12
            args.pivot = args.pivot or (0.5, 0.9)
            args.anchor = args.anchor or "pivot"
        if args.frame_count < 1 or args.frame_count > 128:
            raise ValueError("frame-count must be between 1 and 128")
        if not 0 <= args.chroma_threshold <= 441:
            raise ValueError("chroma-threshold must be between 0 and 441")
        if not args.strip.is_file():
            raise FileNotFoundError(args.strip)
        output_dir = args.output_dir.resolve()
        manifest_path = output_dir / "frames-manifest.json"
        existing_frames = list(output_dir.glob("[0-9][0-9][0-9].png")) if output_dir.exists() else []
        if (manifest_path.exists() or existing_frames) and not args.force:
            raise FileExistsError(f"Output already contains extracted frames: {output_dir}; pass --force to replace matching files")
        output_dir.mkdir(parents=True, exist_ok=True)

        with Image.open(args.strip) as source:
            keyed = remove_background(source.convert("RGBA"), args.background, parse_color(args.chroma_key), args.chroma_threshold)
        slots = equal_slots(keyed.width, keyed.height, args.frame_count)
        warnings: list[str] = []
        method_used = args.method
        source_boxes = slots
        if args.normalization == "shared-fit" and args.method in {"auto", "projection"}:
            merge_gap = max(2, keyed.width // 512)
            groups = projection_groups(keyed, args.alpha_threshold, merge_gap)
            if len(groups) == args.frame_count:
                source_boxes = groups
                method_used = "projection"
            elif args.method == "projection":
                raise ValueError(f"Projection found {len(groups)} pose groups, expected {args.frame_count}")
            else:
                method_used = "slots"
                warnings.append(
                    f"projection found {len(groups)} pose groups instead of {args.frame_count}; fell back to equal slots"
                )
        elif args.method == "slots" or args.normalization == "stable-slots":
            method_used = "slots"

        resample = Image.Resampling.NEAREST if args.pixel_art else Image.Resampling.LANCZOS
        if args.normalization == "stable-slots":
            frames, records = normalize_stable_slots(keyed, slots, args.frame_size, resample)
        else:
            frames, records = normalize_shared_fit(
                keyed,
                source_boxes,
                args.frame_size,
                args.padding,
                args.pivot,
                args.anchor,
                resample,
            )

        for index, frame in enumerate(frames):
            array = clear_hidden_rgb(np.asarray(frame, dtype=np.uint8))
            Image.fromarray(array, mode="RGBA").save(output_dir / f"{index:03d}.png")
            records[index]["output_path"] = f"{index:03d}.png"

        manifest = {
            "schema_version": 1,
            "source_strip": str(args.strip.resolve()),
            "source_size": {"w": keyed.width, "h": keyed.height},
            "frame_count": args.frame_count,
            "frame_size": {"w": args.frame_size[0], "h": args.frame_size[1]},
            "method_requested": args.method,
            "method_used": method_used,
            "normalization": args.normalization,
            "background": {
                "mode": args.background,
                "chroma_key": color_hex(parse_color(args.chroma_key)),
                "chroma_threshold": args.chroma_threshold,
            },
            "pivot": {"x": args.pivot[0], "y": args.pivot[1]},
            "anchor": args.anchor,
            "pixel_art": args.pixel_art,
            "warnings": warnings,
            "frames": records,
        }
        write_json(manifest_path, manifest)
        print(f"frames={len(frames)}")
        print(f"method={method_used}")
        print(f"manifest={manifest_path}")
        for warning in warnings:
            print(f"warning: {warning}")
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
