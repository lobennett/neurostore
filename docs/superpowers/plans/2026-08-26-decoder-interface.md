# Decoder Interface MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished, public, fixture-backed `/decode` workflow that covers map and coordinate inputs, metadata, model configuration, viewer interactions, terms, studies, and map comparison without integrating a backend.

**Architecture:** `DecodePage` will own one typed draft and one immutable preview snapshot. Focused panels will edit the draft, while a fixture adapter returns provenance-bearing result states through the same interface a later API adapter can implement. Viewer display state and result navigation will remain separate from scientific inputs so they cannot silently invalidate or rerun results.

**Tech Stack:** React 19, TypeScript 5.9, MUI v5, Vitest 4, Testing Library, Cypress 15, Vite 8

**Spec:** `docs/superpowers/specs/2026-08-26-decoder-interface-design.md`

## Global Constraints

- Keep `/decode` public and stateless; do not add login checks or first-visit behavior.
- Use one workspace, not a wizard.
- Keep uploads, NeuroVault lookup, atlas lookup, model execution, persistence, and sharing behind fixtures.
- Label every computed value, map, atlas label, study, deposit receipt, and suggestion as example data.
- Accept arbitrary remote URLs only when they identify a NeuroVault image.
- Treat 3D, unthresholded z/t maps in MNI152 space as declared requirements, not verified facts.
- Make NeuroVLM the default and expose NiCLIP through a typed, extensible model registry.
- Keep terms primary; provide search, metric-aware sorting, pagination, associated studies, and explicit comparison.
- Do not expose functional-connectivity, coactivation, full atlas-browser, scatterplot, classifier, or text-prior controls.
- Use MUI v5, existing theme tokens, Roboto, blue in-page actions, and no new orange actions.
- Preserve keyboard operation, accessible names, field-error associations, live announcements, and responsive layout.
- Run tests and builds only with commands documented in `.github/copilot-instructions.md`.
- Preserve the untracked root `CODEX_REVIEW_BRIEF.md`.

## File structure

The implementation will keep domain data out of rendering components:

- `Decode.types.ts`: source, metadata, model, preview, result, viewer, and comparison contracts.
- `Decode.constants.ts`: stable option lists and MNI limits.
- `Decode.vocabulary.json`: checked-in raw Cognitive Atlas concept snapshot.
- `Decode.vocabulary.ts`: typed, deduplicated concept options and snapshot provenance.
- `Decode.fixtures.ts`: deterministic model, result, study, atlas, and scenario fixtures.
- `Decode.adapter.ts`: fixture adapter with the future backend interface.
- `Decode.helpers.ts`: parsing, validation, stale-run comparison, filtering, sorting, and pagination.
- `DecodePage.tsx`: draft/preview orchestration and layout only.
- `components/*`: one focused panel or result surface per file.

---

### Task 1: Replace the narrow domain model with the frontend service contract

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.constants.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.adapter.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts`

**Interfaces:**
- Produces: `IDecodeDraft`, `IDecodeRunRequest`, `IDecodePreview`, `IDecodePreviewState`, `IDecodeModelDefinition`, `IDecodeTerm`, `IDecodeStudy`, `IAtlasReadout`, and `IDecodeFrontendAdapter`.
- Produces: `EMPTY_DECODE_DRAFT`, `DECODE_MODELS`, `createFixtureDecodeAdapter()`, `buildDecodeRunRequest(draft)`, `validateDecodeDraft(draft)`, and `isPreviewStale(draft, request)`.
- Consumes: existing NeuroVault and NIfTI parsing behavior.

- [ ] **Step 1: Write failing contract and validation tests**

Add tests that establish all source variants and prevent inactive source values from leaking into a request:

```tsx
it('builds a request from only the active NeuroVault source', () => {
    const draft = completeDraft({
        activeSource: 'neurovault',
        neurovaultReference: 'https://neurovault.org/images/25/',
        file: new File(['unused'], 'unused.nii.gz'),
    });
    expect(buildDecodeRunRequest(draft).source).toEqual({ kind: 'neurovault', imageId: '25' });
});

it('validates every coordinate against the displayed MNI limits', () => {
    const draft = completeDraft({ activeSource: 'coordinates', coordinates: [{ id: 'p1', label: '', x: '91', y: '0', z: '0' }] });
    expect(validateDecodeDraft(draft).coordinates).toContain('x must be between -90 and 90');
});

