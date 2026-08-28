# Decoder Live Atlas Readout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decoder's coordinate-specific atlas fixture with a public, scientifically accurate Harvard–Oxford and DiFuMo 512 readout that follows the live MNI coordinate without disrupting the real-map walkthrough.

**Architecture:** A public Connexion endpoint delegates blocking atlas work to a typed, cached `AtlasReadoutService`. Harvard–Oxford uses a pinned minimal FSL `atlasq` environment; DiFuMo uses a pinned 2 mm four-dimensional NIfTI sampled directly with nibabel. A narrow Axios adapter and React Query hook debounce coordinates, preserve previous data, cancel superseded requests, and feed a semantic decoder panel.

**Tech Stack:** Python 3.14, Connexion 3.3/OpenAPI 3, AnyIO, nibabel/NumPy, FSL `atlasq`, pytest, React 19, TypeScript 5.9, TanStack Query 5, Axios, MUI, Vitest/Testing Library, Cypress 15, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-27-decoder-atlas-readout-design.md`

## Global Constraints

- The endpoint is public and stateless: no login, database write, map upload, NeuroVault identifier, metadata, or interpretation text.
- Accept MNI152 millimetre coordinates with exact bounds x `[-90, 90]`, y `[-126, 90]`, and z `[-72, 108]`; preserve finite decimals.
- Return Harvard–Oxford cortical and subcortical probabilities separately; never renormalize overlapping probabilities.
- Return DiFuMo 512 native loadings; never format or describe them as probabilities or percentages.
- Return every nonzero match in deterministic descending-value order; the client alone limits the initial display to three.
- An in-bounds coordinate outside atlas coverage returns `200` with empty matches; a required-provider failure returns a safe `503` and never fixture data.
- Invoke only fixed atlas IDs with an argument array and `shell=False`; no visitor-controlled executable, path, atlas, resolution, or command fragment.
- Keep NiiVue as the browser renderer; do not install or embed desktop FSLeyes.
- Begin implementation with the redistribution/license and runtime feasibility gate in Task 1. Do not continue to product code if that gate records a blocker requiring maintainer authority.
- Use `apply_patch` for hand edits, preserve unrelated work, and initialize submodules before builds.
- Backend validation uses the exact Docker commands in `.github/copilot-instructions.md`; frontend validation runs from `compose/neurosynth-frontend` with the documented npm commands.

## File map

### Runtime and provenance

- Create `compose/backend/atlas_runtime/environment.yml`: minimal FSL channel and direct dependency specification.
- Create `compose/backend/atlas_runtime/explicit-linux-64.txt`: exact resolved Linux package URLs used by Docker.
- Create `compose/backend/atlas_runtime/manifest.json`: FSL/Harvard–Oxford and DiFuMo versions, sources, hashes, dimensions, interpolation, and citations.
- Create `compose/backend/atlas_runtime/THIRD_PARTY_NOTICES.md`: redistribution terms and operator-facing restrictions.
- Create `compose/backend/atlas_runtime/README.md`: reproducible build, external-runtime configuration, verification, and upgrade procedure.
- Create `compose/backend/neurosynth_compose/scripts/install_decoder_atlases.py`: verified DiFuMo acquisition/extraction and normalized label-table preparation.
- Modify `compose/backend/Dockerfile`: copy the pinned minimal FSL environment and install verified DiFuMo artifacts.
- Modify `compose/backend/MANIFEST.in`: include the runtime manifest/notices needed by the installed service.
- Modify `compose/backend/pyproject.toml`: declare direct nibabel/NumPy dependencies.
- Modify `compose/backend/neurosynth_compose/config.py`: add atlas paths, timeout, and cache size.

### Backend feature

- Create `compose/backend/neurosynth_compose/atlas_readout/types.py`: coordinate, match, atlas result, metadata, and typed error definitions.
- Create `compose/backend/neurosynth_compose/atlas_readout/difumo.py`: lazy DiFuMo loader and nearest-voxel sampler.
- Create `compose/backend/neurosynth_compose/atlas_readout/fsl.py`: subprocess runner, short-output parser, and fixed Harvard–Oxford provider.
- Create `compose/backend/neurosynth_compose/atlas_readout/service.py`: provider orchestration, ordering, and bounded exact-coordinate cache.
- Create `compose/backend/neurosynth_compose/atlas_readout/factory.py`: configuration-to-service construction and process-local singleton.
- Create `compose/backend/neurosynth_compose/atlas_readout/__init__.py`: public backend interface exports.
- Create `compose/backend/neurosynth_compose/resources/atlases.py`: async public resource and safe problem response.
- Modify `compose/backend/neurosynth_compose/openapi/neurosynth-compose-openapi.yml` in its `neurostore-spec` submodule: public endpoint and schemas.
- Create `compose/backend/neurosynth_compose/tests/test_atlas_difumo.py`: affine, sampling, bounds, labels, and malformed-asset tests.
- Create `compose/backend/neurosynth_compose/tests/test_atlas_fsl.py`: safe invocation, parsing, timeouts, and malformed-output tests.
- Create `compose/backend/neurosynth_compose/tests/test_atlas_service.py`: ordering, cache, provider failure, and serialization tests.
- Create `compose/backend/neurosynth_compose/tests/api/test_atlas_readout.py`: anonymous OpenAPI contract and error-surface tests.
- Create `compose/backend/neurosynth_compose/tests/integration/test_atlas_runtime.py`: actual packaged atlas golden-coordinate checks.

### Frontend feature

- Create `compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.types.ts`: API-facing atlas contract and runtime validator.
- Create `compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.api.ts`: narrow Compose Axios request adapter.
- Create `compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.ts`: 200 ms debounce, React Query cancellation, stale-data retention, and retry.
- Create `compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.spec.tsx`: hook timing, cancellation, and out-of-order tests.
- Replace `compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.tsx`: live semantic panel.
- Create `compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.spec.tsx`: display, expansion, empty, error, and accessibility tests.
- Modify `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx`: pass only the active coordinate to the live panel.
- Modify `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx`: remove fixture assumptions and verify live-panel isolation.
- Modify `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`: remove `IAtlasReadout` and `IDecodePreview.atlasReadouts`.
- Modify `compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts`: remove example atlas data.
- Modify `compose/neurosynth-frontend/src/pages/Decode/Decode.golden.ts`: remove the empty atlas fixture field.
- Modify `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`: stop plumbing preview atlas data.
- Modify affected Decode result/comparison tests that construct `IDecodePreview` fixtures.
- Modify `compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx`: deterministic atlas API and real-viewer interaction coverage.

---

### Task 1: Prove and pin the atlas runtime and redistribution basis

**Files:**
- Create: `compose/backend/atlas_runtime/environment.yml`
- Create: `compose/backend/atlas_runtime/explicit-linux-64.txt`
- Create: `compose/backend/atlas_runtime/manifest.json`
- Create: `compose/backend/atlas_runtime/THIRD_PARTY_NOTICES.md`
- Create: `compose/backend/atlas_runtime/README.md`
- Create: `compose/backend/neurosynth_compose/scripts/install_decoder_atlases.py`
- Create: `compose/backend/neurosynth_compose/tests/test_decoder_atlas_manifest.py`
- Modify: `compose/backend/pyproject.toml`

**Interfaces:**
- Consumes: Official FSL public channel, `fslpy`/`atlasq`, `fsl-data_atlases=2103.0`, official DiFuMo 512 OSF archive `https://osf.io/9b76y/download`, and the approved license gates.
- Produces: A reproducible FSL explicit lock, a verified normalized DiFuMo artifact set (`difumo-512-2mm.nii.gz`, `difumo-512-labels.csv`), and `manifest.json` consumed by every backend provider and Docker build.

