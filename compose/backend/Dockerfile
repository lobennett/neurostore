ARG NODE_MAJOR=22
ARG RUNTIME_PLATFORM=linux/amd64

FROM --platform=${RUNTIME_PLATFORM} node:${NODE_MAJOR}-trixie-slim AS node

FROM --platform=${RUNTIME_PLATFORM} mambaorg/micromamba:2.3.2 AS atlas-runtime

USER root

COPY atlas_runtime/explicit-linux-64.txt /tmp/explicit-linux-64.txt

RUN sed -e '1c@EXPLICIT' -e '2d' \
        /tmp/explicit-linux-64.txt > /tmp/explicit-spec.txt \
    && micromamba create -y \
        -p /opt/decoder-atlases \
        -f /tmp/explicit-spec.txt \
    && FSLDIR=/opt/decoder-atlases \
        /opt/decoder-atlases/bin/atlasq list \
        | grep -E 'harvardoxford-(cortical|subcortical)' \
    && micromamba clean --all --yes \
    && rm -f \
        /opt/decoder-atlases/bin/pip \
        /opt/decoder-atlases/bin/pip3 \
        /opt/decoder-atlases/bin/pip3.14 \
        /opt/decoder-atlases/bin/python \
        /opt/decoder-atlases/bin/python3 \
        /opt/decoder-atlases/bin/python3.1

RUN mkdir -p \
        /opt/decoder-atlases/licenses/fslpy-3.29.1 \
        /opt/decoder-atlases/licenses/harvard-oxford \
        /opt/decoder-atlases/licenses/difumo-512 \
    && fslpy_license="$(find /opt/decoder-atlases -type f \
        -path '*fslpy*' -name LICENSE -print -quit)" \
    && test -n "${fslpy_license}" \
    && cp "${fslpy_license}" \
        /opt/decoder-atlases/licenses/fslpy-3.29.1/LICENSE

ADD --checksum=sha256:28a9529c7d0bb4dc51f4bf5c116a3d16ef247a052f7591466768ddf563fd1cf5 \
    https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt \
    /opt/decoder-atlases/licenses/harvard-oxford/CC-BY-SA-4.0.txt
COPY atlas_runtime/MIT-PROJECT-AUTHORIZATION.txt \
    /opt/decoder-atlases/licenses/difumo-512/MIT-PROJECT-AUTHORIZATION.txt
COPY atlas_runtime/THIRD_PARTY_NOTICES.md \
    /opt/decoder-atlases/licenses/THIRD_PARTY_NOTICES.md

FROM --platform=${RUNTIME_PLATFORM} python:3.14-trixie

ARG DEBIAN_FRONTEND=noninteractive
WORKDIR /compose/backend

COPY --from=node /usr/local/ /usr/local/
COPY --from=atlas-runtime /opt/decoder-atlases /opt/decoder-atlases

ENV FSLDIR=/opt/decoder-atlases
ENV PATH=/opt/decoder-atlases/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libasound2t64 \
        libgbm-dev \
        libgtk-3-0t64 \
        libnotify-dev \
        libnss3 \
        libxtst6 \
        libxss1 \
        xauth \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

ENV CYPRESS_CACHE_FOLDER=/app/.cache/Cypress

RUN mkdir -p "${CYPRESS_CACHE_FOLDER}" \
    && chmod 777 "${CYPRESS_CACHE_FOLDER}"

COPY MANIFEST.in pyproject.toml /compose/backend/

RUN /usr/local/bin/python -m pip install --no-cache-dir --upgrade pip cython \
    && /usr/local/bin/python -m pip install --no-cache-dir -e .[dev]

COPY . /compose/backend/

COPY atlas_runtime/manifest.json /opt/decoder-atlases/manifest.json

RUN /usr/local/bin/python -m pip install --no-cache-dir --no-deps -e . \
    && CELERY_BROKER_URL=redis://localhost/0 \
        CELERY_RESULT_BACKEND=redis://localhost/0 \
        POSTGRES_HOST=localhost \
        AUTH0_CLIENT_ID=atlas-build \
        AUTH0_CLIENT_SECRET=atlas-build \
        APP_ENV=docker_test \
        /usr/local/bin/python \
        -m neurosynth_compose.scripts.install_decoder_atlases \
        --manifest /opt/decoder-atlases/manifest.json \
        --destination /opt/decoder-atlases/data/difumo-512
