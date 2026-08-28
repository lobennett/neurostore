"""Install the pinned DiFuMo 512 assets after complete provenance checks."""

import argparse
import csv
import hashlib
import json
import os
import shutil
import tempfile
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

import nibabel as nib
import numpy as np


OFFICIAL_DIFUMO_URL = "https://osf.io/9b76y/download"
NIFTI_ARCHIVE_PATH = "512/2mm/maps.nii.gz"
LABELS_ARCHIVE_PATH = "512/labels_512_dictionary.csv"
NIFTI_FILENAME = "difumo-512-2mm.nii.gz"
LABELS_FILENAME = "difumo-512-labels.csv"


class AtlasInstallError(RuntimeError):
    """Raised when downloaded atlas material does not match its manifest."""


@dataclass(frozen=True)
class InstallResult:
    """Verified provenance observed during an installation."""

    resolved_url: str
    destination: Path


class HttpsOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Reject a redirect chain as soon as any hop is not HTTPS."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _require_https(req.full_url, "redirect source")
        _require_https(newurl, "redirect destination")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _require_https(url, description):
    if urllib.parse.urlsplit(url).scheme.lower() != "https":
        raise AtlasInstallError(f"{description} must use HTTPS: {url}")


def _stable_resolved_url(url):
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, parts.path, "", "")
    )


def _sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_file(path, metadata, description):
    observed_bytes = path.stat().st_size
    if observed_bytes != metadata["bytes"]:
        raise AtlasInstallError(
            f"{description} byte count mismatch: expected {metadata['bytes']}, "
            f"observed {observed_bytes}"
        )
    observed_hash = _sha256(path)
    if observed_hash != metadata["sha256"]:
        raise AtlasInstallError(
            f"{description} SHA-256 mismatch: expected {metadata['sha256']}, "
            f"observed {observed_hash}"
        )


def _download_https(url, destination):
    _require_https(url, "download URL")
    opener = urllib.request.build_opener(HttpsOnlyRedirectHandler())
    with opener.open(url, timeout=120) as response, destination.open("wb") as output:
        resolved_url = response.geturl()
        _require_https(resolved_url, "resolved download URL")
        shutil.copyfileobj(response, output, length=1024 * 1024)
    return resolved_url


def _copy_archive_member(archive, member_name, destination):
    matches = [info for info in archive.infolist() if info.filename == member_name]
    if len(matches) != 1 or matches[0].is_dir():
        raise AtlasInstallError(
            f"archive must contain exactly one file named {member_name}"
        )
    with archive.open(matches[0]) as source, destination.open("wb") as output:
        shutil.copyfileobj(source, output, length=1024 * 1024)


