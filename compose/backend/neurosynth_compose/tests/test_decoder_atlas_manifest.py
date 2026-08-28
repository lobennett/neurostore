import csv
import hashlib
import io
import json
import os
import re
import urllib.request
import zipfile
from pathlib import Path

import nibabel as nib
import numpy as np
import pytest

from neurosynth_compose.scripts.install_decoder_atlases import (
    AtlasInstallError,
    HttpsOnlyRedirectHandler,
    install_decoder_atlases,
)


MANIFEST_PATH = (
    Path(__file__).resolve().parents[2] / "atlas_runtime" / "manifest.json"
)

EXPECTED_INTEGRATION_COORDINATES = [
    {
        "purpose": "multiple Harvard-Oxford matches and nonzero DiFuMo modes",
        "coordinate": {"x": -42.0, "y": 0.0, "z": 0.0},
        "harvardOxford": {
            "category": "anatomical",
            "valueType": "probability",
            "atlases": {
                "harvardoxford-cortical": [
                    {"index": 1, "label": "Insular Cortex", "value": 70.0},
                    {
                        "index": 41,
                        "label": "Central Opercular Cortex",
                        "value": 4.0,
                    },
                ],
                "harvardoxford-subcortical": [
                    {
                        "index": 1,
                        "label": "Left Cerebral Cortex",
                        "value": 95.8715,
                    },
                    {
                        "index": 0,
                        "label": "Left Cerebral White Matter",
                        "value": 0.0407,
                    },
                ],
            },
        },
        "difumo": {
            "category": "functional",
            "valueType": "loading",
            "voxel": [27, 66, 39],
            "nonzeroCount": 3,
            "matches": [
                {
                    "componentId": 467,
                    "label": "External capsule middle LH",
                    "value": 0.0012017411645501852,
                },
                {
                    "componentId": 330,
                    "label": "Central operculum LH",
                    "value": 0.00047331181121990085,
                },
                {
                    "componentId": 116,
                    "label": "Planum polare superior",
                    "value": 0.00040436722338199615,
                },
            ],
        },
    },
    {
        "purpose": "subcortical overlap and nonzero DiFuMo modes",
        "coordinate": {"x": 0.0, "y": 0.0, "z": 0.0},
        "harvardOxford": {
            "category": "anatomical",
            "valueType": "probability",
            "atlases": {
                "harvardoxford-cortical": [],
                "harvardoxford-subcortical": [
                    {
                        "index": 0,
                        "label": "Left Cerebral White Matter",
                        "value": 28.5143,
                    },
                    {
                        "index": 11,
                        "label": "Right Cerebral White Matter",
                        "value": 9.0551,
                    },
                    {"index": 3, "label": "Left Thalamus", "value": 4.0968},
                    {
                        "index": 1,
                        "label": "Left Cerebral Cortex",
                        "value": 1.5979,
                    },
                    {"index": 14, "label": "Right Thalamus", "value": 1.5939},
                    {
                        "index": 2,
                        "label": "Left Lateral Ventricle",
                        "value": 1.5023,
                    },
                    {
                        "index": 12,
                        "label": "Right Cerebral Cortex",
                        "value": 0.5529,
                    },
                    {
                        "index": 13,
                        "label": "Right Lateral Ventricle",
                        "value": 0.0457,
                    },
                ],
            },
        },
        "difumo": {
            "category": "functional",
            "valueType": "loading",
            "voxel": [48, 66, 39],
            "nonzeroCount": 3,
            "matches": [
                {
                    "componentId": 11,
                    "label": "Midbrain superior",
                    "value": 0.00022901856573298573,
                },
                {
                    "componentId": 464,
                    "label": "Lateral ventricles anterior horns",
                    "value": 0.00017279043095186353,
                },
                {
                    "componentId": 194,
                    "label": (
                        "Cerebrospinal fluid (between superior cerebellum and "
                        "limbic lobe)"
                    ),
                    "value": 0.00014064775314182043,
                },
            ],
        },
    },
    {
        "purpose": "valid MNI coordinate with no atlas coverage",
        "coordinate": {"x": 90.0, "y": 90.0, "z": 108.0},
        "harvardOxford": {
            "category": "anatomical",
            "valueType": "probability",
            "atlases": {
                "harvardoxford-cortical": [],
                "harvardoxford-subcortical": [],
            },
        },
        "difumo": {
            "category": "functional",
            "valueType": "loading",
            "voxel": [93, 111, 93],
            "nonzeroCount": 0,
            "matches": [],
        },
    },
    {
        "purpose": "decimal coordinate exercising inverse-affine nearest sampling",
        "coordinate": {"x": -41.5, "y": 0.5, "z": 0.5},
        "harvardOxford": {
            "category": "anatomical",
            "valueType": "probability",
            "atlases": {
                "harvardoxford-cortical": [
                    {"index": 1, "label": "Insular Cortex", "value": 70.0},
                    {
                        "index": 41,
                        "label": "Central Opercular Cortex",
                        "value": 4.0,
                    },
                ],
                "harvardoxford-subcortical": [
                    {
                        "index": 1,
                        "label": "Left Cerebral Cortex",
                        "value": 95.8715,
                    },
                    {
                        "index": 0,
                        "label": "Left Cerebral White Matter",
                        "value": 0.0407,
                    },
                ],
            },
        },
        "difumo": {
            "category": "functional",
            "valueType": "loading",
            "voxel": [27, 66, 39],
            "nonzeroCount": 3,
            "matches": [
                {
                    "componentId": 467,
                    "label": "External capsule middle LH",
                    "value": 0.0012017411645501852,
                },
                {
                    "componentId": 330,
                    "label": "Central operculum LH",
                    "value": 0.00047331181121990085,
                },
                {
                    "componentId": 116,
                    "label": "Planum polare superior",
                    "value": 0.00040436722338199615,
                },
            ],
        },
    },
]


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
    assert manifest["difumo"]["voxelRounding"] == "floor(voxel + 0.5)"
    assert manifest["difumo"]["componentIndexConvention"] == {
        "componentIdBase": 1,
        "vectorIndexBase": 0,
        "mapping": "vector_index = component_id - 1",
    }
    assert manifest["difumo"]["canonicalUrl"] == "https://osf.io/9b76y/download"
    assert manifest["difumo"]["archive"] == {
        "filename": "512.zip",
        "sha256": "63af869a11312def29cbe554c900322ee65c36e37709a14a7e9bf18659827d68",
        "bytes": 3702732,
    }
    assert manifest["difumo"]["assets"] == [
        {
            "filename": "difumo-512-2mm.nii.gz",
            "sha256": (
                "1de41df48d726d43c70e420b6a7a98b57e18f65768c9224bb6b057f329de9238"
            ),
            "bytes": 14359345,
        },
        {
            "filename": "difumo-512-labels.csv",
            "sha256": (
                "b5609f0f9aeb11d1bf3212eeef302d7241207aa90b0c84c6c7e282c585372b99"
            ),
            "bytes": 18201,
        },
    ]
    assert manifest["difumo"]["nifti"] == {
        "shape": [104, 123, 104, 512],
        "affine": [
            [2.0, 0.0, 0.0, -96.0],
            [0.0, 2.0, 0.0, -132.0],
            [0.0, 0.0, 2.0, -78.0],
            [0.0, 0.0, 0.0, 1.0],
        ],
        "dtype": "float32",
    }
    assert all(
        re.fullmatch(r"[0-9a-f]{64}", asset["sha256"])
        for asset in manifest["difumo"]["assets"]
    )


