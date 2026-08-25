#!/usr/bin/env python3
"""Exercise request normalization, mirroring, variable timing, and paged atlases."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_DIR / "scripts"


def run(*args: str) -> None:
    completed = subprocess.run([sys.executable, *args], text=True, capture_output=True)
    if completed.returncode:
        raise AssertionError(f"Failed: {' '.join(args)}\n{completed.stdout}\n{completed.stderr}")


def make_frame(path: Path, index: int, color: tuple[int, int, int]) -> None:
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    x = 6 + index
    draw.rectangle((x, 8, x + 10, 26), fill=(*color, 255))
    draw.ellipse((x + 2, 4, x + 8, 10), fill=(240, 225, 180, 255))
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def write_manifest(directory: Path, count: int) -> None:
    (directory / "frames-manifest.json").write_text(
        json.dumps({"schema_version": 1, "frame_count": count, "warnings": []}, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="game-animation-edge-") as temporary:
        root = Path(temporary)
        request = {
            "schema_version": 1,
            "project": {"id": "edge-case", "display_name": "Edge Case"},
            "subject": {
                "id": "tester",
                "display_name": "Tester",
                "description": "Synthetic test sprite",
                "style_notes": "flat test colors",
                "references": [],
            },
            "canvas": {
                "frame_width": 32,
                "frame_height": 32,
                "padding": 2,
                "background": {"mode": "transparent"},
                "pivot": {"x": 0.5, "y": 0.9},
                "edge_policy": "clear",
            },
            "directions": {
                "mode": "screen-space",
                "values": ["east", "west"],
                "camera_mapping": None,
                "mirror_pairs": {"east": "west"},
            },
            "clips": [
                {
                    "id": "attack-east",
                    "action": "attack",
                    "direction": "east",
                    "frame_count": 3,
                    "durations_ms": [70, 140, 90],
                    "loop": "once",
                    "root_motion": "in-place",
                    "normalization": "shared-fit",
                    "anchor": "pivot",
                    "semantic_beats": [{"name": "contact", "frames": [1]}],
                    "events": [{"frame": 1, "name": "hit"}],
                    "notes": "test",
                },
                {
                    "id": "attack-west",
                    "action": "attack",
                    "direction": "west",
                    "frame_count": 3,
                    "fps": 10,
                    "loop": "once",
                    "root_motion": "in-place",
                    "normalization": "shared-fit",
                    "anchor": "pivot",
                    "semantic_beats": [],
                    "events": [],
                    "notes": "mirrored test",
                },
            ],
            "export": {
                "mode": "atlas-and-frames",
                "atlas": {
                    "layout": "rows-by-clip",
                    "max_width": 64,
                    "max_height": 32,
                    "power_of_two": True,
                    "format": "both",
                },
                "metadata": ["generic-json"],
            },
        }
        request_path = root / "request.json"
        request_path.write_text(json.dumps(request, indent=2) + "\n", encoding="utf-8")
        run_dir = root / "run"
        run(str(SCRIPTS / "prepare_animation_run.py"), "--request", str(request_path), "--output-dir", str(run_dir))

        east_dir = run_dir / "frames" / "attack-east"
        for index in range(3):
            make_frame(east_dir / f"{index:03d}.png", index, (30, 160, 225))
        write_manifest(east_dir, 3)
        west_dir = run_dir / "frames" / "attack-west"
        run(
            str(SCRIPTS / "mirror_clip.py"),
            "--source-dir",
            str(east_dir),
            "--output-dir",
            str(west_dir),
            "--decision-note",
            "Synthetic symmetric sprite",
        )
        east = np.asarray(Image.open(east_dir / "000.png").convert("RGBA"))
        west = np.asarray(Image.open(west_dir / "000.png").convert("RGBA"))
        assert np.array_equal(east[:, ::-1], west)

        run(str(SCRIPTS / "assemble_atlas.py"), "--run-dir", str(run_dir))
        metadata = json.loads((run_dir / "final" / "atlas.json").read_text(encoding="utf-8"))
        assert len(metadata["pages"]) == 4, metadata["pages"]
        assert all("png" in page["images"] and "webp" in page["images"] for page in metadata["pages"])
        contact = next(frame for frame in metadata["frames"] if frame["key"] == "attack-east/001")
        assert contact["duration_ms"] == 140
        assert contact["events"][0]["name"] == "hit"

        report = run_dir / "qa" / "validation.json"
        run(
            str(SCRIPTS / "validate_animation.py"),
            "--run-dir",
            str(run_dir),
            "--json-out",
            str(report),
            "--require-atlas",
        )
        assert json.loads(report.read_text(encoding="utf-8"))["ok"]
    print("edge_cases_test=pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
