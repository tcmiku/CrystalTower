---
name: game-animation-frames
description: Create, repair, validate, and package production-ready 2D raster game animation frame sequences from character concepts, reference art, existing frames, strips, or atlases. Use for sprite actions, directional animation sets, VFX sequences, frame-by-frame loops, spritesheets, and engine-ready frame metadata; do not use for 3D rigs, skeletal animation, or code-only shader motion.
---

# Game Animation Frames

## Outcome

Produce a coherent set of 2D raster animation clips with explicit timing, direction, pivots, events, transparent backgrounds, deterministic frame geometry, QA media, validation reports, and engine-neutral metadata. Preserve the user's visual style and requested engine contract. Do not silently force pixel art, a fixed frame count, a fixed atlas shape, or a particular engine.

This skill borrows the strongest production ideas from `hatch-pet`—a canonical identity reference, one visual job per coherent action, deterministic assembly, visible QA artifacts, provenance, and row-level repair—while replacing its pet-specific 8x11 contract with an explicit per-project animation specification.

## Boundary

Use this skill for bitmap frames that will be played as discrete images. It supports characters, creatures, props, UI animation, environmental loops, attacks, emotes, transitions, and sprite-like VFX.

- For 3D, skeletal, Spine/DragonBones rigging, motion capture, or blend trees, use a rigging/animation workflow instead.
- For a shader-only effect, use a shader workflow unless the user explicitly needs baked frames.
- For an existing SVG or code-native vector animation, preserve that representation unless the user asks for raster frames.
- Never invent copyrighted character identity from a bare franchise name. Use user-supplied or authorized references and preserve the requested degree of transformation.

## Visual Generation

Use `$imagegen` for normal visual synthesis or image editing. Before generating a canonical reference, action strip, direction anchor, VFX strip, or repair strip, load and follow the installed image generation skill:

```text
${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/SKILL.md
```

Do not call an image API, image CLI, local diffusion model, or a one-off raster drawing script as a substitute for missing generated artwork. Bundled scripts may create layout guides, remove a known flat background, extract already-generated poses, normalize frames, mirror an approved clip, assemble an atlas, render QA media, and validate outputs. They must not fabricate missing animation poses.

Only a canonical-base job may be prompt-only. Every animation job must attach the approved canonical reference and its layout guide. When the user supplies identity-defining images, attach all relevant references rather than relying on prose summaries.

## Runtime

Before running bundled scripts, call `load_workspace_dependencies`. Set `PYTHON` to the exact returned Python executable and use it for every command. The scripts require Pillow; validation and extraction also use NumPy.

Set `SKILL_DIR` to this skill's absolute folder and `RUN_DIR` to a project-owned working directory. Do not write generated artifacts back into the skill folder except during skill development or testing.

## Read Only What the Current Run Needs

- Always read [references/animation-spec.md](references/animation-spec.md) before preparing a run or changing `animation-spec.json`.
- Read [references/visual-generation.md](references/visual-generation.md) before generating or repairing artwork, including directional or VFX clips.
- Read [references/qa-gates.md](references/qa-gates.md) before accepting warnings, regenerating a failed clip, or packaging.
- Read [references/engine-handoff.md](references/engine-handoff.md) only when exporting or integrating with an engine.

## Production Contract

Record the contract in `animation-spec.json` before generating animation frames. The minimum contract is:

- character/effect identity and authorized reference images
- frame canvas size and transparent/chroma background policy
- clips, frame counts, timing or FPS, loop mode, and semantic beats
- direction coordinate system and required directions
- pivot, in-place versus authored root motion, and alignment policy
- export form: individual frames, atlas, or both
- requested engine metadata and texture constraints

Infer safe prototype defaults when omitted, write them into the spec, and tell the user what was inferred. Do not guess engine-specific limits, world-direction conventions, root motion, or hit timing when a wrong choice would materially change gameplay.

Treat these as hard invariants:

1. The approved canonical image is the identity source of truth.
2. A clip is one coherent motion family, not a collage of unrelated generated frames.
3. Generated art never owns exact cell geometry; deterministic scripts do.
4. Frame order, duration, pivot, events, and source provenance survive every transformation.
5. Repair the smallest failing coherent unit. Usually that is the entire clip strip, not one final normalized cell.
6. Structural validation does not replace visual motion review, and visual review does not waive structural errors.

## Visible Work Plan

Keep a visible plan with one active stage:

