"""Safe fixed-atlas queries for Harvard–Oxford probability readouts."""

from collections.abc import Mapping, Sequence
import math
import subprocess
from types import MappingProxyType

from .types import AtlasMatch, AtlasResult, AtlasUnavailableError, Coordinate


_MAX_STDOUT_BYTES = 256 * 1024
_RUNNER_ERROR = "Atlas query is unavailable"
_PARSER_ERROR = "Atlas query output is invalid"
_ATLAS_NAMES = {
    "harvardoxford-cortical": (
        "Harvard–Oxford Cortical Structural Atlas"
    ),
    "harvardoxford-subcortical": (
        "Harvard–Oxford Subcortical Structural Atlas"
    ),
}


class SubprocessAtlasRunner:
    """Run one atlas command with bounded, non-shell process semantics."""

    def run(
        self,
        arguments: Sequence[str],
        timeout_seconds: float,
    ) -> str:
        try:
            completed = subprocess.run(
                arguments,
                shell=False,
                check=True,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
            output = completed.stdout
            if not isinstance(output, str):
                raise AtlasUnavailableError(_RUNNER_ERROR)
            if len(output.encode("utf-8")) > _MAX_STDOUT_BYTES:
                raise AtlasUnavailableError(_RUNNER_ERROR)
            return output
        except AtlasUnavailableError:
            raise
        except (OSError, subprocess.SubprocessError, UnicodeError):
            raise AtlasUnavailableError(_RUNNER_ERROR) from None


def parse_short_query(
    output: str,
    atlas_id: str,
    label_ids: Mapping[str, str],
) -> tuple[AtlasMatch, ...]:
    """Parse exactly one tab-delimited ``atlasq query --short`` record."""

    try:
        if not isinstance(output, str):
            raise ValueError
        records = output.splitlines()
        if len(records) != 1:
            raise ValueError

        fields = records[0].split("\t")
        if len(fields) < 2 or fields[0] != "coordinate":
            raise ValueError

        coordinate_tokens = fields[1].split()
        if len(coordinate_tokens) != 3:
            raise ValueError
        coordinates = tuple(float(token) for token in coordinate_tokens)
        if not all(math.isfinite(value) for value in coordinates):
            raise ValueError

        matches = []
        for field in fields[2:]:
            label, probability_token = field.rsplit(maxsplit=1)
            probability = float(probability_token)
            if not math.isfinite(probability) or not 0.0 <= probability <= 100.0:
                raise ValueError
            label_id = label_ids[label]
            if not isinstance(label_id, str) or not label_id:
                raise ValueError
            if probability != 0.0:
                matches.append(
                    AtlasMatch(
                        id=f"{atlas_id}:{label_id}",
                        label=label,
                        value=probability,
                    )
                )
    except (AttributeError, KeyError, TypeError, ValueError):
        raise AtlasUnavailableError(_PARSER_ERROR) from None

    return tuple(
        sorted(matches, key=lambda match: (-match.value, match.id))
    )


class FslAtlasProvider:
    """Query one allowlisted Harvard–Oxford atlas at a coordinate."""

    def __init__(
        self,
        atlas_id: str,
        label_ids: Mapping[str, str],
        version: str,
        source_url: str,
        executable: str = "/opt/decoder-atlases/bin/atlasq",
        timeout_seconds: float = 2.0,
        runner=None,
    ):
        if atlas_id not in _ATLAS_NAMES:
            raise ValueError("Unsupported FSL atlas ID")
        self._atlas_id = atlas_id
        self._atlas_name = _ATLAS_NAMES[atlas_id]
        self._label_ids = MappingProxyType(dict(label_ids))
        self._version = version
        self._source_url = source_url
        self._executable = executable
        self._timeout_seconds = timeout_seconds
        self._runner = runner if runner is not None else SubprocessAtlasRunner()

    def query(self, coordinate: Coordinate) -> AtlasResult:
        arguments = [
            self._executable,
            "query",
            self._atlas_id,
            "--short",
            "--resolution",
            "2",
            "--coord",
            str(float(coordinate.x)),
            str(float(coordinate.y)),
            str(float(coordinate.z)),
        ]
        output = self._runner.run(arguments, self._timeout_seconds)
        matches = parse_short_query(
            output,
            self._atlas_id,
            self._label_ids,
        )
        return AtlasResult(
            id=self._atlas_id,
            name=self._atlas_name,
            category="anatomical",
            value_type="probability",
            version=self._version,
            source_url=self._source_url,
            matches=matches,
        )
