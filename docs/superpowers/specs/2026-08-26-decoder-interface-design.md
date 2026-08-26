# Decoder interface design

## Purpose

The `/decode` route will give the Neurosynth Compose maintainers a polished, interactive frontend to review before the decoding service exists. The page will accept a local NIfTI map or a NeuroVault image reference, collect enough metadata to describe the submission, and show representative outputs from two decoding methods. Every result will be visibly illustrative. This branch will not upload a file, fetch a NeuroVault image, call a decoder, save a submission, or create a shareable result.

The route will remain public. It will neither require an account nor infer whether someone has visited before.

## Scope

The interface will support:

- A local `.nii` or `.nii.gz` file.
- A NeuroVault image ID or a recognized NeuroVault image URL.
- Required map type, analysis level, modality, and subject count.
- An optional Cognitive Atlas task search with no initial selection.
- An optional free-text answer to “What do you think this map relates to?”
- Neurosynth-style term correlations.
- NiCLIP-style domain and task predictions.
- An explicit side-by-side comparison between the submitted map and a selected term.
- Client-side validation, a subject-level warning, and a reset flow.

The interface will not support:

- Arbitrary remote NIfTI URLs.
- Backend upload, decoding, validation, persistence, or sharing.
- Login-aware or first-visit behavior.
- Claims that the browser verified MNI space, dimensionality, threshold status, or statistical validity.
- Simulated network latency or backend errors.

## Page flow

The page will use one workspace rather than a wizard. All source and metadata controls will appear together so occasional and repeat users follow the same stateless flow.

The source selector will offer two tabs:

1. **Upload map** accepts one local `.nii` or `.nii.gz` file through drag and drop or a file picker.
2. **NeuroVault image** accepts a numeric image ID or a URL whose path identifies a NeuroVault image.

The input panel will state the intended input precisely: one unthresholded, group-level, 3D z- or t-statistic map in MNI152 space. The text describes a requirement, not a completed check.

The user must provide:

- map type: z statistic or t statistic;
- analysis level;
- modality; and
- a positive integer subject count.

The user may also search for a Cognitive Atlas task and describe what they think the map relates to. The task field will start empty and will never choose the first option automatically. This avoids the selection artifact found in the NeuroVault decoder-upload audit.

Once the source and required metadata are valid, **Preview results** will reveal example output. The page will label the output as illustrative and will not say that it decoded the selected map.

## Results

The result workspace will provide three views.

### Term correlations

This view will show signed spatial correlations with Neurosynth meta-analytic maps. A zero-centered diverging bar will distinguish positive from negative values. The numeric correlation will retain its sign.

Each term row will contain a keyboard-operable selection control. Selecting a term will keep the user in the correlation view and enable **Compare selected term**. It will not switch views without an explicit action.

### NiCLIP predictions

This view will show:

- a compact domain summary;
- task posterior probabilities; and
- Bayes factors with restrained evidence labels.

The accompanying copy will explain that posterior probabilities include a literature-derived prior and that Bayes factors express the change from that prior. The fixture values will be marked as illustrative.

### Compare maps

This view will place the submitted-map placeholder beside the selected term’s meta-analytic-map placeholder. Until a term is selected, it will explain how to make a comparison and link back to the correlation view. The two panels will stack on narrow screens.

A compact **About decoding** section below the results will explain the difference between the two methods, the expected input, and the limits of interpretation. It will not compete with the result views as another primary tab.

## Components and state

`DecodePage` will own page-level state and SEO metadata. Smaller components will each handle one part of the interface:

- `DecodeInputPanel`: source choice, metadata, and submission.
- `DecodeFileInput`: file selection and drag-and-drop behavior.
- `DecodeNeurovaultInput`: NeuroVault image reference entry.
- `DecodeMetadataForm`: required metadata, optional task search, and free text.
- `DecodeResults`: result-view navigation and shared result context.
- `DecodeTermResults`: signed correlations and term selection.
- `DecodeNiClipResults`: domain and task predictions.
- `DecodeComparison`: side-by-side map placeholders.
- `DecodeMethodSummary`: method and interpretation guidance.

Pure helpers will validate file names, NeuroVault references, and metadata. Representative Cognitive Atlas tasks and decoder outputs will live in a clearly named fixture module. No data-fetching hook or React Query placeholder will be added.

The page state will record:

- active source type;
- selected file or NeuroVault input;
- metadata values;
- validation messages;
- whether the example preview is open;
- active result view; and
- selected correlation term.

Switching source types will not discard metadata. Resetting the workspace will clear both source-specific values, all metadata, the preview, and the selected term.

## Validation and warnings

Client-side validation will only make claims the browser can support.

- A local file name must end in `.nii` or `.nii.gz`, matched without regard to case.
- A NeuroVault reference must be a positive numeric ID or an HTTP(S) URL on `neurovault.org` or `www.neurovault.org` whose path is `/images/<id>` or `/api/images/<id>`. A trailing slash, query string, or fragment is allowed.
- Map type, analysis level, and modality must be selected.
- Subject count must be a positive integer.
- The Cognitive Atlas task and free-text interpretation are optional.

A subject-level selection will show a prominent warning that NiCLIP was designed for group-level maps. The user may continue after acknowledging the warning. The prototype will not try to infer analysis level from the file.

Each inline error will name the problem and the correction. Empty and comparison states will direct the user to the next available action.

## Visual design and accessibility

The page will follow the existing Neurosynth Compose visual system:

- MUI v5 components and `sx` styling;
- theme spacing and semantic colors;
- Roboto typography;
- blue for in-page primary actions; and
- orange reserved for the existing **NEW PROJECT** action.

A compact provenance strip will summarize the declared input and the illustrative method output. It will distinguish user-provided metadata from verified facts.

The desktop layout will place the submitted-map summary and results beside each other after preview. The mobile layout will stack them. Controls will retain visible keyboard focus, tabs will expose their selected state, errors will connect to their fields, and dynamic preview changes will use an appropriate polite live region. A table row itself will not act as an unlabeled button.

## Tests

Unit and component tests will cover:

- switching between upload and NeuroVault sources;
- accepted and rejected file names;
- accepted NeuroVault IDs and URL forms;
- required metadata and positive-integer subject counts;
- the initially empty task autocomplete;
- the subject-level warning and acknowledgement;
- the transition to visibly illustrative results;
- signed negative correlations and diverging bars;
- keyboard term selection;
- the explicit comparison action;
- source and metadata retention where intended; and
- the reset flow.

Verification will use the frontend commands documented in `.github/copilot-instructions.md`: the complete Vitest suite and the development build. The finished page will also be inspected at desktop and mobile widths with keyboard navigation.

## Deferred backend contract

The later backend branch will decide upload limits, NIfTI inspection, remote NeuroVault fetching, decoding model parameters, loading and failure behavior, caching, persistence, result sharing, and API response shapes. This frontend will keep those boundaries visible so the prototype does not accidentally establish a false contract.
