# Decoder golden walkthrough design

## Status and relationship to the decoder interface spec

This document extends the approved [decoder interface design](./2026-08-26-decoder-interface-design.md). It supersedes that document only where it describes the map viewer, map-comparison placeholders, and uniformly illustrative result data. All other product decisions remain in force, including the public route, single-workspace layout, source metadata, model controls, frontend-only adapter boundary, and the rule that live decoding belongs in a later backend branch.

The change gives reviewers one scientifically traceable, fully local walkthrough with real NIfTI volumes and a recorded decoder response. It does not turn arbitrary inputs into live results and does not add a backend dependency.

## Product decision

The decoder will offer a **Load real walkthrough** action near the NeuroVault input. It will populate the form with public NeuroVault image 308, its declared metadata, and an optional plain-language interpretation that the reviewer can edit. Opening the walkthrough will load:

- the actual response-control statistical map from NeuroVault;
- an actual MNI anatomical template;
- 20 authentic signed correlations recorded from the legacy Neurosynth Pearson decoder; and
- actual Neurosynth association-test z maps for three comparison terms.

The walkthrough is a recorded example, not a new computation. Its results header and method summary will say **Recorded Neurosynth Pearson example** and identify the source, reference dataset, retrieval date, and score definition. The interface must never label these values as NeuroVLM or NiCLIP output.

Reviewers may still enter other NeuroVault images, choose the planned NeuroVLM or NiCLIP interfaces, and preview the existing illustrative fixtures. Those states remain visibly labeled as illustrative. Only the explicit golden walkthrough receives the recorded data and local maps.

## Canonical walkthrough dataset

### Input map

The fixed input is NeuroVault image 308, **landmark response control**, from collection 63, **A test-retest fMRI dataset for motor, language and spatial attention functions**.

The walkthrough pre-fills the following metadata from NeuroVault:

- NeuroVault image ID: `308`;
- source URL: `https://neurovault.org/images/308/`;
- statistic type: t;
- analysis level: group;
- modality: fMRI BOLD;
- subject count: 10;
- thresholding: unthresholded;
- target template: GenericMNI;
- Cognitive Atlas task: Landmark task (`trm_5346938eed092`); and
- contrast: correct or incorrect response (control).

The bundled input volume is the exact file served by NeuroVault at `https://neurovault.org/media/images/63/task005_cope04_Response_Control.nii.gz`. Its upstream compressed size is 814,903 bytes. The asset is public under NeuroVault's CC0 policy. The interface will still cite the collection, its authors, and DOI `10.1186/2047-217X-2-6` as scholarly provenance.

### Recorded decoder response

The response comes from the official legacy Neurosynth decode for NeuroVault image 308, result identifier `6a6a9cdb07754185b6218dff275112fe`, using reference dataset `terms_20k`. The legacy method is Pearson correlation between the vectorized input image and each reference term map, including zero-valued voxels.

The checked-in fixture contains the 20 largest correlations by absolute magnitude, ordered by absolute magnitude while preserving each signed value:

| Term | Pearson r |
| --- | ---: |
| premotor | 0.442 |
| motor | 0.395 |
| movements | 0.391 |
| parietal | 0.372 |
| premotor cortex | 0.368 |
| visual | 0.363 |
| execution | 0.363 |
| hand | 0.352 |
| finger | 0.340 |
| intraparietal | 0.337 |
| motor imagery | 0.321 |
| intraparietal sulcus | 0.317 |
| movement | 0.309 |
| action | 0.309 |
| dorsal premotor | 0.307 |
| posterior cingulate | -0.307 |
| eye | 0.307 |
| finger movements | 0.304 |
| supplementary | 0.300 |
| medial | -0.298 |

The table's default sort is **magnitude**, not descending signed value. The correlation column retains the sign, a zero-centred visual scale, and an explanation that correlation is spatial similarity rather than a probability, causal conclusion, or diagnosis. Reviewers can still sort by signed correlation or term name.

### Comparison maps

Three results have bundled, unthresholded Neurosynth association-test z maps:

| Term | Purpose in the walkthrough | Official asset |
| --- | --- | --- |
| premotor | default, strongest positive match | `premotor_association-test_z.nii.gz` |
| visual | a positive result with a distinct spatial pattern | `visual_association-test_z.nii.gz` |
| posterior cingulate | a strong negative correlation and contrasting pattern | `posterior cingulate_association-test_z.nii.gz` |

Their source endpoints are `/api/analyses/<term>/images/association/?unthresholded` on `neurosynth.org`. Other table rows remain valid recorded results but display **Comparison map not included in this walkthrough** rather than synthesizing a map or fetching one at runtime.

