#!/usr/bin/env python3
"""Render contact sheets, timing-aware GIF previews, and onion-skin motion evidence."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from common import frame_durations, frame_paths, load_rgba, read_json, require_valid_spec, write_json


def checker(size: tuple[int, int], cell: int = 12) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size, (38, 42, 52, 255))
    draw = ImageDraw.Draw(image)
    light = (61, 67, 82, 255)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, min(width - 1, x + cell - 1), min(height - 1, y + cell - 1)), fill=light)
    return image


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = image.copy()
    result.thumbnail(size, resample=Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(result, dest=((size[0] - result.width) // 2, (size[1] - result.height) // 2))
    return canvas


def framed_tile(image: Image.Image, tile_size: tuple[int, int]) -> Image.Image:
    background = checker(tile_size, max(4, min(tile_size) // 12))
    background.alpha_composite(contain(image, tile_size))
    return background


def build_contact_sheet(run_dir: Path, spec: dict[str, Any], output: Path) -> None:
    frame_w = int(spec["canvas"]["frame_width"])
    frame_h = int(spec["canvas"]["frame_height"])
    scale = min(1.0, 150 / frame_w, 150 / frame_h)
    tile_w = max(48, round(frame_w * scale))
    tile_h = max(48, round(frame_h * scale))
    label_h = 22
    gutter = 8
    columns = min(8, max(int(clip["frame_count"]) for clip in spec["clips"]))
    sheet_w = gutter + columns * (tile_w + gutter)
    clip_blocks: list[tuple[dict[str, Any], int, int]] = []
    sheet_h = gutter
    for clip in spec["clips"]:
        rows = math.ceil(int(clip["frame_count"]) / columns)
        block_h = label_h + rows * (tile_h + label_h + gutter)
        clip_blocks.append((clip, sheet_h, block_h))
        sheet_h += block_h + gutter
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (20, 23, 31, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for clip, top, _ in clip_blocks:
        direction = clip.get("direction") or "none"
        draw.text((gutter, top + 4), f"{clip['id']}  action={clip['action']}  dir={direction}  {clip['loop']}", fill=(235, 238, 245), font=font)
        for index, path in enumerate(frame_paths(run_dir, clip)):
            image = load_rgba(path)
            row = index // columns
            column = index % columns
            x = gutter + column * (tile_w + gutter)
            y = top + label_h + row * (tile_h + label_h + gutter)
            sheet.alpha_composite(framed_tile(image, (tile_w, tile_h)), dest=(x, y))
            draw.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), outline=(91, 100, 122), width=1)
            draw.text((x + 3, y + tile_h + 3), f"{index:03d}", fill=(205, 211, 225), font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)


def preview_sequence(frames: list[Image.Image], clip: dict[str, Any]) -> tuple[list[Image.Image], list[int]]:
    durations = frame_durations(clip)
    if clip["loop"] == "ping-pong" and len(frames) > 2:
        return frames + frames[-2:0:-1], durations + durations[-2:0:-1]
    return frames, durations


def build_preview(run_dir: Path, clip: dict[str, Any], output: Path) -> None:
    frames = [load_rgba(path) for path in frame_paths(run_dir, clip)]
    frames, durations = preview_sequence(frames, clip)
    rendered: list[Image.Image] = []
    for frame in frames:
        background = checker(frame.size, max(4, min(frame.size) // 16))
        background.alpha_composite(frame)
        rendered.append(background.convert("P", palette=Image.Palette.ADAPTIVE, colors=255))
    output.parent.mkdir(parents=True, exist_ok=True)
    rendered[0].save(
        output,
        save_all=True,
        append_images=rendered[1:],
        duration=durations,
        loop=0 if clip["loop"] in {"loop", "ping-pong"} else 1,
        disposal=2,
        optimize=False,
    )


def tint_alpha(image: Image.Image, rgb: tuple[int, int, int], strength: float) -> Image.Image:
    alpha = image.getchannel("A").point(lambda value: round(value * strength))
    layer = Image.new("RGBA", image.size, (*rgb, 0))
    layer.putalpha(alpha)
    return layer


def build_onion_sheet(run_dir: Path, clip: dict[str, Any], output: Path) -> None:
    frames = [load_rgba(path) for path in frame_paths(run_dir, clip)]
    pairs = [(index, index + 1) for index in range(len(frames) - 1)]
    if clip["loop"] == "loop" and len(frames) > 1:
        pairs.append((len(frames) - 1, 0))
    if not pairs:
        pairs = [(0, 0)]
    source_size = frames[0].size
    scale = min(1.0, 180 / source_size[0], 180 / source_size[1])
    tile_size = (max(48, round(source_size[0] * scale)), max(48, round(source_size[1] * scale)))
    columns = min(6, len(pairs))
    rows = math.ceil(len(pairs) / columns)
    label_h = 22
    gutter = 8
    sheet = Image.new(
        "RGBA",
        (gutter + columns * (tile_size[0] + gutter), gutter + rows * (tile_size[1] + label_h + gutter)),
        (20, 23, 31, 255),
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for pair_index, (left, right) in enumerate(pairs):
        tile = checker(source_size, max(4, min(source_size) // 16))
        tile.alpha_composite(tint_alpha(frames[left], (255, 54, 160), 0.72))
        tile.alpha_composite(tint_alpha(frames[right], (35, 225, 255), 0.72))
        tile = contain(tile, tile_size)
        row = pair_index // columns
        column = pair_index % columns
        x = gutter + column * (tile_size[0] + gutter)
        y = gutter + row * (tile_size[1] + label_h + gutter)
        sheet.alpha_composite(tile, dest=(x, y))
        draw.rectangle((x, y, x + tile_size[0] - 1, y + tile_size[1] - 1), outline=(91, 100, 122), width=1)
        draw.text((x + 3, y + tile_size[1] + 3), f"{left:03d}->{right:03d}", fill=(220, 225, 236), font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(output)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        run_dir = args.run_dir.resolve()
        spec = read_json(run_dir / "animation-spec.json")
        require_valid_spec(spec)
        qa_dir = run_dir / "qa"
        contact_path = qa_dir / "contact-sheet.png"
        build_contact_sheet(run_dir, spec, contact_path)
        preview_paths: list[str] = []
        onion_paths: list[str] = []
        for clip in spec["clips"]:
            preview_path = qa_dir / "previews" / f"{clip['id']}.gif"
            onion_path = qa_dir / "onion-skins" / f"{clip['id']}.png"
            build_preview(run_dir, clip, preview_path)
            build_onion_sheet(run_dir, clip, onion_path)
            preview_paths.append(preview_path.relative_to(run_dir).as_posix())
            onion_paths.append(onion_path.relative_to(run_dir).as_posix())
        index: dict[str, Any] = {
            "schema_version": 1,
            "contact_sheet": contact_path.relative_to(run_dir).as_posix(),
            "previews": preview_paths,
            "onion_skins": onion_paths,
            "review_instruction": "Inspect at intended game size and 1:1 pixels; magenta is the previous pose and cyan is the next pose in onion sheets.",
        }
        write_json(qa_dir / "qa-index.json", index)
        print(f"contact_sheet={contact_path}")
        print(f"previews={len(preview_paths)}")
        print(f"onion_skins={len(onion_paths)}")
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
