# Decoder atlas third-party licensing review

Review date: 2026-08-27

This review is a release gate for distributing the decoder atlas runtime in a
Neurostore container image. It is not legal advice. Upstream DiFuMo metadata
does not declare a license; the project maintainer has explicitly authorized
Neurostore to treat the reviewed DiFuMo 512 artifacts as MIT-licensed for this
project. That project authorization, not an upstream-discovered declaration,
is the redistribution basis recorded below.

## FSL tooling and Harvard–Oxford atlases

### Exact material reviewed

- `fslpy-3.29.1-pyhc364b38_0.conda`, SHA-256
  `76646b1782794b70c13e4e356e95a1107f625291c9d6018436da9feac886fb16`,
  resolved from the exact URL in `explicit-linux-64.txt`.
- `fsl-data_atlases-2103.0-0.tar.bz2`, SHA-256
  `3ac89f5f67de84054e1e576c9ad5f7ef6f562cef7b2504a3fa992c079cf72f8c`,
  43,655,793 bytes, resolved from the exact URL in
  `explicit-linux-64.txt`.
- The cortical and subcortical probability volumes and XML definitions under
  `data/atlases/HarvardOxford/`, `data/atlases/HarvardOxford-Cortical.xml`,
  and `data/atlases/HarvardOxford-Subcortical.xml` in that data package.

The exact `fslpy` package declares `Apache-2.0` in `info/index.json` and
includes `info/licenses/LICENSE`. The exact `fsl-data_atlases` archive has an
empty `about` section and no embedded license file. The authoritative FSL
license page separately identifies the Harvard–Oxford atlases as CC BY-SA 4.0.

### Sources and supporting clauses

- FSL license and atlas-specific terms:
  <https://fsl.fmrib.ox.ac.uk/fsl/docs/license.html>
- Apache License 2.0: <https://www.apache.org/licenses/LICENSE-2.0>
- CC BY-SA 4.0 legal code:
  <https://creativecommons.org/licenses/by-sa/4.0/legalcode.en>
- Harvard–Oxford atlas documentation:
  <https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html>
- Harvard–Oxford reference named by the official FSL documentation: Makris
  et al. (2006), *Decreased volume of left and total anterior insular lobule in
  schizophrenia*, <https://pubmed.ncbi.nlm.nih.gov/16448806/>.

FSL's atlas-specific terms state that the Harvard–Oxford atlases "are
released under the CC BY-SA 4.0 licence." CC BY-SA 4.0 section 2(a)(1)
permits reproduction and sharing; section 3 requires attribution, a license
notice/link, modification disclosure, and ShareAlike licensing for adapted
material. Apache 2.0 section 4 permits redistribution of `fslpy` provided the
license, modification notices, and applicable attribution notices are
retained.

### Redistribution conclusion and operator restrictions

**Conclusion: allowed with conditions.** Neurostore may distribute this exact
`fslpy` build and the exact Harvard–Oxford files from
`fsl-data_atlases=2103.0` in an image if it includes the required Apache 2.0
and CC BY-SA 4.0 notices and satisfies attribution, modification-marking, and
ShareAlike obligations. The main FSL non-commercial license must not be
misapplied to Harvard–Oxford; FSL's own atlas-specific clause identifies
Harvard–Oxford as CC BY-SA 4.0.

Before any image is published, the build must place the complete license texts
at these stable in-image paths:

- `/opt/decoder-atlases/licenses/fslpy-3.29.1/LICENSE`
- `/opt/decoder-atlases/licenses/harvard-oxford/CC-BY-SA-4.0.txt`
- `/opt/decoder-atlases/licenses/THIRD_PARTY_NOTICES.md`

Downstream operators must preserve those texts and attribution, disclose any
changes to the atlas material, apply CC BY-SA 4.0 or a compatible license to
adapted Harvard–Oxford material, avoid additional restrictions or effective
technological measures on that material, and avoid implying Oxford or atlas
author endorsement.

## DiFuMo 512

### Exact material reviewed

- Canonical download: <https://osf.io/9b76y/download>
- OSF file ID: `9b76y`; OSF node: `k8w5s`; stored filename: `512.zip`.
- OSF resolver URL observed on 2026-08-27:
  `https://files.osf.io/v1/resources/k8w5s/providers/osfstorage/600fd66add222500e2589a9e`.
- Stable final storage URL observed by the verified GET on 2026-08-28:
  `https://storage.googleapis.com/cos-osf-prod-files-us-east1/63af869a11312def29cbe554c900322ee65c36e37709a14a7e9bf18659827d68`.
- Archive SHA-256:
  `63af869a11312def29cbe554c900322ee65c36e37709a14a7e9bf18659827d68`;
  size: 3,702,732 bytes.
- Archive contents relevant to the proposed image:
  `512/2mm/maps.nii.gz` (14,359,345 bytes) and
  `512/labels_512_dictionary.csv` (56,808 bytes).
- Publication: Dadi et al., *Fine-grain atlases of functional modes for fMRI
  analysis*, NeuroImage 2020, <https://doi.org/10.1016/j.neuroimage.2020.117126>.
- Upstream project: <https://github.com/Parietal-INRIA/DiFuMo>.

### Sources and exact evidence

- OSF node metadata: <https://api.osf.io/v2/nodes/k8w5s/>.
- OSF file metadata: <https://api.osf.io/v2/files/9b76y/>.
- OSF licensing guidance: <https://help.osf.io/article/148-licensing>.
- Upstream repository: <https://github.com/Parietal-INRIA/DiFuMo>.

The OSF node's relationships contain no `license` relationship. The file
metadata provides hashes and provenance but no license grant. The exact
archive contains only the map volumes and label CSV; it contains no license or
notice file. The upstream repository also has no `LICENSE` file. Its README
requests citation, but a citation request is not a redistribution license.
The publication describes data availability but does not grant a license for
redistributing the atlas artifacts in a third-party container image.

OSF's own licensing guidance says that without a license, use requires the
copyright holder's consent. Public download availability does not by itself
grant redistribution rights.

### Project authorization, redistribution conclusion, and operator restrictions

**Project ruling (2026-08-27):** the maintainer/user explicitly directed this
implementation to assume that DiFuMo 512 is open source, MIT-licensed, and may
be used and redistributed by this project. This is a project authorization;
it must not be represented as a license declaration discovered in the OSF
metadata, archive, upstream repository, or paper.

The standard MIT text used by this project is published by the Open Source
Initiative at <https://opensource.org/license/mit>. Its permission clause
allows use, modification, publication, distribution, sublicensing, and sale,
provided copies or substantial portions retain the copyright and permission
notice.

**Conclusion: allowed for this project under the binding maintainer ruling.**
Neurostore may download, normalize, and redistribute the exact reviewed
DiFuMo 512 map and label artifacts in its image under the MIT terms assumed by
the project. The image must place the project-authorized MIT text and this
provenance distinction at:

- `/opt/decoder-atlases/licenses/difumo-512/MIT-PROJECT-AUTHORIZATION.txt`
- `/opt/decoder-atlases/licenses/THIRD_PARTY_NOTICES.md`

Downstream operators must retain the MIT copyright/license notice. They must
also preserve the statement that MIT is the Neurostore maintainer's binding
project assumption rather than an upstream license observed in the reviewed
sources, and retain the scholarly citation requested by the upstream README.
Any change in the artifacts or intended use requires a fresh review.
