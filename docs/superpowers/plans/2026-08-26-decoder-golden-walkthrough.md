# Decoder Golden Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline, scientifically traceable decoder walkthrough that renders NeuroVault image 308 and three real Neurosynth comparison maps with its recorded Pearson results, without calling a decoder backend.

**Architecture:** A manifest-backed fixture adapter distinguishes recorded data from the existing illustrative fixtures. A decoder-specific, lazily mounted NiiVue canvas renders identified local volumes under controlled coordinate and display state; the input and comparison workspaces compose that boundary without coupling page state to NiiVue internals.

**Tech Stack:** React 18, TypeScript, Material UI, NiiVue, Vitest/Testing Library, Cypress, Vite static assets.

**Spec:** `docs/superpowers/specs/2026-08-26-decoder-golden-walkthrough-design.md`

## Global Constraints

- Keep `/decode` public and stateless; do not add authentication.
- Do not fetch arbitrary NeuroVault images, run a decoder, upload a file, query an atlas, or persist a run.
- The recorded example must be labeled **Recorded Neurosynth Pearson example** and must never be presented as NeuroVLM or NiCLIP output.
- Preserve signed Pearson correlations and rank the recorded top 20 by absolute magnitude.
- Bundle all five NIfTI volumes locally; their combined compressed size must equal 7,553,823 bytes and remain below 9 MB.
- Load NiiVue and the bundled volumes only after the real walkthrough opens.
- Viewer controls change presentation only and must not invalidate scientific results.
- Keep the current illustrative NeuroVLM/NiCLIP flow working for non-walkthrough inputs.
- Use only the documented frontend verification commands from `.github/copilot-instructions.md`: `npm run test`, `npm run build:dev`, and `npm run cy:e2e-headless-dev` from `compose/neurosynth-frontend`.

## File structure

- Create `public/decoder/examples/neurovault-308/manifest.json` as the single runtime source for recorded scores, asset metadata, licenses, and provenance.
- Create five `.nii.gz` files beside the manifest for the anatomy, input statistic, and three comparison maps.
- Create `src/pages/Decode/Decode.golden.ts` to validate/load the manifest and construct the canonical draft and preview.
- Create `src/pages/Decode/Decode.golden.spec.ts` for manifest, checksum, canonical-data, and adapter tests.
- Create `src/pages/Decode/components/DecodeNiiVueCanvas.tsx` as the only decoder component that imports `@niivue/niivue`.
- Create `src/pages/Decode/components/DecodeNiiVueCanvas.spec.tsx` for lifecycle, replacement, coordinate, and fallback tests.
- Modify decoder types, fixtures, adapter, helpers, input components, page state, viewer, results, and comparison components only where needed to consume those boundaries.
- Extend the existing decoder unit and Cypress specs instead of creating a separate end-to-end suite.

---

### Task 1: Pin and verify the golden assets

**Files:**
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/generic-mni.nii.gz`
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/response-control.nii.gz`
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/premotor-association-z.nii.gz`
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/visual-association-z.nii.gz`
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/posterior-cingulate-association-z.nii.gz`
- Create: `compose/neurosynth-frontend/public/decoder/examples/neurovault-308/manifest.json`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.golden.spec.ts`

**Interfaces:**
- Produces: `/decoder/examples/neurovault-308/manifest.json` with `exampleId`, `method`, `input`, `assets`, and `terms` fields.
- Produces: five immutable local asset URLs and exact SHA-256 values consumed by Task 2.

- [ ] **Step 1: Write the failing integrity test**

Create `Decode.golden.spec.ts` with a suite that reads the public manifest and assets through Node APIs, then asserts the pinned identity, total size, hashes, term count, signed ordering, and mapped terms. Keep the project's default Vitest environment so Task 2 can add browser-facing loader tests to the same file:

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureRoot = resolve(process.cwd(), 'public/decoder/examples/neurovault-308');

