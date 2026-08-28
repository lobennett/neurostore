"""Lazy nearest-voxel sampling for normalized DiFuMo 512 assets."""

import csv
from pathlib import Path
import threading

import nibabel as nib
from nibabel.affines import apply_affine
import numpy as np

from .types import AtlasMatch, AtlasResult, AtlasUnavailableError, Coordinate


class DifumoAtlasProvider:
    """Sample native DiFuMo loadings at one MNI152 coordinate."""

    atlas_id = "difumo-512"
    atlas_name = "DiFuMo 512"

    def __init__(self, image_path, labels_path, version, source_url):
        self._image_path = Path(image_path)
        self._labels_path = Path(labels_path)
        self._version = version
        self._source_url = source_url
        self._load_lock = threading.Lock()
        self._loaded = None

    def query(self, coordinate: Coordinate) -> AtlasResult:
        image, inverse_affine, components = self._load_assets()
        voxel = apply_affine(
            inverse_affine,
            np.asarray([coordinate.x, coordinate.y, coordinate.z], dtype=float),
        )
        indices = np.floor(voxel + 0.5).astype(np.int64)

        if any(
            index < 0 or index >= image.shape[axis]
            for axis, index in enumerate(indices)
        ):
            return self._result(())

        try:
            sampled = np.asanyarray(
                image.dataobj[
                    int(indices[0]),
                    int(indices[1]),
                    int(indices[2]),
                    :,
                ]
            )
            if sampled.shape != (len(components),):
                raise AtlasUnavailableError(
                    "DiFuMo sampled component count does not match its labels"
                )
            if sampled.dtype.kind not in "fiu":
                raise AtlasUnavailableError(
                    "DiFuMo sampled values must be real numbers"
                )
            values = tuple(float(value) for value in sampled)
            if not np.all(np.isfinite(values)):
                raise AtlasUnavailableError(
                    "DiFuMo sampled values must be finite"
                )
        except AtlasUnavailableError:
            raise
        except (TypeError, ValueError, OverflowError) as exc:
            raise AtlasUnavailableError(
                "DiFuMo sampled values could not be converted"
            ) from exc
        except Exception as exc:
            raise AtlasUnavailableError(
                "DiFuMo atlas data could not be sampled"
            ) from exc

        matches = tuple(
            AtlasMatch(
                id=f"{self.atlas_id}:{component_id}",
                label=label,
                value=value,
            )
            for (component_id, label), value in zip(components, values)
            if value != 0.0
        )
        return self._result(
            tuple(sorted(matches, key=lambda match: (-match.value, match.id)))
        )

    def _load_assets(self):
        if self._loaded is None:
            with self._load_lock:
                if self._loaded is None:
                    self._loaded = self._read_assets()
        return self._loaded

    def _read_assets(self):
        try:
            image = nib.load(self._image_path)
            components = self._read_components()
            if len(image.shape) != 4:
                raise AtlasUnavailableError(
                    "DiFuMo atlas must be a four-dimensional image"
                )
            if image.shape[-1] != len(components):
                raise AtlasUnavailableError(
                    "DiFuMo image component count does not match its labels"
                )
            affine = np.asarray(image.affine, dtype=float)
            if affine.shape != (4, 4) or not np.all(np.isfinite(affine)):
                raise AtlasUnavailableError("DiFuMo affine must be finite")
            inverse_affine = np.linalg.inv(affine)
        except AtlasUnavailableError:
            raise
        except Exception as exc:
            raise AtlasUnavailableError(
                "DiFuMo atlas assets could not be loaded"
            ) from exc
        return image, inverse_affine, components

    def _read_components(self):
        try:
            with self._labels_path.open(
                "r", encoding="utf-8", newline=""
            ) as stream:
                reader = csv.DictReader(stream, strict=True)
                required_fields = ["component_id", "label"]
                if reader.fieldnames != required_fields:
                    raise AtlasUnavailableError(
                        "DiFuMo component table must have normalized columns"
                    )

                by_id = {}
                for row in reader:
                    if set(row) != set(required_fields):
                        raise AtlasUnavailableError(
                            "DiFuMo component table contains invalid records"
                        )
                    try:
                        component_id = int(row["component_id"])
                        label = row["label"].strip()
                    except (
                        AttributeError,
                        KeyError,
                        TypeError,
                        ValueError,
                    ) as exc:
                        raise AtlasUnavailableError(
                            "DiFuMo component table contains invalid rows"
                        ) from exc
                    if component_id in by_id or not label:
                        raise AtlasUnavailableError(
                            "DiFuMo component table contains invalid components"
                        )
                    by_id[component_id] = label
        except AtlasUnavailableError:
            raise
        except (csv.Error, UnicodeError) as exc:
            raise AtlasUnavailableError(
                "DiFuMo component table contains invalid records"
            ) from exc

        expected_ids = set(range(1, len(by_id) + 1))
        if set(by_id) != expected_ids:
            raise AtlasUnavailableError(
                "DiFuMo component IDs must be consecutive and one-based"
            )
        return tuple(
            (component_id, by_id[component_id])
            for component_id in range(1, len(by_id) + 1)
        )

    def _result(self, matches):
        return AtlasResult(
            id=self.atlas_id,
            name=self.atlas_name,
            category="functional",
            value_type="loading",
            version=self._version,
            source_url=self._source_url,
            matches=matches,
        )
