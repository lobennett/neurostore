import subprocess

import pytest

from neurosynth_compose.atlas_readout.fsl import (
    FslAtlasProvider,
    SubprocessAtlasRunner,
    parse_short_query,
)
from neurosynth_compose.atlas_readout.types import (
    AtlasUnavailableError,
    Coordinate,
)


ATLASQ = "/opt/decoder-atlases/bin/atlasq"


class RecordingRunner:
    def __init__(self, output):
        self.output = output
        self.calls = []

    def run(self, arguments, timeout_seconds):
        self.calls.append((list(arguments), timeout_seconds))
        return self.output


def _provider(
    runner,
    atlas_id="harvardoxford-cortical",
    label_ids=None,
):
    if label_ids is None:
        label_ids = {
            "Superior Parietal Lobule": "17",
            "Angular Gyrus": "20",
        }
    return FslAtlasProvider(
        atlas_id=atlas_id,
        label_ids=label_ids,
        version="2103.0",
        source_url=(
            "https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html"
        ),
        executable=ATLASQ,
        timeout_seconds=1.25,
        runner=runner,
    )


def test_parse_short_query_preserves_recorded_probabilities_and_label_ids():
    output = (
        "coordinate\t38.00 -44.00 48.00\tSuperior Parietal Lobule 45.0000"
        "\tAngular Gyrus 12.0000\n"
    )

    matches = parse_short_query(
        output,
        "harvardoxford-cortical",
        {"Superior Parietal Lobule": "17", "Angular Gyrus": "20"},
    )

    assert [(match.id, match.label, match.value) for match in matches] == [
        (
            "harvardoxford-cortical:17",
            "Superior Parietal Lobule",
            45.0,
        ),
        ("harvardoxford-cortical:20", "Angular Gyrus", 12.0),
    ]


def test_parse_short_query_uses_final_numeric_token_for_complex_labels():
    output = (
        "coordinate\t0 0 0\tArea 8, division 1 12.5"
        "\tHeschl's Gyrus (includes H1 and H2) 3.25\n"
    )

    matches = parse_short_query(
        output,
        "harvardoxford-cortical",
        {
            "Area 8, division 1": "8",
            "Heschl's Gyrus (includes H1 and H2)": "44",
        },
    )

    assert [(match.id, match.label, match.value) for match in matches] == [
        ("harvardoxford-cortical:8", "Area 8, division 1", 12.5),
        (
            "harvardoxford-cortical:44",
            "Heschl's Gyrus (includes H1 and H2)",
            3.25,
        ),
    ]


def test_parse_short_query_removes_zero_and_sorts_ties_by_stable_id():
    output = (
        "coordinate\t0 0 0\tZero label 0.0000\tLater label 25.0"
        "\tEarlier label 25.0\tSmall label 2.0\n"
    )

    matches = parse_short_query(
        output,
        "harvardoxford-cortical",
        {
            "Zero label": "0",
            "Later label": "20",
            "Earlier label": "17",
            "Small label": "3",
        },
    )

    assert [(match.id, match.value) for match in matches] == [
        ("harvardoxford-cortical:17", 25.0),
        ("harvardoxford-cortical:20", 25.0),
        ("harvardoxford-cortical:3", 2.0),
    ]


def test_parse_short_query_allows_one_empty_coordinate_result():
    matches = parse_short_query(
        "coordinate\t90.0 90.0 108.0\n",
        "harvardoxford-cortical",
        {"Frontal Pole": "0"},
    )

    assert matches == ()


@pytest.mark.parametrize(
    "probability",
    ["nan", "inf", "-inf", "-0.0001", "100.0001", "not-a-number"],
)
def test_parse_short_query_rejects_invalid_probabilities(probability):
    output = f"coordinate\t0 0 0\tFrontal Pole {probability}\n"

    with pytest.raises(AtlasUnavailableError, match="output is invalid"):
        parse_short_query(
            output,
            "harvardoxford-cortical",
            {"Frontal Pole": "0"},
        )


def test_parse_short_query_rejects_unknown_labels_without_leaking_them():
    output = "coordinate\t0 0 0\tSecret unknown label 25.0\n"

    with pytest.raises(AtlasUnavailableError) as error:
        parse_short_query(
            output,
            "harvardoxford-cortical",
            {"Frontal Pole": "0"},
        )

    assert str(error.value) == "Atlas query output is invalid"
    assert "Secret unknown label" not in str(error.value)


@pytest.mark.parametrize(
    "output",
    [
        "",
        "label\t0 0 0\tFrontal Pole 1.0\n",
        "coordinate\t0 0\tFrontal Pole 1.0\n",
        "coordinate\t0 0 0\tFrontal Pole 1.0\n"
        "coordinate\t1 1 1\tFrontal Pole 2.0\n",
        "coordinate\t0 0 0\t\n",
    ],
    ids=[
        "empty",
        "wrong record type",
        "invalid coordinate field",
        "multiple records",
        "empty match field",
    ],
)
def test_parse_short_query_rejects_malformed_records(output):
    with pytest.raises(AtlasUnavailableError, match="output is invalid"):
        parse_short_query(
            output,
            "harvardoxford-cortical",
            {"Frontal Pole": "0"},
        )