describe('NeuroVault 308 golden walkthrough assets', () => {
    it('pins the recorded response and five verified NIfTI files', async () => {
        const manifest = JSON.parse(await readFile(resolve(fixtureRoot, 'manifest.json'), 'utf8'));
        const assets = await Promise.all(
            manifest.assets.map(async (asset: { filename: string; bytes: number; sha256: string }) => {
                const bytes = await readFile(resolve(fixtureRoot, asset.filename));
                expect(bytes.byteLength).toBe(asset.bytes);
                expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
                return bytes.byteLength;
            })
        );

        expect(manifest.exampleId).toBe('neurovault-308');
        expect(manifest.input.neurovaultImageId).toBe('308');
        expect(manifest.method.referenceDataset).toBe('terms_20k');
        expect(manifest.terms).toHaveLength(20);
        expect(manifest.terms.map(({ r }: { r: number }) => Math.abs(r))).toEqual(
            [...manifest.terms].map(({ r }: { r: number }) => Math.abs(r)).sort((a, b) => b - a)
        );
        expect(manifest.terms.find(({ id }: { id: string }) => id === 'posterior-cingulate')?.r).toBe(-0.307);
        expect(manifest.terms.filter(({ mapAssetId }: { mapAssetId?: string }) => mapAssetId)).toHaveLength(3);
        expect(assets.reduce((sum, bytes) => sum + bytes, 0)).toBe(7_553_823);
    });
});
```

- [ ] **Step 2: Run the documented unit suite and verify the new test fails**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because `manifest.json` and the NIfTI files do not exist.

- [ ] **Step 3: Download the exact source files**

Run these commands from `compose/neurosynth-frontend`:

```bash
mkdir -p public/decoder/examples/neurovault-308
curl -sSL --max-time 30 'https://neurovault.org/static/images/GenericMNI.nii.gz' -o public/decoder/examples/neurovault-308/generic-mni.nii.gz
curl -sSL --max-time 30 'https://neurovault.org/media/images/63/task005_cope04_Response_Control.nii.gz' -o public/decoder/examples/neurovault-308/response-control.nii.gz
curl -sSL --max-time 30 'https://neurosynth.org/api/analyses/premotor/images/association/?unthresholded' -o public/decoder/examples/neurovault-308/premotor-association-z.nii.gz
curl -sSL --max-time 30 'https://neurosynth.org/api/analyses/visual/images/association/?unthresholded' -o public/decoder/examples/neurovault-308/visual-association-z.nii.gz
curl -sSL --max-time 30 'https://neurosynth.org/api/analyses/posterior%20cingulate/images/association/?unthresholded' -o public/decoder/examples/neurovault-308/posterior-cingulate-association-z.nii.gz
```

- [ ] **Step 4: Create the exact manifest**

Create `manifest.json` with retrieval date `2026-08-26`, result identifier `6a6a9cdb07754185b6218dff275112fe`, ranking rule `absolute-correlation-descending`, the 20 rows from the approved spec, and these asset records:

```json
[
  {"id":"generic-mni","filename":"generic-mni.nii.gz","bytes":2221462,"sha256":"892c83f85f67d161572b282da69f65e772121392ff5cb84ae643a65022f52ec1","kind":"anatomical","statisticType":"anatomical","sourceUrl":"https://neurovault.org/static/images/GenericMNI.nii.gz","license":"CC0"},
  {"id":"response-control","filename":"response-control.nii.gz","bytes":814903,"sha256":"ae055340a3d0657fbee891240a5ca23a2c36425a29f33a991d83f41caf9fdab5","kind":"input-statistic","statisticType":"t","sourceUrl":"https://neurovault.org/media/images/63/task005_cope04_Response_Control.nii.gz","license":"CC0"},
  {"id":"premotor-map","filename":"premotor-association-z.nii.gz","bytes":1489180,"sha256":"343faba2dc0bd02f56b94aa5ac731912c2981a3d90e307c2355a3f3c894f648b","kind":"association-z","statisticType":"z","sourceUrl":"https://neurosynth.org/api/analyses/premotor/images/association/?unthresholded","license":"ODbL-derived"},
  {"id":"visual-map","filename":"visual-association-z.nii.gz","bytes":1577919,"sha256":"b73d77994d1859e70eb6f6c9eb504dce46a41b0531d8397f1db5d661dd76b2fc","kind":"association-z","statisticType":"z","sourceUrl":"https://neurosynth.org/api/analyses/visual/images/association/?unthresholded","license":"ODbL-derived"},
  {"id":"posterior-cingulate-map","filename":"posterior-cingulate-association-z.nii.gz","bytes":1450359,"sha256":"e82080c66d16a0e52e952b09810990d735ee88b1a08e00c25fd80cfa1f76e39f","kind":"association-z","statisticType":"z","sourceUrl":"https://neurosynth.org/api/analyses/posterior%20cingulate/images/association/?unthresholded","license":"ODbL-derived"}
]
```

Give only `premotor`, `visual`, and `posterior-cingulate` a `mapAssetId`. Use stable slug IDs for all terms and integer ranks 1–20.

- [ ] **Step 5: Run the documented unit suite and verify it passes**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS, including the asset integrity suite.

- [ ] **Step 6: Commit the pinned assets**

```bash
git add compose/neurosynth-frontend/public/decoder/examples/neurovault-308 compose/neurosynth-frontend/src/pages/Decode/Decode.golden.spec.ts
git commit -m "test: pin decoder golden walkthrough assets"
```

---

### Task 2: Add recorded provenance and the manifest adapter

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.golden.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.adapter.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.golden.spec.ts`

