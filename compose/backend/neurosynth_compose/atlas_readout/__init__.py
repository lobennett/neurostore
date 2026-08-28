"""Typed atlas readout provider interfaces."""

from .difumo import DifumoAtlasProvider
from .factory import get_atlas_readout_service
from .service import AtlasReadoutService
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
    "AtlasReadoutService",
    "AtlasUnavailableError",
    "Coordinate",
    "DifumoAtlasProvider",
    "InvalidCoordinateError",
    "get_atlas_readout_service",
]