def _normalize_labels(archive, destination):
    matches = [
        info for info in archive.infolist() if info.filename == LABELS_ARCHIVE_PATH
    ]
    if len(matches) != 1 or matches[0].is_dir():
        raise AtlasInstallError(
            f"archive must contain exactly one file named {LABELS_ARCHIVE_PATH}"
        )
    with archive.open(matches[0]) as raw_stream:
        rows = list(
            csv.DictReader(
                (line.decode("utf-8-sig") for line in raw_stream),
            )
        )

    normalized = []
    try:
        for row in rows:
            normalized.append(
                {
                    "component_id": int(row["Component"]),
                    "label": row["Difumo_names"].strip(),
                }
            )
    except (KeyError, TypeError, ValueError) as exc:
        raise AtlasInstallError("DiFuMo label table has invalid columns or IDs") from exc

    component_ids = [row["component_id"] for row in normalized]
    if (
        len(normalized) != 512
        or len(set(component_ids)) != 512
        or set(component_ids) != set(range(1, 513))
        or any(not row["label"] for row in normalized)
    ):
        raise AtlasInstallError(
            "DiFuMo label table must contain 512 unique component rows numbered 1-512"
        )

    normalized.sort(key=lambda row: row["component_id"])
    with destination.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=["component_id", "label"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(normalized)


def _validate_nifti(path, metadata):
    try:
        image = nib.load(path)
    except Exception as exc:
        raise AtlasInstallError("DiFuMo NIfTI could not be loaded") from exc
    if len(image.shape) != 4 or image.shape[-1] != 512:
        raise AtlasInstallError("DiFuMo NIfTI final dimension must be 512")
    if list(image.shape) != metadata["shape"]:
        raise AtlasInstallError(
            f"DiFuMo NIfTI shape mismatch: expected {metadata['shape']}, "
            f"observed {list(image.shape)}"
        )
    expected_affine = np.asarray(metadata["affine"], dtype=float)
    if not np.all(np.isfinite(image.affine)) or not np.allclose(
        image.affine, expected_affine, rtol=0, atol=1e-6
    ):
        raise AtlasInstallError("DiFuMo NIfTI affine does not match the manifest")


def _asset_metadata(manifest, filename):
    matches = [
        asset for asset in manifest["difumo"]["assets"] if asset["filename"] == filename
    ]
    if len(matches) != 1:
        raise AtlasInstallError(
            f"manifest must contain exactly one asset entry for {filename}"
        )
    return matches[0]


def _release_id(manifest):
    identity = "\n".join(
        f"{asset['filename']}:{asset['sha256']}"
        for asset in manifest["difumo"]["assets"]
    )
    return hashlib.sha256(identity.encode("ascii")).hexdigest()


def _verify_installed_release(release, manifest):
    if release.is_symlink() or not release.is_dir():
        raise AtlasInstallError(
            f"published release is not an immutable directory: {release}"
        )
    nifti_path = release / NIFTI_FILENAME
    labels_path = release / LABELS_FILENAME
    _validate_nifti(nifti_path, manifest["difumo"]["nifti"])
    _verify_file(
        nifti_path,
        _asset_metadata(manifest, NIFTI_FILENAME),
        NIFTI_FILENAME,
    )
    _verify_file(
        labels_path,
        _asset_metadata(manifest, LABELS_FILENAME),
        LABELS_FILENAME,
    )


def _publish_destination(staging, destination, manifest):
    if destination.is_symlink():
        pass
    elif destination.exists():
        raise AtlasInstallError(
            "destination must be absent or a managed symbolic link; refusing "
            "a non-atomic replacement of an existing directory"
        )

    versions = destination.parent / f".{destination.name}-versions"
    versions.mkdir(exist_ok=True)
    release = versions / _release_id(manifest)
    if release.exists():
        _verify_installed_release(release, manifest)
        shutil.rmtree(staging)
    else:
        os.replace(staging, release)

    publish_dir = Path(
        tempfile.mkdtemp(
            prefix=f".{destination.name}-publish-",
            dir=destination.parent,
        )
    )
    candidate = publish_dir / "current"
    try:
        os.symlink(os.path.relpath(release, destination.parent), candidate)
        os.replace(candidate, destination)
    finally:
        shutil.rmtree(publish_dir, ignore_errors=True)


def install_decoder_atlases(manifest_path, destination, downloader=None):
    """Download, normalize, verify, and transactionally install DiFuMo 512."""

    manifest_path = Path(manifest_path)
    destination = Path(destination)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source_url = manifest["difumo"]["canonicalUrl"]
    if source_url != OFFICIAL_DIFUMO_URL:
        raise AtlasInstallError(
            f"DiFuMo source must be the pinned URL {OFFICIAL_DIFUMO_URL}"
        )
    _require_https(source_url, "DiFuMo source URL")
    destination.parent.mkdir(parents=True, exist_ok=True)
    work_dir = Path(
        tempfile.mkdtemp(prefix=f".{destination.name}-install-", dir=destination.parent)
    )
    staging = work_dir / "verified"
    staging.mkdir()
    archive_path = work_dir / "512.zip"
    try:
        resolved_url = (downloader or _download_https)(source_url, archive_path)
        _require_https(resolved_url, "resolved download URL")
        resolved_url = _stable_resolved_url(resolved_url)
        _verify_file(archive_path, manifest["difumo"]["archive"], "archive")

        nifti_path = staging / NIFTI_FILENAME
        labels_path = staging / LABELS_FILENAME
        try:
            with zipfile.ZipFile(archive_path) as archive:
                _copy_archive_member(archive, NIFTI_ARCHIVE_PATH, nifti_path)
                _normalize_labels(archive, labels_path)
        except zipfile.BadZipFile as exc:
            raise AtlasInstallError("DiFuMo archive is not a valid ZIP file") from exc

        _validate_nifti(nifti_path, manifest["difumo"]["nifti"])
        _verify_file(
            nifti_path,
            _asset_metadata(manifest, NIFTI_FILENAME),
            NIFTI_FILENAME,
        )
        _verify_file(
            labels_path,
            _asset_metadata(manifest, LABELS_FILENAME),
            LABELS_FILENAME,
        )
        _publish_destination(staging, destination, manifest)
        return InstallResult(resolved_url=resolved_url, destination=destination)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--destination", required=True, type=Path)
    args = parser.parse_args(argv)
    result = install_decoder_atlases(args.manifest, args.destination)
    print(f"Installed verified DiFuMo 512 assets in {result.destination}")
    print(f"Resolved download URL: {result.resolved_url}")


if __name__ == "__main__":
    main()