**Interfaces:**
- Produces: `DecodeExampleId = 'neurovault-308'` and `DecodeModelId` including `'neurosynth-pearson-recorded'`.
- Produces: `DecodeVolumeAsset`, `DecodeVisualization`, and discriminated `IDecodeProvenance` types.
- Produces: `loadGoldenWalkthrough(): Promise<{ draft: IDecodeDraft; preview: IDecodePreview }>` and a recorded model entry in `DECODE_MODELS` with `exampleOnly: 'neurovault-308'`.
- Consumes: Task 1 manifest at `/decoder/examples/neurovault-308/manifest.json`.

- [ ] **Step 1: Extend the test with the manifest-loader contract**

Add a jsdom suite that stubs `fetch`, invokes `loadGoldenWalkthrough`, and asserts:

```ts
expect(draft.activeSource).toBe('neurovault');
expect(draft.neurovaultReference).toBe('https://neurovault.org/images/308/');
expect(draft.metadata).toMatchObject({ mapType: 't', analysisLevel: 'group', modality: 'fmri-bold', subjectCount: '10' });
expect(draft.modelId).toBe('neurosynth-pearson-recorded');
expect(preview.provenance.kind).toBe('recorded');
expect(preview.provenance.resultId).toBe('6a6a9cdb07754185b6218dff275112fe');
expect(preview.visualization?.comparisonByResultId['premotor'].id).toBe('premotor-map');
expect(preview.terms.map(({ value }) => value)).toContain(-0.307);
```

- [ ] **Step 2: Run `npm run test` and verify type/module failures**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because the loader and recorded-data types do not exist.

- [ ] **Step 3: Define the exact recorded-data types**

In `Decode.types.ts`, add:

```ts
export type DecodeExampleId = 'neurovault-308';
export type DecodeModelId = 'neurovlm' | 'niclip' | 'neurosynth-pearson-recorded';
export type DecodeStatisticType = 'anatomical' | 't' | 'z';

export interface IDecodeAssetProvenance {
    sourceUrl: string;
    license: 'CC0' | 'ODbL-derived';
    sha256: string;
    bytes: number;
}

export interface IDecodeVolumeAsset {
    id: string;
    url: string;
    filename: string;
    kind: 'anatomical' | 'input-statistic' | 'association-z';
    statisticType: DecodeStatisticType;
    provenance: IDecodeAssetProvenance;
}

export interface IDecodeVisualization {
    anatomical: IDecodeVolumeAsset;
    input?: IDecodeVolumeAsset;
    comparisonByResultId: Record<string, IDecodeVolumeAsset>;
}

export type IDecodeProvenance =
    | { kind: 'illustrative'; label: string; version: string }
    | {
          kind: 'recorded';
          label: 'Recorded Neurosynth Pearson example';
          version: string;
          resultId: string;
          method: 'Pearson correlation';
          referenceDataset: 'terms_20k';
          retrievedAt: string;
          rankingRule: 'absolute-correlation-descending';
          sourceUrl: string;
      };
```

Add `exampleId: DecodeExampleId | null` to `IDecodeDraft`, optional `exampleId` to `IDecodeRunRequest`, and optional `visualization` to `IDecodePreview`. Change `FIXTURE_PROVENANCE.kind` to `illustrative`.
Add `exampleOnly?: DecodeExampleId` to `IDecodeModelDefinition`; ordinary models omit it.

- [ ] **Step 4: Implement strict manifest loading and projection**

