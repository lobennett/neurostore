"""Public async resource for fixed atlas coordinate readouts."""

import json
import time

import anyio
from connexion import request
from connexion.lifecycle import ConnexionResponse

from neurosynth_compose.atlas_readout import (
    AtlasUnavailableError,
    Coordinate,
    InvalidCoordinateError,
    get_atlas_readout_service,
)
from neurosynth_compose.resources.common import make_json_response


_UNAVAILABLE_TYPE = (
    "https://neurostore.org/problems/atlas-readout-unavailable"
)


def _problem_response(*, problem_type, title, detail, status):
    body = json.dumps(
        {
            "type": problem_type,
            "title": title,
            "detail": detail,
            "status": status,
        }
    )
    return ConnexionResponse(
        body=body,
        status_code=status,
        mimetype="application/problem+json",
        content_type="application/problem+json",
    )


async def readout(x: float, y: float, z: float):
    """Return all configured atlas matches at one validated MNI coordinate."""

    started_at = time.monotonic()
    try:
        coordinate = Coordinate(x=x, y=y, z=z)
    except InvalidCoordinateError:
        return _problem_response(
            problem_type="about:blank",
            title="Bad Request",
            detail="Coordinates must be finite and within MNI152 bounds.",
            status=400,
        )

    try:
        service = get_atlas_readout_service(request.state.settings)
        payload = await anyio.to_thread.run_sync(service.query, coordinate)
    except AtlasUnavailableError:
        elapsed_seconds = time.monotonic() - started_at
        request.state.logger.warning(
            "Atlas readout failed category=required-provider "
            "elapsed_seconds=%.6f",
            elapsed_seconds,
        )
        return _problem_response(
            problem_type=_UNAVAILABLE_TYPE,
            title="Atlas readout unavailable",
            detail=(
                "The configured atlas service is temporarily unavailable."
            ),
            status=503,
        )

    return make_json_response(payload)
