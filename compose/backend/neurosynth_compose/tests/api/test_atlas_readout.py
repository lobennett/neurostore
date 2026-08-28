import copy
from pathlib import Path
import threading

import httpx
from jsonschema import Draft4Validator, ValidationError
import pytest
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT4
import yaml

from neurosynth_compose.atlas_readout import AtlasUnavailableError, Coordinate
from neurosynth_compose.resources import atlases


pytestmark = pytest.mark.anyio

_READOUT_PATH = "/api/atlases/readout"
_INTERNAL_FAILURE = "secret atlas failure at /opt/private/atlas: stderr"


class FakeAtlasReadoutService:
    def __init__(self, failure=None, extra_response=None):
        self.failure = failure
        self.extra_response = extra_response or {}
        self.coordinates = []
        self.thread_ids = []

    def query(self, coordinate):
        self.coordinates.append(coordinate)
        self.thread_ids.append(threading.get_ident())
        if self.failure is not None:
            raise self.failure
        return {
            "coordinate": {
                "x": coordinate.x,
                "y": coordinate.y,
                "z": coordinate.z,
            },
            "space": "MNI152",
            "atlases": [
                {
                    "id": "harvardoxford-cortical",
                    "name": "Harvard–Oxford Cortical Structural Atlas",
                    "category": "anatomical",
                    "valueType": "probability",
                    "version": "2103.0",
                    "sourceUrl": "https://example.org/harvard-oxford",
                    "matches": [
                        {
                            "id": "harvardoxford-cortical:4",
                            "label": "Left frontal region",
                            "value": 54.0,
                        }
                    ],
                },
                {
                    "id": "difumo-512",
                    "name": "DiFuMo 512",
                    "category": "functional",
                    "valueType": "loading",
                    "version": "1.0",
                    "sourceUrl": "https://example.org/difumo",
                    "matches": [],
                },
            ],
            **self.extra_response,
        }


class RecordingLogger:
    def __init__(self):
        self.warnings = []

    def warning(self, message, *args):
        self.warnings.append(message % args)


@pytest.fixture
async def atlas_client(app):
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(
            app=app.asgi_app,
            raise_app_exceptions=False,
        ),
        base_url="https://testserver",
    ) as client:
        yield client


def _install_fake_factory(monkeypatch, service, expected_settings):
    factory_settings = []

    def fake_factory(settings):
        factory_settings.append(settings)
        assert settings is expected_settings
        return service

    monkeypatch.setattr(atlases, "get_atlas_readout_service", fake_factory)
    return factory_settings


async def test_anonymous_readout_preserves_decimals_and_uses_request_settings(
    atlas_client,
    app,
    monkeypatch,
):
    service = FakeAtlasReadoutService()
    factory_settings = _install_fake_factory(monkeypatch, service, app.config)
    event_loop_thread = threading.get_ident()

    response = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "-42.5", "y": "0", "z": "8.25"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json()["coordinate"] == {
        "x": -42.5,
        "y": 0.0,
        "z": 8.25,
    }
    assert "WWW-Authenticate" not in response.headers
    assert factory_settings == [app.config]
    assert service.coordinates == [Coordinate(x=-42.5, y=0.0, z=8.25)]
    assert service.thread_ids != [event_loop_thread]


@pytest.mark.parametrize(
    "params",
    [
        {"y": "0", "z": "0"},
        {"x": "0", "z": "0"},
        {"x": "0", "y": "0"},
        {"x": "not-a-number", "y": "0", "z": "0"},
        {"x": "0", "y": "not-a-number", "z": "0"},
        {"x": "0", "y": "0", "z": "not-a-number"},
        {"x": "NaN", "y": "0", "z": "0"},
        {"x": "0", "y": "NaN", "z": "0"},
        {"x": "0", "y": "0", "z": "NaN"},
        {"x": "Infinity", "y": "0", "z": "0"},
        {"x": "-Infinity", "y": "0", "z": "0"},
        {"x": "0", "y": "Infinity", "z": "0"},
        {"x": "0", "y": "-Infinity", "z": "0"},
        {"x": "0", "y": "0", "z": "Infinity"},
        {"x": "0", "y": "0", "z": "-Infinity"},
        {"x": "-90.0001", "y": "0", "z": "0"},
        {"x": "90.0001", "y": "0", "z": "0"},
        {"x": "0", "y": "-126.0001", "z": "0"},
        {"x": "0", "y": "90.0001", "z": "0"},
        {"x": "0", "y": "0", "z": "-72.0001"},
        {"x": "0", "y": "0", "z": "108.0001"},
    ],
)
async def test_invalid_coordinate_is_rejected_before_factory_or_provider(
    atlas_client,
    monkeypatch,
    params,
):
    factory_calls = []

    def fail_if_factory_is_called(settings):
        factory_calls.append(settings)
        raise AssertionError("invalid requests must not construct the service")

    monkeypatch.setattr(
        atlases,
        "get_atlas_readout_service",
        fail_if_factory_is_called,
    )

    response = await atlas_client.get(_READOUT_PATH, params=params)

    assert response.status_code == 400
    assert response.json()["status"] == 400
    assert factory_calls == []