In `Decode.golden.ts`, fetch the local manifest, reject a non-OK response or mismatched example/result identity, project asset filenames to `/decoder/examples/neurovault-308/<filename>`, and build the canonical draft and recorded preview. Add the recorded model to `DECODE_MODELS` in `Decode.fixtures.ts` with no parameters and all four result views:

```ts
export const RECORDED_PEARSON_MODEL: IDecodeModelDefinition = {
    id: 'neurosynth-pearson-recorded',
    name: 'Neurosynth Pearson',
    purpose: 'Replays a recorded spatial-correlation example for interface review.',
    version: 'terms_20k-recorded-2026-08-26',
    supportedSources: ['neurovault'],
    inputRequirements: 'Available only for the canonical NeuroVault 308 walkthrough.',
    parameters: [],
    outputViews: ['terms', 'studies', 'model-summary', 'compare'],
    interpretationNote: 'Pearson correlation measures spatial similarity; it is not a probability or proof of cognitive state.',
    subjectLevelSuitability: 'This recorded example is a group-level map.',
    exampleOnly: 'neurovault-308',
};
```

- [ ] **Step 5: Route the recorded request through the existing adapter**

Change the adapter to call `loadGoldenWalkthrough()` only when `request.exampleId === 'neurovault-308'`; return its preview after asserting the request uses image `308` and the recorded model. Preserve every existing fixture scenario and error path for illustrative requests.

- [ ] **Step 6: Run `npm run test` and verify the adapter contract passes**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS with recorded and illustrative provenance covered.

- [ ] **Step 7: Commit the manifest adapter**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts compose/neurosynth-frontend/src/pages/Decode/Decode.adapter.ts compose/neurosynth-frontend/src/pages/Decode/Decode.golden.ts compose/neurosynth-frontend/src/pages/Decode/Decode.golden.spec.ts
git commit -m "feat: add recorded decoder walkthrough data"
```

---

### Task 3: Add the explicit walkthrough entry and canonical-state rules

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourcePanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeModelPanel.tsx`

**Interfaces:**
- Consumes: `loadGoldenWalkthrough`, `RECORDED_PEARSON_MODEL`, and `exampleId` from Task 2.
- Produces: `makeGoldenWalkthroughDraft(interpretation: string): IDecodeDraft` and `isCanonicalGoldenDraft(draft): boolean`.
- Produces: `onLoadWalkthrough` input-panel callback and `?example=neurovault-308` restoration.

- [ ] **Step 1: Write page and helper tests first**

Add assertions that **Load real walkthrough** populates image 308 and metadata, preserves pre-existing free text, exposes a read-only **Recorded example** model, changes the action to **Open recorded walkthrough**, and sends no preview until that action is pressed. Add direct-navigation coverage for `?example=neurovault-308`, manual image-308 coverage that offers but does not auto-load the walkthrough, and edited-field coverage that marks results stale and offers **Restore walkthrough values**. Verify the model panel hides definitions whose `exampleOnly` does not equal the active `draft.exampleId`.

- [ ] **Step 2: Run `npm run test` and verify the new behavior fails**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because the walkthrough controls and canonical-state helpers are absent.

- [ ] **Step 3: Implement canonical draft creation and validation**

Set the canonical values to image 308, t map, group analysis, fMRI BOLD, 10 subjects, Landmark task `trm_5346938eed092`, and recorded model. `isCanonicalGoldenDraft` must compare computation-relevant fields while intentionally ignoring `interpretation`. Reject the recorded model in `validateDecodeDraft` unless `exampleId` is present and all canonical values match.

- [ ] **Step 4: Wire the entry controls without auto-running**

Give `DecodeNeurovaultInput` an `onLoadWalkthrough` callback and render:

```tsx
<Button type="button" variant="outlined" onClick={onLoadWalkthrough}>
    Load real walkthrough
</Button>
```

When a visitor manually enters image 308, render the nonmodal hint **A recorded walkthrough is available for this image** with the same explicit action. In recorded mode, the primary action reads **Open recorded walkthrough** and its note reads **Uses bundled public maps and a recorded result; no decoder runs and nothing is uploaded.**

- [ ] **Step 5: Restore the example from the public query parameter**

At initial page state, recognize only `example=neurovault-308`. Populate and open the recorded walkthrough without encoding interpretation or later edits back into the URL. Keep the existing development-only `fixture` parameter behavior unchanged.

