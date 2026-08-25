#!/usr/bin/env python3
"""Prepare a deterministic game animation run, prompts, guides, and visual jobs."""

from __future__ import annotations

import argparse
import copy
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from common import (
    color_hex,
    parse_color,
    parse_frame_size,
    read_json,
    require_valid_spec,
    slugify,
    write_json,
)


def parse_action(value: str) -> dict[str, Any]:
    parts = [part.strip() for part in value.split(":")]
    if len(parts) != 5:
        raise argparse.ArgumentTypeError(
            "Action must be ACTION:DIRECTION:FRAMES:LOOP:FPS, for example run:east:8:loop:12"
        )
    action, direction, frame_text, loop, fps_text = parts
    if not action:
        raise argparse.ArgumentTypeError("Action name cannot be empty")
    direction = direction if direction not in {"", "-", "none"} else None
    try:
        frame_count = int(frame_text)
        fps = float(fps_text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("FRAMES must be an integer and FPS must be numeric") from exc
    clip_id = slugify(f"{action}-{direction}" if direction else action)
    normalization = "stable-slots" if slugify(action) in {"jump", "knockback", "projectile", "dash", "vfx"} else "shared-fit"
    root_motion = "authored" if normalization == "stable-slots" and slugify(action) in {"jump", "knockback", "projectile", "dash"} else "in-place"
    return {
        "id": clip_id,
        "action": slugify(action),
        "direction": direction,
        "frame_count": frame_count,
        "fps": fps,
        "loop": loop,
        "root_motion": root_motion,
        "normalization": normalization,
        "anchor": "pivot",
        "semantic_beats": [],
        "events": [],
        "notes": "",
    }


def normalize_request(raw: dict[str, Any]) -> dict[str, Any]:
    spec = copy.deepcopy(raw)
    spec.setdefault("schema_version", 1)
    spec.setdefault("project", {})
    spec["project"].setdefault("id", slugify(str(spec["project"].get("display_name", "animation-project"))))
    spec["project"].setdefault("display_name", spec["project"]["id"].replace("-", " ").title())
    spec.setdefault("subject", {})
    spec["subject"].setdefault("id", slugify(str(spec["subject"].get("display_name", "subject")), "subject"))
    spec["subject"].setdefault("display_name", spec["subject"]["id"].replace("-", " ").title())
    spec["subject"].setdefault("description", "2D game animation subject")
    spec["subject"].setdefault("style_notes", "Preserve the supplied visual style")
    spec["subject"].setdefault("references", [])
    spec.setdefault("canvas", {})
    spec["canvas"].setdefault("frame_width", 256)
    spec["canvas"].setdefault("frame_height", 256)
    spec["canvas"].setdefault("padding", 12)
    spec["canvas"].setdefault("pixel_art", False)
    spec["canvas"].setdefault("background", {"mode": "chroma", "color": "#FF00FF", "threshold": 72})
    spec["canvas"].setdefault("pivot", {"x": 0.5, "y": 0.9})
    spec["canvas"].setdefault("edge_policy", "clear")
    spec.setdefault("directions", {})
    spec["directions"].setdefault("mode", "screen-space")
    spec["directions"].setdefault("values", [])
    spec["directions"].setdefault("camera_mapping", None)
    spec["directions"].setdefault("mirror_pairs", {})
    spec.setdefault("clips", [])
    for clip in spec["clips"]:
        clip.setdefault("direction", None)
        clip.setdefault("root_motion", "in-place")
        clip.setdefault("normalization", "shared-fit")
        clip.setdefault("anchor", "pivot")
        clip.setdefault("semantic_beats", [])
        clip.setdefault("events", [])
        clip.setdefault("notes", "")
    spec.setdefault("export", {})
    spec["export"].setdefault("mode", "atlas-and-frames")
    spec["export"].setdefault(
        "atlas",
        {
            "layout": "rows-by-clip",
            "max_width": 4096,
            "max_height": 4096,
            "power_of_two": False,
            "format": "png",
        },
    )
    spec["export"].setdefault("metadata", ["generic-json"])
    return spec


def build_spec(args: argparse.Namespace) -> dict[str, Any]:
    if args.request:
        request_path = args.request.resolve()
        spec = normalize_request(read_json(request_path))
        resolved_references: list[str] = []
        for value in spec["subject"].get("references", []):
            path = Path(value)
            if not path.is_absolute():
                path = request_path.parent / path
            path = path.resolve()
            if not path.is_file():
                raise FileNotFoundError(f"Reference image does not exist: {path}")
            resolved_references.append(str(path))
        spec["subject"]["references"] = resolved_references
        if not spec["directions"].get("values"):
            spec["directions"]["values"] = list(
                dict.fromkeys(clip.get("direction") for clip in spec["clips"] if clip.get("direction"))
            )
        return spec

    width, height = parse_frame_size(args.frame_size)
    references = [str(path.resolve()) for path in args.reference]
    actions = args.action or [parse_action("idle:none:6:loop:8")]
    directions = list(dict.fromkeys(clip["direction"] for clip in actions if clip["direction"]))
    project_id = slugify(args.project_name)
    subject_name = args.character_name or args.project_name
    subject_id = slugify(subject_name, "subject")
    key = color_hex(parse_color(args.chroma_key))
    return {
        "schema_version": 1,
        "project": {"id": project_id, "display_name": args.project_name},
        "subject": {
            "id": subject_id,
            "display_name": subject_name,
            "description": args.description or "2D game animation subject",
            "style_notes": args.style_notes or "Preserve the supplied visual style",
            "references": references,
        },
        "canvas": {
            "frame_width": width,
            "frame_height": height,
            "padding": args.padding,
            "pixel_art": args.pixel_art,
            "background": {"mode": "chroma", "color": key, "threshold": args.chroma_threshold},
            "pivot": {"x": args.pivot_x, "y": args.pivot_y},
            "edge_policy": "clear",
        },
        "directions": {
            "mode": args.direction_mode,
            "values": directions,
            "camera_mapping": args.camera_mapping,
            "mirror_pairs": {},
        },
        "clips": actions,
        "export": {
            "mode": args.export_mode,
            "atlas": {
                "layout": "rows-by-clip",
                "max_width": args.atlas_max_width,
                "max_height": args.atlas_max_height,
                "power_of_two": args.power_of_two,
                "format": args.atlas_format,
            },
            "metadata": ["generic-json"],
        },
    }


def guide_dimensions(frame_count: int, frame_width: int, frame_height: int) -> tuple[int, int]:
    target_slot = min(256, max(96, 1536 // frame_count))
    scale = min(target_slot / frame_width, 512 / frame_height)
    slot_w = max(48, round(frame_width * scale))
    slot_h = max(48, round(frame_height * scale))
    return slot_w * frame_count, slot_h


def make_layout_guide(path: Path, clip: dict[str, Any], spec: dict[str, Any]) -> None:
    canvas = spec["canvas"]
    count = int(clip["frame_count"])
    width, height = guide_dimensions(count, int(canvas["frame_width"]), int(canvas["frame_height"]))
    background = canvas["background"]
    rgb = parse_color(background.get("color", "#FF00FF")) if background["mode"] == "chroma" else (232, 232, 232)
    image = Image.new("RGB", (width, height), rgb)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    slot_width = width / count
    outline = (35, 213, 255) if sum(rgb) < 500 else (20, 45, 80)
    pivot = canvas["pivot"]
    for index in range(count):
        left = round(index * slot_width)
        right = round((index + 1) * slot_width) - 1
        draw.rectangle((left + 2, 2, right - 2, height - 3), outline=outline, width=2)
        px = round(left + float(pivot["x"]) * (right - left))
        py = round(float(pivot["y"]) * height)
        draw.line((px - 5, py, px + 5, py), fill=outline, width=1)
        draw.line((px, py - 5, px, py + 5), fill=outline, width=1)
        draw.text((left + 7, 7), f"{index + 1:02d}", fill=outline, font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def beat_text(clip: dict[str, Any]) -> str:
    beats = clip.get("semantic_beats", [])
    if not beats:
        return "Plan a readable action arc appropriate to the clip; keep every required pose distinct."
    parts = []
    for beat in beats:
        frame_labels = ", ".join(str(int(frame) + 1) for frame in beat.get("frames", []))
        parts.append(f"- {beat['name']}: frame(s) {frame_labels}")
    return "\n".join(parts)


def write_prompts(run_dir: Path, spec: dict[str, Any]) -> dict[str, str]:
    subject = spec["subject"]
    canvas = spec["canvas"]
    background = canvas["background"]
    background_text = (
        f"flat uniform {background['color']} chroma background"
        if background["mode"] == "chroma"
        else "genuine transparent background"
    )
    canonical_path = run_dir / "prompts" / "canonical.md"
    canonical_path.parent.mkdir(parents=True, exist_ok=True)
    canonical_path.write_text(
        "\n".join(
            [
                "# Canonical game-sprite identity reference",
                "",
                f"Create one complete centered 2D game character/effect reference for **{subject['display_name']}**.",
                f"Identity: {subject['description']}",
                f"Style: {subject['style_notes']}",
                "Pixel treatment: preserve a strict integer-grid pixel-art language with no smoothing." if canvas.get("pixel_art") else "Pixel treatment: preserve the canonical raster rendering language.",
                f"Use a {background_text}.",
                "Show the complete silhouette and every persistent prop clearly. Preserve the requested camera and projection.",
                "No labels, frame grid, scenery, floor, cast shadow, detached decoration, checkerboard, or UI.",
                "This image will be the identity source of truth for all animation clips.",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    prompt_paths = {"base": canonical_path.relative_to(run_dir).as_posix()}
    for clip in spec["clips"]:
        direction = clip.get("direction") or "the canonical facing"
        clip_path = run_dir / "prompts" / "clips" / f"{clip['id']}.md"
        clip_path.parent.mkdir(parents=True, exist_ok=True)
        clip_path.write_text(
            "\n".join(
                [
                    f"# Animation clip: {clip['id']}",
                    "",
                    f"Generate exactly {clip['frame_count']} complete separated poses in one horizontal strip, left to right in playback order.",
                    f"Action: {clip['action']}. Direction: {direction}. Loop mode: {clip['loop']}. Root motion: {clip['root_motion']}.",
                    f"Subject: {subject['display_name']} — {subject['description']}",
                    f"Identity lock: preserve the canonical face/anatomy, silhouette, palette, material, costume, equipment handedness, camera, scale, lighting model, and rendering style. {subject['style_notes']}",
                    "Use crisp integer-grid pixel art with no antialiasing or subpixel details." if canvas.get("pixel_art") else "Preserve the canonical edge treatment and detail density.",
                    "",
                    "Motion beats:",
                    beat_text(clip),
                    "",
                    f"Layout: follow the attached {clip['frame_count']}-slot guide for count, order, spacing, safe padding, and pivot only.",
                    "Do not reproduce its numbers, borders, slot fill, crosshairs, or other guide pixels.",
                    f"Use a {background_text}. Keep every pose complete, separated, and away from the outer canvas edge.",
                    "No text, arrows, labels, visible grid, checkerboard, scenery, cast shadow, contact sheet furniture, overlapping poses, or neighboring-slot intrusion.",
                    f"Clip notes: {clip.get('notes') or 'none'}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        prompt_paths[clip["id"]] = clip_path.relative_to(run_dir).as_posix()
    return prompt_paths


def build_jobs(run_dir: Path, spec: dict[str, Any], prompt_paths: dict[str, str]) -> dict[str, Any]:
    refs = [{"path": path, "role": "identity reference supplied by user"} for path in spec["subject"]["references"]]
    jobs: list[dict[str, Any]] = [
        {
            "id": "base",
            "kind": "canonical-base",
            "status": "pending",
            "depends_on": [],
            "prompt_file": prompt_paths["base"],
            "input_images": refs,
            "output_path": "references/canonical.png",
            "source_path": None,
            "completed_at": None,
            "qa_note": None,
        }
    ]
    for clip in spec["clips"]:
        guide_rel = f"references/layout-guides/{clip['id']}.png"
        jobs.append(
            {
                "id": clip["id"],
                "kind": "animation-strip",
                "status": "pending",
                "depends_on": ["base"],
                "prompt_file": prompt_paths[clip["id"]],
                "input_images": [
                    {"path": "references/canonical.png", "role": "canonical identity source of truth"},
                    {"path": guide_rel, "role": "layout-only guide; do not copy guide pixels"},
                    *refs,
                ],
                "output_path": f"decoded/{clip['id']}.png",
                "frames_path": f"frames/{clip['id']}",
                "source_path": None,
                "completed_at": None,
                "qa_note": None,
            }
        )
    return {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "run_dir": str(run_dir),
        "jobs": jobs,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", type=Path, help="Full animation request JSON")
    parser.add_argument("--project-name", default="animation-project")
    parser.add_argument("--character-name")
    parser.add_argument("--description")
    parser.add_argument("--style-notes")
    parser.add_argument("--reference", type=Path, action="append", default=[])
    parser.add_argument("--frame-size", default="256x256")
    parser.add_argument("--padding", type=int, default=12)
    parser.add_argument("--pixel-art", action="store_true")
    parser.add_argument("--pivot-x", type=float, default=0.5)
    parser.add_argument("--pivot-y", type=float, default=0.9)
    parser.add_argument("--chroma-key", default="#FF00FF")
    parser.add_argument("--chroma-threshold", type=int, default=72)
    parser.add_argument("--direction-mode", choices=["screen-space", "world-space", "character-relative", "none"], default="screen-space")
    parser.add_argument("--camera-mapping")
    parser.add_argument("--action", type=parse_action, action="append")
    parser.add_argument("--export-mode", choices=["frames", "atlas", "atlas-and-frames"], default="atlas-and-frames")
    parser.add_argument("--atlas-max-width", type=int, default=4096)
    parser.add_argument("--atlas-max-height", type=int, default=4096)
    parser.add_argument("--atlas-format", choices=["png", "webp", "both"], default="png")
    parser.add_argument("--power-of-two", action="store_true")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--force", action="store_true", help="Replace generated spec/prompts/guides; never deletes artwork")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        for reference in args.reference:
            if not reference.is_file():
                raise FileNotFoundError(f"Reference image does not exist: {reference}")
        spec = build_spec(args)
        require_valid_spec(spec)
        run_dir = args.output_dir.resolve()
        spec_path = run_dir / "animation-spec.json"
        if spec_path.exists() and not args.force:
            raise FileExistsError(f"Run already exists: {spec_path}; pass --force to refresh generated control files")
        for relative in ("prompts/clips", "references/layout-guides", "decoded", "frames", "final", "qa"):
            (run_dir / relative).mkdir(parents=True, exist_ok=True)
        for clip in spec["clips"]:
            make_layout_guide(run_dir / "references" / "layout-guides" / f"{clip['id']}.png", clip, spec)
        prompts = write_prompts(run_dir, spec)
        jobs = build_jobs(run_dir, spec, prompts)
        write_json(spec_path, spec)
        write_json(run_dir / "visual-jobs.json", jobs)
        print(f"run_dir={run_dir}")
        print(f"spec={spec_path}")
        print(f"jobs={run_dir / 'visual-jobs.json'}")
        print(f"clips={len(spec['clips'])}")
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
