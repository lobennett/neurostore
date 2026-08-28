"""Golden-coordinate checks for the atlas runtime packaged in the image."""

import csv
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess

import nibabel as nib
import numpy as np
import pytest


pytestmark = [
    pytest.mark.atlas_runtime,
    pytest.mark.skipif(
        os.environ.get("ATLAS_RUNTIME_REQUIRED") != "1",
        reason="set ATLAS_RUNTIME_REQUIRED=1 to require packaged atlases",
    ),
]

ATLAS_ROOT = Path("/opt/decoder-atlases")
MANIFEST_PATH = ATLAS_ROOT / "manifest.json"
ATLASQ_PATH = ATLAS_ROOT / "bin" / "atlasq"
DIFUMO_DIR = ATLAS_ROOT / "data" / "difumo-512"
DIFUMO_IMAGE_PATH = DIFUMO_DIR / "difumo-512-2mm.nii.gz"
DIFUMO_LABELS_PATH = DIFUMO_DIR / "difumo-512-labels.csv"

EXPECTED_MANIFEST_SHA256 = (
    "3d60301b256fdd21294464e4ca00d9edb59a63e44e3537fa8f025c910eeeefbd"
)
EXPECTED_FSL_ATLAS_IDS = (
    "harvardoxford-cortical",
    "harvardoxford-subcortical",
)
EXPECTED_DIFUMO_AFFINE = np.asarray(
    [
        [2.0, 0.0, 0.0, -96.0],
        [0.0, 2.0, 0.0, -132.0],
        [0.0, 0.0, 2.0, -78.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
)
EXPECTED_LICENSE_FILES = (
    ATLAS_ROOT / "licenses" / "fslpy-3.29.1" / "LICENSE",
    ATLAS_ROOT / "licenses" / "harvard-oxford" / "CC-BY-SA-4.0.txt",
    ATLAS_ROOT
    / "licenses"
    / "difumo-512"
    / "MIT-PROJECT-AUTHORIZATION.txt",
    ATLAS_ROOT / "licenses" / "THIRD_PARTY_NOTICES.md",
)

GOLDEN_COORDINATES = (
    {
        "purpose": "multiple matches and nonzero functional modes",
        "coordinate": (-42.0, 0.0, 0.0),
        "voxel": (27, 66, 39),
        "fsl": {
            "harvardoxford-cortical": (
                ("Insular Cortex", 70.0),
                ("Central Opercular Cortex", 4.0),
            ),
            "harvardoxford-subcortical": (
                ("Left Cerebral Cortex", 95.8715),
                ("Left Cerebral White Matter", 0.0407),
            ),
        },
        "difumo": (
            (467, "External capsule middle LH", 0.0012017411645501852),
            (330, "Central operculum LH", 0.00047331181121990085),
            (116, "Planum polare superior", 0.00040436722338199615),
        ),
    },
    {
        "purpose": "subcortical overlap and nonzero functional modes",
        "coordinate": (0.0, 0.0, 0.0),
        "voxel": (48, 66, 39),
        "fsl": {
            "harvardoxford-cortical": (),
            "harvardoxford-subcortical": (
                ("Left Cerebral White Matter", 28.5143),
                ("Right Cerebral White Matter", 9.0551),
                ("Left Thalamus", 4.0968),
                ("Left Cerebral Cortex", 1.5979),
                ("Right Thalamus", 1.5939),
                ("Left Lateral Ventricle", 1.5023),
                ("Right Cerebral Cortex", 0.5529),
                ("Right Lateral Ventricle", 0.0457),
            ),
        },
        "difumo": (
            (11, "Midbrain superior", 0.00022901856573298573),
            (
                464,
                "Lateral ventricles anterior horns",
                0.00017279043095186353,
            ),
            (
                194,
                "Cerebrospinal fluid (between superior cerebellum and limbic lobe)",
                0.00014064775314182043,
            ),
        ),
    },
    {
        "purpose": "valid coordinate outside atlas coverage",
        "coordinate": (90.0, 90.0, 108.0),
        "voxel": (93, 111, 93),
        "fsl": {
            "harvardoxford-cortical": (),
            "harvardoxford-subcortical": (),
        },
        "difumo": (),
    },
    {
        "purpose": "decimal inverse-affine nearest sampling",
        "coordinate": (-41.5, 0.5, 0.5),
        "continuous_voxel": (27.25, 66.25, 39.25),
        "voxel": (27, 66, 39),
        "fsl": {
            "harvardoxford-cortical": (
                ("Insular Cortex", 70.0),
                ("Central Opercular Cortex", 4.0),
            ),
            "harvardoxford-subcortical": (
                ("Left Cerebral Cortex", 95.8715),
                ("Left Cerebral White Matter", 0.0407),
            ),
        },
        "difumo": (
            (467, "External capsule middle LH", 0.0012017411645501852),
            (330, "Central operculum LH", 0.00047331181121990085),
            (116, "Planum polare superior", 0.00040436722338199615),
        ),
    },
)


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atlasq_matches(atlas_id, coordinate):
    completed = subprocess.run(
        [
            str(ATLASQ_PATH),
            "query",
            atlas_id,
            "--short",
            "--resolution",
            "2",
            "--coord",
            *(str(value) for value in coordinate),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=10,
        env={**os.environ, "FSLDIR": str(ATLAS_ROOT)},
    )
    records = completed.stdout.splitlines()
    assert len(records) == 1
    fields = records[0].split("\t")
    assert fields[0] == "coordinate"
    assert tuple(float(value) for value in fields[1].split()) == coordinate
    matches = []
    for field in fields[2:]:
        label, raw_value = field.rsplit(maxsplit=1)
        matches.append((label, float(raw_value)))
    return tuple(matches)


def _difumo_labels():
    with DIFUMO_LABELS_PATH.open("r", encoding="utf-8", newline="") as stream:
        rows = tuple(csv.DictReader(stream))
    assert len(rows) == 512
    return tuple((int(row["component_id"]), row["label"]) for row in rows)


def _difumo_matches(image, labels, voxel):
    values = np.asanyarray(image.dataobj[*voxel, :])
    matches = tuple(
        sorted(
            (
                (component_id, label, float(value))
                for (component_id, label), value in zip(labels, values)
                if float(value) != 0.0
            ),
            key=lambda match: (-match[2], match[0]),
        )
    )
    return matches


def test_packaged_runtime_files_match_the_pinned_manifest():
    assert os.environ["FSLDIR"] == str(ATLAS_ROOT)
    assert shutil.which("python") == "/usr/local/bin/python"
    assert shutil.which("atlasq") == str(ATLASQ_PATH)
    assert _sha256(MANIFEST_PATH) == EXPECTED_MANIFEST_SHA256
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert manifest["schemaVersion"] == 1
    assert manifest["space"] == "MNI152"
    assert manifest["fsl"]["packages"] == {
        "fslpy": "3.29.1",
        "fslpyBuild": "pyhc364b38_0",
        "fsl-data_atlases": "2103.0",
        "fsl-data_atlasesBuild": "0",
    }
    assert tuple(manifest["fsl"]["atlasIds"]) == EXPECTED_FSL_ATLAS_IDS
    assert manifest["difumo"]["version"] == "OSF file version 1, 2021-01-26"

    assets = {asset["filename"]: asset for asset in manifest["difumo"]["assets"]}
    for path in (DIFUMO_IMAGE_PATH, DIFUMO_LABELS_PATH):
        metadata = assets[path.name]
        assert path.stat().st_size == metadata["bytes"]
        assert _sha256(path) == metadata["sha256"]

    for license_path in EXPECTED_LICENSE_FILES:
        assert license_path.is_file()
        assert license_path.stat().st_size > 0


def test_packaged_atlasq_lists_only_the_approved_harvard_oxford_ids():
    completed = subprocess.run(
        [str(ATLASQ_PATH), "list"],
        check=True,
        capture_output=True,
        text=True,
        timeout=10,
        env={**os.environ, "FSLDIR": str(ATLAS_ROOT)},
    )
    listed_ids = {
        line.split()[0]
        for line in completed.stdout.splitlines()
        if line.startswith("harvardoxford-")
    }
    assert listed_ids == set(EXPECTED_FSL_ATLAS_IDS)


@pytest.mark.parametrize(
    "golden",
    GOLDEN_COORDINATES,
    ids=[golden["purpose"] for golden in GOLDEN_COORDINATES],
)
def test_packaged_atlases_match_task_one_coordinate_goldens(golden):
    image = nib.load(DIFUMO_IMAGE_PATH)
    assert image.shape == (104, 123, 104, 512)
    np.testing.assert_array_equal(image.affine, EXPECTED_DIFUMO_AFFINE)

    x, y, z = golden["coordinate"]
    continuous_voxel = ((x + 96.0) / 2.0, (y + 132.0) / 2.0, (z + 78.0) / 2.0)
    if "continuous_voxel" in golden:
        assert continuous_voxel == golden["continuous_voxel"]
    observed_voxel = tuple(math.floor(value + 0.5) for value in continuous_voxel)
    assert observed_voxel == golden["voxel"]

    for atlas_id in EXPECTED_FSL_ATLAS_IDS:
        observed = _atlasq_matches(atlas_id, golden["coordinate"])
        expected = golden["fsl"][atlas_id]
        assert tuple(label for label, _ in observed) == tuple(
            label for label, _ in expected
        )
        assert tuple(value for _, value in observed) == pytest.approx(
            tuple(value for _, value in expected), rel=0, abs=1e-4
        )

    observed_difumo = _difumo_matches(image, _difumo_labels(), observed_voxel)
    expected_difumo = golden["difumo"]
    assert tuple(match[:2] for match in observed_difumo) == tuple(
        match[:2] for match in expected_difumo
    )
    assert tuple(match[2] for match in observed_difumo) == pytest.approx(
        tuple(match[2] for match in expected_difumo), rel=1e-7, abs=1e-12
    )