- [ ] **Step 6: Run `npm run test` and verify all input flows pass**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS for manual fixtures, explicit walkthrough loading, URL restoration, staleness, and reset behavior.

- [ ] **Step 7: Commit the walkthrough entry flow**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourcePanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeModelPanel.tsx
git commit -m "feat: add decoder walkthrough entry flow"
```

---

### Task 4: Build the controlled NiiVue canvas boundary

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiiVueCanvas.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiiVueCanvas.spec.tsx`

**Interfaces:**
- Consumes: `IDecodeVolumeAsset` from Task 2.
- Produces: `DecodeNiiVueCanvasProps` with `ariaLabel`, `volumes`, `coordinate`, `sliceType`, `crosshairs`, `onCoordinateChange`, `onValuesChange`, and `displayByVolumeId`.
- Produces: `DecodeSliceType = 'multiplanar' | 'axial' | 'coronal' | 'sagittal'` and `IDecodeVolumeDisplay` with `opacity`, `colormap`, `colormapNegative`, `calMin`, `calMax`, `calMinNegative`, and `calMaxNegative`.

- [ ] **Step 1: Write a mocked NiiVue lifecycle test**

Mock `Niivue` and assert one instance attaches per mount, `loadVolumes` receives descriptors in the supplied order, a descriptor change replaces rather than appends volumes, late completion from an earlier load cannot publish ready state, `onLocationChange` forwards rounded MNI coordinates and values by asset ID, and unmount clears callbacks and loses the WebGL context.

- [ ] **Step 2: Add loading, error, and WebGL fallback tests**

Assert the region has `aria-busy="true"` with the pending map names, reports **Could not load response-control.nii.gz** on rejection, retries from the button, and renders the textual map/coordinate summary when `canvas.getContext('webgl2')` returns `null`.

- [ ] **Step 3: Run `npm run test` and verify the component tests fail**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because `DecodeNiiVueCanvas` does not exist.

- [ ] **Step 4: Implement a generation-safe NiiVue adapter**

Use a monotonically increasing load generation in an effect:

```ts
const generation = ++loadGeneration.current;
setLoadState({ status: 'loading', filenames: volumes.map(({ filename }) => filename) });
try {
    await niivue.loadVolumes(volumes.map(toNiiVueOptions));
    if (generation !== loadGeneration.current) return;
    applyCoordinate(niivue, coordinate);
    setLoadState({ status: 'ready' });
} catch (error) {
    if (generation !== loadGeneration.current) return;
    setLoadState({ status: 'error', filename: failingFilename(error, volumes) });
}
```

Use `niivue.mm2frac([x, y, z])`, assign `niivue.scene.crosshairPos`, and call `drawScene()` for controlled coordinate changes. Configure per-volume `cal_min`, `cal_max`, negative range, opacity, and colormap by stable asset ID after load rather than hard-coded indices.

- [ ] **Step 5: Implement cleanup and accessible fallback**

On cleanup, invalidate the generation, replace NiiVue callbacks with no-ops, remove loaded volumes, request `WEBGL_lose_context`, and clear refs. Keep a fixed `aspectRatio: '1.35 / 1'` wrapper and adjacent live text of the form `MNI x 0, y 0, z 0 · response-control value 2.314`.
Do not add animated slice transitions; add `@media (prefers-reduced-motion: reduce) { transition: none; }` to any loading-state fade that is introduced.

- [ ] **Step 6: Run `npm run test` and verify the canvas contract passes**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS including load replacement, ignored stale completion, cleanup, retry, and fallback.

- [ ] **Step 7: Commit the viewer boundary**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiiVueCanvas.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiiVueCanvas.spec.tsx
git commit -m "feat: add controlled decoder NiiVue canvas"
```

---

### Task 5: Replace the golden input graphic with the real map viewer

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`

**Interfaces:**
- Consumes: `IDecodePreview.visualization` and `DecodeNiiVueCanvas`.
- Preserves: existing coordinate-only behavior and atlas-readout disclosure.
- Produces: controlled input-map opacity, threshold, signed colormap, slice layout, and crosshair state.

- [ ] **Step 1: Write viewer integration tests**