The term-map files are derived from the Neurosynth database. The fixture manifest will record the Neurosynth database ODbL provenance and the originating endpoint for each asset. Attribution remains visible in the walkthrough even where the source license does not require it.

## Asset packaging and reproducibility

All volumes used by the walkthrough are checked into `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/` so the review works offline and is not affected by CORS, service availability, or upstream changes. The directory contains:

- `generic-mni.nii.gz`;
- `response-control.nii.gz`;
- `premotor-association-z.nii.gz`;
- `visual-association-z.nii.gz`;
- `posterior-cingulate-association-z.nii.gz`; and
- `manifest.json`.

The combined compressed asset budget is approximately 7.6 MB and must remain below 9 MB. Volumes load only when the real walkthrough is opened; the `/decode` initial bundle and ordinary illustrative previews do not download them.

`manifest.json` records, for every file, its local filename, original URL, SHA-256 digest, byte count, retrieval date, license or database-license basis, attribution, and semantic role. It also records the exact decoder result endpoint, result identifier, `terms_20k` reference, ranking rule, and the 20 retained rows. Implementation generates digests from the downloaded bytes and verifies them before committing the assets.

The frontend imports a typed projection of this manifest through the fixture adapter. Components do not duplicate URLs, scores, or provenance strings.

## Walkthrough entry and state

The **Load real walkthrough** action is available only within the NeuroVault source panel. Activating it:

1. selects the NeuroVault source;
2. enters image 308;
3. fills the known map metadata and Cognitive Atlas task;
4. selects the fixture-only `neurosynth-pearson-recorded` model definition;
5. retains the visitor's free-text interpretation if they already wrote one; and
6. places focus on a short review card summarizing what will be opened.

The reviewer then activates **Open recorded walkthrough**. Keeping this second action preserves the normal input-review moment and makes clear when the larger local assets will load. The adjacent text states: **Uses bundled public maps and a recorded result; no decoder runs and nothing is uploaded.**

`neurosynth-pearson-recorded` appears in the model panel only while the golden example is active. It is read-only, carries a **Recorded example** badge, exposes no pretend parameters, and links to the method provenance. Choosing NeuroVLM or NiCLIP exits recorded-example mode and returns to illustrative fixture behavior without clearing the populated source fields. Editing any computation-relevant field marks the recorded result stale; reopening it requires restoring the canonical example values with **Restore walkthrough values**.

Entering image 308 manually does not silently substitute the recorded result. The interface may offer **A recorded walkthrough is available for this image**, but the visitor must choose it explicitly.

The URL may encode that the golden walkthrough is active, such as `?example=neurovault-308`, because the example contains no visitor data. Direct navigation to that URL restores the canonical inputs and recorded results. It does not encode subsequent free text or edits.

## Real NIfTI viewer architecture

### Decoder-specific viewer boundary

The frontend already depends on NiiVue, but the existing `NiiVueVisualizer` is coupled to the meta-analysis result screen, assumes exactly one overlay at `volumes[1]`, owns its display state internally, and loads the anatomical template remotely. It will not be reused unchanged.

The decoder introduces a small `DecodeNiiVueCanvas` adapter that owns one NiiVue instance and accepts controlled inputs:

- base and overlay volume descriptors;
- selected MNI coordinate;
- slice type;
- positive and negative display ranges;
- colormaps and opacity;
- crosshair visibility; and
- callbacks for location, load state, and recoverable errors.

The adapter attaches once, replaces volumes when descriptors change, ignores completion from superseded loads, and disposes listeners and WebGL resources on unmount. It identifies volumes by descriptor ID rather than array position. Loading, failure, and unsupported-WebGL states stay inside the canvas region.

Viewer settings affect presentation only. They never alter recorded correlations or mark results stale.

### Input view

The map workspace initially shows the bundled anatomical template plus the response-control input map in orthogonal slices. The selected MNI coordinate and voxel value update from actual NIfTI data. Controls expose crosshairs, slice layout, input-map opacity, signed colormap, and display thresholds derived from the loaded volume range.

The existing atlas-region panel remains an explicitly recorded/example readout in this branch; no live atlas query is added. Its wording distinguishes atlas labels from the real voxel coordinate and value supplied by NiiVue.

Coordinate-only submissions use the real bundled anatomical template and crosshairs but no activation overlay. They remain locations, not fabricated statistical maps.

### Side-by-side comparison

Side-by-side mode creates two `DecodeNiiVueCanvas` instances:

- **Submitted map**: anatomy plus response-control map; and
- **Term map**: anatomy plus the selected Neurosynth association z map.

