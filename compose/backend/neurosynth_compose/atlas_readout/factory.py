"""Validated process-local construction of the fixed atlas service."""

from collections.abc import Mapping
from dataclasses import dataclass
import hashlib
import json
import math
import os
from pathlib import Path
import threading
from urllib.parse import urlsplit

from .difumo import DifumoAtlasProvider
from .fsl import FslAtlasProvider
from .service import ATLAS_ORDER, AtlasReadoutService
from .types import AtlasUnavailableError


_IMAGE_FILENAME = "difumo-512-2mm.nii.gz"
_LABELS_FILENAME = "difumo-512-labels.csv"
_SERVICE_CACHE = {}
_SERVICE_CACHE_LOCK = threading.Lock()


@dataclass(frozen=True)
class _AtlasConfiguration:
    fsl_dir: Path
    difumo_dir: Path
    manifest_path: Path
    timeout_seconds: float
    cache_size: int


def get_atlas_readout_service(
    settings: Mapping[str, object],
) -> AtlasReadoutService:
    """Return the singleton service for one frozen deployment configuration."""

    configuration = _freeze_configuration(settings)
    with _SERVICE_CACHE_LOCK:
        service = _SERVICE_CACHE.get(configuration)
        if service is None:
            service = _build_service(configuration)
            _SERVICE_CACHE[configuration] = service
        return service


def _freeze_configuration(settings):
    try:
        if not isinstance(settings, Mapping):
            raise TypeError
        fsl_dir = _configured_path(settings["ATLAS_FSLDIR"])
        difumo_dir = _configured_path(settings["ATLAS_DIFUMO_DIR"])
        manifest_path = _configured_path(settings["ATLAS_MANIFEST"])

        timeout = settings["ATLAS_QUERY_TIMEOUT_SECONDS"]
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)):
            raise TypeError
        timeout = float(timeout)
        if not math.isfinite(timeout) or timeout <= 0:
            raise ValueError

        cache_size = settings["ATLAS_CACHE_SIZE"]
        if (
            isinstance(cache_size, bool)
            or not isinstance(cache_size, int)
            or cache_size <= 0
        ):
            raise ValueError
    except (KeyError, TypeError, ValueError, OSError):
        raise AtlasUnavailableError(
            "Atlas readout configuration is invalid"
        ) from None

    return _AtlasConfiguration(
        fsl_dir=fsl_dir,
        difumo_dir=difumo_dir,
        manifest_path=manifest_path,
        timeout_seconds=timeout,
        cache_size=cache_size,
    )


def _configured_path(value):
    if not isinstance(value, (str, os.PathLike)):
        raise TypeError
    if isinstance(value, str) and not value.strip():
        raise ValueError
    return Path(value).absolute()


def _build_service(configuration):
    manifest_bytes, manifest = _read_manifest(configuration.manifest_path)
    cortical_labels, subcortical_labels = _validate_manifest(manifest)
    executable, image_path, labels_path = _runtime_paths(configuration)

    fsl = manifest["fsl"]
    difumo = manifest["difumo"]
    fsl_version = fsl["packages"]["fsl-data_atlases"]
    providers = {
        ATLAS_ORDER[2]: DifumoAtlasProvider(
            image_path=image_path,
            labels_path=labels_path,
            version=difumo["version"],
            source_url=difumo["canonicalUrl"],
        ),
        ATLAS_ORDER[1]: FslAtlasProvider(
            atlas_id=ATLAS_ORDER[1],
            label_ids=subcortical_labels,
            version=fsl_version,
            source_url=fsl["sourceUrl"],
            executable=str(executable),
            timeout_seconds=configuration.timeout_seconds,
        ),
        ATLAS_ORDER[0]: FslAtlasProvider(
            atlas_id=ATLAS_ORDER[0],
            label_ids=cortical_labels,
            version=fsl_version,
            source_url=fsl["sourceUrl"],
            executable=str(executable),
            timeout_seconds=configuration.timeout_seconds,
        ),
    }
    return AtlasReadoutService(
        providers=providers,
        manifest_version=hashlib.sha256(manifest_bytes).hexdigest(),
        cache_size=configuration.cache_size,
    )