def test_decoder_atlas_manifest_records_real_runtime_provenance():
    manifest = json.loads(MANIFEST_PATH.read_text())
    assert manifest["fsl"]["packages"]["fslpy"] == "3.29.1"
    assert manifest["fsl"]["packages"]["fslpyBuild"] == "pyhc364b38_0"
    assert manifest["fsl"]["citation"] == {
        "title": "Harvard-Oxford cortical and subcortical structural atlases",
        "documentationUrl": (
            "https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html"
            "#harvard-oxford-cortical-and-subcortical-structural-atlases"
        ),
        "publicationUrl": "https://pubmed.ncbi.nlm.nih.gov/16448806/",
    }
    cortical = manifest["fsl"]["labelIndexMaps"]["harvardoxford-cortical"]
    subcortical = manifest["fsl"]["labelIndexMaps"][
        "harvardoxford-subcortical"
    ]
    assert [entry["index"] for entry in cortical] == list(range(48))
    assert [entry["index"] for entry in subcortical] == list(range(21))
    assert manifest["integrationCoordinates"] == EXPECTED_INTEGRATION_COORDINATES

    license_basis = manifest["difumo"]["license"]
    assert license_basis["spdx"] == "MIT"
    assert license_basis["upstreamDeclared"] is False
    assert license_basis["authorization"] == "project-maintainer-assumption"

    forbidden = {"", "latest", "unknown", "tbd"}

    def check(value):
        if isinstance(value, dict):
            for child in value.values():
                check(child)
        elif isinstance(value, list):
            for child in value:
                check(child)
        elif isinstance(value, str):
            assert value.strip().lower() not in forbidden

    check(manifest)