def test_subprocess_runner_uses_bounded_shell_free_contract(monkeypatch):
    observed = {}

    def fake_run(arguments, **kwargs):
        observed["arguments"] = arguments
        observed["kwargs"] = kwargs
        return subprocess.CompletedProcess(arguments, 0, stdout="coordinate\n")

    monkeypatch.setattr(subprocess, "run", fake_run)

    output = SubprocessAtlasRunner().run([ATLASQ, "query"], 1.25)

    assert output == "coordinate\n"
    assert observed == {
        "arguments": [ATLASQ, "query"],
        "kwargs": {
            "shell": False,
            "check": True,
            "capture_output": True,
            "text": True,
            "timeout": 1.25,
        },
    }


def test_subprocess_runner_accepts_exact_output_size_limit(monkeypatch):
    output = "x" * (256 * 1024)
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess(
            args[0], 0, stdout=output
        ),
    )

    assert SubprocessAtlasRunner().run([ATLASQ], 1.0) == output


@pytest.mark.parametrize(
    "failure",
    [
        subprocess.TimeoutExpired(
            cmd=["/secret/runtime", "secret-option"],
            timeout=1.0,
            output="secret stdout",
            stderr="secret stderr",
        ),
        subprocess.CalledProcessError(
            returncode=9,
            cmd=["/secret/runtime", "secret-option"],
            output="secret stdout",
            stderr="secret stderr",
        ),
        FileNotFoundError("/secret/runtime"),
        UnicodeDecodeError("utf-8", b"secret\xff", 6, 7, "invalid"),
    ],
    ids=["timeout", "process failure", "missing executable", "decode failure"],
)
def test_subprocess_runner_normalizes_failures_without_leaks(
    monkeypatch, failure
):
    def fail(*args, **kwargs):
        raise failure

    monkeypatch.setattr(subprocess, "run", fail)

    with pytest.raises(AtlasUnavailableError) as error:
        SubprocessAtlasRunner().run([ATLASQ, "secret-option"], 1.0)

    assert str(error.value) == "Atlas query is unavailable"
    for secret in ["secret", "/secret/runtime", "stdout", "stderr"]:
        assert secret not in str(error.value)


def test_subprocess_runner_rejects_oversized_output_without_leaking_it(
    monkeypatch,
):
    output = "secret-output" + "x" * (256 * 1024)
    monkeypatch.setattr(
        subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess(
            args[0], 0, stdout=output
        ),
    )

    with pytest.raises(AtlasUnavailableError) as error:
        SubprocessAtlasRunner().run([ATLASQ], 1.0)

    assert str(error.value) == "Atlas query is unavailable"
    assert "secret-output" not in str(error.value)


def test_provider_builds_exact_fixed_command_and_anatomical_result():
    runner = RecordingRunner(
        "coordinate\t38.00 -44.00 48.00"
        "\tSuperior Parietal Lobule 45.0000"
        "\tAngular Gyrus 12.0000\n"
    )
    provider = _provider(runner)

    result = provider.query(Coordinate(x=38.0, y=-44.0, z=48.0))

    assert runner.calls == [
        (
            [
                ATLASQ,
                "query",
                "harvardoxford-cortical",
                "--short",
                "--resolution",
                "2",
                "--coord",
                "38.0",
                "-44.0",
                "48.0",
            ],
            1.25,
        )
    ]
    assert result.id == "harvardoxford-cortical"
    assert result.name == "Harvard–Oxford Cortical Structural Atlas"
    assert result.category == "anatomical"
    assert result.value_type == "probability"
    assert result.version == "2103.0"
    assert result.source_url == (
        "https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html"
    )
    assert [(match.id, match.value) for match in result.matches] == [
        ("harvardoxford-cortical:17", 45.0),
        ("harvardoxford-cortical:20", 12.0),
    ]


def test_provider_uses_fixed_copy_of_pinned_label_mapping():
    runner = RecordingRunner("coordinate\t0 0 0\tFrontal Pole 10.0\n")
    label_ids = {"Frontal Pole": "0"}
    provider = _provider(runner, label_ids=label_ids)
    label_ids["Frontal Pole"] = "visitor-controlled"

    result = provider.query(Coordinate(x=0.0, y=0.0, z=0.0))

    assert result.matches[0].id == "harvardoxford-cortical:0"


def test_provider_returns_faithful_subcortical_metadata():
    runner = RecordingRunner(
        "coordinate\t-42 0 0\tLeft Cerebral Cortex 95.8715\n"
    )
    provider = _provider(
        runner,
        atlas_id="harvardoxford-subcortical",
        label_ids={"Left Cerebral Cortex": "1"},
    )

    result = provider.query(Coordinate(x=-42.0, y=0.0, z=0.0))

    assert result.id == "harvardoxford-subcortical"
    assert result.name == "Harvard–Oxford Subcortical Structural Atlas"
    assert result.category == "anatomical"
    assert result.value_type == "probability"
    assert result.matches[0].id == "harvardoxford-subcortical:1"
    assert result.matches[0].value == 95.8715


@pytest.mark.parametrize(
    "atlas_id",
    [
        "harvardoxford-cortical; rm -rf /",
        "harvardoxford-cortical --resolution 1",
        "difumo-512",
        "",
    ],
)
def test_provider_rejects_every_non_allowlisted_atlas_id(atlas_id):
    runner = RecordingRunner("coordinate\t0 0 0\n")

    with pytest.raises(ValueError, match="Unsupported FSL atlas ID"):
        _provider(runner, atlas_id=atlas_id)

    assert runner.calls == []
