import csv
import hashlib
import io
import json
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
    for asset in manifest["difumo"]["assets"]:
        assert re.fullmatch(r"[0-9a-f]{64}", asset["sha256"])
        assert asset["bytes"] > 0


def test_decoder_atlas_manifest_records_real_runtime_provenance():
    manifest = json.loads(MANIFEST_PATH.read_text())
    assert manifest["fsl"]["packages"]["fslpy"] == "3.29.1"
    assert manifest["fsl"]["packages"]["fslpyBuild"] == "pyhc364b38_0"
    cortical = manifest["fsl"]["labelIndexMaps"]["harvardoxford-cortical"]
    subcortical = manifest["fsl"]["labelIndexMaps"][
        "harvardoxford-subcortical"
    ]
    assert [entry["index"] for entry in cortical] == list(range(48))
    assert [entry["index"] for entry in subcortical] == list(range(21))
    assert len(manifest["integrationCoordinates"]) == 4
    for golden in manifest["integrationCoordinates"]:
        assert set(golden["coordinate"]) == {"x", "y", "z"}
        assert set(golden["harvardOxford"]) == {
            "harvardoxford-cortical",
            "harvardoxford-subcortical",
        }
        assert golden["difumo"]["nonzeroCount"] >= 0
        assert len(golden["difumo"]["voxel"]) == 3

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


def _synthetic_archive(tmp_path, row_count=512):
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
        {"component_id": component_id, "label": f"Mode {component_id}"}
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


def test_installer_atomically_replaces_destination_with_verified_assets(tmp_path):
    archive, image, labels = _synthetic_archive(tmp_path)
    manifest_path = _synthetic_manifest(tmp_path, archive, image, labels)
    destination = tmp_path / "installed"
    destination.mkdir()
    (destination / "obsolete.txt").write_text("remove me")

    result = install_decoder_atlases(
        manifest_path,
        destination,
        downloader=_local_downloader(archive),
    )

    assert result.resolved_url == "https://files.example.test/difumo/512.zip"
    assert sorted(path.name for path in destination.iterdir()) == [
        "difumo-512-2mm.nii.gz",
        "difumo-512-labels.csv",
    ]
    assert (destination / "difumo-512-2mm.nii.gz").read_bytes() == image
    with (destination / "difumo-512-labels.csv").open(newline="") as stream:
        normalized = list(csv.DictReader(stream))
    assert list(normalized[0]) == ["component_id", "label"]
    assert len(normalized) == 512
    assert normalized[0] == {"component_id": "1", "label": "Mode 1"}
    assert normalized[-1] == {"component_id": "512", "label": "Mode 512"}