it('requires deposit consent only for a local file', () => {
    expect(validateDecodeDraft(completeDraft({ activeSource: 'upload', depositConsent: false })).depositConsent)
        .toBe('Accept the public CC0 deposit terms to continue.');
    expect(validateDecodeDraft(completeDraft({ activeSource: 'neurovault' })).depositConsent).toBeUndefined();
});

it('marks scientific input changes stale but ignores viewer display changes', () => {
    const draft = completeDraft({ modelId: 'neurovlm' });
    const request = buildDecodeRunRequest(draft);
    expect(isPreviewStale({ ...draft, modelParameters: { resultLimit: 100 } }, request)).toBe(true);
    expect(isPreviewStale(draft, request)).toBe(false);
});
```

- [ ] **Step 2: Run `npm run test` from `compose/neurosynth-frontend` and verify RED**

Expected: the new draft, request, adapter, and helper exports do not exist.

- [ ] **Step 3: Add the shared types and fixed option constants**

Use discriminated unions for run sources and explicit result measures:

```tsx
export type DecodeSourceKind = 'neurovault' | 'upload' | 'coordinates';
export type DecodeModelId = 'neurovlm' | 'niclip';
export type DecodeMetric = 'similarity' | 'correlation' | 'probability' | 'bayes-factor';
export type DecodeFixtureScenario = 'success' | 'loading' | 'empty-terms' | 'empty-studies' | 'unsupported' | 'lookup-error' | 'decode-error';

export interface IMniPoint { id: string; label: string; x: string; y: string; z: string; }
export type DecodeRunSource =
    | { kind: 'neurovault'; imageId: string }
    | { kind: 'upload'; filename: string; license: 'CC0' }
    | { kind: 'coordinates'; points: Array<{ id: string; label: string; x: number; y: number; z: number }> };

export interface IDecodeDraft {
    activeSource: DecodeSourceKind;
    neurovaultReference: string;
    file: File | null;
    coordinates: IMniPoint[];
    depositConsent: boolean;
    metadata: IDecodeMetadata;
    concepts: ICognitiveConcept[];
    interpretation: string;
    confirmedSuggestions: ICognitiveConcept[];
    subjectWarningAcknowledged: boolean;
    modelId: DecodeModelId;
    modelParameters: Record<string, string | number | boolean>;
}

export interface IDecodeRunRequest {
    source: DecodeRunSource;
    metadata?: IDecodeMetadata;
    concepts: ICognitiveConcept[];
    interpretation: string;
    modelId: DecodeModelId;
    modelVersion: string;
    parameters: Record<string, string | number | boolean>;
}

export interface IDecodeFrontendAdapter {
    preview(request: IDecodeRunRequest, scenario: DecodeFixtureScenario): IDecodePreviewState;
}
```

In `Decode.helpers.spec.ts`, define `completeDraft(overrides: Partial<IDecodeDraft> = {}): IDecodeDraft` by merging overrides over `EMPTY_DECODE_DRAFT`, a valid NeuroVault reference, valid group/z/fMRI-BOLD/121 metadata, and default NeuroVLM parameters. Add `ANALYSIS_LEVEL_OPTIONS`, the eleven NeuroVault modality options, `MAP_TYPE_OPTIONS`, and exact `MNI_LIMITS` in `Decode.constants.ts`. Keep the stored identifiers stable and the labels readable. Set `EMPTY_DECODE_DRAFT.activeSource` to `neurovault` so the simplest public path appears first.

- [ ] **Step 4: Implement the fixture adapter and pure request helpers**

The adapter must attach fixture provenance at construction time:

```tsx
export const createFixtureDecodeAdapter = (): IDecodeFrontendAdapter => ({
    preview: (request, scenario) => {
        if (scenario === 'loading') return { status: 'loading', request };
        if (scenario === 'unsupported') return { status: 'error', operation: 'Model compatibility', request, message: 'The example model does not support this input.' };
        if (scenario === 'lookup-error') return { status: 'error', operation: 'NeuroVault lookup', request, message: 'The example NeuroVault lookup failed.' };
        if (scenario === 'decode-error') return { status: 'error', operation: 'Decoder', request, message: 'The example decoder run failed.' };
        return { status: 'success', request, preview: makeExamplePreview(request, scenario), provenance: FIXTURE_PROVENANCE };
    },
});
```

Define `FIXTURE_PROVENANCE` in `Decode.fixtures.ts` as `{ kind: 'fixture', label: 'Illustrative example — no decoder was called', version: 'fixture-v1' }`. Define `makeExamplePreview(request, scenario): IDecodePreview` in that file; it copies model/version/parameters from the request, returns `EXAMPLE_TERMS`, `EXAMPLE_STUDIES`, model summary data, and `EXAMPLE_ATLAS_READOUTS`, and replaces the relevant result list with `[]` for either empty scenario.

`buildDecodeRunRequest` must normalize the active source, omit map metadata for coordinate input, copy the model version from `DECODE_MODELS`, and throw only when called with an invalid draft. `validateDecodeDraft` must retain the existing filename and NeuroVault rules; require map type, analysis level, modality, and subject count for participant maps; require one valid coordinate for coordinate input; and apply upload consent and subject-warning rules only when relevant.

- [ ] **Step 5: Run `npm run test` and verify GREEN**

Expected: the complete suite passes with the expanded contract.

- [ ] **Step 6: Commit the domain contract**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts compose/neurosynth-frontend/src/pages/Decode/Decode.constants.ts compose/neurosynth-frontend/src/pages/Decode/Decode.adapter.ts compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts
git commit -m "refactor: define decoder frontend contract"
```