- [ ] **Step 1: Resolve the minimal FSL environment in a disposable micromamba container**

Create `environment.yml` with only the official channels and direct packages:

```yaml
name: decoder-atlases
channels:
  - https://fsl.fmrib.ox.ac.uk/fsldownloads/fslconda/public/
  - conda-forge
dependencies:
  - fslpy
  - fsl-data_atlases=2103.0
```

Resolve it on Linux, run `/opt/decoder-atlases/bin/atlasq list`, and export an explicit lock:

```bash
docker run --rm --platform linux/amd64 -v "$PWD/compose/backend/atlas_runtime:/work" mambaorg/micromamba:2.3.2 bash -lc 'micromamba create -y -p /opt/decoder-atlases -f /work/environment.yml && /opt/decoder-atlases/bin/atlasq list | grep -E "harvardoxford-(cortical|subcortical)" && micromamba list -p /opt/decoder-atlases --explicit > /work/explicit-linux-64.txt'
```

Expected: `atlasq list` prints both approved IDs and the explicit lock contains exact package URLs, including one `fslpy` build and `fsl-data_atlases-2103.0`.

- [ ] **Step 2: Record the redistribution decision before product code**

Read the licenses contained in the exact resolved packages plus the FSL license and DiFuMo distribution/publication terms. Write `THIRD_PARTY_NOTICES.md` with separate FSL/Harvard–Oxford and DiFuMo sections. Each section names exact packages/files, upstream and publication links, the in-image license-text path, a prose redistribution conclusion, the supporting clause, and operator restrictions.

Expected: both conclusions cite source text and affirm that the intended Neurostore image distribution is allowed. If either conclusion instead blocks distribution or remains ambiguous, stop the plan and request maintainer/legal direction; do not proceed by relabeling or replacing the atlas. `README.md` records the exact lock regeneration command, verified installer invocation, `ATLAS_FSLDIR`/`ATLAS_DIFUMO_DIR`/`ATLAS_MANIFEST` external-runtime configuration, hash verification, license-review requirement for upgrades, and the `ATLAS_RUNTIME_REQUIRED=1` test command.

- [ ] **Step 3: Write the failing manifest validation test**

The test must require real values rather than tokens such as `latest`, `unknown`, or empty hashes:

```python
def test_decoder_atlas_manifest_is_fully_pinned():
    manifest = json.loads(MANIFEST_PATH.read_text())
    assert manifest["space"] == "MNI152"
    assert manifest["fsl"]["packages"]["fsl-data_atlases"] == "2103.0"
    assert manifest["fsl"]["atlasIds"] == [
        "harvardoxford-cortical",
        "harvardoxford-subcortical",
    ]
    assert manifest["difumo"]["dimension"] == 512
    assert manifest["difumo"]["resolutionMm"] == 2
    assert manifest["difumo"]["interpolation"] == "nearest"
    for asset in manifest["difumo"]["assets"]:
        assert re.fullmatch(r"[0-9a-f]{64}", asset["sha256"])
        assert asset["bytes"] > 0
```