1. Define the animation contract.
2. Lock the canonical visual identity.
3. Generate and approve coherent clips.
4. Extract, normalize, and assemble deterministic outputs.
5. Review motion and package the handoff.

Start at the first relevant stage for repair or conversion work. Mark a stage complete only when its artifact or decision exists.

## Default Workflow

### 1. Prepare the run

Create the run from CLI values or a fully authored JSON request:

```powershell
& $PYTHON "$SKILL_DIR/scripts/prepare_animation_run.py" `
  --project-name "forest-hero" `
  --character-name "Moss Knight" `
  --description "A compact moss-armored sword fighter" `
  --reference "C:\absolute\moss-knight.png" `
  --frame-size 256x256 `
  --direction-mode screen-space `
  --action "idle:south:6:loop:8" `
  --action "run:east:8:loop:12" `
  --action "attack:east:7:once:14" `
  --output-dir $RUN_DIR
```

For full control, pass `--request path/to/request.json`. The script validates the request, writes `animation-spec.json`, `visual-jobs.json`, state-specific prompts, and layout guides. Inspect both JSON files before generation.

### 2. Establish the canonical reference

If the user already provides a model sheet or approved neutral frame, preserve it as a generation reference. Otherwise generate one clean canonical image with `$imagegen`: a single complete subject, the requested camera/view, stable palette and proportions, no labels, no frame grid, no cast shadow unless the game art explicitly requires one, and a flat removable background or real alpha.

Copy the selected source to `references/canonical.png`, record its original absolute path and generation note in `visual-jobs.json`, then mark the base job complete. Do not overwrite user reference art.

### 3. Generate coherent animation clips

Read each ready job from `visual-jobs.json`. A job is ready only when all `depends_on` jobs are complete.

- Generate one whole clip strip per job, left to right in playback order.
- Attach every input listed by the job: canonical identity, relevant model-sheet views, action anchors, the layout guide, and continuity evidence when applicable.
- Keep character scale, camera, lighting, palette, outfit, anatomy, equipment handedness, and rendering style fixed.
- Make every frame a complete separated pose. No overlapping frames, labels, borders, contact sheet furniture, or neighboring-cell intrusion.
- Use pose, silhouette, weight shift, anticipation, follow-through, and authored effects to communicate motion. Avoid decorative motion marks unless they are part of the requested game effect.
- For an attack, interaction, or VFX clip, honor named semantic beats and leave gameplay event timing in metadata rather than painting hitboxes or labels into the art.

After selection, copy the exact generated image to the job's `decoded/` output path. Preserve `source_path`, `completed_at`, generation note, and reference list in the job manifest. Run incremental extraction and clip QA before marking the job complete.

### 4. Handle directional families deliberately

Direction values always use the coordinate system in the spec. `screen-space` left/right refer to the image edges; `world-space` directions require the project camera mapping in the spec.

For 4-way or 8-way families, approve cardinal pose/motion anchors before diagonals. Generate diagonals from adjacent approved cardinals and keep locomotion phase aligned across directions. Mirroring is allowed only after visual approval that anatomy, lighting, readable text, equipment, damage, asymmetrical clothing, and game meaning survive the flip.

When mirroring is safe, mirror individual frames while preserving frame indices and durations:

```powershell
& $PYTHON "$SKILL_DIR/scripts/mirror_clip.py" `
  --source-dir "$RUN_DIR/frames/run-east" `
  --output-dir "$RUN_DIR/frames/run-west" `
  --decision-note "Symmetric body and centered equipment; lighting is non-directional"
```

Never mirror the complete strip as one canvas if doing so reverses playback order. Never mirror a failed source clip.

### 5. Extract and normalize each generated strip

Use the extraction mode selected in the clip spec:

```powershell
& $PYTHON "$SKILL_DIR/scripts/extract_frames.py" `
  --run-dir $RUN_DIR `
  --clip run-east
```

The script reads frame size, background, pivot, normalization, and pixel-art settings from the spec. Pass explicit low-level options only for a documented repair. Use `shared-fit` for in-place actions whose subject should keep one scale and ground anchor. Use `stable-slots` for jumps, knockback, projectiles, camera-authored motion, or VFX where the source's within-slot displacement is intentional. Inspect `frames-manifest.json`; fallback from pose-group recovery to stable slots is a review warning, not silent success.

### 6. Validate incrementally

Validate a clip as soon as its frames exist:

```powershell
& $PYTHON "$SKILL_DIR/scripts/validate_animation.py" `
  --run-dir $RUN_DIR `
  --clip run-east `
  --json-out "$RUN_DIR/qa/run-east-validation.json"
```

