#!/usr/bin/env python3
"""End-to-end smoke test using synthetic chroma strips; no visual generation required."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_DIR / "scripts"


def run(*args: str) -> None:
    command = [sys.executable, *args]
    completed = subprocess.run(command, text=True, capture_output=True)
    if completed.returncode:
        report = ""
        if "--json-out" in args:
            report_path = Path(args[args.index("--json-out") + 1])
            if report_path.is_file():
                report = f"\nreport:\n{report_path.read_text(encoding='utf-8')}"
        raise AssertionError(
            f"Command failed ({completed.returncode}): {' '.join(command)}\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}{report}"
        )


def make_strip(path: Path, count: int, jump: bool) -> None:
    slot = 64
    image = Image.new("RGB", (slot * count, slot), (255, 0, 255))
    draw = ImageDraw.Draw(image)
    for index in range(count):
        left = index * slot
        y_offset = (12 - abs(2 - index) * 3) if jump else (index % 2)
        body = (left + 22, 24 - y_offset, left + 41, 53 - y_offset)
        head = (left + 25, 14 - y_offset, left + 38, 27 - y_offset)
        draw.rounded_rectangle(body, radius=4, fill=(36, 170, 91), outline=(12, 60, 35), width=2)
        draw.ellipse(head, fill=(95, 218, 139), outline=(12, 60, 35), width=2)
        arm_shift = 3 if index % 2 else -3
        draw.line((left + 22, 33 - y_offset, left + 15 + arm_shift, 42 - y_offset), fill=(12, 60, 35), width=4)
        draw.line((left + 41, 33 - y_offset, left + 48 - arm_shift, 42 - y_offset), fill=(12, 60, 35), width=4)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="game-animation-frames-") as temporary:
        run_dir = Path(temporary) / "run"
        run(
            str(SCRIPTS / "prepare_animation_run.py"),
            "--project-name",
            "smoke-test",
            "--character-name",
            "Moss Test",
            "--frame-size",
            "64x64",
            "--padding",
            "4",
            "--action",
            "idle:none:4:loop:8",
            "--action",
            "jump:east:5:once:10",
            "--output-dir",
            str(run_dir),
        )
        spec = json.loads((run_dir / "animation-spec.json").read_text(encoding="utf-8"))
        for clip in spec["clips"]:
            strip = run_dir / "decoded" / f"{clip['id']}.png"
            make_strip(strip, int(clip["frame_count"]), clip["action"] == "jump")
            if clip["action"] == "idle":
                run(
                    str(SCRIPTS / "extract_frames.py"),
                    "--run-dir",
                    str(run_dir),
                    "--clip",
                    clip["id"],
                )
            else:
                run(
                    str(SCRIPTS / "extract_frames.py"),
                    "--strip",
                    str(strip),
                    "--output-dir",
                    str(run_dir / "frames" / clip["id"]),
                    "--frame-count",
                    str(clip["frame_count"]),
                    "--frame-size",
                    "64x64",
                    "--normalization",
                    clip["normalization"],
                    "--background",
                    "chroma",
                    "--chroma-key",
                    "#FF00FF",
                    "--padding",
                    "4",
                    "--pivot",
                    "0.5,0.9",
                )
        run(str(SCRIPTS / "assemble_atlas.py"), "--run-dir", str(run_dir))
        run(str(SCRIPTS / "render_qa.py"), "--run-dir", str(run_dir))
        report_path = run_dir / "qa" / "validation.json"
        run(
            str(SCRIPTS / "validate_animation.py"),
            "--run-dir",
            str(run_dir),
            "--json-out",
            str(report_path),
            "--require-atlas",
        )
        report = json.loads(report_path.read_text(encoding="utf-8"))
        assert report["ok"], report
        assert (run_dir / "final" / "atlas.png").is_file()
        assert (run_dir / "final" / "atlas.json").is_file()
        assert (run_dir / "qa" / "contact-sheet.png").is_file()
        assert len(list((run_dir / "qa" / "previews").glob("*.gif"))) == 2
        assert len(list((run_dir / "qa" / "onion-skins").glob("*.png"))) == 2
    print("smoke_test=pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
