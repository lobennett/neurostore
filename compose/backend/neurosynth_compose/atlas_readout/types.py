"""Immutable domain values shared by atlas readout providers."""

from dataclasses import dataclass
import math
from typing import Literal


class AtlasUnavailableError(RuntimeError):
    """Raised when configured atlas data cannot produce a safe result."""


class InvalidCoordinateError(ValueError):
    """Raised when a coordinate is not a finite point in MNI152 bounds."""


@dataclass(frozen=True)
class Coordinate:
    x: float
    y: float
    z: float

    def __post_init__(self):
        bounds = {
            "x": (-90.0, 90.0),
            "y": (-126.0, 90.0),
            "z": (-72.0, 108.0),
        }
        for axis, (lower, upper) in bounds.items():
            value = getattr(self, axis)
            try:
                finite = math.isfinite(value)
            except TypeError as exc:
                raise InvalidCoordinateError(
                    f"{axis} coordinate must be finite"
                ) from exc
            if not finite:
                raise InvalidCoordinateError(f"{axis} coordinate must be finite")
            if not lower <= value <= upper:
                raise InvalidCoordinateError(
                    f"{axis} coordinate must be between {lower} and {upper}"
                )


@dataclass(frozen=True)
class AtlasMatch:
    id: str
    label: str
    value: float


@dataclass(frozen=True)
class AtlasResult:
    id: str
    name: str
    category: Literal["anatomical", "functional"]
    value_type: Literal["probability", "loading"]
    version: str
    source_url: str
    matches: tuple[AtlasMatch, ...]

    def __post_init__(self):
        try:
            values_are_finite = all(
                math.isfinite(match.value) for match in self.matches
            )
        except (AttributeError, TypeError) as exc:
            raise AtlasUnavailableError(
                "Atlas match values must be finite"
            ) from exc
        if not values_are_finite:
            raise AtlasUnavailableError("Atlas match values must be finite")

    def to_dict(self):
        """Serialize with the public API's camel-cased field names."""

        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "valueType": self.value_type,
            "version": self.version,
            "sourceUrl": self.source_url,
            "matches": [
                {"id": match.id, "label": match.label, "value": match.value}
                for match in self.matches
            ],
        }
