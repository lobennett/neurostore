# Decoder atlas runtime

## Status: authorized by project maintainer ruling

The FSL/Harvard–Oxford runtime is resolved and pinned. The official DiFuMo 512
sources do not declare a license, but the Neurostore maintainer has explicitly
authorized this project to treat the exact reviewed artifacts as MIT-licensed
and redistributable. See `THIRD_PARTY_NOTICES.md` for the required provenance
distinction. Large atlas binaries and unpacked environments remain generated
Docker artifacts rather than committed repository files.

## Regenerating the FSL lock

From the repository root, with Docker available:

```bash
docker run --rm --platform linux/amd64 --user root \
  -v "$PWD/compose/backend/atlas_runtime:/work" \
  mambaorg/micromamba:2.3.2 bash -lc \
  'micromamba create -y -p /opt/decoder-atlases -f /work/environment.yml && FSLDIR=/opt/decoder-atlases /opt/decoder-atlases/bin/atlasq list | grep -E "harvardoxford-(cortical|subcortical)" && micromamba list -p /opt/decoder-atlases --explicit > /work/explicit-linux-64.txt'
```

`--user root` is needed by this micromamba image to create the prescribed
`/opt/decoder-atlases` prefix. `FSLDIR` is needed for `atlasq` to discover the
atlas XML installed under that prefix. The checked-in lock was generated with
the Docker-compatible Podman 5.8.1 runtime because the executing host did not
provide the Docker CLI.

Any lock regeneration or dependency upgrade requires a fresh license review,
package-file inspection, `atlasq` proof, artifact hash verification, and
canonical Compose backend test run. Do not replace exact URLs with `latest` or
floating package names.

## Runtime contract

Deployments configure:

- `ATLAS_FSLDIR`: the pinned FSL environment root;
- `ATLAS_DIFUMO_DIR`: the verified DiFuMo 512 artifact directory; and
- `ATLAS_MANIFEST`: the checked-in manifest path.

The verified installer command is:

```bash
python -m neurosynth_compose.scripts.install_decoder_atlases \
  --manifest /compose/backend/atlas_runtime/manifest.json \
  --destination /opt/decoder-atlases/data/difumo-512
```

The installer validates the archive and normalized-file SHA-256 hashes and
byte counts before atomic replacement.

The required real-runtime test command is:

```bash
ATLAS_RUNTIME_REQUIRED=1 python -m pytest neurosynth_compose/tests
```
