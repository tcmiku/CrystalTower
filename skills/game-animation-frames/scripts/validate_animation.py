#!/usr/bin/env python3
"""Validate frame structure, motion evidence, atlas integrity, and warning resolution."""

from __future__ import annotations

import argparse
import statistics
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from common import frame_durations, frame_paths, load_rgba, read_json, validate_spec, write_json


def issue(severity: str, check: str, message: str, **context: Any) -> dict[str, Any]:
    return {"severity": severity, "check": check, "message": message, **context}


def visible_bbox(array: np.ndarray, alpha_threshold: int) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(array[:, :, 3] > alpha_threshold)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def frame_signature(array: np.ndarray) -> np.ndarray:
    rgba = array.astype(np.float32) / 255.0
    premultiplied = rgba[:, :, :3] * rgba[:, :, 3:4]
    return np.concatenate((premultiplied, rgba[:, :, 3:4]), axis=2)


def frame_difference(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.mean(np.abs(frame_signature(left) - frame_signature(right))))


def alpha_centroid(array: np.ndarray) -> tuple[float, float]:
    weights = array[:, :, 3].astype(np.float64) / 255.0
    total = float(weights.sum())
    if total <= 0:
        return 0.0, 0.0
    ys, xs = np.indices(weights.shape)
    return float((xs * weights).sum() / total), float((ys * weights).sum() / total)


