# Decoder Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/decode` wireframe with a polished public frontend prototype that collects a NIfTI or NeuroVault source and metadata, then presents clearly illustrative Neurosynth-correlation, NiCLIP, and comparison views without calling a backend.

**Architecture:** `DecodePage` owns the controlled submission, preview, result-view, and selected-term state. Focused input and result components consume typed props, while pure helpers validate file names, NeuroVault references, and required metadata. Static Cognitive Atlas and decoder examples live in a fixture module so no component implies that a network request occurred.

**Tech Stack:** React 19, TypeScript 5.9, MUI v5, Vitest 4, Testing Library, Vite 8

**Spec:** `docs/superpowers/specs/2026-08-26-decoder-interface-design.md`

## Global Constraints

- Keep `/decode` public and preserve its existing SEO metadata and `SEO_ROUTES` registration.
- Accept only a local `.nii`/`.nii.gz` file or a NeuroVault image ID/URL; do not accept arbitrary remote NIfTI URLs.
- Require map type, analysis level, modality, and a positive integer subject count.
- Keep the Cognitive Atlas task and “What do you think this map relates to?” fields optional; never preselect a task.
- Label every decoder result as illustrative; do not simulate upload, decoding, persistence, sharing, latency, or backend failures.
- Describe MNI152 space, one 3D volume, and unthresholded input as requirements, never as browser-verified facts.
- Use MUI v5 with `sx`, theme spacing, semantic colors, Roboto, blue primary actions, and no new orange actions.
- Keep all interactive controls keyboard operable and expose validation and dynamic preview state to assistive technology.
- Run frontend tests only with the repository-documented `npm run test` command.

---

### Task 1: Decode domain types, fixtures, and validation

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts`
- Test: `compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts`

**Interfaces:**
- Produces: `IDecodeSubmission`, `IDecodeValidationErrors`, `IDecodedTerm`, `INiClipDomain`, `INiClipTask`, `EMPTY_DECODE_SUBMISSION`, `COGNITIVE_TASK_OPTIONS`, `EXAMPLE_TERMS`, `EXAMPLE_NICLIP_DOMAINS`, `EXAMPLE_NICLIP_TASKS`.
- Produces: `isAcceptedNiftiFilename(filename: string): boolean`, `parseNeurovaultImageId(value: string): string | null`, and `validateDecodeSubmission(submission: IDecodeSubmission): IDecodeValidationErrors`.

- [ ] **Step 1: Write the failing helper tests**

```tsx
import { describe, expect, it } from 'vitest';
import { EMPTY_DECODE_SUBMISSION } from './Decode.fixtures';
import { isAcceptedNiftiFilename, parseNeurovaultImageId, validateDecodeSubmission } from './Decode.helpers';

describe('decode input helpers', () => {
    it.each(['map.nii', 'map.nii.gz', 'MAP.NII.GZ'])('accepts the supported NIfTI filename %s', (filename) => {
        expect(isAcceptedNiftiFilename(filename)).toBe(true);
    });

    it.each(['map.nii.zip', 'map.gz', 'map', ''])('rejects the unsupported filename %s', (filename) => {
        expect(isAcceptedNiftiFilename(filename)).toBe(false);
    });

    it.each([
        ['308', '308'],
        ['https://neurovault.org/images/308/', '308'],
        ['https://www.neurovault.org/api/images/308?format=json', '308'],
    ])('normalizes NeuroVault reference %s', (reference, expected) => {
        expect(parseNeurovaultImageId(reference)).toBe(expected);
    });

    it.each([
        '0',
        '-1',
        'https://example.org/images/308/',
        'https://neurovault.org/collections/308/',
        'https://neurovault.org/images/not-a-number/',
    ])('rejects non-image NeuroVault reference %s', (reference) => {
        expect(parseNeurovaultImageId(reference)).toBeNull();
    });

    it('reports every missing required value', () => {
        expect(validateDecodeSubmission(EMPTY_DECODE_SUBMISSION)).toEqual({
            source: 'Choose a NIfTI file.',
            mapType: 'Choose a map type.',
            analysisLevel: 'Choose an analysis level.',
            modality: 'Choose a modality.',
            subjectCount: 'Enter the number of subjects.',
        });
    });

    it('requires acknowledgement for subject-level maps', () => {
        expect(
            validateDecodeSubmission({
                ...EMPTY_DECODE_SUBMISSION,
                file: new File(['map'], 'map.nii'),
                metadata: {
                    ...EMPTY_DECODE_SUBMISSION.metadata,
                    mapType: 'z',
                    analysisLevel: 'subject',
                    modality: 'fmri-bold',
                    subjectCount: '1',
                },
            }).subjectWarningAcknowledged
        ).toBe('Acknowledge the subject-level warning to continue.');
    });
});
```

- [ ] **Step 2: Run the documented test command and verify RED**

Run from `compose/neurosynth-frontend`: `npm run test`

Expected: FAIL because `Decode.types`, `Decode.fixtures`, and `Decode.helpers` do not exist.

- [ ] **Step 3: Add the types, literal fixtures, and pure validation**

Define the shared model in `Decode.types.ts`:

```tsx
export type DecodeSource = 'upload' | 'neurovault';
export type DecodeMapType = '' | 'z' | 't';
export type DecodeAnalysisLevel = '' | 'group' | 'subject';
export type DecodeModality = '' | 'fmri-bold' | 'pet' | 'other';
export type DecodeResultView = 'terms' | 'niclip' | 'compare';