- [ ] **Step 4: Run the canonical Compose backend suite and verify the new test fails**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because `manifest.json` and verified artifact metadata do not exist.

- [ ] **Step 5: Implement verified DiFuMo acquisition and manifest generation**

Add direct dependencies `nibabel>=5.3,<6` and `numpy>=2,<3` to `pyproject.toml`. `install_decoder_atlases.py` must begin from only the pinned OSF URL, require HTTPS for every redirect, record the resolved storage URL, calculate archive/file SHA-256 and byte counts, extract into a temporary directory, select the 2 mm 512-component NIfTI, normalize labels to exact CSV columns `component_id,label`, validate 512 unique rows and a 4-D final dimension of 512 with nibabel, then atomically place the two artifacts under a caller-provided destination. It accepts:

```text
python -m neurosynth_compose.scripts.install_decoder_atlases \
  --manifest /compose/backend/atlas_runtime/manifest.json \
  --destination /opt/decoder-atlases/data/difumo-512
```

The committed manifest records the observed upstream archive and normalized-file hashes, byte sizes, NIfTI shape/affine, resolved `fslpy` build from the explicit lock, FSL atlas version, license sources, canonical URLs, citations, Harvard–Oxford label/index maps obtained from the pinned runtime, and real expected results for the four integration coordinates required by the spec. Re-running with changed bytes must fail before replacing installed assets. Extend the test with a local synthetic archive to prove checksum rejection, 512-row validation, HTTPS redirect enforcement, and atomic replacement without making a network request.

- [ ] **Step 6: Run manifest test and inspect runtime provenance**

Run the canonical Compose backend suite again using the commands in Step 4.

Expected: PASS, and manual inspection confirms no empty, `latest`, `TBD`, or `unknown` provenance value.

- [ ] **Step 7: Commit the runtime decision**

```bash
git add compose/backend/atlas_runtime compose/backend/pyproject.toml compose/backend/neurosynth_compose/scripts/install_decoder_atlases.py compose/backend/neurosynth_compose/tests/test_decoder_atlas_manifest.py
git commit -m "build: pin decoder atlas runtime"
```

### Task 2: Add the typed atlas domain and DiFuMo sampler

**Files:**
- Create: `compose/backend/neurosynth_compose/atlas_readout/__init__.py`
- Create: `compose/backend/neurosynth_compose/atlas_readout/types.py`
- Create: `compose/backend/neurosynth_compose/atlas_readout/difumo.py`
- Create: `compose/backend/neurosynth_compose/tests/test_atlas_difumo.py`

**Interfaces:**
- Consumes: Normalized `component_id,label` CSV and pinned 4-D NIfTI from Task 1.
- Produces: `Coordinate`, `AtlasMatch`, `AtlasResult`, `InvalidCoordinateError`, `AtlasUnavailableError`, and `DifumoAtlasProvider.query(coordinate: Coordinate) -> AtlasResult`.

- [ ] **Step 1: Write failing domain and sampling tests**

Use a synthetic `(3, 3, 3, 4)` NIfTI with a non-identity affine and four normalized labels. Assert:

```python
result = provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))
assert result.id == "difumo-512"
assert result.category == "functional"
assert result.value_type == "loading"
assert [(m.id, m.label, m.value) for m in result.matches] == [
    ("difumo-512:3", "Mode three", 0.75),
    ("difumo-512:1", "Mode one", 0.25),
]
```

Also assert exact zeros are absent, native values are unchanged, half-voxel positions use `floor(voxel + 0.5)`, out-of-image coordinates return empty matches, and component-count mismatch/nonfinite voxels raise `AtlasUnavailableError`.

- [ ] **Step 2: Run the canonical Compose backend suite and verify failure**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because `atlas_readout.types` and `DifumoAtlasProvider` do not exist.

- [ ] **Step 3: Implement immutable domain values**

`types.py` defines frozen dataclasses and serialization:

```python
@dataclass(frozen=True)
class Coordinate:
    x: float
    y: float
    z: float

@dataclass(frozen=True)
class AtlasMatch:
    id: str
    label: str
    value: float

@dataclass(frozen=True)
class AtlasResult:
    id: str
    name: str
    category: Literal["anatomical", "functional"]
    value_type: Literal["probability", "loading"]
    version: str
    source_url: str
    matches: tuple[AtlasMatch, ...]

class AtlasUnavailableError(RuntimeError):
    pass

class InvalidCoordinateError(ValueError):
    pass
```

Add `AtlasResult.to_dict()` using API keys `valueType` and `sourceUrl`. `Coordinate.__post_init__` rejects nonfinite values and values outside x `[-90, 90]`, y `[-126, 90]`, z `[-72, 108]` with `InvalidCoordinateError`. Reject nonfinite match values at the result boundary.

- [ ] **Step 4: Implement lazy, thread-safe nearest-voxel sampling**

`DifumoAtlasProvider` loads the NIfTI and CSV once behind a lock. Convert MNI world coordinates using `nibabel.affines.apply_affine(inv(image.affine), xyz)`, choose indices with `numpy.floor(voxel + 0.5)`, check all bounds, sample `data[i, j, k, :]`, remove exact zero, and sort by `(-value, id)`.

- [ ] **Step 5: Run the canonical Compose backend suite**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: PASS, including affine, half-voxel, empty-coverage, and malformed-data cases.

