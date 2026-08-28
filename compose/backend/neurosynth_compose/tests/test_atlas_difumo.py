import csv
from concurrent.futures import ThreadPoolExecutor
from dataclasses import FrozenInstanceError
import time
import warnings

import nibabel as nib
import numpy as np
import pytest

from neurosynth_compose.atlas_readout import (
    AtlasMatch,
    AtlasResult,
    AtlasUnavailableError,
    Coordinate,
    DifumoAtlasProvider,
    InvalidCoordinateError,
)


AFFINE = np.array(
    [
        [2.0, 0.0, 0.0, 10.0],
        [0.0, -2.0, 0.0, -6.0],
        [0.0, 0.0, 4.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
)
LABELS = [
    (1, "Mode one"),
    (2, "Mode two"),
    (3, "Mode three"),
    (4, "Mode four"),
]


def _write_assets(tmp_path, data=None, labels=LABELS):
    if data is None:
        data = np.zeros((3, 3, 3, 4), dtype=np.float32)
        data[1, 1, 1, :] = [0.25, 0.0, 0.75, 0.0]

    image_path = tmp_path / "difumo.nii.gz"
    nib.save(nib.Nifti1Image(data, AFFINE), image_path)

    labels_path = tmp_path / "labels.csv"
    with labels_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=["component_id", "label"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(
            {"component_id": component_id, "label": label}
            for component_id, label in labels
        )
    return image_path, labels_path


def _provider(tmp_path, data=None, labels=LABELS):
    image_path, labels_path = _write_assets(tmp_path, data, labels)
    return DifumoAtlasProvider(
        image_path=image_path,
        labels_path=labels_path,
        version="synthetic-v1",
        source_url="https://example.test/difumo",
    )


def _provider_with_labels_csv(tmp_path, payload):
    image_path, labels_path = _write_assets(tmp_path)
    labels_path.write_text(payload, encoding="utf-8")
    return DifumoAtlasProvider(
        image_path=image_path,
        labels_path=labels_path,
        version="synthetic-v1",
        source_url="https://example.test/difumo",
    )


@pytest.mark.parametrize(
    ("values", "message"),
    [
        ({"x": float("nan"), "y": 0.0, "z": 0.0}, "finite"),
        ({"x": float("inf"), "y": 0.0, "z": 0.0}, "finite"),
        ({"x": -90.0001, "y": 0.0, "z": 0.0}, "x"),
        ({"x": 90.0001, "y": 0.0, "z": 0.0}, "x"),
        ({"x": 0.0, "y": -126.0001, "z": 0.0}, "y"),
        ({"x": 0.0, "y": 90.0001, "z": 0.0}, "y"),
        ({"x": 0.0, "y": 0.0, "z": -72.0001}, "z"),
        ({"x": 0.0, "y": 0.0, "z": 108.0001}, "z"),
    ],
)
def test_coordinate_rejects_nonfinite_and_out_of_mni_values(values, message):
    with pytest.raises(InvalidCoordinateError, match=message):
        Coordinate(**values)


def test_coordinate_accepts_exact_mni_bounds_and_is_immutable():
    lower = Coordinate(x=-90.0, y=-126.0, z=-72.0)
    upper = Coordinate(x=90.0, y=90.0, z=108.0)

    assert lower == Coordinate(x=-90.0, y=-126.0, z=-72.0)
    assert upper == Coordinate(x=90.0, y=90.0, z=108.0)
    with pytest.raises(FrozenInstanceError):
        lower.x = 0.0


def test_atlas_result_serializes_api_names_and_rejects_nonfinite_matches():
    match = AtlasMatch(id="difumo-512:1", label="Mode one", value=0.25)
    result = AtlasResult(
        id="difumo-512",
        name="DiFuMo 512",
        category="functional",
        value_type="loading",
        version="synthetic-v1",
        source_url="https://example.test/difumo",
        matches=(match,),
    )

    assert result.to_dict() == {
        "id": "difumo-512",
        "name": "DiFuMo 512",
        "category": "functional",
        "valueType": "loading",
        "version": "synthetic-v1",
        "sourceUrl": "https://example.test/difumo",
        "matches": [
            {"id": "difumo-512:1", "label": "Mode one", "value": 0.25}
        ],
    }
    with pytest.raises(FrozenInstanceError):
        match.value = 1.0
    with pytest.raises(AtlasUnavailableError, match="finite"):
        AtlasResult(
            id="difumo-512",
            name="DiFuMo 512",
            category="functional",
            value_type="loading",
            version="synthetic-v1",
            source_url="https://example.test/difumo",
            matches=(
                AtlasMatch(
                    id="difumo-512:1",
                    label="Mode one",
                    value=float("nan"),
                ),
            ),
        )


def test_provider_samples_nonidentity_affine_and_returns_native_loadings(tmp_path):
    provider = _provider(tmp_path)

    result = provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))

    assert result.id == "difumo-512"
    assert result.name == "DiFuMo 512"
    assert result.category == "functional"
    assert result.value_type == "loading"
    assert result.version == "synthetic-v1"
    assert result.source_url == "https://example.test/difumo"
    assert [(match.id, match.label, match.value) for match in result.matches] == [
        ("difumo-512:3", "Mode three", 0.75),
        ("difumo-512:1", "Mode one", 0.25),
    ]


def test_provider_keeps_signed_values_and_filters_only_exact_zero(tmp_path):
    data = np.zeros((3, 3, 3, 4), dtype=np.float32)
    data[1, 1, 1, :] = [-0.125, -0.0, 0.5, 0.0]
    provider = _provider(tmp_path, data)

    result = provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))

    assert [(match.id, match.value) for match in result.matches] == [
        ("difumo-512:3", 0.5),
        ("difumo-512:1", -0.125),
    ]