export interface ICognitiveTaskOption { id: string; label: string; }
export interface IDecodeMetadata {
    mapType: DecodeMapType;
    analysisLevel: DecodeAnalysisLevel;
    modality: DecodeModality;
    subjectCount: string;
    cognitiveTask: ICognitiveTaskOption | null;
    interpretation: string;
}
export interface IDecodeSubmission {
    source: DecodeSource;
    file: File | null;
    neurovaultReference: string;
    metadata: IDecodeMetadata;
    subjectWarningAcknowledged: boolean;
}
export type IDecodeValidationErrors = Partial<Record<'source' | 'mapType' | 'analysisLevel' | 'modality' | 'subjectCount' | 'subjectWarningAcknowledged', string>>;
export interface IDecodedTerm { term: string; correlation: number; }
export interface INiClipDomain { domain: string; probability: number; }
export interface INiClipTask { task: string; probability: number; bayesFactor: number; }
```

Put hand-authored examples in `Decode.fixtures.ts`, including at least one negative term:

```tsx
export const EMPTY_DECODE_SUBMISSION: IDecodeSubmission = {
    source: 'upload',
    file: null,
    neurovaultReference: '',
    metadata: { mapType: '', analysisLevel: '', modality: '', subjectCount: '', cognitiveTask: null, interpretation: '' },
    subjectWarningAcknowledged: false,
};
export const COGNITIVE_TASK_OPTIONS = [
    { id: 'visual-perception', label: 'Visual perception' },
    { id: 'response-inhibition', label: 'Response inhibition' },
    { id: 'working-memory', label: 'Working memory' },
];
export const EXAMPLE_TERMS: IDecodedTerm[] = [
    { term: 'visual', correlation: 0.312 },
    { term: 'occipital', correlation: 0.268 },
    { term: 'language', correlation: -0.118 },
];
export const EXAMPLE_NICLIP_DOMAINS: INiClipDomain[] = [
    { domain: 'Perception', probability: 0.78 },
    { domain: 'Attention', probability: 0.55 },
    { domain: 'Action', probability: 0.21 },
];
export const EXAMPLE_NICLIP_TASKS: INiClipTask[] = [
    { task: 'Visual perception', probability: 0.21, bayesFactor: 14.2 },
    { task: 'Motion detection', probability: 0.14, bayesFactor: 7.1 },
    { task: 'Spatial attention', probability: 0.09, bayesFactor: 4.3 },
];
```

Implement `Decode.helpers.ts` with these exact validation boundaries:

```tsx
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const NEUROVAULT_HOSTS = new Set(['neurovault.org', 'www.neurovault.org']);

export const isAcceptedNiftiFilename = (filename: string) => /\.nii(?:\.gz)?$/i.test(filename);

