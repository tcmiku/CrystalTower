# Visual Generation and Repair

Read this reference before calling `$imagegen` for a canonical image, animation strip, direction family, VFX sequence, or repair.

## Generation Unit

Generate one coherent clip strip per visual job. A coherent strip shares one identity, camera, scale, lighting model, palette, and motion idea. It is generated together in playback order so neighboring frames relate to one another.

Do not generate the final atlas as one image. Do not generate independent final cells and collage them into a new clip unless the source is an existing user-approved frame set being converted.

## Canonical Identity Lock

The canonical reference should make stable features easy to inspect:

- complete silhouette and all persistent props
- face, anatomy, material, palette, markings, costume, and equipment handedness
- camera angle and projection
- outline/rendering language and intended pixel density
- clear alpha or a removable flat background

Animation prompts should state what must remain unchanged, then describe only the current action and its timing beats. Avoid re-describing the character in a way that invites redesign.

## Strip Prompt Contract

Each prompt should contain:

1. clip id and frame count
2. exact left-to-right playback order
3. action, direction, loop mode, and root-motion policy
4. named semantic beats with approximate frame ranges
5. identity and camera locks
6. spacing and edge requirements
7. background requirements
8. action-specific forbidden artifacts

The prepared prompt is authoritative. Attach the layout guide as construction evidence only. The rendered output must not reproduce guide labels, borders, slot fills, center marks, or grid lines.

## Motion Design

Plan the action before generation:

- intent: what the player should read immediately
- line of action and center-of-mass travel
- anticipation, action/contact, overshoot, recovery, and settle
- limb/prop attachment and occlusion changes
- which parts lead, follow, drag, squash, stretch, or remain rigid
- loop closure or one-shot final pose
- exact frames that must remain readable for gameplay

Prefer readable silhouettes and weight changes over decorative motion streaks. A small sprite cannot carry many subtle simultaneous cues.

### Idle

Use restrained breathing, blink, material sway, or weight shift. The loop must change visibly at intended size without becoming a different action. Avoid six near-identical copies.

### Locomotion

Keep gait phase explicit: contact, down, passing, up, then the opposite side. In-place clips keep the logical pivot stable while limbs and body cycle. Authored root motion preserves translation and must use `stable-slots` or metadata root tracks.

### Attack and Interaction

Show anticipation, readable contact, follow-through, and recovery. Keep gameplay events in metadata. Weapon trails belong only when requested and should form one coherent attached effect rather than detached decorative streaks.

### Hit, Death, and Reactions

Preserve identity and spatial continuity. Avoid floating punctuation, arbitrary symbols, or effects that change game meaning. For death/defeat, confirm whether the final frame must remain loopable, hold, disappear, or transition.

### VFX

Define the effect's attachment point, growth/decay, luminance range, alpha behavior, and whether it is seamless. Keep the effect inside its logical canvas unless the spec explicitly allows edge crossing. Avoid unintended premultiplied-color halos.

## Direction Families

Write a direction plan before generating a 4-way or 8-way family:

- coordinate system and camera mapping
- visible side, occluded side, and equipment relationships for each cardinal
- gait phase correspondence across directions
- what can be mirrored safely
- how diagonals interpolate between adjacent cardinals

Approve cardinals before diagonals. Left/right are viewer/image coordinates in `screen-space`, never character-relative. A cardinal that is ambiguous at final size fails.

Do not rotate or skew the complete sprite to fake a new direction. Redraw the pose family so foreshortening, overlap, face orientation, feet, equipment, and lighting remain physically coherent.

## Effects and Transparency

Generated pixels should be either part of the runtime sprite or cleanly removable background.

Avoid unless explicitly requested:

- labels, frame numbers, arrows, grids, checkerboards, UI, scenery
- cast/contact shadows or floor patches
- blur, soft glow beyond the sprite's intended effect bounds, compression noise
- detached specks, dust, stars, punctuation, or loose fragments that segmentation can confuse with separate poses
- chroma-key-adjacent subject colors
- pose overlap, cropped foreground, or content touching the outer strip edge

Detached effect components are allowed only when they are intentional runtime pixels, remain inside the corresponding slot, and are identified in the clip notes so extraction does not discard them.

## Incremental Selection and Provenance

After a generation result is selected:

1. Copy the exact selected source into the job's `decoded/` path.
2. Record `source_path`, references used, prompt path, selection note, and timestamp.
3. Extract the clip immediately.
4. Render a short preview and inspect it before completing the job.
5. Mark complete only when the copied source and deterministic artifacts exist.

Do not let a helper script populate decoded visual jobs. Scripts process selected artwork; they do not pretend generation occurred.

## Repair Policy

Classify the root problem:

- wrong identity/style/camera/direction/action: regenerate the full coherent clip
- one bad final cell caused by the source pose: regenerate the full coherent clip or use an explicitly approved authored source-frame repair followed by complete clip review
- regular strip but failed component recovery: switch to `stable-slots`
- inconsistent generated slot positions: regenerate; do not normalize away gameplay motion accidentally
- scale/baseline jitter introduced by extraction: change deterministic normalization
- timing or event mismatch: repair metadata without regenerating pixels
- chroma/alpha issue: adjust the deterministic key only if the subject colors remain safe; otherwise regenerate on a safer background

After two recurrences of the same root failure, change strategy rather than accumulating prompt adjectives. Simplify the motion, choose clearer key poses, reduce detached effects, strengthen cardinal anchors, or split the clip.

## Worker Handoff Template

When delegation is available and authorized, give a visual worker exactly one job:

```text
Generate one coherent 2D game animation strip with $imagegen.

Run dir: <absolute run dir>
Job id: <job id>
Prompt file: <absolute prompt path>
Input images:
- <absolute path> — canonical identity
- <absolute path> — layout-only guide
- <absolute path> — optional direction/continuity evidence

Use $imagegen only. Read the prompt and attach every listed image. Verify the exact frame count, left-to-right playback order, stable identity/camera/scale, separated complete poses, requested background, and absence of copied guides or labels.

Do not edit manifests, copy files, extract frames, assemble atlases, package, or inspect unrelated files.
Return exactly:
selected_source=<absolute path>
qa_note=<one sentence>
```
