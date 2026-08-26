# Decoder interface design

## Product decision

The `/decode` route will present the complete public decoder workflow for UX review while every external operation remains a frontend simulation. A visitor can bring a brain map or coordinates, describe the input, choose a decoding model, inspect term and study results, and compare maps in a viewer-shaped workspace. The interface will make the intended product concrete without uploading data, fetching NeuroVault, querying an atlas, running a model, or saving a result.

This branch defines the frontend contract. A later branch will connect that contract to Neurostore, NeuroVault, the viewer, vocabularies, atlases, and decoder services.

The route will remain public and stateless. It will not require login, show a first-visit wizard, or claim to know whether someone has used it before.

## What the MVP must communicate

The decoder helps a researcher explore which psychological concepts and studies are associated with a statistical brain map or location. Its output is evidence for interpretation, not proof that a person or study engaged a particular mental process. The interface will keep that distinction visible wherever it presents a ranking or probability.

The reviewable frontend will include:

- existing NeuroVault images and local NIfTI files as map sources;
- one or more MNI coordinates as a location source;
- a map viewer workspace with coordinate selection and an atlas readout;
- Cognitive Atlas concepts aligned with the vocabulary used elsewhere in Compose;
- a free-text description of what the visitor thinks the map represents;
- NeuroVLM as the default decoder, NiCLIP as another available model, and an extensible model selector;
- model-specific parameters that remain visible and understandable before a run;
- searchable, sortable, and paginated term results;
- associated studies;
- side-by-side and overlay comparison modes; and
- an anonymous-deposit explanation for local files, including the proposed CC0 license and optional later account association.

All computed values, maps, atlas labels, study matches, upload states, and task suggestions in this branch will be labeled as example data.

## Scope boundaries

### Complete in this branch

This branch will implement every visible state needed to review the workflow:

- source selection and source-specific controls;
- client-side validation that uses only the information already in the browser;
- metadata and interpretation fields;
- the anonymous-deposit consent and attribution UI;
- model and parameter selection;
- a viewer-shaped map and coordinate workspace;
- atlas labels at a selected coordinate;
- term and study result navigation;
- map comparison controls;
- loading, empty, success, and recoverable error examples; and
- responsive and keyboard-accessible behavior.

A local adapter will return deterministic fixtures after the visitor chooses **Preview example results**. The page must never imply that those fixtures were computed from the submitted file, NeuroVault image, or coordinates.

### Hand off to backend integration

The later integration branch will implement:

- anonymous file deposit, CC0 recording, object storage, and optional account association;
- file limits, NIfTI parsing, header inspection, defacing or identifiability policy, and server-side validation;
- NeuroVault image lookup, metadata import, permissions, and failure handling;
- coordinate-to-image or coordinate-to-region construction;
- the image viewer, voxel-value lookup, and atlas probability queries;
- live Cognitive Atlas or ONVOC retrieval and identifier reconciliation;
- NeuroVLM, NiCLIP, and future model execution;
- model versioning, parameter schemas, queues, progress, cancellation, caching, and failures;
- associated-study queries and map retrieval;
- persisted and shareable decoder runs; and
- final API request and response shapes.

The frontend will isolate fixture data behind typed adapters so these integrations do not require a page redesign.

### Deliberately deferred

The meeting raised valuable research and product directions that are not part of this MVP:

- functional-connectivity and coactivation-map generation;
- a full atlas and parcel browser as another source type;
- scatterplots or other multi-axis result summaries;
- an image-trained CLIP decoder;
- experiments on coordinate-trained image decoding;
- automatic statistic-map or modality classification;
- free text as a mathematical prior for model inference; and
- automatic task assignment without user confirmation.

The architecture may accommodate these additions, but the interface will not expose inactive controls for them.

## One workspace, not a wizard

The page will use a single workspace with a clear reading order:

