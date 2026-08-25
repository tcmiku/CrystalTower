# QA Gates

Read this reference before accepting a clip, resolving warnings, regenerating artwork, or packaging.

## Evidence Set

Every delivered run should include:

- `qa/validation.json`: deterministic structural and motion metrics
- `qa/contact-sheet.png`: all frames labeled by clip and index
- `qa/previews/<clip>.gif`: timing-aware playback
- `qa/onion-skins/<clip>.png`: adjacent-frame displacement evidence
- `frames/<clip>/frames-manifest.json`: source crop and transform provenance
- `final/atlas.json`: rectangles, pivots, durations, events, and clip tags when an atlas exists
- `qa/review-resolution.json`: only when warnings are accepted

Inspect animation at intended in-game size first, then at 1:1 pixels. Enlarged inspection is useful for alpha edges and pixel defects but must not be used to claim that an unreadable small sprite communicates a direction or action.

## Structural Errors

These block packaging:

- missing clip or frame
- wrong frame count or canvas size
- blank required frame
- visible pixels on a forbidden logical-canvas edge
- atlas rectangle outside texture bounds or pointing to the wrong frame
- metadata duration, event frame, loop mode, direction, or pivot outside the spec
- source pose overlap/cropping that cannot be recovered deterministically
- nontransparent background after the declared cleanup stage
- unreadable or corrupt image/JSON artifact

Do not override structural errors as visual taste.

## Visual-Semantic Errors

These require repairing the source clip:

- identity, costume, anatomy, palette, camera, projection, or equipment drift
- wrong action, direction, handedness, or game meaning
- missing anticipation/contact/recovery beat required by the spec
- prop detachment, limb discontinuity, broken silhouette, or a pose from a different motion family
- cardinal direction ambiguous at intended size
- diagonal in the wrong quadrant or a visible direction-family phase reversal
- unintended whole-sprite scale pop, registration jump, or camera move
- a looping clip with a conspicuous unplanned closure snap
- a one-shot clip that visibly restarts because the first frame was duplicated at the end

Regenerate the whole coherent clip when the final normalized cell is visually wrong because its source pose is wrong.

## Warnings Requiring Review

Metrics are evidence, not universal animation laws. Review these visually:

- consecutive-frame alpha or color difference is unusually small or large
- visible bounding-box area varies substantially
- subject center moves farther than expected for an in-place clip
- loop closure differs more than typical adjacent changes
- pose-group extraction fell back to stable slots
- small detached components may be intentional VFX
- intermediate direction is subtle while cardinals remain clear
- an intentional hold produces duplicate-looking frames

Accept a warning only when the intended-size preview shows no defect and the spec explains the behavior. Record:

```json
{
  "accepted": [
    {
      "check": "attack-east:large-frame-diff:2->3",
      "reason": "Intentional contact-frame impact jump; silhouette and attachment remain coherent",
      "reviewed_by": "user|parent",
      "evidence": ["qa/previews/attack-east.gif", "qa/onion-skins/attack-east.png"]
    }
  ]
}
```

## Motion Review by Clip Type

### Loop

- first-to-last transition reads as the same cycle boundary
- no duplicated terminal frame unless timing requires a hold
- center of mass and planted contacts do not teleport
- secondary motion returns naturally

### One Shot

- readable starting intent, peak action, and recovery/end state
- final frame matches the transition contract
- no requirement for closure unless the action returns to idle inside the clip

### Ping-Pong

- endpoints do not contain directional contact poses that look wrong when reversed
- metadata, not duplicated images, owns the reverse traversal when the engine supports it

### Authored Root Motion

- logical displacement is intentional and preserved
- pivot/root track remains consistent with gameplay movement
- normalization did not recenter away the motion

### VFX

- birth, expansion/action, decay, and end alpha are coherent
- edge contact is allowed only by spec
- no unexpected dark or chroma halo on contrasting backgrounds
- attachment point remains stable for attached effects

## Direction Review

Review cardinals without labels when confidence matters. A reviewer should identify the direction from visible face/body/feet/equipment cues at intended size. Direction labels and ordered playback may be used for diagonal continuity review after cardinals pass.

Mirrored outputs need explicit comparison with the source for:

- frame order and timing preserved
- correct destination direction
- equipment and injury sides remain acceptable
- no reversed text, symbol, lighting, or one-sided design meaning
- attack collision timing and pose silhouette remain valid

## Alpha and Edge Review

Inspect on at least two contrasting backgrounds. Fully transparent pixels should have cleared hidden RGB when the target pipeline is sensitive to texture bleed. Semi-transparent effect pixels must retain intended color without a chroma fringe.

Do not repeatedly despill a passing asset; multiple cleanup passes can erode outlines and translucent effects. Once deterministic alpha validation and contrasting-background review pass, close the issue.

## Repair Convergence

After each failure:

1. name the failed gate and concrete evidence
2. classify it as spec, visual-semantic, source-geometry, extraction, timing, alpha, or packing
3. change the root condition, not unrelated prompt wording
4. preserve every already-passing property
5. compare the new artifact with the prior one

A repair counts as progress only when it reduces failure severity without breaking a passed gate. If the same failure returns twice or moves between frames, change the motion construction or extraction strategy.

## Final Gate

Package only when:

- deterministic validation has no errors
- every warning is repaired or recorded in `qa/review-resolution.json`
- all previews and contact/onion sheets were visually reviewed
- requested engine metadata exists and was checked against the generic source metadata
- final user-facing paths point to runtime assets, not decoded source strips or guides
