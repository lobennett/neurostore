"""Typed atlas readout provider interfaces."""

from .difumo import DifumoAtlasProvider
from .types import (
    AtlasMatch,
    AtlasResult,
    AtlasUnavailableError,
    Coordinate,
    InvalidCoordinateError,
)


__all__ = [
    "AtlasMatch",
    "AtlasResult",
    "AtlasUnavailableError",
    "Coordinate",
    "DifumoAtlasProvider",
    "InvalidCoordinateError",
]