def test_provider_uses_floor_plus_half_for_half_voxel_positions(tmp_path):
    data = np.zeros((3, 3, 3, 4), dtype=np.float32)
    data[0, 0, 0, 0] = 0.875
    data[1, 0, 0, 3] = 0.625
    provider = _provider(tmp_path, data)

    result = provider.query(Coordinate(x=11.0, y=-6.0, z=0.0))

    assert [(match.id, match.value) for match in result.matches] == [
        ("difumo-512:4", 0.625)
    ]


def test_provider_returns_empty_matches_outside_image_coverage(tmp_path):
    provider = _provider(tmp_path)

    result = provider.query(Coordinate(x=20.0, y=-8.0, z=4.0))

    assert result.matches == ()


@pytest.mark.parametrize(
    "labels",
    [
        LABELS[:-1],
        [(1, "Mode one"), (2, "Mode two"), (3, "Mode three"), (5, "Mode five")],
    ],
)
def test_provider_rejects_component_count_or_id_mismatch(tmp_path, labels):
    provider = _provider(tmp_path, labels=labels)

    with pytest.raises(AtlasUnavailableError, match="component"):
        provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))


@pytest.mark.parametrize(
    "payload",
    [
        "component_id,label\n"
        "1,Mode one,unexpected\n"
        "2,Mode two\n"
        "3,Mode three\n"
        "4,Mode four\n",
        "component_id,label\n"
        '1,"Mode one"unexpected\n'
        "2,Mode two\n"
        "3,Mode three\n"
        "4,Mode four\n",
        "component_id,label\n"
        "1\n"
        "2,Mode two\n"
        "3,Mode three\n"
        "4,Mode four\n",
        "component_id,label\n"
        "1,   \n"
        "2,Mode two\n"
        "3,Mode three\n"
        "4,Mode four\n",
        "component_id,label,unexpected\n"
        "1,Mode one,value\n"
        "2,Mode two,value\n"
        "3,Mode three,value\n"
        "4,Mode four,value\n",
    ],
    ids=[
        "extra column",
        "broken quoting",
        "missing field",
        "blank value",
        "unexpected key",
    ],
)
def test_provider_rejects_malformed_component_records(tmp_path, payload):
    provider = _provider_with_labels_csv(tmp_path, payload)

    with pytest.raises(AtlasUnavailableError, match="component|assets"):
        provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))


@pytest.mark.parametrize("nonfinite", [float("nan"), float("inf"), -float("inf")])
def test_provider_rejects_nonfinite_sampled_voxels(tmp_path, nonfinite):
    data = np.zeros((3, 3, 3, 4), dtype=np.float32)
    data[1, 1, 1, 2] = nonfinite
    provider = _provider(tmp_path, data)

    with pytest.raises(AtlasUnavailableError, match="finite"):
        provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))


def test_provider_rejects_finite_complex_voxels_without_conversion_warning(
    tmp_path,
):
    data = np.zeros((3, 3, 3, 4), dtype=np.complex64)
    data[1, 1, 1, 2] = 0.75 + 0.25j
    provider = _provider(tmp_path, data)

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        with pytest.raises(AtlasUnavailableError, match="real"):
            provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))

    assert not any(
        issubclass(warning.category, np.exceptions.ComplexWarning)
        for warning in caught
    )


def test_provider_normalizes_unsupported_sample_dtype_errors(
    tmp_path, monkeypatch
):
    provider = _provider(tmp_path)

    class UnsupportedData:
        def __getitem__(self, key):
            return np.asarray([object(), object(), object(), object()])

    class UnsupportedImage:
        shape = (3, 3, 3, 4)
        affine = AFFINE
        dataobj = UnsupportedData()

    monkeypatch.setattr(nib, "load", lambda path: UnsupportedImage())

    with pytest.raises(AtlasUnavailableError, match="sampled"):
        provider.query(Coordinate(x=12.0, y=-8.0, z=4.0))


def test_provider_loads_assets_lazily_once_for_concurrent_queries(
    tmp_path, monkeypatch
):
    provider = _provider(tmp_path)
    real_load = nib.load
    load_count = 0

    def observed_load(path):
        nonlocal load_count
        load_count += 1
        time.sleep(0.02)
        return real_load(path)

    monkeypatch.setattr(nib, "load", observed_load)

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(
            executor.map(
                provider.query,
                [Coordinate(x=12.0, y=-8.0, z=4.0)] * 8,
            )
        )

    assert load_count == 1
    assert all(result == results[0] for result in results)