export const parseNeurovaultImageId = (value: string): string | null => {
    const trimmed = value.trim();
    if (POSITIVE_INTEGER.test(trimmed)) return trimmed;
    try {
        const url = new URL(trimmed);
        if (!['http:', 'https:'].includes(url.protocol) || !NEUROVAULT_HOSTS.has(url.hostname.toLowerCase())) return null;
        return url.pathname.match(/^\/(?:api\/)?images\/([1-9]\d*)\/?$/)?.[1] ?? null;
    } catch {
        return null;
    }
};

export const validateDecodeSubmission = (submission: IDecodeSubmission): IDecodeValidationErrors => {
    const errors: IDecodeValidationErrors = {};
    if (submission.source === 'upload') {
        if (!submission.file) errors.source = 'Choose a NIfTI file.';
        else if (!isAcceptedNiftiFilename(submission.file.name)) errors.source = 'Choose a .nii or .nii.gz file.';
    } else if (!parseNeurovaultImageId(submission.neurovaultReference)) {
        errors.source = 'Enter a NeuroVault image ID or image URL.';
    }
    if (!submission.metadata.mapType) errors.mapType = 'Choose a map type.';
    if (!submission.metadata.analysisLevel) errors.analysisLevel = 'Choose an analysis level.';
    if (!submission.metadata.modality) errors.modality = 'Choose a modality.';
    if (!submission.metadata.subjectCount.trim()) errors.subjectCount = 'Enter the number of subjects.';
    else if (!POSITIVE_INTEGER.test(submission.metadata.subjectCount.trim())) errors.subjectCount = 'Enter a positive whole number.';
    if (submission.metadata.analysisLevel === 'subject' && !submission.subjectWarningAcknowledged) {
        errors.subjectWarningAcknowledged = 'Acknowledge the subject-level warning to continue.';
    }
    return errors;
};
```

- [ ] **Step 4: Run the documented test command and verify GREEN**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 5: Commit the domain layer**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.ts compose/neurosynth-frontend/src/pages/Decode/Decode.helpers.spec.ts
git commit -m "feat: define decoder prototype inputs"
```

### Task 2: Source inputs

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeFileInput.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx`
- Test: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourceInputs.spec.tsx`

**Interfaces:**
- Consumes: `isAcceptedNiftiFilename` from Task 1.
- Produces: `DecodeFileInput({ file, error, onChange })` and `DecodeNeurovaultInput({ value, error, onChange })`.

- [ ] **Step 1: Write failing interaction tests for both source controls**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DecodeFileInput from './DecodeFileInput';
import DecodeNeurovaultInput from './DecodeNeurovaultInput';

it('reports the selected NIfTI file', async () => {
    const onChange = vi.fn();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii.gz');
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), file);
    expect(onChange).toHaveBeenCalledWith(file);
});