1. choose an input;
2. describe it;
3. choose a model and parameters;
4. preview example results;
5. inspect terms and studies; and
6. compare a selected result with the input.

The visitor can move between these areas without completing artificial steps. Results may collapse when an input that affects them changes, but the page will preserve unrelated entries. A full reset will remain available.

The primary action will say **Preview example results** in this branch. Its adjacent note will say that no map is uploaded and no decoder is run. Backend integration may later change the label to **Decode map**.

## Inputs

### Source selector

The source selector will provide three choices:

1. **NeuroVault image** accepts a positive image ID or a URL on `neurovault.org` whose path identifies an image. It will state plainly that arbitrary NIfTI URLs are not accepted.
2. **Upload NIfTI** accepts one local `.nii` or `.nii.gz` file through drag and drop or a file picker. Selecting a file does not upload it in this branch.
3. **MNI coordinates** accepts one or more x, y, and z triplets in millimetres. The interface will support adding, removing, and naming points and will show the accepted MNI convention. Coordinates remain a distinct input rather than pretending to be a NIfTI map.

The visitor will always see which source is active. Switching sources will retain unfinished values within each source, but only the active source will appear in the run summary or validation.

### Map requirements

For image sources, the interface will describe the supported input as a 3D, unthresholded z- or t-statistic map in MNI152 space. This is a requirement, not a browser-verified fact.

The visitor must declare:

- statistic type: z or t;
- analysis level: group, subject, meta-analysis, or other;
- imaging modality; and
- subject count when the analysis describes participants.

The modality control will use the NeuroVault categories relevant to statistical maps rather than the short sample list in the first prototype. The UI will support fMRI BOLD, fMRI CBF, fMRI CBV, diffusion MRI, structural MRI, FDG PET, oxygen-water PET, other PET, MEG, EEG, and other. Labels will be human-readable while submitted values remain stable identifiers.

Subject-level maps will trigger an identifiability and model-suitability warning. The visitor must acknowledge it before continuing. The frontend will not claim that the file is deidentified or that a selected model supports subject-level inference.

### Anonymous deposit for local files

The upload source will explain the proposed integrated deposit flow instead of sending the visitor to a separate NeuroVault upload page. Before preview, the visitor will see:

- that the eventual service will make the deposited image publicly accessible;
- that the proposed license is CC0;
- the minimal metadata that will accompany it;
- that no account is required; and
- that a signed-in visitor may later associate the deposit with an account if the backend supports that policy.

The visitor must explicitly accept the public-deposit and license terms. The prototype will then show an example deposit receipt and stable identifier in its success state, clearly marked as illustrative. It will neither copy the file nor create an identifier.

### Concepts and the visitor's interpretation

The metadata area will ask the visitor to search for Cognitive Atlas concepts. It will start empty, allow multiple confirmed concepts where useful, show stable vocabulary identifiers, and never preselect the first result. This avoids the list-position artifact found in the prior NeuroVault upload workflow.

The frontend fixture will use a versioned snapshot of the relevant Cognitive Atlas concept vocabulary rather than a handful of example labels. The adapter boundary will allow the backend to replace this snapshot with the ONVOC-aligned vocabulary used by Compose. Tasks, conditions, and modalities are future vocabulary axes; the MVP must not mix them into a single unlabeled list.

An optional text area will ask, **What do you think this map or location relates to?** The visitor may describe a task, construct, contrast, or hypothesis in their own words. The fixture adapter may return example concept suggestions from that text, but the interface will require the visitor to confirm each suggestion. The text itself will not alter the example decoder scores.

There will be no bare **None** or **Other** concept choice. A visitor who finds no suitable concept can leave the concept field empty and use the text area.

## Model selection and parameters

The model panel will put the scientific choice before the run action.

- **NeuroVLM** will be selected by default because it is the intended first integration.
- **NiCLIP** will demonstrate that models can expose different output types and parameters.
- The data model will accept additional decoders without adding model-specific state to `DecodePage`.

