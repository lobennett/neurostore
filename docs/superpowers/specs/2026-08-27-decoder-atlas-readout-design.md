# Decoder live atlas readout design

## Status and relationship to the decoder specifications

This document extends the approved [decoder interface design](./2026-08-26-decoder-interface-design.md) and [decoder golden walkthrough design](./2026-08-26-decoder-golden-walkthrough-design.md). It supersedes those documents only where they describe the decoder atlas readout as illustrative or deferred.

The branch will replace the coordinate-specific fixture with a real, public atlas lookup for the coordinate selected in the decoder viewer. It remains a focused spatial-interpretation feature: it does not upload maps, fetch arbitrary NeuroVault images, run a decoder, persist a submission, or make the rest of the decoder workflow depend on a live backend.

## Product decision

The decoder viewer will provide an FSLeyes-style coordinate readout backed by established atlases:

- **Harvard–Oxford Cortical Structural Atlas** and **Harvard–Oxford Subcortical Structural Atlas** for probabilistic anatomical location; and
- **DiFuMo 512** for functional mode loadings compatible with the feature space used by NiCLIP.

The anatomical and functional values have different meanings and must remain visibly separate. A Harvard–Oxford value is an atlas probability at the selected location. A DiFuMo value is the sampled weight or loading of a continuous functional mode at that location; it is not a probability of belonging to a parcel and will never be displayed with a percent sign.

The route remains public. Looking up an MNI coordinate requires no login, creates no database record, and transmits no map, NeuroVault identifier, participant metadata, or free-text interpretation.

## Scope

### Complete in this branch

This branch will add:

- a public Compose API endpoint for atlas readout at one MNI152 coordinate;
- a reusable backend service boundary for querying configured atlases;
- real Harvard–Oxford cortical and subcortical probability results;
- real DiFuMo 512 mode loadings;
- a live decoder panel that follows the selected viewer coordinate;
- top-three summaries with access to all nonzero matches;
- loading, updating, empty, unavailable, and retry states local to the panel;
- pinned atlas provenance, versions, checksums, and license notices;
- deterministic frontend tests and real backend integration checks; and
- documentation for installing or packaging the required atlas runtime.

### Deferred

This branch will not add:

- a general atlas browser or an API that accepts arbitrary atlas names or paths;
- anatomical labels derived from the submitted statistical map rather than the selected coordinate;
- surface, subject-space, Talairach, or nonlinear coordinate transforms;
- interpolation controls or user-selectable atlas resolutions;
- FSLeyes itself, a desktop GUI, or an embedded Python desktop viewer;
- server-side NIfTI upload or NeuroVault retrieval;
- NeuroVLM, NiCLIP, Pearson, or other decoder execution;
- database persistence, saved readouts, or shareable decoder runs; or
- reuse on routes other than `/decode`.

The API response and frontend component will nevertheless avoid decoder-fixture assumptions so another route can reuse them later.

## Scientific interpretation

### Coordinate convention

The endpoint accepts millimetre coordinates in MNI152 world space. It returns the exact accepted coordinate in the response. The initial consumer uses the decoder viewer's selected coordinate, including coordinate fields and NiiVue crosshair changes.

The existing decoder limits remain authoritative:

- x: -90 through 90 mm;
- y: -126 through 90 mm; and
- z: -72 through 108 mm.

These bounds validate the declared coordinate convention; they do not guarantee that every atlas covers the coordinate. A coordinate within the allowed MNI152 bounds but outside an atlas image is a valid query with no matches for that atlas.

### Harvard–Oxford

Harvard–Oxford cortical and subcortical results are separate atlas groups. Each nonzero match contains the atlas label and the probability reported at the coordinate. Results are sorted from largest to smallest probability. The API preserves the atlas value without converting the list into probabilities that sum to 100, because probabilistic atlas labels may overlap and their values do not describe a mutually exclusive categorical distribution.

The UI labels these values **Probability** and displays them as percentages. It does not collapse cortical and subcortical hits into a single winning anatomical label.

### DiFuMo 512