def _sha256(payload):
    return hashlib.sha256(payload).hexdigest()


def _normalized_labels(rows):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(
        stream, fieldnames=["component_id", "label"], lineterminator="\n"
    )
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode()


def _synthetic_archive(tmp_path, row_count=512, label_prefix="Mode"):
    image_path = tmp_path / "maps.nii.gz"
    nib.save(
        nib.Nifti1Image(
            np.zeros((2, 3, 4, 512), dtype=np.float32),
            np.array(
                [
                    [2.0, 0.0, 0.0, -2.0],
                    [0.0, 2.0, 0.0, -4.0],
                    [0.0, 0.0, 2.0, -6.0],
                    [0.0, 0.0, 0.0, 1.0],
                ]
            ),
        ),
        image_path,
    )
    rows = [
        {"component_id": component_id, "label": f"{label_prefix} {component_id}"}
        for component_id in range(1, row_count + 1)
    ]
    upstream_labels = io.StringIO(newline="")
    writer = csv.DictWriter(
        upstream_labels,
        fieldnames=[
            "Component",
            "Difumo_names",
            "Yeo_networks7",
            "Yeo_networks17",
            "GM",
            "WM",
            "CSF",
        ],
        lineterminator="\n",
    )
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "Component": row["component_id"],
                "Difumo_names": row["label"],
                "Yeo_networks7": "Network 7",
                "Yeo_networks17": "Network 17",
                "GM": "1.0",
                "WM": "0.0",
                "CSF": "0.0",
            }
        )

    archive_path = tmp_path / "512.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(image_path, "512/2mm/maps.nii.gz")
        zf.writestr(
            "512/labels_512_dictionary.csv", upstream_labels.getvalue().encode()
        )
    return archive_path.read_bytes(), image_path.read_bytes(), _normalized_labels(rows)


def _synthetic_manifest(tmp_path, archive, image, labels):
    manifest = json.loads(MANIFEST_PATH.read_text())
    manifest["difumo"]["archive"] = {
        "filename": "512.zip",
        "sha256": _sha256(archive),
        "bytes": len(archive),
    }
    manifest["difumo"]["assets"] = [
        {
            "filename": "difumo-512-2mm.nii.gz",
            "sha256": _sha256(image),
            "bytes": len(image),
        },
        {
            "filename": "difumo-512-labels.csv",
            "sha256": _sha256(labels),
            "bytes": len(labels),
        },
    ]
    manifest["difumo"]["nifti"] = {
        "shape": [2, 3, 4, 512],
        "affine": [
            [2.0, 0.0, 0.0, -2.0],
            [0.0, 2.0, 0.0, -4.0],
            [0.0, 0.0, 2.0, -6.0],
            [0.0, 0.0, 0.0, 1.0],
        ],
        "dtype": "float32",
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))
    return manifest_path


def _local_downloader(payload):
    def download(url, destination):
        assert url == "https://osf.io/9b76y/download"
        destination.write_bytes(payload)
        return "https://files.example.test/difumo/512.zip?signature=temporary"

    return download


def test_installer_rejects_changed_archive_before_replacing_assets(tmp_path):
    archive, image, labels = _synthetic_archive(tmp_path)
    manifest_path = _synthetic_manifest(tmp_path, archive, image, labels)
    manifest = json.loads(manifest_path.read_text())
    manifest["difumo"]["archive"]["sha256"] = "0" * 64
    manifest_path.write_text(json.dumps(manifest))
    destination = tmp_path / "installed"
    destination.mkdir()
    old_asset = destination / "difumo-512-labels.csv"
    old_asset.write_text("existing asset")

    with pytest.raises(AtlasInstallError, match="archive SHA-256"):
        install_decoder_atlases(
            manifest_path,
            destination,
            downloader=_local_downloader(archive),
        )

    assert old_asset.read_text() == "existing asset"