def _read_manifest(manifest_path):
    try:
        manifest_bytes = manifest_path.read_bytes()
        manifest = json.loads(manifest_bytes)
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise AtlasUnavailableError(
            "Atlas readout manifest is unavailable"
        ) from None
    return manifest_bytes, manifest


def _validate_manifest(manifest):
    try:
        if not isinstance(manifest, dict):
            raise ValueError
        schema_version = manifest["schemaVersion"]
        if (
            isinstance(schema_version, bool)
            or not isinstance(schema_version, int)
            or schema_version != 1
            or manifest["space"] != "MNI152"
        ):
            raise ValueError

        fsl = manifest["fsl"]
        if not isinstance(fsl, dict) or fsl["atlasIds"] != list(
            ATLAS_ORDER[:2]
        ):
            raise ValueError
        _required_https_url(fsl["sourceUrl"])
        packages = fsl["packages"]
        if not isinstance(packages, dict):
            raise ValueError
        _required_text(packages["fsl-data_atlases"])
        label_maps = fsl["labelIndexMaps"]
        if not isinstance(label_maps, dict) or set(label_maps) != set(
            ATLAS_ORDER[:2]
        ):
            raise ValueError
        cortical = _label_ids(label_maps[ATLAS_ORDER[0]], expected_count=48)
        subcortical = _label_ids(
            label_maps[ATLAS_ORDER[1]], expected_count=21
        )

        difumo = manifest["difumo"]
        if not isinstance(difumo, dict):
            raise ValueError
        if (
            difumo["name"] != "DiFuMo 512"
            or isinstance(difumo["dimension"], bool)
            or not isinstance(difumo["dimension"], int)
            or difumo["dimension"] != 512
            or isinstance(difumo["resolutionMm"], bool)
            or not isinstance(difumo["resolutionMm"], int)
            or difumo["resolutionMm"] != 2
            or difumo["interpolation"] != "nearest"
        ):
            raise ValueError
        _required_text(difumo["version"])
        _required_https_url(difumo["canonicalUrl"])
        _validate_assets(difumo["assets"])
    except (KeyError, TypeError, ValueError):
        raise AtlasUnavailableError(
            "Atlas readout manifest is invalid"
        ) from None
    return cortical, subcortical


def _required_text(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError
    return value


def _required_https_url(value):
    value = _required_text(value)
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError
    return value


def _label_ids(entries, expected_count):
    if not isinstance(entries, list) or len(entries) != expected_count:
        raise ValueError
    by_label = {}
    indices = set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"index", "label"}:
            raise ValueError
        index = entry["index"]
        label = _required_text(entry["label"])
        if (
            isinstance(index, bool)
            or not isinstance(index, int)
            or index in indices
            or label in by_label
        ):
            raise ValueError
        indices.add(index)
        by_label[label] = str(index)
    if indices != set(range(expected_count)):
        raise ValueError
    return by_label


def _validate_assets(assets):
    if not isinstance(assets, list) or len(assets) != 2:
        raise ValueError
    by_filename = {}
    for asset in assets:
        if not isinstance(asset, dict):
            raise ValueError
        filename = _required_text(asset["filename"])
        digest = asset["sha256"]
        byte_count = asset["bytes"]
        if (
            filename in by_filename
            or not isinstance(digest, str)
            or len(digest) != 64
            or any(character not in "0123456789abcdef" for character in digest)
            or isinstance(byte_count, bool)
            or not isinstance(byte_count, int)
            or byte_count <= 0
        ):
            raise ValueError
        by_filename[filename] = asset
    if set(by_filename) != {_IMAGE_FILENAME, _LABELS_FILENAME}:
        raise ValueError


def _runtime_paths(configuration):
    executable = configuration.fsl_dir / "bin" / "atlasq"
    image_path = configuration.difumo_dir / _IMAGE_FILENAME
    labels_path = configuration.difumo_dir / _LABELS_FILENAME
    if (
        not executable.is_file()
        or not os.access(executable, os.X_OK)
        or not image_path.is_file()
        or not labels_path.is_file()
    ):
        raise AtlasUnavailableError(
            "Atlas readout runtime is unavailable"
        )
    return executable, image_path, labels_path