DiFuMo is a continuous, overlapping functional atlas. The service samples each of the 512 components at the coordinate, associates the value with the pinned component label table, removes exact zero values, and sorts the remaining modes from largest to smallest loading.

The UI places these results under **Decoder feature space**, labels each value **Loading**, and preserves the source value's scale. It does not normalize loadings to percentages, force them to sum to one, or describe the leading mode as a parcel containing the coordinate.

DiFuMo 512 is included because it provides a legitimate functional interpretation and matches NiCLIP's documented image-feature representation. It does not imply that the recorded legacy Neurosynth Pearson walkthrough used DiFuMo; that decoder correlated voxelwise maps and used no atlas feature space.

## Public API contract

### Request

The Compose OpenAPI document will define:

```http
GET /api/atlases/readout?x=-42&y=0&z=0
```

`x`, `y`, and `z` are required finite numbers. The operation has no security requirement. Connexion performs schema validation and the resource validates the MNI bounds. Unknown query parameters follow the application's existing OpenAPI behavior.

The endpoint accepts decimal coordinates. It does not round the request before atlas sampling or change the coordinate echoed to the client. The initial NiiVue interaction commonly emits integer coordinates, but that frontend behavior is not part of the API contract.

### Successful response

The response is `200 application/json`:

```json
{
  "coordinate": { "x": -42.0, "y": 0.0, "z": 0.0 },
  "space": "MNI152",
  "atlases": [
    {
      "id": "harvard-oxford-cortical",
      "name": "Harvard–Oxford Cortical Structural Atlas",
      "category": "anatomical",
      "valueType": "probability",
      "version": "<pinned version>",
      "sourceUrl": "<canonical source>",
      "matches": [
        { "id": "<stable label id>", "label": "<atlas label>", "value": 54.0 }
      ]
    },
    {
      "id": "difumo-512",
      "name": "DiFuMo 512",
      "category": "functional",
      "valueType": "loading",
      "version": "<pinned version>",
      "sourceUrl": "<canonical source>",
      "matches": [
        { "id": "<stable mode id>", "label": "<mode label>", "value": 0.71 }
      ]
    }
  ]
}
```

The production values replace the placeholders above. All configured atlas entries appear in a successful response even when `matches` is empty. The server returns all nonzero matches, subject to the fixed configured atlas sizes; the top-three presentation is a client concern. The ordering of `atlases` and `matches` is deterministic.

The response intentionally includes `valueType` rather than asking clients to infer scientific meaning from an atlas ID. `category`, `version`, and `sourceUrl` support a reusable UI and visible provenance. Stable match IDs are derived from the pinned atlas label metadata, not from the label's display spelling.

### Invalid request and unavailable service

Missing, nonnumeric, nonfinite, or out-of-bounds coordinates return the application's standard `400` problem response. No atlas process runs for an invalid request.

Failure to load a required atlas, a subprocess timeout, malformed atlas output, or an unexpected sampler failure returns `503 application/problem+json` with a stable problem type and a safe user-facing detail. Responses do not expose filesystem paths, command lines, or captured process output. Operational details are logged server-side.

An in-bounds coordinate outside atlas coverage is not an error. It returns `200` with an empty `matches` array for that atlas. A coordinate with no nonzero DiFuMo modes behaves the same way.

The first implementation treats the configured atlas set as one service: if a required provider fails, the request is `503` rather than returning an undocumented partial scientific result. A future contract may add explicit per-atlas availability, but clients must not infer partial success from a missing atlas entry.

## Backend architecture

### Service boundary

The OpenAPI operation resolves to a thin resource function under `neurosynth_compose.resources`. It validates the coordinate, calls an `AtlasReadoutService`, and serializes the typed result. It contains no subprocess parsing, NIfTI indexing, or atlas-specific display logic.

`AtlasReadoutService` owns the configured providers and deterministic response ordering. Providers implement a small internal interface that accepts an MNI coordinate and returns atlas metadata plus matches. The initial providers are:

- `FslAtlasQueryProvider` for the two fixed Harvard–Oxford atlases; and
- `DifumoAtlasProvider` for the pinned 512-mode volume and label table.

The endpoint never accepts an atlas ID, executable, path, resolution, output format, or command fragment from the visitor. This keeps the public endpoint's work and response size bounded.

### Harvard–Oxford query

The FSL provider uses the command-line atlas query tooling supplied by the pinned FSL installation. It invokes the executable with an argument array and `shell=False`, chooses atlas identifiers from a hard-coded allowlist, captures bounded output, and enforces a short timeout. It parses output through an isolated parser whose fixtures are recorded from the pinned runtime.

The provider must confirm during implementation whether a machine-readable `atlasq` output is sufficient and stable for the pinned FSL version. If the available format cannot be parsed unambiguously, the implementation will use FSL's Python atlas APIs or direct pinned-volume sampling behind the same provider interface. It will not ship a brittle parser merely to preserve the command choice.

The query preserves cortical and subcortical atlases independently and filters only true zero values. Label IDs and ordering come from pinned atlas metadata.

### DiFuMo sampling

The DiFuMo provider loads the pinned four-dimensional NIfTI and its matching component table once per application process. It transforms the requested MNI world coordinate through the inverse NIfTI affine, verifies image bounds, and samples the atlas at that location using the interpolation rule declared in the pinned asset manifest.

The default rule is nearest-neighbour voxel sampling, matching a coordinate readout rather than estimating a smoothed neighbourhood. The implementation must test affine orientation and half-voxel behavior against known points before this rule is considered final. The same rule is recorded in the API documentation and provenance.

The provider rejects a volume/table component-count mismatch at startup or first load. It returns finite native loadings only and never renormalizes them.

### Blocking work, cancellation, and caching

Subprocess execution, initial NIfTI loading, and sampling run outside the ASGI event loop using the project's compatible thread-offload mechanism. The request has a bounded provider timeout. A timed-out external process is terminated and reaped.

The service may use a small process-local least-recently-used cache keyed by the exact normalized numeric coordinate and atlas data version. Caching is an optimization, not persisted state. It must not round distinct decimal requests into the same entry. Startup does not require a database or network request.

### Configuration and observability

Executable and asset paths come from server configuration with deployment-owned defaults. Atlas IDs, expected versions, component count, hashes, and provenance come from checked-in metadata. Misconfiguration fails with a clear service-health or request error rather than silently substituting fixture data.

Logs include provider, elapsed time, cache status, timeout category, and a request correlation identifier where available. They do not include unrelated decoder form values because the endpoint never receives them. Metrics may later record request duration and provider failure counts without changing the API.

## Runtime packaging, provenance, and licensing

The branch will not bundle desktop FSLeyes. NiiVue remains the browser renderer; the FSL contribution is the authoritative atlas data/query behavior used for the coordinate readout.

Implementation begins with a packaging spike against the actual Compose Docker image. Following FSL's official container guidance, it will prefer the smallest pinned FSL conda component set that provides `atlasq` and the Harvard–Oxford atlas data instead of installing the full graphical FSL distribution. The exact packages and versions must be demonstrated in the image before the production Dockerfile is finalized.

FSL's license permits many non-commercial uses but imposes conditions relevant to redistribution. Before committing FSL binaries or atlas files to the image, the implementation must:

1. record the exact packages and files being distributed;
2. retain the applicable FSL and atlas notices;
3. confirm that the project's deployment and redistribution model is allowed; and
4. document any restriction for downstream operators.

If those checks cannot be satisfied for the repository's intended deployment, the provider remains externally configurable and the Docker image will not redistribute FSL. The feature must then report atlas-service unavailability honestly; it must not replace real values with examples under the live label.

DiFuMo 512 is pinned independently from FSL. A checked-in manifest records its release/version, canonical download and publication links, license, filenames, byte sizes, SHA-256 hashes, dimensionality, affine, interpolation rule, and component-table hash. The implementation verifies hashes during image construction or asset preparation and confirms that redistribution is permitted.