def test_installer_requires_512_unique_label_rows(tmp_path):
    archive, image, labels = _synthetic_archive(tmp_path, row_count=511)
    manifest_path = _synthetic_manifest(tmp_path, archive, image, labels)

    with pytest.raises(AtlasInstallError, match="512 unique component rows"):
        install_decoder_atlases(
            manifest_path,
            tmp_path / "installed",
            downloader=_local_downloader(archive),
        )


def test_redirect_handler_rejects_any_non_https_hop():
    handler = HttpsOnlyRedirectHandler()
    request = urllib.request.Request("https://osf.io/9b76y/download")

    with pytest.raises(AtlasInstallError, match="HTTPS"):
        handler.redirect_request(
            request,
            None,
            302,
            "Found",
            {},
            "http://files.example.test/difumo.zip",
        )


def test_installer_atomically_switches_existing_published_runtime(
    tmp_path, monkeypatch
):
    old_archive, old_image, old_labels = _synthetic_archive(tmp_path)
    old_manifest_path = _synthetic_manifest(
        tmp_path, old_archive, old_image, old_labels
    )
    destination = tmp_path / "installed"
    install_decoder_atlases(
        old_manifest_path,
        destination,
        downloader=_local_downloader(old_archive),
    )
    assert destination.is_symlink()
    old_target = destination.resolve()

    new_archive, new_image, new_labels = _synthetic_archive(
        tmp_path, label_prefix="Updated mode"
    )
    new_manifest_path = _synthetic_manifest(
        tmp_path, new_archive, new_image, new_labels
    )
    real_replace = os.replace
    availability_at_switch = []

    def observing_replace(source, target):
        if Path(target) == destination:
            availability_at_switch.append(
                destination.is_symlink()
                and destination.resolve() == old_target
                and (destination / "difumo-512-labels.csv").exists()
            )
        return real_replace(source, target)

    monkeypatch.setattr(os, "replace", observing_replace)
    result = install_decoder_atlases(
        new_manifest_path,
        destination,
        downloader=_local_downloader(new_archive),
    )

    assert availability_at_switch == [True]
    assert destination.is_symlink()
    assert destination.resolve() != old_target
    assert result.resolved_url == "https://files.example.test/difumo/512.zip"
    assert sorted(path.name for path in destination.iterdir()) == [
        "difumo-512-2mm.nii.gz",
        "difumo-512-labels.csv",
    ]
    assert (destination / "difumo-512-2mm.nii.gz").read_bytes() == new_image
    with (destination / "difumo-512-labels.csv").open(newline="") as stream:
        normalized = list(csv.DictReader(stream))
    assert list(normalized[0]) == ["component_id", "label"]
    assert len(normalized) == 512
    assert normalized[0] == {"component_id": "1", "label": "Updated mode 1"}
    assert normalized[-1] == {
        "component_id": "512",
        "label": "Updated mode 512",
    }


def test_failed_publication_keeps_prior_runtime_available(tmp_path, monkeypatch):
    old_archive, old_image, old_labels = _synthetic_archive(tmp_path)
    old_manifest_path = _synthetic_manifest(
        tmp_path, old_archive, old_image, old_labels
    )
    destination = tmp_path / "installed"
    install_decoder_atlases(
        old_manifest_path,
        destination,
        downloader=_local_downloader(old_archive),
    )
    old_target = destination.resolve()
    old_contents = (destination / "difumo-512-labels.csv").read_bytes()

    new_archive, new_image, new_labels = _synthetic_archive(
        tmp_path, label_prefix="Interrupted mode"
    )
    new_manifest_path = _synthetic_manifest(
        tmp_path, new_archive, new_image, new_labels
    )
    real_replace = os.replace

    def interrupt_publication(source, target):
        if Path(target) == destination:
            assert destination.resolve() == old_target
            assert (destination / "difumo-512-labels.csv").read_bytes() == old_contents
            raise OSError("simulated interruption before publication")
        return real_replace(source, target)

    monkeypatch.setattr(os, "replace", interrupt_publication)

    with pytest.raises(OSError, match="simulated interruption"):
        install_decoder_atlases(
            new_manifest_path,
            destination,
            downloader=_local_downloader(new_archive),
        )

    assert destination.is_symlink()
    assert destination.resolve() == old_target
    assert (destination / "difumo-512-labels.csv").read_bytes() == old_contents
    assert list(tmp_path.glob(".installed-install-*")) == []
    assert list(tmp_path.glob(".installed-publish-*")) == []