def validate_clip(
    run_dir: Path,
    spec: dict[str, Any],
    clip: dict[str, Any],
    alpha_threshold: int,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    frame_width = int(spec["canvas"]["frame_width"])
    frame_height = int(spec["canvas"]["frame_height"])
    edge_policy = spec["canvas"].get("edge_policy", "clear")
    arrays: list[np.ndarray] = []
    bboxes: list[tuple[int, int, int, int] | None] = []
    areas: list[int] = []
    centers: list[tuple[float, float]] = []

    durations = frame_durations(clip)
    if len(durations) != int(clip["frame_count"]):
        issues.append(issue("error", f"clip:{clip['id']}:duration-count", "Duration count does not match frame count", clip=clip["id"]))

    for index, path in enumerate(frame_paths(run_dir, clip)):
        check_prefix = f"clip:{clip['id']}:frame:{index:03d}"
        if not path.is_file():
            issues.append(issue("error", f"{check_prefix}:missing", f"Missing frame {path}", clip=clip["id"], frame=index))
            continue
        try:
            with Image.open(path) as opened:
                source_mode = opened.mode
                image = opened.convert("RGBA")
        except Exception as exc:
            issues.append(issue("error", f"{check_prefix}:unreadable", f"Cannot read frame: {exc}", clip=clip["id"], frame=index))
            continue
        if image.size != (frame_width, frame_height):
            issues.append(
                issue(
                    "error",
                    f"{check_prefix}:size",
                    f"Expected {frame_width}x{frame_height}, got {image.width}x{image.height}",
                    clip=clip["id"],
                    frame=index,
                )
            )
        if source_mode not in {"RGBA", "LA", "P"}:
            issues.append(issue("warning", f"{check_prefix}:mode", f"Source mode {source_mode} was converted to RGBA", clip=clip["id"], frame=index))
        array = np.asarray(image, dtype=np.uint8)
        bbox = visible_bbox(array, alpha_threshold)
        if bbox is None:
            issues.append(issue("error", f"{check_prefix}:empty", "Required frame is fully transparent", clip=clip["id"], frame=index))
            arrays.append(array)
            bboxes.append(None)
            areas.append(0)
            centers.append((0.0, 0.0))
            continue
        if edge_policy == "clear":
            edge_pixels = int(
                np.count_nonzero(array[0, :, 3] > alpha_threshold)
                + np.count_nonzero(array[-1, :, 3] > alpha_threshold)
                + np.count_nonzero(array[:, 0, 3] > alpha_threshold)
                + np.count_nonzero(array[:, -1, 3] > alpha_threshold)
            )
            if edge_pixels:
                issues.append(
                    issue(
                        "error",
                        f"{check_prefix}:edge-touch",
                        f"{edge_pixels} visible edge pixels violate canvas.edge_policy=clear",
                        clip=clip["id"],
                        frame=index,
                    )
                )
        hidden_rgb = int(np.count_nonzero(np.any(array[:, :, :3] != 0, axis=2) & (array[:, :, 3] == 0)))
        if hidden_rgb:
            issues.append(
                issue(
                    "warning",
                    f"{check_prefix}:hidden-rgb",
                    f"{hidden_rgb} fully transparent pixels retain hidden RGB",
                    clip=clip["id"],
                    frame=index,
                )
            )
        arrays.append(array)
        bboxes.append(bbox)
        areas.append(int(np.count_nonzero(array[:, :, 3] > alpha_threshold)))
        centers.append(alpha_centroid(array))

    expected = int(clip["frame_count"])
    actual_files = sorted((run_dir / "frames" / clip["id"]).glob("[0-9][0-9][0-9].png"))
    if len(actual_files) != expected:
        issues.append(
            issue(
                "error",
                f"clip:{clip['id']}:file-count",
                f"Expected exactly {expected} numbered PNG files, found {len(actual_files)}",
                clip=clip["id"],
            )
        )

    consecutive: list[float] = []
    center_deltas: list[float] = []
    for index in range(min(len(arrays), expected) - 1):
        difference = frame_difference(arrays[index], arrays[index + 1])
        consecutive.append(difference)
        if np.array_equal(arrays[index], arrays[index + 1]):
            issues.append(
                issue(
                    "warning",
                    f"clip:{clip['id']}:duplicate:{index:03d}->{index + 1:03d}",
                    "Consecutive frames are pixel-identical; confirm an intentional hold",
                    clip=clip["id"],
                )
            )
        dx = centers[index + 1][0] - centers[index][0]
        dy = centers[index + 1][1] - centers[index][1]
        delta = float((dx * dx + dy * dy) ** 0.5)
        center_deltas.append(delta)
        if clip["root_motion"] == "in-place" and delta > 0.15 * (frame_width * frame_width + frame_height * frame_height) ** 0.5:
            issues.append(
                issue(
                    "warning",
                    f"clip:{clip['id']}:center-jump:{index:03d}->{index + 1:03d}",
                    f"In-place alpha centroid moved {delta:.1f}px",
                    clip=clip["id"],
                )
            )

    nonempty_boxes = [bbox for bbox in bboxes if bbox is not None]
    widths = [bbox[2] - bbox[0] for bbox in nonempty_boxes]
    heights = [bbox[3] - bbox[1] for bbox in nonempty_boxes]
    if widths and min(widths) > 0 and max(widths) / min(widths) > 1.45:
        issues.append(issue("warning", f"clip:{clip['id']}:width-pop", f"Visible width ratio is {max(widths) / min(widths):.2f}", clip=clip["id"]))
    if heights and min(heights) > 0 and max(heights) / min(heights) > 1.35:
        issues.append(issue("warning", f"clip:{clip['id']}:height-pop", f"Visible height ratio is {max(heights) / min(heights):.2f}", clip=clip["id"]))

    loop_closure = None
    if clip["loop"] == "loop" and len(arrays) > 1:
        loop_closure = frame_difference(arrays[-1], arrays[0])
        median = statistics.median(consecutive) if consecutive else 0.0
        if loop_closure > max(0.22, median * 2.5):
            issues.append(
                issue(
                    "warning",
                    f"clip:{clip['id']}:loop-closure",
                    f"Loop closure difference {loop_closure:.4f} is large relative to median adjacent difference {median:.4f}",
                    clip=clip["id"],
                )
            )
        if np.array_equal(arrays[-1], arrays[0]):
            issues.append(
                issue(
                    "warning",
                    f"clip:{clip['id']}:duplicate-loop-end",
                    "First and last frame are identical; prefer timing metadata unless an engine requires the duplicate",
                    clip=clip["id"],
                )
            )

    manifest_path = run_dir / "frames" / clip["id"] / "frames-manifest.json"
    if not manifest_path.is_file():
        issues.append(issue("error", f"clip:{clip['id']}:manifest-missing", "frames-manifest.json is missing", clip=clip["id"]))
    else:
        try:
            manifest = read_json(manifest_path)
            for index, warning in enumerate(manifest.get("warnings", [])):
                issues.append(
                    issue(
                        "warning",
                        f"clip:{clip['id']}:extraction-warning:{index}",
                        str(warning),
                        clip=clip["id"],
                    )
                )
        except Exception as exc:
            issues.append(issue("error", f"clip:{clip['id']}:manifest-invalid", f"Invalid frames manifest: {exc}", clip=clip["id"]))

    metrics = {
        "frame_count": len(arrays),
        "visible_area": areas,
        "visible_bbox": [list(value) if value else None for value in bboxes],
        "alpha_centroid": [[round(x, 3), round(y, 3)] for x, y in centers],
        "consecutive_difference": [round(value, 6) for value in consecutive],
        "center_delta_px": [round(value, 3) for value in center_deltas],
        "loop_closure_difference": round(loop_closure, 6) if loop_closure is not None else None,
    }
    return issues, metrics


def validate_atlas(run_dir: Path, spec: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    metadata_path = run_dir / "final" / "atlas.json"
    if not metadata_path.is_file():
        return [issue("error", "atlas:metadata-missing", f"Missing {metadata_path}")]
    try:
        metadata = read_json(metadata_path)
    except Exception as exc:
        return [issue("error", "atlas:metadata-invalid", f"Invalid atlas metadata: {exc}")]
    pages: dict[int, np.ndarray] = {}
    page_sizes: dict[int, tuple[int, int]] = {}
    for page in metadata.get("pages", []):
        index = int(page["index"])
        images = page.get("images", {})
        image_name = images.get("png") or images.get("webp")
        if not image_name:
            issues.append(issue("error", f"atlas:page:{index}:image-missing", "Page has no PNG or WebP image"))
            continue
        image_path = run_dir / "final" / image_name
        if not image_path.is_file():
            issues.append(issue("error", f"atlas:page:{index}:file-missing", f"Missing atlas page {image_path}"))
            continue
        image = load_rgba(image_path)
        pages[index] = np.asarray(image, dtype=np.uint8)
        page_sizes[index] = image.size
        expected_size = (int(page["size"]["w"]), int(page["size"]["h"]))
        if image.size != expected_size:
            issues.append(issue("error", f"atlas:page:{index}:size", f"Metadata says {expected_size}, image is {image.size}"))

    expected_frames = sum(int(clip["frame_count"]) for clip in spec["clips"])
    records = metadata.get("frames", [])
    if len(records) != expected_frames:
        issues.append(issue("error", "atlas:frame-count", f"Expected {expected_frames} frame records, found {len(records)}"))
    seen: set[str] = set()
    for record in records:
        key = str(record.get("key"))
        if key in seen:
            issues.append(issue("error", f"atlas:key:{key}:duplicate", "Duplicate atlas frame key"))
        seen.add(key)
        page_index = int(record.get("page", -1))
        if page_index not in pages:
            issues.append(issue("error", f"atlas:key:{key}:page", f"Unknown atlas page {page_index}"))
            continue
        rect = record.get("rect", {})
        try:
            x, y, width, height = (int(rect[field]) for field in ("x", "y", "w", "h"))
        except Exception:
            issues.append(issue("error", f"atlas:key:{key}:rect", "Invalid rectangle"))
            continue
        page_width, page_height = page_sizes[page_index]
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > page_width or y + height > page_height:
            issues.append(issue("error", f"atlas:key:{key}:bounds", f"Rectangle {(x, y, width, height)} exceeds page bounds"))
            continue
        source_path = run_dir / str(record.get("source", ""))
        if not source_path.is_file():
            issues.append(issue("error", f"atlas:key:{key}:source", f"Missing source frame {source_path}"))
            continue
        source = np.asarray(load_rgba(source_path), dtype=np.uint8)
        crop = pages[page_index][y : y + height, x : x + width]
        if source.shape != crop.shape or not np.array_equal(source, crop):
            issues.append(issue("error", f"atlas:key:{key}:pixel-mismatch", "Atlas rectangle does not exactly match its source frame"))
    return issues


def accepted_checks(run_dir: Path) -> set[str]:
    path = run_dir / "qa" / "review-resolution.json"
    if not path.is_file():
        return set()
    try:
        data = read_json(path)
        return {str(item["check"]) for item in data.get("accepted", []) if isinstance(item, dict) and item.get("check")}
    except Exception:
        return set()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--clip")
    parser.add_argument("--json-out", type=Path)
    parser.add_argument("--alpha-threshold", type=int, default=8)
    parser.add_argument("--require-atlas", action="store_true")
    parser.add_argument("--require-resolved-warnings", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_dir = args.run_dir.resolve()
    output = args.json_out.resolve() if args.json_out else run_dir / "qa" / "validation.json"
    issues: list[dict[str, Any]] = []
    metrics: dict[str, Any] = {}
    try:
        spec = read_json(run_dir / "animation-spec.json")
        for message in validate_spec(spec):
            issues.append(issue("error", "spec:invalid", message))
        clips = spec.get("clips", [])
        if args.clip:
            clips = [clip for clip in clips if clip.get("id") == args.clip]
            if not clips:
                issues.append(issue("error", f"clip:{args.clip}:unknown", "Requested clip is not in the spec"))
        for clip in clips:
            clip_issues, clip_metrics = validate_clip(run_dir, spec, clip, args.alpha_threshold)
            issues.extend(clip_issues)
            metrics[clip["id"]] = clip_metrics
        if args.require_atlas:
            issues.extend(validate_atlas(run_dir, spec))

        if args.require_resolved_warnings:
            accepted = accepted_checks(run_dir)
            unresolved = [entry for entry in issues if entry["severity"] == "warning" and entry["check"] not in accepted]
            for warning in unresolved:
                issues.append(
                    issue(
                        "error",
                        f"resolution:{warning['check']}",
                        "Warning is unresolved; repair it or record an evidence-backed acceptance in qa/review-resolution.json",
                    )
                )

        errors = [entry for entry in issues if entry["severity"] == "error"]
        warnings = [entry for entry in issues if entry["severity"] == "warning"]
        report = {
            "schema_version": 1,
            "ok": not errors,
            "run_dir": str(run_dir),
            "clip_filter": args.clip,
            "require_atlas": args.require_atlas,
            "require_resolved_warnings": args.require_resolved_warnings,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "issues": issues,
            "metrics": metrics,
        }
        write_json(output, report)
        if not args.clip:
            summary = {
                "schema_version": 1,
                "ok": not errors,
                "run_dir": str(run_dir),
                "validation": output.relative_to(run_dir).as_posix() if output.is_relative_to(run_dir) else str(output),
                "atlas_metadata": "final/atlas.json" if (run_dir / "final" / "atlas.json").is_file() else None,
                "contact_sheet": "qa/contact-sheet.png" if (run_dir / "qa" / "contact-sheet.png").is_file() else None,
                "qa_index": "qa/qa-index.json" if (run_dir / "qa" / "qa-index.json").is_file() else None,
                "clips": [clip.get("id") for clip in spec.get("clips", [])],
                "error_count": len(errors),
                "warning_count": len(warnings),
            }
            write_json(run_dir / "qa" / "run-summary.json", summary)
        print(f"ok={str(not errors).lower()}")
        print(f"errors={len(errors)}")
        print(f"warnings={len(warnings)}")
        print(f"report={output}")
        return 0 if not errors else 1
    except Exception as exc:
        fallback = {
            "schema_version": 1,
            "ok": False,
            "run_dir": str(run_dir),
            "error_count": 1,
            "warning_count": 0,
            "issues": [issue("error", "validator:exception", str(exc))],
            "metrics": metrics,
        }
        try:
            write_json(output, fallback)
        except Exception:
            pass
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