The UI provides concise atlas names and value explanations, with a provenance/details disclosure linking to the canonical sources and versions. Scholarly citations are retained even when a source license does not require attribution.

Primary references for the implementation are:

- FSL atlas command-line documentation: `https://fsl.fmrib.ox.ac.uk/fsl/docs/utilities/dataset_clitools.html`;
- FSL container and component-installation guidance: `https://fsl.fmrib.ox.ac.uk/fsl/docs/install/container.html`;
- FSL license: `https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html`;
- DiFuMo publication: Dadi et al., *Fine-grain atlases of functional modes for fMRI analysis*, NeuroImage 2020; and
- NiCLIP implementation documentation identifying continuous DiFuMo 512 image embeddings: `https://github.com/NBCLab/brain-decoder#approach`.

## Frontend behavior

### Panel structure

The fixture-only **Example atlas readout** becomes **Atlas readout at selected coordinate**. It shows the exact MNI coordinate and two semantic sections:

1. **Anatomical location**, containing separate Harvard–Oxford cortical and subcortical groups; and
2. **Decoder feature space**, containing DiFuMo 512.

Each atlas group initially shows its three largest nonzero matches. If more exist, **Show all nonzero matches** expands only that group and changes to **Show top 3**. Expansion state is presentation-only and does not request a different scientific result.

Harvard–Oxford rows use a percent-formatted **Probability** value. DiFuMo rows use a precision appropriate to the native data and the label **Loading**. Explanatory text states that overlapping atlases can have multiple matches and that functional loadings are not parcel probabilities.

### Live coordinate updates

The coordinate heading updates immediately when the selected viewer coordinate changes. The network lookup starts after a 200 ms debounce so dragging or rapidly editing coordinates does not issue one request per intermediate value.

When another coordinate is selected:

- the previous matches remain visible;
- the panel exposes a nonblocking **Updating atlas readout** status;
- the superseded request is aborted when possible;
- a late response for an older coordinate is ignored even if transport cancellation fails; and
- only a response matching the current debounced coordinate may replace the displayed data.

The query layer uses the generated OpenAPI client or a narrowly typed adapter consistent with the frontend's existing data-access conventions. Components do not construct URLs or interpret raw problem responses.

### Initial, empty, and failure states

Before the first response, the panel reserves its normal layout and shows **Loading atlas readout**. It does not display the old `-42, 0, 0` example while a real coordinate is pending.

An atlas with no matches says **No nonzero matches at this coordinate**. This state is distinct from service failure and retains the atlas name and provenance.

On `503`, network failure, or malformed response, the panel says **Atlas readout unavailable**, briefly explains that the map and decoder results are unaffected, and offers **Retry atlas readout**. The error stays inside the atlas panel. It does not invoke the application-wide error boundary, navigate away, clear the viewer, or clear decoder form/results state.

Retry uses the currently selected coordinate. If the coordinate changes while an error is shown, the normal debounced lookup begins automatically.

### Accessibility and responsive behavior

The readout is a named region associated with the coordinate and provenance text. Loading and updating messages use an appropriately restrained live region. Expansion controls are real buttons with `aria-expanded` and identify the atlas they control. Values have textual labels and do not depend on colour.

Keyboard changes to coordinate fields trigger the same debounced behavior as canvas changes. Focus remains on the initiating control during updates and errors. On narrow screens, labels and values wrap without overlapping; each atlas is a vertical list rather than an absolutely positioned visualization.

## Frontend data types

The generated or adapter-facing contract will preserve backend semantics:

```ts
type AtlasValueType = 'probability' | 'loading';
type AtlasCategory = 'anatomical' | 'functional';

type AtlasMatch = {
    id: string;
    label: string;
    value: number;
};

type AtlasReadout = {
    id: string;
    name: string;
    category: AtlasCategory;
    valueType: AtlasValueType;
    version: string;
    sourceUrl: string;
    matches: AtlasMatch[];
};

type AtlasReadoutResponse = {
    coordinate: { x: number; y: number; z: number };
    space: 'MNI152';
    atlases: AtlasReadout[];
};
```