it('supports dropping a NIfTI file', () => {
    const onChange = vi.fn();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii');
    fireEvent.drop(screen.getByTestId('decode-file-dropzone'), { dataTransfer: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith(file);
});

it('keeps an invalid file visible with correction guidance', async () => {
    render(<DecodeFileInput file={new File(['volume'], 'motor.zip')} error="Choose a .nii or .nii.gz file." onChange={vi.fn()} />);
    expect(screen.getByText('motor.zip')).toBeInTheDocument();
    expect(screen.getByText('Choose a .nii or .nii.gz file.')).toHaveAttribute('role', 'alert');
});

it('edits a NeuroVault image reference', async () => {
    const onChange = vi.fn();
    render(<DecodeNeurovaultInput value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' }), '308');
    expect(onChange).toHaveBeenLastCalledWith('308');
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: FAIL because the two source components do not exist.

- [ ] **Step 3: Implement semantic source inputs**

`DecodeFileInput` will use a visually bounded MUI `Box`, a hidden native file input labeled by a MUI `Button`, and these drop/file handlers:

```tsx
const selectFile = (nextFile?: File) => onChange(nextFile ?? null);
const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectFile(event.dataTransfer.files.item(0) ?? undefined);
};

<Box data-testid="decode-file-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
    <Button component="label" variant="outlined">
        Choose a NIfTI file
        <input hidden type="file" accept=".nii,.nii.gz" aria-label="Choose a NIfTI file"
            onChange={(event) => selectFile(event.target.files?.item(0) ?? undefined)} />
    </Button>
    <Typography>{file?.name ?? 'Drop one .nii or .nii.gz file here'}</Typography>
    {error && <FormHelperText id="decode-file-error" error role="alert">{error}</FormHelperText>}
</Box>
```

`DecodeNeurovaultInput` will render one controlled MUI `TextField` with this helper text when valid or untouched:

```tsx
helperText="Paste an image ID, such as 308, or a neurovault.org/images/… URL."
```

Both controls will forward the user's value without pretending to upload or fetch it. `DecodeNeurovaultInput` is a controlled field:

```tsx
<TextField
    fullWidth
    label="NeuroVault image URL or ID"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    error={Boolean(error)}
    helperText={error ?? 'Paste an image ID, such as 308, or a neurovault.org/images/… URL.'}
/>
```

- [ ] **Step 4: Run `npm run test` and verify GREEN**

Expected: all tests pass.

- [ ] **Step 5: Commit the source controls**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeFileInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeNeurovaultInput.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeSourceInputs.spec.tsx
git commit -m "feat: add decoder source controls"
```

### Task 3: Metadata and submission panel

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeMetadataForm.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx`
- Test: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.spec.tsx`

**Interfaces:**
- Consumes: `IDecodeSubmission`, `IDecodeValidationErrors`, `COGNITIVE_TASK_OPTIONS`, `validateDecodeSubmission`, and both Task 2 source controls.
- Produces: `DecodeInputPanel({ value, onChange, onPreview })` where `onPreview` fires only for a valid submission.

- [ ] **Step 1: Write failing form behavior tests**

```tsx
const completeRequiredFields = async ({ analysisLevel = 'group' }: { analysisLevel?: 'group' | 'subject' } = {}) => {
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.nii'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), analysisLevel);
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

const renderPanel = () => {
    const Wrapper = () => {
        const [value, setValue] = useState(EMPTY_DECODE_SUBMISSION);
        return <DecodeInputPanel value={value} onChange={setValue} onPreview={vi.fn()} />;
    };
    return render(<Wrapper />);
};

it('starts with upload selected and no Cognitive Atlas task selected', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Upload map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: /Cognitive Atlas task/ })).toHaveValue('');
});

it('switches to the NeuroVault source without losing metadata', async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.click(screen.getByRole('tab', { name: 'NeuroVault image' }));
    expect(screen.getByLabelText('Map type')).toHaveValue('z');
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toBeInTheDocument();
});

it('keeps preview disabled until the source and required metadata are valid', async () => {
    renderPanel();
    const preview = screen.getByRole('button', { name: 'Preview results' });
    expect(preview).toBeDisabled();
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.nii'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
    expect(preview).toBeEnabled();
});

it('requires acknowledgement before previewing a subject-level map', async () => {
    renderPanel();
    await completeRequiredFields({ analysisLevel: 'subject' });
    expect(screen.getByRole('alert')).toHaveTextContent('NiCLIP was designed for group-level maps');
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /continue with a subject-level map/i }));
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeEnabled();
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: FAIL because `DecodeMetadataForm` and `DecodeInputPanel` do not exist.

- [ ] **Step 3: Implement the controlled metadata form and input panel**

`DecodeMetadataForm` will render MUI `TextField select` controls for map type, analysis level, and modality; a numeric `TextField` for subject count; an optional MUI `Autocomplete<ICognitiveTaskOption>`; and the optional multiline interpretation field. Use these visible labels:

```tsx
Map type
Analysis level
Modality
Number of subjects
Cognitive Atlas task (optional)
What do you think this map relates to? (optional)
```

`DecodeInputPanel` will render MUI tabs for the two sources, the active source control, the input-requirements callout, and `DecodeMetadataForm`. It will compute validity and update controlled state with these operations:

```tsx
const errors = validateDecodeSubmission(value);
const updateMetadata = <K extends keyof IDecodeMetadata>(key: K, nextValue: IDecodeMetadata[K]) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: nextValue } });
};
const changeSource = (source: DecodeSource) => onChange({ ...value, source });

{value.metadata.analysisLevel === 'subject' && (
    <Alert severity="warning" role="alert">
        NiCLIP was designed for group-level maps. Subject-level results may be unreliable.
        <FormControlLabel
            control={<Checkbox checked={value.subjectWarningAcknowledged}
                onChange={(event) => onChange({ ...value, subjectWarningAcknowledged: event.target.checked })} />}
            label="Continue with a subject-level map"
        />
    </Alert>
)}
<Button variant="contained" disabled={Object.keys(errors).length > 0} onClick={onPreview}>Preview results</Button>
```

