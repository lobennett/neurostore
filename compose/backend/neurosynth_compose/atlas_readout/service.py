"""Deterministic orchestration and process-local caching for atlas readouts."""

from collections import OrderedDict
from collections.abc import Mapping
import threading

from .types import AtlasResult, AtlasUnavailableError, Coordinate


ATLAS_ORDER = (
    "harvardoxford-cortical",
    "harvardoxford-subcortical",
    "difumo-512",
)
_UNAVAILABLE_MESSAGE = "Atlas readout is unavailable"


class _InFlightQuery:
    def __init__(self, cache_lock):
        self.condition = threading.Condition(cache_lock)
        self.owner_ident = threading.get_ident()
        self.complete = False
        self.failed = False
        self.results = None


class AtlasReadoutService:
    """Query all required providers and cache complete immutable results."""

    def __init__(self, providers, manifest_version, cache_size):
        if not isinstance(providers, Mapping) or set(providers) != set(
            ATLAS_ORDER
        ):
            raise AtlasUnavailableError(
                "Atlas provider configuration is invalid"
            )
        if (
            isinstance(cache_size, bool)
            or not isinstance(cache_size, int)
            or cache_size <= 0
        ):
            raise AtlasUnavailableError("Atlas cache configuration is invalid")
        if not isinstance(manifest_version, str) or not manifest_version:
            raise AtlasUnavailableError(
                "Atlas manifest configuration is invalid"
            )

        self._providers = dict(providers)
        self._manifest_version = manifest_version
        self._cache_size = cache_size
        self._cache = OrderedDict()
        self._cache_lock = threading.Lock()
        self._in_flight = {}

    def query(self, coordinate: Coordinate) -> dict:
        """Return one complete, freshly serialized three-atlas response."""

        key = (
            self._manifest_version,
            coordinate.x,
            coordinate.y,
            coordinate.z,
        )
        with self._cache_lock:
            results = self._cache.get(key)
            if results is not None:
                self._cache.move_to_end(key)
            else:
                in_flight = self._in_flight.get(key)
                if in_flight is None:
                    in_flight = _InFlightQuery(self._cache_lock)
                    self._in_flight[key] = in_flight
                    owns_query = True
                else:
                    if in_flight.owner_ident == threading.get_ident():
                        raise AtlasUnavailableError(_UNAVAILABLE_MESSAGE)
                    owns_query = False

                if not owns_query:
                    while not in_flight.complete:
                        in_flight.condition.wait()
                    if in_flight.failed:
                        raise AtlasUnavailableError(_UNAVAILABLE_MESSAGE)
                    results = in_flight.results

        if results is None:
            try:
                results = self._query_providers(coordinate)
            except BaseException:
                self._publish_failure(key, in_flight)
                raise
            self._publish_success(key, in_flight, results)

        return {
            "coordinate": {
                "x": coordinate.x,
                "y": coordinate.y,
                "z": coordinate.z,
            },
            "space": "MNI152",
            "atlases": [result.to_dict() for result in results],
        }

    def _publish_success(self, key, in_flight, results):
        with self._cache_lock:
            self._cache[key] = results
            self._cache.move_to_end(key)
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
            in_flight.results = results
            in_flight.complete = True
            self._in_flight.pop(key, None)
            in_flight.condition.notify_all()

    def _publish_failure(self, key, in_flight):
        with self._cache_lock:
            in_flight.failed = True
            in_flight.complete = True
            self._in_flight.pop(key, None)
            in_flight.condition.notify_all()

    def _query_providers(self, coordinate):
        try:
            results = tuple(
                self._providers[atlas_id].query(coordinate)
                for atlas_id in ATLAS_ORDER
            )
            if any(
                not isinstance(result, AtlasResult)
                or result.id != expected_id
                for result, expected_id in zip(results, ATLAS_ORDER)
            ):
                raise AtlasUnavailableError(_UNAVAILABLE_MESSAGE)
            return results
        except Exception:
            raise AtlasUnavailableError(_UNAVAILABLE_MESSAGE) from None
