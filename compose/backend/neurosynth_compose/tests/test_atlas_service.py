"""Deterministic orchestration and construction of atlas readouts."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
import json
import os
from pathlib import Path
import shlex
import threading

import nibabel as nib
import numpy as np
import pytest

import neurosynth_compose.atlas_readout.service as atlas_service_module
from neurosynth_compose.atlas_readout import (
    AtlasMatch,
    AtlasReadoutService,
    AtlasResult,
    AtlasUnavailableError,
    Coordinate,
    get_atlas_readout_service,
)
from neurosynth_compose.config import Config


ATLAS_IDS = (
    "harvardoxford-cortical",
    "harvardoxford-subcortical",
    "difumo-512",
)


def _result(atlas_id, value):
    anatomical = atlas_id != "difumo-512"
    return AtlasResult(
        id=atlas_id,
        name=atlas_id,
        category="anatomical" if anatomical else "functional",
        value_type="probability" if anatomical else "loading",
        version="atlas-version",
        source_url="https://example.com/atlas",
        matches=(AtlasMatch(f"{atlas_id}:1", "Match", value),),
    )


class RecordingProvider:
    def __init__(self, result, failure=None):
        self.result = result
        self.failure = failure
        self.coordinates = []

    def query(self, coordinate):
        self.coordinates.append(coordinate)
        if self.failure is not None:
            raise self.failure
        return self.result


class CoordinateBlockingProvider(RecordingProvider):
    def __init__(self, result, blocked_coordinate):
        super().__init__(result)
        self.blocked_coordinate = blocked_coordinate
        self.entered = threading.Event()
        self.release = threading.Event()

    def query(self, coordinate):
        self.coordinates.append(coordinate)
        if coordinate == self.blocked_coordinate:
            self.entered.set()
            if not self.release.wait(timeout=2):
                raise AssertionError("blocked provider was not released")
        return self.result


class OverlapProvider(RecordingProvider):
    def __init__(self, result):
        super().__init__(result)
        self._active_lock = threading.Lock()
        self._active = 0
        self.two_active = threading.Event()
        self.release = threading.Event()

    def query(self, coordinate):
        with self._active_lock:
            self.coordinates.append(coordinate)
            self._active += 1
            if self._active == 2:
                self.two_active.set()
        try:
            if not self.release.wait(timeout=2):
                raise AssertionError("overlapping providers were not released")
            return self.result
        finally:
            with self._active_lock:
                self._active -= 1


class FailFirstBlockingProvider(RecordingProvider):
    def __init__(self, result):
        super().__init__(result)
        self._attempt_lock = threading.Lock()
        self.entered = threading.Event()
        self.release = threading.Event()

    def query(self, coordinate):
        with self._attempt_lock:
            self.coordinates.append(coordinate)
            attempt = len(self.coordinates)
        if attempt == 1:
            self.entered.set()
            if not self.release.wait(timeout=2):
                raise AssertionError("failing provider was not released")
            raise RuntimeError("provider details")
        return self.result


class SameKeyReentrantProvider(RecordingProvider):
    def __init__(self, result):
        super().__init__(result)
        self.service = None

    def query(self, coordinate):
        self.coordinates.append(coordinate)
        return self.service.query(coordinate)


class WaiterReportingCondition:
    """Report a waiter at the condition boundary without changing locking."""

    def __init__(self, condition, waiter_ready):
        self._condition = condition
        self._waiter_ready = waiter_ready

    def wait(self, timeout=None):
        self._waiter_ready.set()
        return self._condition.wait(timeout)

    def notify_all(self):
        self._condition.notify_all()


def _install_waiter_ready_handshake(monkeypatch):
    """Expose the instant a same-key caller enters the real condition wait."""

    waiter_ready = threading.Event()
    original_in_flight = atlas_service_module._InFlightQuery

    class WaiterReportingInFlight(original_in_flight):
        def __init__(self, cache_lock):
            super().__init__(cache_lock)
            self.condition = WaiterReportingCondition(
                self.condition, waiter_ready
            )

    monkeypatch.setattr(
        atlas_service_module, "_InFlightQuery", WaiterReportingInFlight
    )
    return waiter_ready


def _providers(**overrides):
    providers = {
        atlas_id: RecordingProvider(_result(atlas_id, index + 1.0))
        for index, atlas_id in enumerate(ATLAS_IDS)
    }
    providers.update(overrides)
    return providers


def test_service_returns_fixed_order_regardless_of_mapping_order():
    providers = _providers()
    reversed_providers = {
        atlas_id: providers[atlas_id] for atlas_id in reversed(ATLAS_IDS)
    }
    service = AtlasReadoutService(
        reversed_providers,
        manifest_version="manifest-v1",
        cache_size=8,
    )
    coordinate = Coordinate(-42.5, 0.0, 8.25)

    payload = service.query(coordinate)

    assert payload == {
        "coordinate": {"x": -42.5, "y": 0.0, "z": 8.25},
        "space": "MNI152",
        "atlases": [
            providers[atlas_id].result.to_dict() for atlas_id in ATLAS_IDS
        ],
    }


def test_service_reuses_exact_coordinate_and_returns_fresh_serialization():
    providers = _providers()
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    coordinate = Coordinate(-42.5, 0.0, 8.25)

    first = service.query(coordinate)
    first["coordinate"]["x"] = 90.0
    first["atlases"][0]["matches"][0]["label"] = "caller mutation"
    second = service.query(coordinate)

    assert second["coordinate"]["x"] == -42.5
    assert second["atlases"][0]["matches"][0]["label"] == "Match"
    assert [len(provider.coordinates) for provider in providers.values()] == [
        1,
        1,
        1,
    ]


def test_service_does_not_round_coordinate_cache_keys():
    providers = _providers()
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)

    service.query(Coordinate(-42.5, 0.0, 8.25))
    service.query(Coordinate(-42.5001, 0.0, 8.25))

    assert [len(provider.coordinates) for provider in providers.values()] == [
        2,
        2,
        2,
    ]


def test_service_manifest_version_is_part_of_the_cache_key():
    providers = _providers()
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    coordinate = Coordinate(-42.5, 0.0, 8.25)

    service.query(coordinate)
    service._manifest_version = "manifest-v2"
    service.query(coordinate)

    assert [len(provider.coordinates) for provider in providers.values()] == [
        2,
        2,
        2,
    ]


def test_service_uses_bounded_least_recently_used_eviction():
    providers = _providers()
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=2)
    first = Coordinate(1.0, 0.0, 0.0)
    second = Coordinate(2.0, 0.0, 0.0)
    third = Coordinate(3.0, 0.0, 0.0)

    service.query(first)
    service.query(second)
    service.query(first)
    service.query(third)
    service.query(second)

    assert [len(provider.coordinates) for provider in providers.values()] == [
        4,
        4,
        4,
    ]


def test_cached_hit_completes_while_unrelated_slow_miss_is_in_flight():
    cached = Coordinate(1.0, 0.0, 0.0)
    slow = Coordinate(2.0, 0.0, 0.0)
    cortical = CoordinateBlockingProvider(_result(ATLAS_IDS[0], 1.0), slow)
    providers = _providers(**{ATLAS_IDS[0]: cortical})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    service.query(cached)

    with ThreadPoolExecutor(max_workers=2) as executor:
        slow_future = executor.submit(service.query, slow)
        assert cortical.entered.wait(timeout=1)
        hit_future = executor.submit(service.query, cached)
        try:
            hit = hit_future.result(timeout=0.5)
        except FutureTimeout:
            pytest.fail("cached hit waited for an unrelated provider query")
        finally:
            cortical.release.set()
        slow_payload = slow_future.result(timeout=1)

    assert hit["coordinate"] == {"x": 1.0, "y": 0.0, "z": 0.0}
    assert slow_payload["coordinate"] == {"x": 2.0, "y": 0.0, "z": 0.0}


def test_distinct_slow_cache_misses_execute_providers_concurrently():
    cortical = OverlapProvider(_result(ATLAS_IDS[0], 1.0))
    providers = _providers(**{ATLAS_IDS[0]: cortical})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    first = Coordinate(1.0, 0.0, 0.0)
    second = Coordinate(2.0, 0.0, 0.0)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(service.query, first)
        second_future = executor.submit(service.query, second)
        try:
            assert cortical.two_active.wait(timeout=0.5)
        finally:
            cortical.release.set()
        first_payload = first_future.result(timeout=1)
        second_payload = second_future.result(timeout=1)

    assert first_payload["coordinate"]["x"] == 1.0
    assert second_payload["coordinate"]["x"] == 2.0


def test_same_key_concurrent_calls_query_once_and_serialize_independently(
    monkeypatch,
):
    coordinate = Coordinate(1.0, 0.0, 0.0)
    cortical = CoordinateBlockingProvider(
        _result(ATLAS_IDS[0], 1.0), coordinate
    )
    providers = _providers(**{ATLAS_IDS[0]: cortical})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    waiter_ready = _install_waiter_ready_handshake(monkeypatch)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(service.query, coordinate)
        assert cortical.entered.wait(timeout=1)
        second_future = executor.submit(service.query, coordinate)
        assert waiter_ready.wait(timeout=1)
        cortical.release.set()
        first = first_future.result(timeout=1)
        second = second_future.result(timeout=1)

    first["atlases"][0]["matches"][0]["label"] = "caller mutation"
    assert second["atlases"][0]["matches"][0]["label"] == "Match"
    assert first is not second
    assert [len(provider.coordinates) for provider in providers.values()] == [
        1,
        1,
        1,
    ]


def test_same_key_failure_wakes_waiters_and_does_not_poison_retry(monkeypatch):
    coordinate = Coordinate(1.0, 0.0, 0.0)
    cortical = FailFirstBlockingProvider(_result(ATLAS_IDS[0], 1.0))
    providers = _providers(**{ATLAS_IDS[0]: cortical})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    waiter_ready = _install_waiter_ready_handshake(monkeypatch)

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(service.query, coordinate)
        assert cortical.entered.wait(timeout=1)
        second_future = executor.submit(service.query, coordinate)
        assert waiter_ready.wait(timeout=1)
        cortical.release.set()
        with pytest.raises(AtlasUnavailableError):
            first_future.result(timeout=1)
        with pytest.raises(AtlasUnavailableError):
            second_future.result(timeout=1)

    assert len(cortical.coordinates) == 1
    recovered = service.query(coordinate)
    assert recovered["coordinate"] == {"x": 1.0, "y": 0.0, "z": 0.0}
    assert len(cortical.coordinates) == 2


def test_same_thread_same_key_reentrancy_fails_instead_of_deadlocking():
    coordinate = Coordinate(1.0, 0.0, 0.0)
    cortical = SameKeyReentrantProvider(_result(ATLAS_IDS[0], 1.0))
    providers = _providers(**{ATLAS_IDS[0]: cortical})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    cortical.service = service

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(service.query, coordinate)
        try:
            with pytest.raises(AtlasUnavailableError):
                future.result(timeout=0.5)
        except FutureTimeout:
            with service._cache_lock:
                in_flight = next(iter(service._in_flight.values()))
                in_flight.failed = True
                in_flight.complete = True
                service._in_flight.clear()
                in_flight.condition.notify_all()
            pytest.fail("same-key recursive query deadlocked its owner")


@pytest.mark.parametrize(
    "failure",
    [AtlasUnavailableError("provider unavailable"), RuntimeError("details")],
)
def test_service_normalizes_provider_failure_without_caching_partial_state(
    failure,
):
    failing = RecordingProvider(_result(ATLAS_IDS[1], 2.0), failure=failure)
    providers = _providers(**{ATLAS_IDS[1]: failing})
    service = AtlasReadoutService(providers, "manifest-v1", cache_size=8)
    coordinate = Coordinate(-42.5, 0.0, 8.25)

    with pytest.raises(AtlasUnavailableError, match="Atlas readout is unavailable"):
        service.query(coordinate)
    with pytest.raises(AtlasUnavailableError):
        service.query(coordinate)

    assert len(providers[ATLAS_IDS[0]].coordinates) == 2
    assert len(failing.coordinates) == 2
    assert providers[ATLAS_IDS[2]].coordinates == []


@pytest.mark.parametrize(
    "providers",
    [
        {},
        {
            **_providers(),
            "unexpected": RecordingProvider(_result(ATLAS_IDS[0], 1)),
        },
        {
            atlas_id: provider
            for atlas_id, provider in _providers().items()
            if atlas_id != ATLAS_IDS[2]
        },
    ],
)
def test_service_requires_exactly_the_three_fixed_providers(providers):
    with pytest.raises(AtlasUnavailableError):
        AtlasReadoutService(providers, "manifest-v1", cache_size=8)


@pytest.mark.parametrize("cache_size", [True, 0, -1, 1.5, "8"])
def test_service_rejects_invalid_cache_size(cache_size):
    with pytest.raises(AtlasUnavailableError):
        AtlasReadoutService(_providers(), "manifest-v1", cache_size=cache_size)


def _valid_manifest():
    return {
        "schemaVersion": 1,
        "space": "MNI152",
        "fsl": {
            "sourceUrl": "https://example.com/harvard-oxford",
            "packages": {"fsl-data_atlases": "2103.0"},
            "atlasIds": list(ATLAS_IDS[:2]),
            "labelIndexMaps": {
                ATLAS_IDS[0]: [
                    {"index": index, "label": f"Cortical {index}"}
                    for index in range(48)
                ],
                ATLAS_IDS[1]: [
                    {"index": index, "label": f"Subcortical {index}"}
                    for index in range(21)
                ],
            },
        },
        "difumo": {
            "name": "DiFuMo 512",
            "version": "version 1",
            "dimension": 512,
            "resolutionMm": 2,
            "interpolation": "nearest",
            "canonicalUrl": "https://example.com/difumo",
            "assets": [
                {
                    "filename": "difumo-512-2mm.nii.gz",
                    "sha256": "1" * 64,
                    "bytes": 1,
                },
                {
                    "filename": "difumo-512-labels.csv",
                    "sha256": "2" * 64,
                    "bytes": 1,
                },
            ],
        },
    }


def _runtime_settings(tmp_path, manifest=None):
    fsl_dir = tmp_path / "fsl"
    difumo_dir = tmp_path / "difumo"
    executable = fsl_dir / "bin" / "atlasq"
    executable.parent.mkdir(parents=True)
    executable.write_text(
        "#!/bin/sh\n"
        "if [ \"$2\" = \"harvardoxford-cortical\" ]; then\n"
        "  printf 'coordinate\\t0 0 0\\tCortical 0 25.0\\n'\n"
        "else\n"
        "  printf 'coordinate\\t0 0 0\\tSubcortical 0 50.0\\n'\n"
        "fi\n",
        encoding="utf-8",
    )
    executable.chmod(0o755)

    difumo_dir.mkdir()
    values = np.zeros((1, 1, 1, 512), dtype=np.float32)
    values[0, 0, 0, 0] = 0.75
    nib.save(
        nib.Nifti1Image(values, np.eye(4)),
        difumo_dir / "difumo-512-2mm.nii.gz",
    )
    (difumo_dir / "difumo-512-labels.csv").write_text(
        "component_id,label\n"
        + "".join(f"{index},Mode {index}\n" for index in range(1, 513)),
        encoding="utf-8",
    )

    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps(_valid_manifest() if manifest is None else manifest),
        encoding="utf-8",
    )
    return {
        "ATLAS_FSLDIR": fsl_dir,
        "ATLAS_DIFUMO_DIR": difumo_dir,
        "ATLAS_MANIFEST": manifest_path,
        "ATLAS_QUERY_TIMEOUT_SECONDS": 1.0,
        "ATLAS_CACHE_SIZE": 2,
    }


def test_factory_builds_fixed_providers_and_memoizes_by_frozen_config(tmp_path):
    settings = _runtime_settings(tmp_path)

    first = get_atlas_readout_service(settings)
    second = get_atlas_readout_service(dict(settings))
    payload = first.query(Coordinate(0.0, 0.0, 0.0))

    assert first is second
    assert [atlas["id"] for atlas in payload["atlases"]] == list(ATLAS_IDS)
    assert payload["atlases"][0]["matches"][0] == {
        "id": f"{ATLAS_IDS[0]}:0",
        "label": "Cortical 0",
        "value": 25.0,
    }
    assert payload["atlases"][1]["matches"][0]["id"] == (
        f"{ATLAS_IDS[1]}:0"
    )
    assert payload["atlases"][2]["matches"][0] == {
        "id": "difumo-512:1",
        "label": "Mode 1",
        "value": 0.75,
    }

    changed = {**settings, "ATLAS_CACHE_SIZE": 3}
    assert get_atlas_readout_service(changed) is not first


def test_factory_supplies_configured_fsldir_and_preserves_ambient_env(
    tmp_path, monkeypatch
):
    settings = _runtime_settings(tmp_path)
    configured_fsldir = str(settings["ATLAS_FSLDIR"])
    ambient_fsldir = str(tmp_path / "conflicting-ambient-fsl")
    atlasq = Path(configured_fsldir) / "bin" / "atlasq"
    atlasq.write_text(
        "#!/bin/sh\n"
        f"test \"$FSLDIR\" = {shlex.quote(configured_fsldir)} || exit 17\n"
        'test "$ATLAS_TEST_SENTINEL" = preserved || exit 18\n'
        'if [ "$2" = "harvardoxford-cortical" ]; then\n'
        "  printf 'coordinate\\t0 0 0\\tCortical 0 25.0\\n'\n"
        "else\n"
        "  printf 'coordinate\\t0 0 0\\tSubcortical 0 50.0\\n'\n"
        "fi\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("FSLDIR", ambient_fsldir)
    monkeypatch.setenv("ATLAS_TEST_SENTINEL", "preserved")

    payload = get_atlas_readout_service(settings).query(
        Coordinate(0.0, 0.0, 0.0)
    )

    assert [atlas["id"] for atlas in payload["atlases"]] == list(ATLAS_IDS)
    assert os.environ["FSLDIR"] == ambient_fsldir
    assert os.environ["ATLAS_TEST_SENTINEL"] == "preserved"


def test_factory_uses_manifest_content_as_service_cache_version(tmp_path):
    settings_v1 = _runtime_settings(tmp_path / "v1")
    manifest_v2 = _valid_manifest()
    manifest_v2["difumo"]["version"] = "version 2"
    settings_v2 = _runtime_settings(tmp_path / "v2", manifest=manifest_v2)

    service_v1 = get_atlas_readout_service(settings_v1)
    service_v2 = get_atlas_readout_service(settings_v2)

    assert service_v1._manifest_version != service_v2._manifest_version


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("ATLAS_FSLDIR", ""),
        ("ATLAS_DIFUMO_DIR", object()),
        ("ATLAS_MANIFEST", None),
        ("ATLAS_QUERY_TIMEOUT_SECONDS", True),
        ("ATLAS_QUERY_TIMEOUT_SECONDS", 0),
        ("ATLAS_QUERY_TIMEOUT_SECONDS", float("inf")),
        ("ATLAS_CACHE_SIZE", True),
        ("ATLAS_CACHE_SIZE", 0),
        ("ATLAS_CACHE_SIZE", 2.5),
    ],
)
def test_factory_rejects_invalid_settings_safely(tmp_path, key, value):
    settings = _runtime_settings(tmp_path)
    settings[key] = value

    with pytest.raises(AtlasUnavailableError, match="configuration is invalid"):
        get_atlas_readout_service(settings)


def test_factory_rejects_missing_required_setting(tmp_path):
    settings = _runtime_settings(tmp_path)
    del settings["ATLAS_MANIFEST"]

    with pytest.raises(AtlasUnavailableError, match="configuration is invalid"):
        get_atlas_readout_service(settings)


@pytest.mark.parametrize(
    "manifest_update",
    [
        {"space": "Talairach"},
        {"schemaVersion": 0},
        {"schemaVersion": 2},
        {"fsl": {"atlasIds": [ATLAS_IDS[1], ATLAS_IDS[0]]}},
        {"difumo": {"dimension": 511}},
        {"difumo": {"dimension": 512.0}},
        {"fsl": {"sourceUrl": "ftp://example.com/atlas"}},
        {"difumo": {"canonicalUrl": "http://example.com/difumo"}},
    ],
)
def test_factory_rejects_invalid_manifest_safely(tmp_path, manifest_update):
    manifest = _valid_manifest()
    for section, value in manifest_update.items():
        if isinstance(value, dict):
            manifest[section].update(value)
        else:
            manifest[section] = value
    settings = _runtime_settings(tmp_path, manifest=manifest)

    with pytest.raises(AtlasUnavailableError, match="manifest is invalid"):
        get_atlas_readout_service(settings)


def test_factory_rejects_malformed_manifest_without_leaking_path(tmp_path):
    settings = _runtime_settings(tmp_path)
    Path(settings["ATLAS_MANIFEST"]).write_text("not json", encoding="utf-8")

    with pytest.raises(AtlasUnavailableError) as error:
        get_atlas_readout_service(settings)

    assert "manifest is unavailable" in str(error.value)
    assert str(tmp_path) not in str(error.value)


@pytest.mark.parametrize(
    "missing_relative_path",
    [
        Path("fsl/bin/atlasq"),
        Path("difumo/difumo-512-2mm.nii.gz"),
        Path("difumo/difumo-512-labels.csv"),
    ],
)
def test_factory_rejects_missing_runtime_files_safely(
    tmp_path, missing_relative_path
):
    settings = _runtime_settings(tmp_path)
    (tmp_path / missing_relative_path).unlink()

    with pytest.raises(AtlasUnavailableError) as error:
        get_atlas_readout_service(settings)

    assert "runtime is unavailable" in str(error.value)
    assert str(tmp_path) not in str(error.value)


def test_config_declares_the_five_deployment_defaults():
    assert Config.ATLAS_FSLDIR == Path("/opt/decoder-atlases")
    assert Config.ATLAS_DIFUMO_DIR == Path(
        "/opt/decoder-atlases/data/difumo-512"
    )
    assert Config.ATLAS_MANIFEST == Path("/opt/decoder-atlases/manifest.json")
    assert Config.ATLAS_QUERY_TIMEOUT_SECONDS == 2.0
    assert Config.ATLAS_CACHE_SIZE == 512