- [ ] **Step 6: Commit the DiFuMo provider**

```bash
git add compose/backend/neurosynth_compose/atlas_readout compose/backend/neurosynth_compose/tests/test_atlas_difumo.py
git commit -m "feat: sample DiFuMo atlas loadings"
```

### Task 3: Add the safe FSL Harvard–Oxford provider

**Files:**
- Create: `compose/backend/neurosynth_compose/atlas_readout/fsl.py`
- Create: `compose/backend/neurosynth_compose/tests/test_atlas_fsl.py`

**Interfaces:**
- Consumes: `Coordinate`, `AtlasMatch`, `AtlasResult`, `AtlasUnavailableError`, fixed atlas metadata, and the pinned `/opt/decoder-atlases/bin/atlasq` runtime.
- Produces: `SubprocessAtlasRunner.run(arguments: Sequence[str], timeout_seconds: float) -> str`, `parse_short_query(output: str, atlas_id: str, label_ids: Mapping[str, str]) -> tuple[AtlasMatch, ...]`, and `FslAtlasProvider.query(coordinate: Coordinate) -> AtlasResult`.

- [ ] **Step 1: Write failing parser and command-safety tests**

Use recorded `atlasq --short` text:

```python
output = (
    "coordinate\t38.00 -44.00 48.00\tSuperior Parietal Lobule 45.0000"
    "\tAngular Gyrus 12.0000\n"
)
matches = parse_short_query(
    output,
    "harvardoxford-cortical",
    {"Superior Parietal Lobule": "17", "Angular Gyrus": "20"},
)
assert [(m.id, m.value) for m in matches] == [
    ("harvardoxford-cortical:17", 45.0),
    ("harvardoxford-cortical:20", 12.0),
]
```

Assert commas/digits in labels parse from the final numeric token, zero rows are removed, ties sort by stable ID, unknown labels and nonfinite/negative/>100 probabilities fail, timeout/process failure becomes `AtlasUnavailableError`, and the captured command is exactly:

```python
[
    "/opt/decoder-atlases/bin/atlasq", "query",
    "harvardoxford-cortical", "--short", "--resolution", "2",
    "--coord", "38.0", "-44.0", "48.0",
]
```

- [ ] **Step 2: Run the canonical Compose backend suite and verify failure**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because the FSL provider does not exist.

- [ ] **Step 3: Implement the bounded subprocess runner**

Call `subprocess.run(arguments, shell=False, check=True, capture_output=True, text=True, timeout=timeout_seconds)` with a fixed executable supplied by configuration. Reject stdout larger than 256 KiB and convert `TimeoutExpired`, `CalledProcessError`, missing executable, decode failure, and oversized output to `AtlasUnavailableError` without including stdout, stderr, paths, or command lines in the public exception message.

- [ ] **Step 4: Implement parser and fixed provider**

Parse one coordinate record only. Split tabs, require the first field to be `coordinate`, parse the final whitespace-delimited token of every match as a finite probability in `[0, 100]`, and resolve the preceding full label through the pinned label-to-index mapping. `FslAtlasProvider` accepts only one constructor-time atlas ID from `{"harvardoxford-cortical", "harvardoxford-subcortical"}` and builds no command element from request text.

- [ ] **Step 5: Run the canonical Compose backend suite**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: PASS, including process timeout, unknown-label, unsafe-ID, malformed-output, and probability-range tests.

- [ ] **Step 6: Commit the FSL provider**

```bash
git add compose/backend/neurosynth_compose/atlas_readout/fsl.py compose/backend/neurosynth_compose/tests/test_atlas_fsl.py
git commit -m "feat: query Harvard Oxford atlases"
```

### Task 4: Compose providers behind a cached service and factory

**Files:**
- Create: `compose/backend/neurosynth_compose/atlas_readout/service.py`
- Create: `compose/backend/neurosynth_compose/atlas_readout/factory.py`
- Create: `compose/backend/neurosynth_compose/tests/test_atlas_service.py`
- Modify: `compose/backend/neurosynth_compose/atlas_readout/__init__.py`
- Modify: `compose/backend/neurosynth_compose/config.py`

**Interfaces:**
- Consumes: Three providers exposing `query(Coordinate) -> AtlasResult` and Task 1 manifest.
- Produces: `AtlasReadoutService.query(coordinate: Coordinate) -> dict`, `get_atlas_readout_service(settings: Mapping[str, object]) -> AtlasReadoutService`, exact atlas ordering, and a process-local bounded cache.

- [ ] **Step 1: Write failing orchestration and cache tests**

Assert the response order is cortical, subcortical, DiFuMo regardless of provider construction order:

```python
assert service.query(Coordinate(-42.5, 0.0, 8.25)) == {
    "coordinate": {"x": -42.5, "y": 0.0, "z": 8.25},
    "space": "MNI152",
    "atlases": [cortical.to_dict(), subcortical.to_dict(), difumo.to_dict()],
}
```

Call twice and assert providers run once; query `-42.5` and `-42.5001` and assert they are distinct; change manifest version and assert it cannot reuse an older-version cache. Assert any provider failure raises one `AtlasUnavailableError` and returns no partial response.

- [ ] **Step 2: Run the canonical Compose backend suite and verify failure**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because service/factory do not exist.

- [ ] **Step 3: Implement deterministic service and bounded cache**