async def test_valid_boundary_coordinates_reach_the_provider(
    atlas_client,
    app,
    monkeypatch,
):
    service = FakeAtlasReadoutService()
    _install_fake_factory(monkeypatch, service, app.config)

    lower = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "-90", "y": "-126", "z": "-72"},
    )
    upper = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "90", "y": "90", "z": "108"},
    )

    assert lower.status_code == 200
    assert upper.status_code == 200
    assert service.coordinates == [
        Coordinate(x=-90.0, y=-126.0, z=-72.0),
        Coordinate(x=90.0, y=90.0, z=108.0),
    ]


async def test_readout_response_obeys_closed_openapi_schema(
    atlas_client,
    app,
    monkeypatch,
):
    service = FakeAtlasReadoutService()
    _install_fake_factory(monkeypatch, service, app.config)

    response = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "-42.5", "y": "0", "z": "8.25"},
    )

    spec_path = (
        Path(__file__).parents[2] / "openapi" / "neurosynth-compose-openapi.yml"
    )
    spec = yaml.safe_load(spec_path.read_text())
    registry = Registry().with_resource(
        "urn:neurosynth-compose-openapi",
        Resource.from_contents(spec, default_specification=DRAFT4),
    )
    validator = Draft4Validator(
        {
            "$ref": (
                "urn:neurosynth-compose-openapi"
                "#/components/schemas/AtlasReadoutResponse"
            )
        },
        registry=registry,
    )
    validator.validate(response.json())

    closed_schema_mutations = []
    for target_path in (
        (),
        ("coordinate",),
        ("atlases", 0),
        ("atlases", 0, "matches", 0),
    ):
        unexpected = copy.deepcopy(response.json())
        target = unexpected
        for part in target_path:
            target = target[part]
        target["internal"] = "must not be admitted by the public contract"
        closed_schema_mutations.append(unexpected)

    required_schema_mutations = []
    for target_path, field in (
        ((), "space"),
        (("coordinate",), "x"),
        (("atlases", 0), "valueType"),
        (("atlases", 0, "matches", 0), "label"),
    ):
        missing = copy.deepcopy(response.json())
        target = missing
        for part in target_path:
            target = target[part]
        del target[field]
        required_schema_mutations.append(missing)

    invalid_category = copy.deepcopy(response.json())
    invalid_category["atlases"][0]["category"] = "unknown"
    invalid_value_type = copy.deepcopy(response.json())
    invalid_value_type["atlases"][0]["valueType"] = "percentage"

    for invalid in (
        *closed_schema_mutations,
        *required_schema_mutations,
        invalid_category,
        invalid_value_type,
    ):
        with pytest.raises(ValidationError):
            validator.validate(invalid)


async def test_readout_success_has_cors_headers(
    atlas_client,
    app,
    monkeypatch,
):
    service = FakeAtlasReadoutService()
    _install_fake_factory(monkeypatch, service, app.config)
    origin = "https://client.example"

    response = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "0", "y": "0", "z": "0"},
        headers={"Origin": origin},
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert response.headers["Vary"] == "Origin"


async def test_provider_failure_returns_safe_rfc_problem_and_safe_log(
    atlas_client,
    app,
    monkeypatch,
):
    service = FakeAtlasReadoutService(
        failure=AtlasUnavailableError(_INTERNAL_FAILURE)
    )
    _install_fake_factory(monkeypatch, service, app.config)
    recording_logger = RecordingLogger()
    monkeypatch.setattr(app.asgi_app, "logger", recording_logger)

    response = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "1", "y": "2", "z": "3"},
        headers={"Origin": "https://client.example"},
    )

    assert response.status_code == 503
    assert response.headers["content-type"].startswith(
        "application/problem+json"
    )
    assert response.json() == {
        "type": "https://neurostore.org/problems/atlas-readout-unavailable",
        "title": "Atlas readout unavailable",
        "detail": "The configured atlas service is temporarily unavailable.",
        "status": 503,
    }
    assert _INTERNAL_FAILURE not in response.text
    assert len(recording_logger.warnings) == 1
    warning = recording_logger.warnings[0]
    assert _INTERNAL_FAILURE not in warning
    assert "category=required-provider" in warning
    assert "elapsed_seconds=" in warning
    assert response.headers["Access-Control-Allow-Origin"] == (
        "https://client.example"
    )


async def test_unexpected_failure_reaches_safe_global_500_handler(
    atlas_client,
    app,
    monkeypatch,
):
    internal_error = "unexpected internal provider implementation detail"
    service = FakeAtlasReadoutService(failure=RuntimeError(internal_error))
    _install_fake_factory(monkeypatch, service, app.config)

    response = await atlas_client.get(
        _READOUT_PATH,
        params={"x": "1", "y": "2", "z": "3"},
    )

    assert response.status_code == 500
    assert response.json()["title"] == "Internal Server Error"
    assert internal_error not in response.text