- [ ] **Step 4: Run `npm run test` and verify GREEN**

Expected: all tests pass.

- [ ] **Step 5: Commit the input workspace**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeMetadataForm.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeInputPanel.spec.tsx
git commit -m "feat: collect decoder map metadata"
```

### Task 4: Accessible signed term correlations

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx`
- Test: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx`

**Interfaces:**
- Consumes: `IDecodedTerm` from Task 1.
- Produces: `DecodeTermResults({ terms, selectedTerm, onSelectTerm, onCompareSelected })`.

- [ ] **Step 1: Write failing behavior and accessibility tests**

```tsx
const terms = [
    { term: 'visual', correlation: 0.3 },
    { term: 'language', correlation: -0.15 },
];

it('renders positive and negative correlations on opposite sides of zero', () => {
    render(<DecodeTermResults terms={terms} onSelectTerm={vi.fn()} onCompareSelected={vi.fn()} />);
    expect(screen.getByLabelText('visual: positive correlation 0.300')).toHaveAttribute('data-direction', 'positive');
    expect(screen.getByLabelText('language: negative correlation -0.150')).toHaveAttribute('data-direction', 'negative');
});

it('selects a term with the keyboard without changing views', async () => {
    const onSelectTerm = vi.fn();
    render(<DecodeTermResults terms={terms} onSelectTerm={onSelectTerm} onCompareSelected={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Select visual for comparison' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSelectTerm).toHaveBeenCalledWith('visual');
});

it('enables explicit comparison only after a term is selected', async () => {
    const onCompareSelected = vi.fn();
    const { rerender } = render(<DecodeTermResults terms={terms} onSelectTerm={vi.fn()} onCompareSelected={onCompareSelected} />);
    expect(screen.getByRole('button', { name: 'Compare selected term' })).toBeDisabled();
    rerender(<DecodeTermResults terms={terms} selectedTerm="visual" onSelectTerm={vi.fn()} onCompareSelected={onCompareSelected} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected term' }));
    expect(onCompareSelected).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: FAIL because rows are not keyboard controls, negative bars are not diverging, and comparison is implicit.

- [ ] **Step 3: Replace clickable rows with explicit selection controls and a diverging scale**

Keep the semantic table. Put a MUI `Button` with `variant="text"` in each term cell and use this two-half correlation track with a visible center line:

```tsx
const strongest = Math.max(...terms.map(({ correlation }) => Math.abs(correlation)), 0.01);
const width = `${(Math.abs(correlation) / strongest) * 100}%`;
const direction = correlation < 0 ? 'negative' : 'positive';

<Button variant="text" aria-pressed={term === selectedTerm}
    aria-label={`Select ${term} for comparison`} onClick={() => onSelectTerm(term)}>{term}</Button>
<Box aria-label={`${term}: ${direction} correlation ${correlation.toFixed(3)}`} data-direction={direction}
    sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {correlation < 0 && <Box sx={{ width, bgcolor: 'primary.dark', height: 8 }} />}
    </Box>
    <Box>{correlation >= 0 && <Box sx={{ width, bgcolor: 'primary.main', height: 8 }} />}</Box>
</Box>
```

Preserve the printed signed value and render **Compare selected term** below the table.

- [ ] **Step 4: Run `npm run test` and verify GREEN**

Expected: all tests pass.

- [ ] **Step 5: Commit the correlation result view**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeTermResults.spec.tsx
git commit -m "feat: show signed decoder correlations"
```

### Task 5: NiCLIP, comparison, and result navigation

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiClipResults.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx`
- Test: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx`

**Interfaces:**
- Consumes: Task 1 result types and fixtures plus Task 4 `DecodeTermResults`.
- Produces: controlled `DecodeResults({ activeView, selectedTerm, sourceLabel, onViewChange, onSelectTerm })`.

- [ ] **Step 1: Write failing result-navigation tests**

```tsx
const ResultHarness = () => {
    const [activeView, setActiveView] = useState<DecodeResultView>('terms');
    const [selectedTerm, setSelectedTerm] = useState<string>();
    return (
        <DecodeResults
            activeView={activeView}
            selectedTerm={selectedTerm}
            sourceLabel="motor.nii.gz"
            onViewChange={setActiveView}
            onSelectTerm={setSelectedTerm}
        />
    );
};

it('labels all displayed outputs as illustrative', () => {
    render(<ResultHarness />);
    expect(screen.getByText(/illustrative example/i)).toBeInTheDocument();
});

it('switches from correlations to NiCLIP predictions explicitly', async () => {
    render(<ResultHarness />);
    await userEvent.click(screen.getByRole('tab', { name: 'NiCLIP predictions' }));
    expect(screen.getByRole('columnheader', { name: 'Bayes factor' })).toBeInTheDocument();
    expect(screen.getByText('Perception')).toBeInTheDocument();
});

it('opens comparison only after selecting a term and choosing compare', async () => {
    render(<ResultHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Select visual for comparison' }));
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected term' }));
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText('visual meta-analytic map')).toBeInTheDocument();
});

it('directs an empty comparison back to term selection', async () => {
    render(<ResultHarness />);
    await userEvent.click(screen.getByRole('tab', { name: 'Compare maps' }));
    expect(screen.getByText('Select a term before comparing maps.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose a term' }));
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveAttribute('aria-selected', 'true');
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: FAIL because the result orchestration and NiCLIP components do not exist.

- [ ] **Step 3: Implement the result components**

`DecodeNiClipResults` will render domain chips and a semantic table with task, `P(task | map)`, and Bayes factor columns. Evidence labels derive from this pure display function:

```tsx
const evidenceLabel = (bayesFactor: number) => {
    if (bayesFactor >= 10) return 'strong';
    if (bayesFactor >= 3) return 'moderate';
    if (bayesFactor >= 1) return 'weak';
    return 'against';
};
```

`DecodeComparison` will render two equal MUI `Box` placeholders on desktop and stacked placeholders on narrow screens. It will render **Choose a term** when `selectedTerm` is absent.

`DecodeMethodSummary` will use a MUI `Accordion` titled **About decoding** and concise copy that distinguishes spatial correlation from NiCLIP inference and warns against diagnostic or causal interpretation.

`DecodeResults` will render controlled MUI tabs named **Term correlations**, **NiCLIP predictions**, and **Compare maps**. It will connect the explicit comparison action without changing views on row selection:

```tsx
<Tabs value={activeView} onChange={(_event, view: DecodeResultView) => onViewChange(view)}>
    <Tab value="terms" label="Term correlations" />
    <Tab value="niclip" label="NiCLIP predictions" />
    <Tab value="compare" label="Compare maps" />
</Tabs>
{activeView === 'terms' && <DecodeTermResults terms={EXAMPLE_TERMS} selectedTerm={selectedTerm}
    onSelectTerm={onSelectTerm} onCompareSelected={() => onViewChange('compare')} />}
{activeView === 'niclip' && <DecodeNiClipResults domains={EXAMPLE_NICLIP_DOMAINS} tasks={EXAMPLE_NICLIP_TASKS} />}
{activeView === 'compare' && <DecodeComparison sourceLabel={sourceLabel} selectedTerm={selectedTerm}
    onChooseTerm={() => onViewChange('terms')} />}
```

It will show an `Alert` reading **Illustrative example — no decoder was called** and finish with `DecodeMethodSummary`.

- [ ] **Step 4: Run `npm run test` and verify GREEN**

Expected: all tests pass.

- [ ] **Step 5: Commit the result workspace**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeNiClipResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeComparison.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeMethodSummary.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeResults.spec.tsx
git commit -m "feat: add decoder result views"
```

### Task 6: Integrate the public decoder workspace

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`
- Test: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx`

**Interfaces:**
- Consumes: `EMPTY_DECODE_SUBMISSION`, `DecodeResultView`, `DecodeInputPanel`, and `DecodeResults`.
- Preserves: existing `usePageMetadata`, `usePrerenderReady(true)`, public `/decode` route, Explore navigation entry, and SEO route.

- [ ] **Step 1: Write failing page workflow tests**

```tsx
const completeUpload = async () => {
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'motor.nii.gz'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

it('reveals illustrative results from a complete public submission', async () => {
    render(<DecodePage />);
    await completeUpload();
    await userEvent.type(screen.getByLabelText(/What do you think this map relates to/), 'Motor response');
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    expect(screen.getByRole('region', { name: 'Illustrative decoder results' })).toBeInTheDocument();
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText(/no decoder was called/i)).toBeInTheDocument();
});

it('summarizes declared metadata without claiming it was verified', async () => {
    render(<DecodePage />);
    await completeUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    expect(screen.getByText(/Declared input: group-level · z statistic · fMRI-BOLD · 48 subjects/)).toBeInTheDocument();
    expect(screen.queryByText(/verified MNI/i)).not.toBeInTheDocument();
});

it('resets the complete workspace', async () => {
    render(<DecodePage />);
    await completeUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start another preview' }));
    expect(screen.queryByRole('region', { name: 'Illustrative decoder results' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Number of subjects')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
});
```

- [ ] **Step 2: Run `npm run test` and verify RED**

Expected: FAIL because `DecodePage` still renders the original hardcoded wireframe.

- [ ] **Step 3: Rewrite `DecodePage` as the controlled workspace**

Initialize these states:

```tsx
const [submission, setSubmission] = useState<IDecodeSubmission>(EMPTY_DECODE_SUBMISSION);
const [isPreviewOpen, setIsPreviewOpen] = useState(false);
const [activeResultView, setActiveResultView] = useState<DecodeResultView>('terms');
const [selectedTerm, setSelectedTerm] = useState<string>();
```

Render the title and concise public-route introduction, then a single-column input workspace before preview. On preview, render a responsive two-column layout with a compact submitted-map/provenance summary and `DecodeResults`. Wrap the result area in `role="region" aria-label="Illustrative decoder results" aria-live="polite"`.

Implement **Start another preview** by restoring `EMPTY_DECODE_SUBMISSION`, closing the preview, selecting the term view, and clearing `selectedTerm`. Derive the source label from `submission.file?.name` or normalized NeuroVault image ID. Preserve the existing metadata hooks and surrounding route integration.

- [ ] **Step 4: Run `npm run test` and verify GREEN**

Expected: all tests pass.

- [ ] **Step 5: Commit the integrated page**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx compose/neurosynth-frontend/src/pages/Decode/DecodePage.spec.tsx
git commit -m "feat: complete decoder interface prototype"
```

### Task 7: Full verification and browser review

**Files:**
- Modify only decoder files when verification exposes a defect.
- Preserve untracked `CODEX_REVIEW_BRIEF.md`; do not stage or commit it.

**Interfaces:**
- Verifies the complete feature against the approved spec and the repository's documented commands.

- [ ] **Step 1: Initialize required submodules before build work**

Run from the monorepo root: `git submodule update --init --recursive`

Expected: exit 0.

- [ ] **Step 2: Run the complete frontend unit suite**

Run from `compose/neurosynth-frontend`: `npm run test`

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the documented development build**

Run: `npm run build:dev`

Expected: Vite build, prerender, and sitemap generation exit 0; `/decode` is included in prerender and sitemap output. Existing development Sentry warnings may appear as documented.

- [ ] **Step 4: Start the documented development server**

Run: `npm run start:dev`

Expected: Vite serves `http://localhost:3000/decode`.

- [ ] **Step 5: Inspect the full interaction at desktop and mobile widths**

At 1280px and 390px widths, verify:

- no horizontal overflow;
- source tabs, fields, task autocomplete, and warnings remain readable;
- keyboard focus follows source → metadata → preview → result tabs → term selection → comparison;
- negative and positive correlations appear on opposite sides of the zero line;
- the completed desktop layout uses two columns and the mobile layout stacks;
- the illustrative-output alert remains visible; and
- reset restores the empty form.

- [ ] **Step 6: Re-run tests and build after any browser-review fix**

Run: `npm run test`

Run: `npm run build:dev`

Expected: both commands exit 0 after the final edit.

- [ ] **Step 7: Check the final diff and repository state**

Run from the monorepo root:

```bash
git diff --check upstream/master...HEAD
git status --short
```

Expected: no whitespace errors; `CODEX_REVIEW_BRIEF.md` remains untracked and no unrelated file is staged.