### Task 2: Add NeuroVault, upload-deposit, and coordinate source controls

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeFileInput.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeCoordinateInput.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeDepositDisclosure.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourcePanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourceInputs.spec.tsx`

**Interfaces:**
- Consumes: `DecodeSourceKind`, `IMniPoint`, `IDecodeValidationErrors`, and source values from `IDecodeDraft`.
- Produces: `DecodeSourcePanel({ draft, errors, onChange, autoFocusSource })`.

- [ ] **Step 1: Write failing source interaction tests**

Cover URL guidance, retained inactive values, coordinates, and deposit consent:

```tsx
it('states that NeuroVault image URLs are accepted but arbitrary NIfTI URLs are not', () => {
    renderSourcePanel();
    expect(screen.getByText(/Only NeuroVault image links are supported/)).toBeVisible();
});

it('adds, labels, and removes an MNI coordinate', async () => {
    renderSourcePanel({ activeSource: 'coordinates' });
    await userEvent.type(screen.getByRole('spinbutton', { name: 'x coordinate for point 1' }), '-42');
    await userEvent.click(screen.getByRole('button', { name: 'Add another coordinate' }));
    expect(screen.getByRole('spinbutton', { name: 'x coordinate for point 2' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Remove point 2' }));
    expect(screen.queryByRole('spinbutton', { name: 'x coordinate for point 2' })).not.toBeInTheDocument();
});

it('requires explicit CC0 public-deposit consent without claiming to upload', async () => {
    renderSourcePanel({ activeSource: 'upload', file: new File(['map'], 'map.nii.gz') });
    expect(screen.getByText(/publicly accessible under CC0/)).toBeVisible();
    await userEvent.click(screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ depositConsent: true }));
    expect(screen.getByText(/Nothing is uploaded in this preview/)).toBeVisible();
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: the coordinate, disclosure, and unified source components are missing.

- [ ] **Step 3: Implement the three-tab source panel**

Render accessible tabs for **NeuroVault image**, **Upload NIfTI**, and **MNI coordinates**. Keep every panel mounted with `hidden` so switching tabs preserves unfinished source values. The active tab updates only `draft.activeSource`.

`DecodeCoordinateInput` will render points from `draft.coordinates` with uniquely labeled x/y/z number fields, an optional point name, one remove action per additional point, and an add action that appends:

```tsx
const emptyPoint = (index: number): IMniPoint => ({
    id: `point-${crypto.randomUUID()}`,
    label: `Point ${index + 1}`,
    x: '',
    y: '',
    z: '',
});
```

Use a module-level fallback counter instead of `crypto.randomUUID()` in tests when `crypto` is unavailable. Associate the group error with all coordinate inputs through `aria-describedby`.

In `DecodeSourceInputs.spec.tsx`, define `renderSourcePanel(overrides: Partial<IDecodeDraft> = {})` to render a stateful wrapper initialized with `{ ...EMPTY_DECODE_DRAFT, ...overrides }`, expose its `onChange` spy, and pass `validateDecodeDraft(draft)` into the panel.

- [ ] **Step 4: Implement the local-file deposit disclosure**

Show the filename, declared metadata list, public visibility, proposed CC0 license, no-login rule, and optional future account association. The consent checkbox updates `depositConsent`; changing or clearing the selected file resets consent to `false`. Never render a real deposit ID before preview.

- [ ] **Step 5: Run `npm run test` and verify GREEN**

Expected: all source controls work by keyboard and preserve inactive values.

- [ ] **Step 6: Commit the source workspace**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeFileInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeCoordinateInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeDepositDisclosure.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourcePanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourceInputs.spec.tsx
git commit -m "feat: add decoder source workspace"
```

### Task 3: Complete map metadata, Cognitive Atlas concepts, and interpretation

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.vocabulary.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.vocabulary.json`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeMetadataForm.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeConceptSelector.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInterpretation.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeDescriptionPanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.spec.tsx`

**Interfaces:**
- Consumes: map option constants, `ICognitiveConcept`, metadata errors, fixture suggestions, and `IDecodeDraft`.
- Produces: `COGNITIVE_ATLAS_CONCEPTS`, `DecodeDescriptionPanel({ draft, errors, onChange })`.

- [ ] **Step 1: Add failing option and vocabulary tests**

```tsx
it('offers every agreed analysis level and NeuroVault modality', async () => {
    renderDescriptionPanel();
    expect(screen.getAllByRole('option', { name: /Group|Subject|Meta-analysis|Other/ })).toHaveLength(4);
    for (const label of ['fMRI BOLD', 'fMRI CBF', 'fMRI CBV', 'Diffusion MRI', 'Structural MRI', 'FDG PET', 'Oxygen-water PET', 'Other PET', 'MEG', 'EEG', 'Other']) {
        expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
});

it('starts with no concept and searches the checked-in concept snapshot', async () => {
    renderDescriptionPanel();
    expect(screen.getByRole('combobox', { name: 'Cognitive Atlas concepts' })).toHaveValue('');
    await userEvent.type(screen.getByRole('combobox', { name: 'Cognitive Atlas concepts' }), 'working memory');
    expect(await screen.findByText('working memory')).toBeVisible();
    expect(screen.getByText(/trm_/)).toBeVisible();
});

it('keeps a text suggestion separate until the visitor confirms it', async () => {
    renderDescriptionPanel();
    await userEvent.type(screen.getByRole('textbox', { name: /What do you think/ }), 'response inhibition');
    expect(screen.getByText('Example suggestion: response inhibition')).toBeVisible();
    expect(screen.queryByText('Confirmed concept')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm response inhibition' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ confirmedSuggestions: expect.any(Array) }));
});
```

In `DecodeInputPanel.spec.tsx`, define `renderDescriptionPanel(overrides: Partial<IDecodeDraft> = {})` as a stateful wrapper around `DecodeDescriptionPanel`, initialized from `EMPTY_DECODE_DRAFT` with valid map metadata and wired to an `onChange` spy.

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: the expanded options, vocabulary snapshot, and suggestion controls are missing.

- [ ] **Step 3: Check in the dated Cognitive Atlas concept snapshot**

From the monorepo root, save the complete JSON response from the official Cognitive Atlas concept endpoint as `Decode.vocabulary.json`:

```bash
curl -sS --max-time 60 https://www.cognitiveatlas.org/api/v-alpha/concept -o compose/neurosynth-frontend/src/pages/Decode/Decode.vocabulary.json
```

Then import the snapshot in `Decode.vocabulary.ts`, keep only records with stable `trm_` identifiers, remove duplicate IDs, sort by lowercase label, and export typed options with dated provenance:

```tsx
import snapshot from './Decode.vocabulary.json';

export const COGNITIVE_ATLAS_SNAPSHOT = {
    retrievedAt: '2026-08-26',
    source: 'https://www.cognitiveatlas.org/api/v-alpha/concept',
} as const;

export const COGNITIVE_ATLAS_CONCEPTS: ICognitiveConcept[] = Array.from(
    new Map(
        snapshot
            .filter((record) => record.id.startsWith('trm_'))
            .map((record) => [record.id, { id: record.id, label: record.name, vocabulary: 'Cognitive Atlas' as const }])
    ).values()
).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
```

Add a test that the array has more than 600 unique `trm_` IDs, is label-sorted, and contains `working memory`. This snapshot contains concepts only; it does not query or mix Cognitive Atlas task, condition, or modality endpoints.

- [ ] **Step 4: Implement description controls**

Render z/t statistic, group/subject/meta-analysis/other, the eleven modalities, and subject count. Hide map-specific fields for coordinate input without clearing their retained draft values. Show the subject warning and acknowledgement only for subject-level map inputs.

Use MUI `Autocomplete` with `multiple`, stable ID secondary text, no initial value, `filterSelectedOptions`, and a bounded listbox. `DecodeInterpretation` will match fixture suggestions case-insensitively but will not add them to concepts or parameters until its explicit confirm button is pressed. Empty free text produces no suggestion.

- [ ] **Step 5: Run `npm run test` and verify GREEN**

Expected: all metadata, vocabulary, and confirmation behavior passes.

- [ ] **Step 6: Commit description metadata**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.vocabulary.json compose/neurosynth-frontend/src/pages/Decode/Decode.vocabulary.ts compose/neurosynth-frontend/src/pages/Decode/components/DecodeMetadataForm.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeConceptSelector.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInterpretation.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeDescriptionPanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.spec.tsx
git commit -m "feat: complete decoder submission metadata"
```

### Task 4: Add model configuration and immutable preview orchestration

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeModelPanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx`

**Interfaces:**
- Consumes: `DECODE_MODELS`, `IDecodeDraft`, validation/build helpers, and `IDecodeFrontendAdapter`.
- Produces: `DecodeModelPanel({ modelId, parameters, sourceKind, onChange })`; `DecodePage` creates an immutable `IDecodePreviewState` on preview.

- [ ] **Step 1: Write failing model and stale-result tests**

```tsx
it('defaults to NeuroVLM and shows only its parameters', () => {
    render(<DecodePage />);
    expect(screen.getByRole('radio', { name: /NeuroVLM/ })).toBeChecked();
    expect(screen.getByLabelText('Number of term results')).toHaveValue(50);
    expect(screen.queryByLabelText('NiCLIP prior')).not.toBeInTheDocument();
});

it('records model version and non-default parameters in the preview summary', async () => {
    await completeNeurovaultDraft();
    await userEvent.clear(screen.getByLabelText('Number of term results'));
    await userEvent.type(screen.getByLabelText('Number of term results'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    expect(screen.getByText(/NeuroVLM.*fixture-v1/)).toBeVisible();
    expect(screen.getByText(/Number of term results: 100/)).toBeVisible();
});

it('marks results stale after a scientific input changes and previews again explicitly', async () => {
    await openPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'eeg');
    expect(screen.getByRole('status')).toHaveTextContent('Inputs changed. Preview again to refresh example results.');
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: no model panel, version provenance, or stale state exists.

- [ ] **Step 3: Implement the model registry UI**

Render each registry entry as a radio card with name, fixture version, purpose, supported inputs, and interpretation note. NeuroVLM defaults to `{ resultLimit: 50 }`; NiCLIP defaults to `{ prior: 'literature', evidenceThreshold: 3 }`. Render parameters from the registry schema rather than branching on model names:

```tsx
model.parameters.map((parameter) => (
    <DecodeParameterControl
        key={parameter.key}
        definition={parameter}
        value={parameters[parameter.key] ?? parameter.defaultValue}
        onChange={(value) => onChange(model.id, { ...parameters, [parameter.key]: value })}
    />
));
```

Define `DecodeParameterControl` as a private component in `DecodeModelPanel.tsx`; it switches exhaustively over registry schema kinds `'integer' | 'number' | 'boolean' | 'select'` and returns the corresponding labeled MUI control. Show an inline compatibility error and correction when a selected model does not support the active source. Do not render disabled future models.

- [ ] **Step 4: Refactor `DecodePage` around draft and preview snapshots**

Keep inputs visible in the one-page workspace; use collapsible sections rather than replacing the entire form with results. On preview:

```tsx
const request = buildDecodeRunRequest(draft);
setPreviewState(adapter.preview(request, fixtureScenario));
setAnnouncement('Example decoder results ready.');
```

The primary action must read **Preview example results** and sit next to **No map is uploaded and no decoder is run**. When `isPreviewStale` becomes true, preserve the old result, label it stale, and require the user to activate preview again. Reset restores `EMPTY_DECODE_DRAFT`, clears preview/viewer/comparison state, and returns focus to the active source tab.

In `DecodePage.spec.tsx`, define `completeNeurovaultDraft()` to fill image 25 plus z/group/fMRI-BOLD/121 using accessible controls, and `openPreview()` to call that helper and activate **Preview example results**.

- [ ] **Step 5: Run `npm run test` and verify GREEN**

Expected: model switching, parameter provenance, preview, stale state, and reset pass.

- [ ] **Step 6: Commit model and page orchestration**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeModelPanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx
git commit -m "feat: add decoder model configuration"
```

### Task 5: Build the viewer-shaped map and coordinate workspace

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`

**Interfaces:**
- Consumes: active `DecodeRunSource`, fixture atlas readouts, and `IViewerState`.
- Produces: `DecodeViewer({ source, atlasReadouts, value, onChange })` with display-only threshold and selected coordinate.

- [ ] **Step 1: Write failing viewer tests**

```tsx
it('labels the viewer and atlas values as examples', () => {
    renderViewer();
    expect(screen.getByRole('region', { name: 'Example map viewer' })).toBeVisible();
    expect(screen.getByText('Example atlas readout')).toBeVisible();
    expect(screen.getByText(/has not loaded or inspected this map/)).toBeVisible();
});

it('updates the active coordinate and corresponding text readout', async () => {
    renderViewer();
    await userEvent.clear(screen.getByLabelText('Viewer x coordinate'));
    await userEvent.type(screen.getByLabelText('Viewer x coordinate'), '-42');
    expect(screen.getByText(/Left inferior frontal gyrus/)).toBeVisible();
    expect(screen.getByText('72%')).toBeVisible();
});

it('changes display threshold without requesting a new preview', async () => {
    renderViewer();
    await userEvent.click(screen.getByRole('slider', { name: 'Display threshold' }));
    expect(onDisplayChange).toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
});
```

In `DecodeViewer.spec.tsx`, define `renderViewer()` to render `DecodeViewer` with NeuroVault image 25, the fixture atlas records, initial viewer state `{ x: 0, y: 0, z: 0, threshold: 0 }`, a state-updating `onChange` spy named `onDisplayChange`, and a separate `onPreview` sentinel that is not passed to the viewer.

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: viewer components do not exist.

- [ ] **Step 3: Implement the accessible viewer placeholder**

Use three labeled orthogonal-plane placeholders—sagittal, coronal, axial—with crosshairs driven by the selected MNI coordinate. Provide x/y/z number fields and a display-threshold slider. For coordinate sources, add a listbox that selects among entered points and copies its values into the viewer selection.

The anatomical placeholder must not suggest it depicts the supplied map. Render the permanent message **Example viewer — this prototype has not loaded or inspected your map** inside the region.

- [ ] **Step 4: Add atlas probability readouts**

Map deterministic coordinate keys to fixture atlas records such as:

```tsx
{ atlas: 'Harvard-Oxford cortical atlas', region: 'Left inferior frontal gyrus', probability: 0.72, example: true }
```

Render atlas, region, and percentage as a semantic list. Include **No example atlas label at this coordinate** when no fixture key matches. Keep atlas results outside the decoder request and mark them as examples in both visible and accessible text.

- [ ] **Step 5: Run `npm run test` and verify GREEN**

Expected: viewer, coordinate selection, threshold separation, and atlas readout pass.

- [ ] **Step 6: Commit the viewer workspace**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx
git commit -m "feat: add decoder viewer workspace"
```

### Task 6: Make terms primary and add associated studies

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeStudyResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiClipResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx`

**Interfaces:**
- Consumes: successful `IDecodePreview`, model definition, selected result, and page controls.
- Produces: terms/studies/model-summary tabs and `onSelectComparison(result: IDecodeComparableResult)`.

- [ ] **Step 1: Write failing term navigation tests**

```tsx
it('searches, sorts, and paginates model-labeled term results', async () => {
    renderTermResults({ terms: makeTerms(65), metric: 'similarity' });
    expect(screen.getByRole('columnheader', { name: 'Similarity' })).toBeVisible();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search term results' }), 'memory');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search term results' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText(/51–65 of 65/)).toBeVisible();
});

it('keeps signed correlation values and a zero-centred display', () => {
    renderTermResults({ terms: [{ id: 'language', label: 'language', value: -0.118, metric: 'correlation', comparableMapId: 'map-language' }] });
    expect(screen.getByText('-0.118')).toBeVisible();
    expect(screen.getByLabelText(/negative correlation -0.118/)).toBeVisible();
});
```

- [ ] **Step 2: Write failing associated-study tests**

```tsx
it('states whether each study matches the input, selected concept, or both', async () => {
    renderResults();
    await userEvent.click(screen.getByRole('tab', { name: 'Associated studies' }));
    expect(screen.getByText('Matches input and selected concept')).toBeVisible();
    expect(screen.getByRole('link', { name: /Open study/ })).toHaveAttribute('href');
});

it('shows the reverse-inference limit beside ranked results', () => {
    renderResults();
    expect(screen.getByText(/does not establish the cognitive state that produced the input/)).toBeVisible();
});
```

In the result specs, define `makeTerms(count)` to return deterministic `IDecodeTerm` records with every tenth label containing `memory`; define `renderTermResults(props)` as a stateful selection wrapper; and define `renderResults()` with a successful NeuroVLM preview from `createFixtureDecodeAdapter()` and stateful active-tab/comparison callbacks.

- [ ] **Step 3: Run `npm run test` and verify RED**

Expected: search, sorting, pagination, associated studies, and metric-specific labels are missing.

- [ ] **Step 4: Implement reusable client-side result navigation**

Add pure helpers with explicit signatures:

```tsx
filterTerms(terms: IDecodeTerm[], query: string): IDecodeTerm[];
sortTerms(terms: IDecodeTerm[], sort: 'rank' | 'label' | 'value', direction: 'asc' | 'desc'): IDecodeTerm[];
paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; start: number; end: number; total: number; pageCount: number };
```

Use controlled search, sort, direction, page, and page-size controls. Reset page to zero when search, sort, direction, or page size changes. The column header must use `Similarity`, `Correlation`, `Probability`, or `Bayes factor` from the metric. Preserve the selected comparable result across navigation.

- [ ] **Step 5: Implement studies and model-specific summaries**

Add **Terms**, **Associated studies**, **Model summary**, and **Compare maps** tabs. Keep **Terms** first and active by default. Study cards show citation, year, match basis, and a fixture-safe URL. NeuroVLM shows ranked concepts and an example narrative; NiCLIP retains domains, posterior probabilities, and Bayes factors with their prior explanation. `DecodeMethodSummary` names the selected model and renders its interpretation note without importing icons through deep default paths.

Place fixture provenance and the reverse-inference limitation above the tab panels so both remain visible in every result view.

- [ ] **Step 6: Run `npm run test` and verify GREEN**

Expected: full term and study navigation, model summaries, signed metrics, and limitations pass.

- [ ] **Step 7: Commit result exploration**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeStudyResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiClipResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx
git commit -m "feat: add decoder term and study exploration"
```

### Task 7: Add side-by-side and overlay comparison plus inspectable result states

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodePreviewState.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx`

**Interfaces:**
- Consumes: `IDecodeComparableResult`, `IDecodePreviewState`, source label, and viewer coordinate.
- Produces: comparison mode `'side-by-side' | 'overlay'`; inline loading, empty, unsupported, lookup-error, decoder-error, and success surfaces.

- [ ] **Step 1: Write failing comparison tests**

```tsx
it('preserves the selected result while switching comparison modes', async () => {
    renderComparison({ selectedResult: visualTerm });
    expect(screen.getByText('visual meta-analytic map')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Overlay' }));
    expect(screen.getByText('visual meta-analytic map')).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Input map opacity' })).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Comparison map opacity' })).toBeVisible();
});

it('offers a direct route back to terms when nothing comparable is selected', async () => {
    renderComparison({ selectedResult: undefined });
    await userEvent.click(screen.getByRole('button', { name: 'Choose a term' }));
    expect(onChooseTerm).toHaveBeenCalledOnce();
});
```

In `DecodeResults.spec.tsx`, define `visualTerm` as the comparable visual term from `EXAMPLE_TERMS` and `renderComparison({ selectedResult })` as a stateful wrapper with spies for `onChooseTerm` and comparison-state changes.

- [ ] **Step 2: Write failing inline-state tests**

```tsx
it.each([
    ['lookup-error', 'Example NeuroVault lookup failed'],
    ['decode-error', 'Example decoder run failed'],
])('keeps %s inside the decoder workspace', async (scenario, message) => {
    render(<DecodePage initialFixtureScenario={scenario} />);
    await previewValidNeurovaultInput();
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Try preview again' })).toBeVisible();
    expect(screen.getByDisplayValue('https://neurovault.org/images/25/')).toBeInTheDocument();
});
```

In `DecodePage.spec.tsx`, define `previewValidNeurovaultInput()` by filling the same image 25 and z/group/fMRI-BOLD/121 controls used by `completeNeurovaultDraft()` and activating **Preview example results**.

- [ ] **Step 3: Run `npm run test` and verify RED**

Expected: overlay controls and inline fixture states are missing.

- [ ] **Step 4: Implement both comparison layouts**

Use a labeled radio group for mode. Side-by-side panes share the selected coordinate and display threshold and stack below the desktop breakpoint. Overlay uses one placeholder frame with two labeled layers, independent opacity sliders, and color controls selected from accessible named presets. Both panes must say **Map placeholder — no image loaded**.

- [ ] **Step 5: Implement inspectable preview states**

`DecodePreviewState` switches exhaustively on `state.status`. Loading uses `aria-busy="true"` without timers. Empty terms and studies render within their tabs. Errors name the failed operation, preserve draft state, and expose **Try preview again** plus **Edit inputs**. A development-only `fixture` query parameter accepts the scenario union; invalid values fall back to `success`. Do not expose this control as a scientific setting.

For an upload success, show **Example deposit receipt**, **CC0**, the filename, and a clearly illustrative ID such as `example-deposit-001`.

- [ ] **Step 6: Run `npm run test` and verify GREEN**

Expected: comparison modes, responsive labels, receipt, loading/empty/error states, and retry behavior pass.

- [ ] **Step 7: Commit comparison and result states**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodePreviewState.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx
git commit -m "feat: complete decoder comparison states"
```

### Task 8: Verify the complete public workflow and frontend boundary

**Files:**
- Modify: `compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx`

**Interfaces:**
- Consumes: the complete public decoder workflow.
- Produces: browser-level proof that NeuroVault image 25 reaches terms, studies, and both comparison modes without a backend call or render crash.

- [ ] **Step 1: Expand and run the Cypress workflow test**

```tsx
it('reviews the complete fixture-backed flow for public NeuroVault image 25', () => {
    cy.intercept('**/api/**', (request) => request.destroy()).as('blockedApi');
    cy.visit('/decode');
    cy.contains('[role="tab"]', 'NeuroVault image').click();
    cy.contains('label', 'NeuroVault image URL or ID').parent().find('input').type('https://neurovault.org/images/25/');
    cy.contains('label', 'Map type').parent().find('select').select('z');
    cy.contains('label', 'Analysis level').parent().find('select').select('group');
    cy.contains('label', 'Modality').parent().find('select').select('fmri-bold');
    cy.contains('label', 'Number of subjects').parent().find('input').type('121');
    cy.contains('button', 'Preview example results').click();
    cy.contains('Example viewer').should('be.visible');
    cy.contains('Illustrative example').should('be.visible');
    cy.get('button[aria-label="Select visual for comparison"]').click();
    cy.contains('[role="tab"]', 'Associated studies').click();
    cy.contains('Matches input').should('be.visible');
    cy.contains('[role="tab"]', 'Compare maps').click();
    cy.contains('label', 'Overlay').click();
    cy.get('[role="slider"][aria-label="Input map opacity"]').should('be.visible');
});
```

Run from `compose/neurosynth-frontend` with the documented server available:

```bash
env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless
```

Expected: the complete fixture-backed flow passes without a decoder API response.

- [ ] **Step 2: Add mobile comparison coverage and rerun Cypress**

Add a second test that calls `cy.viewport(390, 844)`, opens the same fixture result, selects a comparable term, and asserts that the two labeled side-by-side panes are visible in document order without horizontal page overflow:

```tsx
cy.document().then((document) => {
    expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
});
```

Run `env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless` again. Expected: both decoder browser tests pass.

- [ ] **Step 3: Run the complete documented unit suite**

Run:

```bash
NODE_OPTIONS=--localstorage-file=/private/tmp/neurostore-decoder-localstorage npm run test
```

Expected: every Vitest file passes. The `NODE_OPTIONS` workaround addresses Node 26's localStorage behavior and does not alter application code.

- [ ] **Step 4: Run the focused Cypress flow with the dev server**

Start or reuse the documented dev server:

```bash
npm run start:dev
```

In another terminal run:

```bash
env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless
```

Expected: the decoder browser flow passes, and no request is needed to display fixture results.

- [ ] **Step 5: Run the documented development build**

Run:

```bash
npm run build:dev
```

Expected: TypeScript and Vite complete successfully. Existing Sentry/network, chunk-size, or development SEO warnings may remain if they predate and do not fail the command.

- [ ] **Step 6: Inspect desktop, mobile, and keyboard behavior**

At `http://localhost:3000/decode`, verify 1440 px and 390 px widths. Tab through source tabs, fields, model selection, preview, result search, pagination, term selection, study links, comparison modes, opacity controls, retry, and reset. Confirm that focus is visible, panels do not overflow, no label is obscured by duplicate placeholder text, and errors remain in the workspace.

- [ ] **Step 7: Run final repository checks and commit**

```bash
git diff --check
git status --short
git add compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx compose/neurosynth-frontend/src/pages/Decode
git commit -m "test: verify decoder MVP workflow"
```

Expected: only intended decoder changes are staged; `CODEX_REVIEW_BRIEF.md` remains untracked.