Give `AtlasReadoutService` a provider mapping keyed by the three required IDs and an `OrderedDict` LRU capped by `cache_size`. Use the key `(manifest_version, coordinate.x, coordinate.y, coordinate.z)` with Python floats unchanged; never round. Return a deep immutable result or freshly serialized dictionaries so a caller cannot mutate cached state.

- [ ] **Step 4: Implement configuration and process singleton**

Add these configuration keys with deployment defaults:

```python
ATLAS_FSLDIR = Path(get_env_var("ATLAS_FSLDIR", "/opt/decoder-atlases"))
ATLAS_DIFUMO_DIR = Path(get_env_var("ATLAS_DIFUMO_DIR", "/opt/decoder-atlases/data/difumo-512"))
ATLAS_MANIFEST = Path(get_env_var("ATLAS_MANIFEST", "/opt/decoder-atlases/manifest.json"))
ATLAS_QUERY_TIMEOUT_SECONDS = float(get_env_var("ATLAS_QUERY_TIMEOUT_SECONDS", "2"))
ATLAS_CACHE_SIZE = int(get_env_var("ATLAS_CACHE_SIZE", "512"))
```

`factory.py` loads and validates the manifest once, derives the fixed label-index maps, builds exactly three providers, and memoizes by a frozen configuration tuple. Tests inject temporary paths; production performs no network or database access.

- [ ] **Step 5: Run the canonical Compose backend suite**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: PASS with deterministic ordering, exact coordinate cache keys, bounded eviction, provider failure, and configuration tests.

- [ ] **Step 6: Commit service composition**

```bash
git add compose/backend/neurosynth_compose/atlas_readout compose/backend/neurosynth_compose/config.py compose/backend/neurosynth_compose/tests/test_atlas_service.py
git commit -m "feat: add decoder atlas readout service"
```

### Task 5: Publish the anonymous OpenAPI endpoint

**Files:**
- Modify: `compose/backend/neurosynth_compose/openapi/neurosynth-compose-openapi.yml` (submodule)
- Create: `compose/backend/neurosynth_compose/resources/atlases.py`
- Create: `compose/backend/neurosynth_compose/tests/api/test_atlas_readout.py`

**Interfaces:**
- Consumes: `get_atlas_readout_service(settings)` and `AtlasUnavailableError`.
- Produces: `GET /api/atlases/readout?x=<number>&y=<number>&z=<number>` returning the approved `AtlasReadoutResponse` without authentication.

- [ ] **Step 1: Branch the OpenAPI submodule and write the endpoint/schema first**

Inside `compose/backend/neurosynth_compose/openapi`, create a feature branch from its pinned commit. Add `/atlases/readout` with explicit operation ID `neurosynth_compose.resources.atlases.readout`, `security: []`, three required finite `number` query parameters carrying the exact min/max bounds, `200` response schema, `400` bad-request reference, and a `503 application/problem+json` response. Define closed schemas for coordinate, match, atlas, and response; constrain category/valueType enums and require every documented field.

- [ ] **Step 2: Write failing anonymous contract tests**

Use `httpx.AsyncClient` with `ASGITransport` and no Authorization header. Monkeypatch `get_atlas_readout_service` to return a fake. Assert:

```python
response = await client.get("/api/atlases/readout?x=-42.5&y=0&z=8.25")
assert response.status_code == 200
assert response.json()["coordinate"] == {"x": -42.5, "y": 0.0, "z": 8.25}
assert "WWW-Authenticate" not in response.headers
```

Parameterize missing, nonnumeric, `NaN`, infinity, and every lower/upper bound violation as `400`, and assert the fake service was not called. Raise `AtlasUnavailableError` and assert `503`, `application/problem+json`, a stable type URI, and no internal exception text.

- [ ] **Step 3: Run the canonical Compose backend suite and verify failure**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because the resource operation does not exist.

- [ ] **Step 4: Implement the async resource**

`readout(x: float, y: float, z: float)` constructs a validated `Coordinate`, obtains settings from `connexion.request.state.settings`, and calls the synchronous service using:

```python
payload = await anyio.to_thread.run_sync(service.query, coordinate)
return make_json_response(payload)
```

Catch `InvalidCoordinateError` and return the endpoint's safe `400` problem response without invoking a provider. Catch `AtlasUnavailableError`, log provider category and elapsed time without form data, and return a `ConnexionResponse` with status 503, MIME `application/problem+json`, stable type `https://neurostore.org/problems/atlas-readout-unavailable`, title `Atlas readout unavailable`, and safe detail. Unexpected exceptions remain available to the global 500 handler.

- [ ] **Step 5: Run the canonical Compose backend suite**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: PASS for anonymous access, decimal preservation, validation without provider execution, schema validation, `503`, CORS, and existing APIs.

- [ ] **Step 6: Commit the specification submodule, then the parent integration**

```bash
cd compose/backend/neurosynth_compose/openapi
git add neurosynth-compose-openapi.yml
git commit -m "feat: define atlas readout endpoint"
cd ../../../..
git add compose/backend/neurosynth_compose/openapi compose/backend/neurosynth_compose/resources/atlases.py compose/backend/neurosynth_compose/tests/api/test_atlas_readout.py
git commit -m "feat: expose public atlas readout API"
```

Record the submodule commit in the final handoff because upstream must be able to fetch it; do not leave a dirty uncommitted submodule.

### Task 6: Package real atlas assets and verify golden coordinates