Each model definition will provide its name, short purpose, version or fixture version, supported source types, input requirements, parameter schema, output views, and interpretation note. Selecting a model will reveal only its parameters. Defaults will be visible and resettable. Unsupported source/model combinations will explain the conflict and how to correct it.

The run summary will record the selected model, version, and non-default parameters. No fixture result will be presented as a live NeuroVLM or NiCLIP calculation.

## Viewer workspace

The preview area will be shaped like the eventual analysis workspace, while its image and readouts remain deterministic examples.

For a map source it will show:

- the submitted-map pane;
- orthogonal slice controls and a selected MNI coordinate;
- a threshold/display control that changes presentation only;
- an atlas readout listing example regions and probabilities at the selected coordinate; and
- a clear notice that the prototype has not loaded or inspected the selected map.

For coordinate input it will show the entered points in the same spatial workspace and make the active point explicit. The atlas readout will follow that point.

The viewer must distinguish display settings from decoder parameters. Changing a slice or display threshold will not silently rerun or change the result fixtures.

## Results

Terms are the primary result. Studies and model-specific summaries support them rather than displacing them.

### Terms

The term view will present a realistically sized result set through:

- search across labels and identifiers;
- sort by model score, label, or another model-supported measure;
- ascending and descending order;
- explicit pagination and page size; and
- a persistent selection state for comparison.

Columns and score explanations will come from the chosen model. Signed measures will keep their sign and use a zero-centred display. Probabilities, similarities, correlations, and Bayes factors will never share a generic **score** label when their meanings differ.

The result header will identify the fixture model and version, the selected parameters, and the fact that the values are examples. An interpretation note will explain that an association or high rank does not establish the cognitive state that produced the input map.

### Model summary

NeuroVLM fixtures may include ranked concept matches and a plain-language summary. NiCLIP fixtures may include domain probabilities, task posterior probabilities, and Bayes factors. The UI will explain model-specific quantities next to the values that use them. In particular, it will distinguish a posterior probability that includes a literature-derived prior from a Bayes factor that measures the change from that prior.

### Associated studies

The studies view will list example studies related to the active result, including title, authors or citation, year, match basis, and a route to the study or map when available. Search, sorting, and pagination will use the same interaction patterns as term results. The fixture will make clear whether a study is associated with the input, the chosen concept, or both.

### Empty, loading, and error states

Reviewers must be able to inspect these states without real requests. A development-only state control or fixture query parameter may select:

- loading;
- no matching terms;
- no associated studies;
- unsupported model/input;
- NeuroVault lookup failure;
- decoder failure; and
- success.

Every error will remain inside the decoder workspace, preserve the visitor's entries, identify the operation that failed, and offer a relevant retry or correction. No decoder error will send the visitor to the site-wide error page.

## Map comparison

Selecting a term or study with a map will enable comparison. The comparison workspace will offer:

- **Side by side**, with synchronized coordinates and display controls; and
- **Overlay**, with separate opacity and colour controls for the input and comparison map.

The initial state will explain how to select a comparable result. Switching comparison modes will preserve the selected result. On narrow screens, side-by-side panes will stack while retaining their labels. Because no real maps are loaded in this branch, both views will use obvious map placeholders rather than fabricated anatomical matches.

## Page state and architecture

`DecodePage` will coordinate five bounded areas:

- `DecodeSourcePanel` for NeuroVault, upload, and coordinates;
- `DecodeDescriptionPanel` for declared metadata, vocabulary concepts, and free text;
- `DecodeModelPanel` for the decoder and its parameters;
- `DecodeViewer` for spatial display, coordinate selection, and atlas readout; and
- `DecodeResultsWorkspace` for terms, studies, model summaries, and comparison.

Shared types will describe:

- discriminated source values;
- declared map metadata;
- anonymous-deposit consent;
- vocabulary entries and confirmed suggestions;
- model definitions and parameter schemas;
- run provenance;
- viewer selection and atlas readouts;
- term and study result pages; and
- comparison state.

Fixture services will implement the same interfaces expected from future live services. Components will consume those interfaces, not import result constants directly. Fixture provenance will remain part of every response so a component cannot accidentally omit the example-data label.

Changing an input, model, or decoder parameter after preview will mark the visible result as stale and require another preview. Viewer-only display changes, result search, sorting, pagination, and comparison controls will not invalidate it.

The URL may encode reviewable interface state, such as the active source, model, result tab, or fixture scenario. It will not encode a local filename, free text, consent, or other potentially sensitive submission data. Shareable scientific runs remain a backend responsibility.

## Validation

Client-side validation will only make claims the browser can support.

- A local filename must end in `.nii` or `.nii.gz`, case-insensitively.
- A NeuroVault reference must be a positive ID or an HTTP(S) URL on `neurovault.org` or `www.neurovault.org` whose path is `/images/<id>` or `/api/images/<id>`. A trailing slash, query, or fragment is allowed.
- Each coordinate must contain three finite numbers in the displayed MNI range.
- Image metadata required by the selected model must be present.
- Subject count, when required, must be a positive integer.
- Local deposit consent must be explicit.
- Concepts and free text remain optional.

Each error will appear once, next to the control that needs attention, and will name the correction. Required controls will have a single visible label and at most one placeholder. Helper text and validation text must not overlap or duplicate the placeholder.

## Visual design and accessibility

The route will follow the existing Compose system: MUI components, theme spacing and colours, Roboto typography, blue in-page actions, and orange reserved for the global **NEW PROJECT** action.

The visual hierarchy will keep the input and model summary close to the primary action, then give the viewer and terms the largest share of space. Scientific provenance and limitations will be concise but always available. Example-data badges will use text as well as colour.

The interface will support keyboard operation, visible focus, programmatic labels, field-level error associations, semantic tabs, announced result changes, and reduced-motion preferences. Tables will expose labeled selection controls rather than turning rows into unnamed buttons. Charts and atlas probabilities will have equivalent text. At narrow widths, controls and panes will reflow without hiding metadata or comparison labels.

## Verification

Unit and component tests will cover:

- source switching and source-specific value retention;
- valid and invalid NeuroVault references, filenames, and coordinates;
- complete modality and analysis-level options;
- deposit disclosure, consent, and subject-level acknowledgement;
- an initially empty, searchable concept selector with no positional default;
- free-text concept suggestions that require confirmation;
- model compatibility, parameter defaults, and stale-result behavior;
- visibly illustrative provenance in every result state;
- term and study search, sorting, pagination, and selection;
- signed values and model-specific quantity labels;
- viewer coordinate and atlas-readout interaction;
- side-by-side and overlay comparison;
- inline loading, empty, and error recovery;
- reset behavior; and
- keyboard and accessible-name behavior for critical controls.

A browser test will exercise the public route with the real public reference `https://neurovault.org/images/25/`, preview fixture results, select a term, inspect associated studies, and switch between comparison modes. This confirms the frontend flow without fetching that image.

Verification will use the documented frontend commands from `.github/copilot-instructions.md`: the complete Vitest suite, the development build, and the focused Cypress flow. The route will also be inspected at desktop and mobile widths with keyboard navigation.

## Integration order after UX approval

The safest backend sequence is:

1. agree on typed request, provenance, and error contracts;
2. connect NeuroVault lookup and metadata import;
3. connect the viewer and atlas readout;
4. connect NeuroVLM with model version and parameter provenance;
5. connect vocabulary and associated-study services;
6. implement anonymous deposit, CC0 recording, and account association policy;
7. connect coordinate decoding; and
8. add persistence and shareable scientific runs.

This order proves the read-only path before adding anonymous publication and keeps scientific provenance attached from the first live result.