Mock the canvas boundary and assert recorded visualization passes `[anatomical, input]`, input changes update shared `IViewerState`, coordinate sources pass only anatomy, ordinary illustrative previews retain the current explicit no-map graphic, and atlas text remains labeled as an example rather than live lookup data.

- [ ] **Step 2: Run `npm run test` and verify the integration fails**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because `DecodeViewer` does not consume visualization assets.

- [ ] **Step 3: Lazy-load the real canvas only for recorded visualization**

Use:

```ts
const DecodeNiiVueCanvas = lazy(() => import('./DecodeNiiVueCanvas'));
```

Wrap it in a local `Suspense` loading region. Do not mount it when `visualization` is absent. Pass `successfulState.preview.visualization` from `DecodePage` to `DecodeViewer`.

- [ ] **Step 4: Add display-only controls**

Render crosshair and slice-layout controls plus input opacity and signed thresholds derived from the loaded input range. Update canvas display settings without changing the draft or run request. Keep numeric coordinate fields as the keyboard-equivalent control and enforce the existing MNI bounds.

- [ ] **Step 5: Run `npm run test` and verify viewer behavior passes**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS for real, coordinate-only, and illustrative viewer branches.

- [ ] **Step 6: Commit the real input viewer**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx
git commit -m "feat: render real decoder input maps"
```

---

### Task 6: Render synchronized side-by-side and overlay comparisons

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`

**Interfaces:**
- Consumes: anatomy, input, and `comparisonByResultId` assets from `IDecodeVisualization`.
- Produces: side-by-side two-canvas layout and one-canvas three-volume overlay.
- Preserves: selected result, shared MNI coordinate, and per-map display settings across layout changes.

- [ ] **Step 1: Write comparison tests before changing the component**

Mock `DecodeNiiVueCanvas` and verify premotor defaults to two panes with `[anatomy,input]` and `[anatomy,premotor]`; moving either pane calls the shared coordinate setter; overlay passes `[anatomy,input,premotor]`; input and term opacity remain independent; switching modes preserves settings; visual and posterior-cingulate select their own assets; and an unmapped term reports **Comparison map not included in this walkthrough** without losing selection.

- [ ] **Step 2: Run `npm run test` and verify the comparison tests fail**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because comparison still renders abstract graphics.

- [ ] **Step 3: Replace mapped-result graphics with real canvases**

Pass `visualization` through `DecodeResults`. Resolve comparison assets only with `comparisonByResultId[selectedResult.id]`. In side-by-side mode render canvases labeled **Submitted map** and **<term> association map**; stack them at the existing mobile breakpoint.

- [ ] **Step 4: Implement the real overlay and legend**

Render one three-volume canvas and a legend naming both statistical layers. Default input to warm and comparison to cool, expose independent opacity and thresholds, and use paired signed colormaps. Keep labels and numeric ranges visible so colour is never the only identifier.

- [ ] **Step 5: Preserve state across layouts and selections**

Store display settings by asset ID, not current pane or array index. Changing selected mapped terms swaps only the comparison descriptor. Changing mode must not reset coordinates, threshold, opacity, or colormap.

- [ ] **Step 6: Run `npm run test` and verify both comparison modes pass**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS for synchronization, overlay composition, persistence, unavailable maps, and mobile ordering.

- [ ] **Step 7: Commit real comparison views**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.spec.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts
git commit -m "feat: render real decoder map comparisons"
```

---

### Task 7: Finish recorded-result semantics and accessible provenance

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx`

**Interfaces:**
- Consumes: discriminated recorded provenance and signed recorded terms.
- Produces: `DecodeTermSort` including `'magnitude'` and recorded-default navigation.
- Produces: source, method, reference, ranking, license, and retrieval disclosures.

- [ ] **Step 1: Add sorting and copy tests**

Assert magnitude sort orders `0.442, 0.395, -0.307, 0.300` as `0.442, 0.395, -0.307, 0.300`; recorded results default to **Magnitude** and **Strongest first**; correlation signs remain visible; mapped/unmapped rows expose accurate comparison affordances; and the results header says **Recorded Neurosynth Pearson example**, `terms_20k`, **Pearson correlation**, and **spatial similarity—not probability**.

- [ ] **Step 2: Run `npm run test` and verify semantic tests fail**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: FAIL because magnitude sorting and recorded provenance rendering are absent.

- [ ] **Step 3: Add magnitude sorting without changing illustrative defaults**

