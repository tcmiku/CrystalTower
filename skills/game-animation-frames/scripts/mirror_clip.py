#!/usr/bin/env python3
"""Mirror approved clip frames individually while preserving temporal order."""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from common import read_json, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--decision-note", required=True)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        source_dir = args.source_dir.resolve()
        output_dir = args.output_dir.resolve()
        if source_dir == output_dir:
            raise ValueError("source-dir and output-dir must differ")
        source_frames = sorted(source_dir.glob("[0-9][0-9][0-9].png"))
        if not source_frames:
            raise FileNotFoundError(f"No numbered PNG frames found in {source_dir}")
        existing = list(output_dir.glob("[0-9][0-9][0-9].png")) if output_dir.exists() else []
        if existing and not args.force:
            raise FileExistsError(f"Output frames already exist: {output_dir}; pass --force to replace matching files")
        output_dir.mkdir(parents=True, exist_ok=True)

        for source_path in source_frames:
            with Image.open(source_path) as image:
                image.convert("RGBA").transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(output_dir / source_path.name)

        source_manifest_path = source_dir / "frames-manifest.json"
        source_manifest = read_json(source_manifest_path) if source_manifest_path.is_file() else {}
        pivot = source_manifest.get("pivot", {"x": 0.5, "y": 0.9})
        mirrored_pivot = {"x": 1.0 - float(pivot.get("x", 0.5)), "y": float(pivot.get("y", 0.9))}
        manifest = {
            "schema_version": 1,
            "derivation": "horizontal-frame-mirror",
            "derived_at": datetime.now(timezone.utc).isoformat(),
            "source_dir": str(source_dir),
            "frame_count": len(source_frames),
            "temporal_order": "preserved",
            "decision_note": args.decision_note,
            "pivot": mirrored_pivot,
            "source_manifest": str(source_manifest_path) if source_manifest_path.is_file() else None,
            "frames": [
                {"index": index, "source_path": str(source_path), "output_path": source_path.name}
                for index, source_path in enumerate(source_frames)
            ],
        }
        write_json(output_dir / "frames-manifest.json", manifest)
        print(f"frames={len(source_frames)}")
        print(f"output_dir={output_dir}")
        print("temporal_order=preserved")
        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