**Files:**
- Modify: `compose/backend/Dockerfile`
- Modify: `compose/backend/MANIFEST.in`
- Create: `compose/backend/neurosynth_compose/tests/integration/test_atlas_runtime.py`
- Modify: `compose/backend/atlas_runtime/manifest.json` only if the built, verified artifact metadata differs from Task 1

**Interfaces:**
- Consumes: Explicit FSL Linux lock, verified DiFuMo installer/manifest, backend factory.
- Produces: Compose image with `/opt/decoder-atlases/bin/atlasq`, Harvard–Oxford data, DiFuMo assets, notices, and a real-runtime integration test marker.

- [ ] **Step 1: Write the real-runtime integration test**

Mark it `@pytest.mark.atlas_runtime` and skip only when `ATLAS_RUNTIME_REQUIRED` is not `1`. When required, assert files and manifest hashes, `atlasq list` approved IDs, and exact/tolerant results for the four coordinates recorded during Task 1: multiple Harvard–Oxford hits, nonzero DiFuMo modes, valid outside-coverage, and decimal affine sampling. Store expected labels/values directly in the test alongside manifest version; do not call the same parser to generate expectations.

- [ ] **Step 2: Run the integration test against the current image and verify failure**

Use the canonical Compose database setup, then:

```bash
cd compose
docker compose run -e "APP_ENV=docker_test" -e "ATLAS_RUNTIME_REQUIRED=1" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: FAIL because `/opt/decoder-atlases` is not yet present.

- [ ] **Step 3: Add a minimal atlas runtime Docker stage**

Use `mambaorg/micromamba:2.3.2` as a named builder, create `/opt/decoder-atlases` from `explicit-linux-64.txt`, copy only that environment into the Python image, set `FSLDIR=/opt/decoder-atlases`, prepend its `bin` to `PATH`, copy manifest/notices, and run the verified DiFuMo installer during the image build. Do not add GTK/FSLeyes packages. Preserve the existing Node and Cypress stages/dependencies.

- [ ] **Step 4: Build and run the real runtime suite**

```bash
cd compose
docker compose build compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" -e "ATLAS_RUNTIME_REQUIRED=1" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: PASS; image inspection shows only the two direct FSL requirements plus resolved dependencies, both approved atlas IDs, verified DiFuMo files, and notices.

- [ ] **Step 5: Probe the public endpoint in the running development stack**

```bash
cd compose
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d compose
curl -sS "http://localhost:81/api/atlases/readout?x=-42&y=0&z=0"
```

Expected: `200` JSON containing exactly three configured atlases, probability semantics for Harvard–Oxford, loading semantics for DiFuMo, and no authentication challenge.

- [ ] **Step 6: Commit deployable runtime packaging**

```bash
git add compose/backend/Dockerfile compose/backend/MANIFEST.in compose/backend/atlas_runtime/manifest.json compose/backend/neurosynth_compose/tests/integration/test_atlas_runtime.py
git commit -m "build: package decoder atlas runtime"
```

### Task 7: Add the typed frontend API and debounced query hook