Display components exhaustively format `valueType`. An unknown value type or nonfinite match value is treated as a malformed response and shown through the local unavailable state, not guessed or formatted as a percentage.

The recorded walkthrough no longer supplies `atlasReadouts` fixture data to the live panel. Other illustrative decoder results remain unchanged. Atlas availability does not determine whether the recorded Pearson results or maps can be viewed.

## Verification strategy

### Backend unit and contract tests

Backend tests will cover:

- OpenAPI validation for missing, nonnumeric, nonfinite, and out-of-bounds coordinates;
- anonymous access without an Authorization header;
- exact coordinate preservation, including decimals;
- deterministic atlas and match ordering;
- Harvard–Oxford probability parsing without renormalization;
- separate cortical and subcortical results;
- DiFuMo affine conversion, bounds, component labels, native values, and no renormalization;
- empty in-bounds/out-of-coverage responses;
- provider timeout, malformed output, missing assets, and safe `503` responses;
- no shell invocation or user-controlled command arguments;
- cache keys that do not conflate distinct coordinates or atlas versions; and
- mismatch and nonfinite-value rejection.

Provider unit tests use injected runners and tiny synthetic NIfTI fixtures. They do not require FSL or download atlas data.

### Real runtime integration tests

A Docker-level integration check uses the actual pinned FSL and DiFuMo artifacts. It queries a small documented set of MNI coordinates, including:

- a point with multiple Harvard–Oxford matches;
- a point with nonzero DiFuMo modes;
- a valid point outside at least one atlas's coverage; and
- a decimal coordinate that exercises affine sampling.

Expected values are recorded from the pinned runtime with atlas version and tolerance where floating-point sampling requires it. The test verifies that the container contains the declared versions and that asset hashes match the manifest. It is separate from parser fixtures so a package or data change cannot silently preserve a stale mocked test.

### Frontend unit tests

Frontend tests use fake timers and deferred requests to verify:

- immediate coordinate text and 200 ms request debounce;
- previous data retention and updating status;
- cancellation plus rejection of stale out-of-order responses;
- three-row defaults and independent show-all controls;
- probability versus loading labels and formatting;
- zero-match groups;
- initial loading, local failure, retry, and recovery;
- no application error-boundary fallback on service failure;
- current-coordinate retry after a coordinate change;
- invalid/malformed response handling; and
- keyboard and accessible-region behavior.

### End-to-end and manual checks

Cypress intercepts the atlas endpoint with deterministic contract responses and verifies the `/decode?example=neurovault-308` walkthrough. It changes the coordinate through both viewer interaction and coordinate fields, confirms the request parameters, exercises updating and stale responses, expands DiFuMo results, and verifies that an atlas failure leaves the real input and comparison maps usable.

A manual browser check against the real Compose service confirms that crosshair movement produces scientifically plausible Harvard–Oxford and DiFuMo results, values remain readable beside and overlaid with real maps, rapid movement does not flicker or show stale labels, and the layout works at desktop and mobile widths.

Final verification follows the repository-documented commands: Compose backend tests in Docker, frontend `npm run test`, frontend `npm run build:dev`, the decoder Cypress flow with the development environment, and `git diff --check`. Long-running commands receive the timeouts required by `.github/copilot-instructions.md`.

## Delivery gates

Implementation is complete only when:

1. the exact FSL component set works in the Compose Docker image;
2. FSL and Harvard–Oxford redistribution/licensing are documented or the deployment explicitly supplies them externally;
3. DiFuMo 512 provenance, license, dimensions, labels, and checksums are pinned;
4. real-runtime golden coordinates pass for both providers;
5. the public endpoint never requires authentication or persistence;
6. the decoder panel contains no fixture fallback presented as live data; and
7. all repository verification listed above passes.

If packaging or license work blocks redistribution, that is reported as a release blocker or documented external runtime prerequisite. It is not resolved by weakening scientific labels, inventing results, or silently omitting an approved atlas.