Both canvases share one controlled MNI coordinate, slice type, and crosshair state. A location change in either canvas updates the shared state, producing synchronized slice navigation. Threshold and opacity values remain map-specific because the maps use different statistic types and ranges.

On narrow screens the canvases stack while keeping their labels and shared coordinate. Synchronization applies to orthogonal position, not 3-D camera rotation.

### Overlay comparison

Overlay mode uses one canvas with three identified volumes: anatomy, response-control input, and selected term map. The two statistical overlays have independent opacity, colormap, and threshold controls. The input defaults to a warm scale and the comparison to a cool scale; negative values use paired signed scales. A compact legend names both maps and never relies on colour alone.

Switching between side-by-side and overlay preserves the selected term, MNI coordinate, and each map's display settings. Selecting a result without a bundled map preserves the result selection and replaces only the comparison canvas with the explicit unavailable state.

## Loading, failure, and accessibility behavior

Each real canvas has a fixed aspect-ratio placeholder while volumes decode, preventing layout jumps. Its loading label names the pending map. A failed volume reports which local asset failed and offers **Retry viewer**; it does not discard form entries, results, or the other canvas.

If WebGL is unavailable, the interface shows a textual fallback containing map names, selected coordinate, current voxel values when already known, score provenance, and links to the NeuroVault image and Neurosynth term. The results table and all non-spatial controls remain usable.

Every canvas has an accessible name and adjacent live text for the selected coordinate and values. Keyboard-operable coordinate fields provide an equivalent way to move the crosshairs. Colour legends include labels and numeric ranges, and status is not communicated by colour alone. Reduced-motion preferences disable animated slice transitions.

## Typed data changes

The fixture service extends its response with a visualization payload rather than allowing components to infer assets from result labels:

```ts
type DecodeVolumeAsset = {
    id: string;
    url: string;
    filename: string;
    kind: 'anatomical' | 'input-statistic' | 'association-z';
    statisticType: 'anatomical' | 't' | 'z';
    provenance: DecodeAssetProvenance;
};

type DecodeVisualization = {
    anatomical: DecodeVolumeAsset;
    input?: DecodeVolumeAsset;
    comparisonByResultId: Record<string, DecodeVolumeAsset>;
};
```

Recorded-run provenance includes `kind: 'recorded'`, method name, reference dataset, result identifier, retrieval date, ranking rule, source links, and license/attribution records. Existing fixtures retain `kind: 'illustrative'`. Result rows link to comparison maps by stable result ID; labels are display data and never asset keys.

The adapter returns local public paths for the golden fixture. A later live adapter may return signed service URLs without changing viewer components.

## Verification strategy

Unit tests mock the NiiVue boundary and verify:

- the example action populates the canonical fields without overwriting free text;
- the recorded model cannot be used with edited or arbitrary inputs;
- recorded and illustrative provenance labels cannot be omitted;
- the top 20 values, signs, order, and map/result ID links match the manifest;
- stale-result behavior and restoration of canonical values;
- load replacement and cleanup when a canvas descriptor changes;
- synchronized coordinates in side-by-side mode;
- independent overlay controls and persistence across modes; and
- loading, asset failure, and WebGL fallback states.

Component tests use tiny mocked volume descriptors and do not parse multi-megabyte NIfTI files. Cypress exercises `?example=neurovault-308` at desktop and mobile widths, confirms that local asset requests succeed, selects each of the three mapped terms, changes coordinates from both side-by-side panes, switches to overlay, and verifies that no decode, upload, NeuroVault, or Neurosynth network request occurs.

A manual browser check with WebGL confirms that the actual response-control, premotor, visual, and posterior-cingulate volumes render; crosshairs synchronize; the overlay legend matches the displayed colours; and the comparison remains readable at the default thresholds. The asset manifest's sizes and SHA-256 digests are verified in a focused automated test.

The final verification remains the repository-documented frontend unit tests, build, decoder Cypress flow, and `git diff --check`.

## Deferred backend work

This extension deliberately stops before:

- fetching arbitrary NeuroVault metadata or NIfTI files at runtime;
- parsing visitor-selected local NIfTI files in the decoder;
- sending any map, coordinate, metadata, or free text to a service;
- running Pearson, NeuroVLM, NiCLIP, or any other decoder;
- retrieving arbitrary term maps;
- querying a live atlas;
- persisting or sharing a visitor-created run; or
- claiming that the recorded Pearson output predicts future model behavior.

The golden walkthrough is therefore suitable for UX review and spatial-readability decisions while preserving an honest backend boundary.