Extend `DecodeTermSort` and `sortTerms`:

```ts
const comparison =
    sort === 'label'
        ? left.label.localeCompare(right.label, undefined, { numeric: true })
        : sort === 'magnitude'
          ? Math.abs(left.value) - Math.abs(right.value)
          : sort === 'value'
            ? left.value - right.value
            : left.rank - right.rank;
```

Initialize recorded term tables with `sort='magnitude'` and `direction='desc'`; retain rank ascending for illustrative fixtures.

- [ ] **Step 4: Render recorded provenance and method details**

Branch on `preview.provenance.kind`. Recorded output names the result ID, `terms_20k`, retrieval date, Pearson method, NeuroVault image/collection, CC0 input, and ODbL-derived term maps with upstream links. Illustrative output retains its existing notice. Update generic **example** copy in the term and model-summary views only when recorded data is active.

- [ ] **Step 5: Make comparison availability explicit in rows**

Mapped rows retain **Select <term> for comparison**. Unmapped recorded rows remain selectable with the accurate label **Select <term>; comparison map not bundled**, display **Map not bundled**, and lead to the specified **Comparison map not included in this walkthrough** state while preserving the selected result.

- [ ] **Step 6: Run `npm run test` and verify result semantics pass**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS for signed magnitude order, recorded/illustrative copy, provenance links, and comparison availability.

- [ ] **Step 7: Commit result semantics**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx
git commit -m "fix: clarify recorded decoder result semantics"
```

---

### Task 8: Verify the complete walkthrough in browser and build

**Files:**
- Modify: `compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx`
- Modify only if failures reveal a walkthrough defect: files changed in Tasks 2–7.

**Interfaces:**
- Consumes: complete golden walkthrough.
- Produces: end-to-end regression coverage proving local assets, responsive comparison, and absence of backend traffic.

- [ ] **Step 1: Add desktop Cypress coverage**

Visit `/decode?example=neurovault-308`, assert the recorded provenance and 20 terms, confirm all requests for `/decoder/examples/neurovault-308/**` return 200, and fail the test on any request to external NeuroVault, Neurosynth, or local `/api/**`. Select premotor, open comparison, change the coordinate in the term pane, switch to overlay, change both opacities, select visual, and assert the legend updates while the coordinate persists.

- [ ] **Step 2: Add negative-result and mobile coverage**

At 390×844, select posterior cingulate, assert `-0.307`, open the real side-by-side view, confirm **Submitted map** precedes **posterior cingulate association map**, switch to overlay, and assert the document has no horizontal overflow.

- [ ] **Step 3: Run the documented unit suite**

Run: `cd compose/neurosynth-frontend && npm run test`

Expected: PASS with all decoder and existing frontend tests.

- [ ] **Step 4: Run the documented development build**

Run: `cd compose/neurosynth-frontend && npm run build:dev`

Expected: exit 0. Offline Sentry release/sourcemap warnings are acceptable if the Vite build, prerender, and sitemap complete.

- [ ] **Step 5: Run the documented Cypress suite**

Keep the existing Vite server at `http://localhost:3000`, then run:

`cd compose/neurosynth-frontend && env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless-dev`

Expected: PASS, including both decoder walkthrough cases. No live decoder, upload, NeuroVault, or Neurosynth request occurs.

- [ ] **Step 6: Perform the real-WebGL review**

Open `http://localhost:3000/decode?example=neurovault-308` on the Mac and verify the response-control map, premotor map, visual map, and posterior-cingulate map render; crosshairs synchronize; overlay colours and legend agree; default thresholds leave anatomy and both maps readable; and keyboard coordinate fields move the slices.

- [ ] **Step 7: Check the final diff and asset budget**

Run:

```bash
git diff --check
wc -c compose/neurosynth-frontend/public/decoder/examples/neurovault-308/*.nii.gz
git status --short
```

Expected: no whitespace errors; the five assets total 7,553,823 bytes; only intended decoder files and the pre-existing untracked `CODEX_REVIEW_BRIEF.md` appear.

- [ ] **Step 8: Commit the end-to-end walkthrough**

```bash
git add compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx compose/neurosynth-frontend/src/pages/Decode compose/neurosynth-frontend/public/decoder/examples/neurovault-308
git commit -m "test: verify real decoder walkthrough"
```