**Files:**
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.types.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.api.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.ts`
- Create: `compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/api/api.config.ts`

**Interfaces:**
- Consumes: Public endpoint and `IViewerState` x/y/z.
- Produces: `fetchAtlasReadout(coordinate, signal) -> Promise<AtlasReadoutResponse>` and `useDecodeAtlasReadout(coordinate)` returning `{ data, isInitialLoading, isUpdating, isError, retry }`.

- [ ] **Step 1: Write failing runtime-contract tests**

Define exact frontend types from the spec and a validator that rejects missing atlases, unknown `category`/`valueType`, nonfinite values, mismatched category/valueType pairs, duplicate atlas/match IDs, and a response coordinate/space that does not match the request. Test a valid response with empty match arrays.

- [ ] **Step 2: Write failing hook timing and stale-response tests**

Use a new QueryClient per test, fake timers, and a mocked `fetchAtlasReadout`. Assert no request at 199 ms, one exact decimal request at 200 ms, immediate coordinate state, prior data retained with `isUpdating`, old AbortSignal becomes aborted, an old deferred response cannot replace current data, retry uses current coordinates, and an Axios/validator error stays in hook state.

- [ ] **Step 3: Run frontend tests and verify failure**

```bash
cd compose/neurosynth-frontend
npm run test
```

Expected: FAIL because the API contract and hook do not exist.

- [ ] **Step 4: Implement the narrow Axios adapter**

Use the shared `axiosInstance` and `neurosynthConfig.basePath`:

```ts
const response = await axiosInstance.get<unknown>(`${neurosynthConfig.basePath}/atlases/readout`, {
    params: { x: coordinate.x, y: coordinate.y, z: coordinate.z },
    signal,
});
return parseAtlasReadoutResponse(response.data, coordinate);
```

Expose this under `API.NeurosynthServices.AtlasReadoutService` without editing the generated SDK submodule. Do not attach an Authorization header explicitly.

- [ ] **Step 5: Implement the 200 ms React Query hook**

Debounce only x/y/z, not `threshold`. Use query key `['atlas-readout', x, y, z]`, pass React Query's AbortSignal to the adapter, set `retry: false`, and use `placeholderData: (previous) => previous` so old matches remain during a coordinate transition. Compute `isUpdating` as a coordinate waiting for debounce or an active fetch with prior data. React Query's key isolation plus response-coordinate validation prevents stale results from winning.

- [ ] **Step 6: Run frontend tests**

```bash
cd compose/neurosynth-frontend
npm run test
```

Expected: PASS for validator, debounce, cancellation, prior-data, out-of-order, error, and retry tests plus the existing suite.

- [ ] **Step 7: Commit frontend data access**

```bash
git add compose/neurosynth-frontend/src/api/api.config.ts compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.types.ts compose/neurosynth-frontend/src/pages/Decode/Decode.atlas.api.ts compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.ts compose/neurosynth-frontend/src/pages/Decode/useDecodeAtlasReadout.spec.tsx
git commit -m "feat: query live decoder atlas readouts"
```

### Task 8: Replace the fixture panel with the semantic live readout

**Files:**
- Replace: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.tsx`
- Create: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.spec.tsx`

**Interfaces:**
- Consumes: `coordinate: Pick<IViewerState, 'x' | 'y' | 'z'>` and `useDecodeAtlasReadout` state.
- Produces: Named live region with exact coordinate, separate anatomical/functional sections, top-three/all controls, provenance, and panel-local recovery.

- [ ] **Step 1: Write failing presentation tests**

Mock the hook and verify:

- heading `Atlas readout at selected coordinate` and exact signed decimal coordinate;
- separate `Anatomical location` and `Decoder feature space` sections;
- cortical and subcortical are distinct groups;
- three rows per group initially, all rows after that group's `Show all nonzero matches` button, and independent expansion state;
- `Probability` values include `%`, while `Loading` values never do;
- overlap explanation and DiFuMo non-probability explanation;
- initial loading has a status and no old fixture;
- updating keeps rows and announces `Updating atlas readout`;
- empty group says `No nonzero matches at this coordinate`;
- unavailable state is an alert with `Retry atlas readout`; and
- buttons have `aria-expanded`, focus survives updates, and long labels wrap at 390 px.

- [ ] **Step 2: Run frontend tests and verify failure**

```bash
cd compose/neurosynth-frontend
npm run test
```

Expected: FAIL because the current component is fixture-only.

- [ ] **Step 3: Implement semantic grouping and exhaustive value formatting**

Order groups by fixed IDs, render at most `matches.slice(0, 3)` until expanded, and format through an exhaustive switch:

```ts
const formatAtlasValue = (valueType: AtlasValueType, value: number) => {
    if (valueType === 'probability') return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
    if (valueType === 'loading') return value.toPrecision(3);
    return assertNever(valueType);
};
```

Use a vertical list with ordinary document flow; no absolute positioning. Provenance links use backend `sourceUrl` and show the pinned version. Keep errors/loading inside the section.

- [ ] **Step 4: Run frontend tests**

```bash
cd compose/neurosynth-frontend
npm run test
```

Expected: PASS for all panel states, semantics, accessibility, and responsive wrapping.

- [ ] **Step 5: Commit the live panel**

```bash
git add compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.tsx compose/neurosynth-frontend/src/pages/Decode/components/DecodeAtlasReadout.spec.tsx
git commit -m "feat: render live decoder atlas labels"
```

### Task 9: Integrate the live panel and remove all atlas fixtures

**Files:**
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/components/DecodeViewer.spec.tsx`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.types.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.fixtures.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/Decode.golden.ts`
- Modify: `compose/neurosynth-frontend/src/pages/Decode/DecodePage.tsx`
- Modify: Decode tests constructing `IDecodePreview` values

**Interfaces:**
- Consumes: New `DecodeAtlasReadout coordinate={value}`.
- Produces: One live atlas query surface for illustrative viewers, recorded NIfTI viewers, and coordinate sources, independent of preview/decoder state.

- [ ] **Step 1: Update viewer tests to describe integration before code**

Mock `DecodeAtlasReadout` as a named test component and assert it receives coordinate changes from typed fields, entered-coordinate selection, and NiiVue crosshair movement. Assert changing only `threshold` does not alter its x/y/z props. Remove assertions for `Left inferior frontal gyrus`, `72%`, `Example atlas readout`, and deterministic fixture provenance.

- [ ] **Step 2: Run frontend tests and verify failure**

```bash
cd compose/neurosynth-frontend
npm run test
```

Expected: FAIL because `DecodeViewer` still requires fixture atlas data.

- [ ] **Step 3: Remove fixture data from the preview contract**

Delete `IAtlasReadout`, `IDecodePreview.atlasReadouts`, `EXAMPLE_ATLAS_READOUTS`, all fixture/golden assignments, and `atlasReadouts` props through `DecodePage` and `DecodeViewer`. Update every test object so TypeScript has no cast hiding the removed field. Confirm:

```bash
rg -n "IAtlasReadout|EXAMPLE_ATLAS_READOUTS|atlasReadouts|Example atlas readout" compose/neurosynth-frontend/src/pages/Decode
```

Expected: no matches.

- [ ] **Step 4: Mount the live panel from the viewer coordinate**

Render `<DecodeAtlasReadout coordinate={value} />` in the existing viewer side column for all source kinds and both illustrative/recorded viewers. The panel does not depend on `preview`, `visualization`, model selection, or map load success.

- [ ] **Step 5: Run frontend tests and build**

```bash
cd compose/neurosynth-frontend
npm run test
npm run build:dev
```

Expected: PASS. Expected development Sentry DNS/token warnings may remain non-fatal; TypeScript reports no obsolete atlas fixture property.

- [ ] **Step 6: Commit viewer integration**

```bash
git add compose/neurosynth-frontend/src/pages/Decode
git commit -m "refactor: replace decoder atlas fixtures"
```

### Task 10: Exercise the complete real-map walkthrough and failure recovery

**Files:**
- Modify: `compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx`

**Interfaces:**
- Consumes: `/decode?example=neurovault-308`, live panel, deterministic endpoint contract, and real local NIfTI maps.
- Produces: End-to-end proof that coordinate-driven atlas updates coexist with side-by-side/overlay map viewing and recover locally.

- [ ] **Step 1: Add deterministic atlas responses to every decoder Cypress flow**

Register the atlas intercept before broad `/api/**` guards. Match `GET **/api/atlases/readout*`, read numeric x/y/z, and reply with three valid atlas groups whose labels encode the requested coordinate. Keep the existing guards for every other backend request. Alias it `atlasReadout`.

- [ ] **Step 2: Add walkthrough and recovery assertions**

In the NeuroVault 308 test, wait for the initial atlas request, move the submitted-map crosshair/coordinate, assert query parameters and updated coordinate label, show all DiFuMo matches, then enter side-by-side and overlay modes and confirm both real canvases remain ready. In a separate test, reply `503` once, assert `Atlas readout unavailable`, maps/results remain visible, click `Retry atlas readout`, return `200`, and assert recovery without navigation.

- [ ] **Step 3: Run Cypress and verify any missing behavior fails**

With the documented development server and backend running:

```bash
cd compose/neurosynth-frontend
env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless-dev
```

Expected before final fixes: the new assertions identify any request ordering, selector, or local-error gap. Do not weaken WebGL readiness assertions.

- [ ] **Step 4: Make the smallest accessibility/responsive corrections exposed by Cypress**

Limit edits to the live atlas component/hook and their unit tests. Preserve the 200 ms debounce, prior-data behavior, scientific labels, vertical layout, and existing real-map comparison behavior.

- [ ] **Step 5: Re-run frontend unit, build, and Cypress suites**

```bash
cd compose/neurosynth-frontend
npm run test
npm run build:dev
env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless-dev
```

Expected: all suites pass, including existing real NIfTI/WebGL checks and new live atlas recovery.

- [ ] **Step 6: Commit the end-to-end flow**

```bash
git add compose/neurosynth-frontend/cypress/e2e/pages/DecodePage.cy.tsx compose/neurosynth-frontend/src/pages/Decode
git commit -m "test: verify live decoder atlas walkthrough"
```

### Task 11: Run final scientific, security, and repository verification

**Files:**
- Modify only files required to correct failures found by the commands below.

**Interfaces:**
- Consumes: Entire branch implementation.
- Produces: Evidence-backed merge readiness plus the OpenAPI submodule commit and runtime/license prerequisites in the handoff.

- [ ] **Step 1: Verify pinned artifacts and prohibited fixture language**

```bash
rg -n "TBD|TODO|latest|unknown" compose/backend/atlas_runtime
rg -n "IAtlasReadout|EXAMPLE_ATLAS_READOUTS|Example atlas readout|deterministic examples" compose/neurosynth-frontend/src/pages/Decode
git submodule status --recursive
git diff --check
```

Expected: no provenance placeholders, no old atlas fixture terms, the OpenAPI submodule is committed at the intended feature commit, and no whitespace errors.

- [ ] **Step 2: Run the complete Compose backend suite with real atlases required**

```bash
cd compose
docker compose exec -T compose-pgsql17 bash -lc "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = 'compose_test_db'\" | grep -q 1 || psql -U postgres -c \"create database compose_test_db\""
docker compose run -e "APP_ENV=docker_test" -e "ATLAS_RUNTIME_REQUIRED=1" --rm compose bash -c "python -m pytest neurosynth_compose/tests"
```

Expected: all backend tests pass with real-runtime integration enabled.

- [ ] **Step 3: Run complete frontend verification**

```bash
cd compose/neurosynth-frontend
npm run test
npm run build:dev
env -u ELECTRON_RUN_AS_NODE npm run cy:e2e-headless-dev
```

Expected: all unit and Cypress tests pass and build completes; only documented non-fatal Sentry warnings are acceptable.

- [ ] **Step 4: Perform the manual live service walkthrough**

At `http://localhost:3000/decode?example=neurovault-308`, verify real response-control, premotor, visual, and posterior-cingulate maps; move coordinates quickly; confirm old atlas rows remain under `Updating`; confirm final Harvard–Oxford probabilities and DiFuMo loadings match the API at the final coordinate; switch side-by-side/overlay; expand rows at desktop and 390 px; stop the atlas service or inject `503`; retry without losing viewer/result state.

- [ ] **Step 5: Review the branch diff and commit only necessary corrections**

```bash
git status --short
git diff --stat enh/decoder_interface...HEAD
git diff --check
```

If verification corrections were required, interactively stage only reviewed hunks and commit them:

```bash
git add -p
git commit -m "fix: resolve decoder atlas verification gaps"
```

The final handoff must name: parent branch/commit, OpenAPI submodule branch/commit, exact FSL environment lock, DiFuMo manifest version/hashes, redistribution conclusion, backend/frontend/Cypress counts, build result, and any externally supplied runtime requirement.