Treat errors as blockers. Review warnings at normal display size and in motion. Deterministic chroma removal or packing failures call for a deterministic fix; wrong poses, identity drift, bad silhouettes, and broken timing call for regenerating the smallest failing coherent clip.

### 7. Assemble and render QA media

After every required clip has passed incremental review:

```powershell
& $PYTHON "$SKILL_DIR/scripts/assemble_atlas.py" --run-dir $RUN_DIR
& $PYTHON "$SKILL_DIR/scripts/render_qa.py" --run-dir $RUN_DIR
& $PYTHON "$SKILL_DIR/scripts/validate_animation.py" `
  --run-dir $RUN_DIR `
  --json-out "$RUN_DIR/qa/validation.json" `
  --require-atlas `
  --require-resolved-warnings
```

The required review set is `qa/contact-sheet.png`, every clip preview under `qa/previews/`, `qa/onion-skins/`, `qa/validation.json`, and `final/atlas.json` when an atlas is requested.

### 8. Visual QA and repair

Inspect the output at intended in-game size and at 1:1 pixels. Confirm identity, camera, scale, grounding, direction, action semantics, readable anticipation/contact/recovery, loop closure, prop attachment, effect continuity, and absence of unwanted crop or jitter.

Classify failures before acting:

- `spec`: contract or direction ambiguity; repair the spec and regenerate affected jobs.
- `visual-semantic`: wrong pose, facing, beat, identity, or style; regenerate the whole coherent clip.
- `source-geometry`: overlapping/cropped pose groups; regenerate or choose `stable-slots` only when the source layout is actually regular.
- `extraction`: source is correct but segmentation/normalization is wrong; change deterministic settings.
- `timing`: artwork is correct but duration/event data is wrong; repair metadata.
- `packing`: frames pass but atlas or bounds fail; repair deterministic export.

Do not keep changing prompts after the same root failure recurs twice. Change the pose plan, simplify the silhouette/effects, strengthen direction anchors, or split an overloaded clip.

### 9. Package the handoff

Keep these artifacts:

```text
run/
  animation-spec.json
  references/canonical.png
  frames/<clip-id>/<frame>.png
  frames/<clip-id>/frames-manifest.json
  final/atlas.png                  # when requested
  final/atlas.webp                 # when requested
  final/atlas.json
  qa/contact-sheet.png
  qa/previews/*.gif
  qa/onion-skins/*.png
  qa/validation.json
  qa/run-summary.json
```

Keep source strips, prompts, guides, and job manifests when the user wants an editable production archive. Otherwise they may remain in the run folder but must not be mistaken for final runtime assets.

## Acceptance Criteria

- Every required clip and frame exists with the specified canvas dimensions, duration, pivot, direction, and loop mode.
- Used frames are non-empty RGBA images; no visible pixels touch a forbidden edge unless the spec explicitly allows edge crossing.
- The same character/effect identity, camera, style, palette, anatomy, and equipment persist across the set.
- Motion communicates the named action at intended display size and contains the required semantic beats.
- Consecutive frames progress coherently; intentional holds are recorded in timing, and accidental duplicates, scale pops, anchor jumps, reversals, or broken attachments do not remain.
- Looping clips close without an unintended visible snap. One-shot clips do not duplicate the first frame merely to simulate closure.
- Directional clips match the declared coordinate system. Cardinal directions are unambiguous; diagonals remain in the correct quadrant and share phase with their family.
- Transparent-background and atlas validation pass. Metadata rectangles stay within atlas bounds and point to the correct frames.
- `qa/validation.json` has no errors. Every warning has a concise accepted reason in `qa/review-resolution.json`, or the affected clip is repaired.
- The contact sheet, GIF previews, and onion-skin sheets have been visually inspected before delivery.

## Non-Negotiable Rules

- Preserve user intent, authorized references, and requested engine constraints.
- Do not generate a complete final atlas as one image. Generate coherent clips, then assemble deterministically.
- Do not hand-edit a normalized final frame to conceal a bad generated source. Repair the coherent source clip unless the defect is purely deterministic.
- Do not treat generated labels, grids, checkerboards, or colored panels as transparency.
- Do not use frame interpolation to invent required key poses unless the user explicitly requests interpolation and approves its artifacts.
- Do not let automatic trimming change the logical frame canvas, pivot, hit timing, or authored root motion.
- Do not package a warning without recording who accepted it and why.
