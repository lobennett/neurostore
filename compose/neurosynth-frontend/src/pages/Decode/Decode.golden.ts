import { EMPTY_DECODE_DRAFT, RECORDED_PEARSON_MODEL } from './Decode.fixtures';
import type {
    DecodeExampleId,
    DecodeStatisticType,
    IDecodeDraft,
    IDecodePreview,
    IDecodeVisualization,
    IDecodeVolumeAsset,
} from './Decode.types';

const EXAMPLE_ID: DecodeExampleId = 'neurovault-308';
const MANIFEST_URL = '/decoder/examples/neurovault-308/manifest.json';
const ASSET_URL_PREFIX = '/decoder/examples/neurovault-308/';
const RESULT_ID = '6a6a9cdb07754185b6218dff275112fe';
const RETRIEVAL_DATE = '2026-08-26';
const RESULT_ENDPOINT = `https://neurosynth.org/api/decode/${RESULT_ID}`;
const SCORE_DEFINITION =
    'Pearson correlation between vectorized input and reference term maps, including zero-valued voxels';
const PROVENANCE_HOSTS = new Set(['neurovault.org', 'www.neurovault.org', 'neurosynth.org', 'www.neurosynth.org']);

interface IRecordedManifestAsset {
    id: string;
    filename: string;
    bytes: number;
    sha256: string;
    kind: IDecodeVolumeAsset['kind'];
    statisticType: DecodeStatisticType;
    sourceUrl: string;
    license: IDecodeVolumeAsset['provenance']['license'];
    attribution: string;
}

interface IRecordedManifest {
    exampleId: string;
    retrievalDate: string;
    input: {
        neurovaultImageId: string;
        sourceUrl: string;
        collection: string;
        collectionId: string;
        statisticType: 't';
        analysisLevel: 'group';
        modality: 'fMRI BOLD';
        subjectCount: number;
        doi: string;
        license: 'CC0';
        attribution: string;
    };
    method: {
        label: 'Recorded Neurosynth Pearson example';
        name: 'Pearson correlation';
        referenceDataset: 'terms_20k';
        resultEndpoint: string;
        resultId: string;
        rankingRule: 'absolute-correlation-descending';
        scoreDefinition: string;
        sourceUrl: string;
        attribution: string;
    };
    assets: IRecordedManifestAsset[];
    terms: Array<{ id: string; label: string; rank: number; r: number; mapAssetId?: string }>;
}

const invalidManifest = (): never => {
    throw new Error('The recorded NeuroVault 308 manifest does not match the canonical walkthrough.');
};

const requireAsset = (assets: Map<string, IDecodeVolumeAsset>, id: string): IDecodeVolumeAsset => {
    const asset = assets.get(id);
    if (!asset) return invalidManifest();
    return asset;
};

const toVolumeAsset = (asset: IRecordedManifestAsset): IDecodeVolumeAsset => ({
    id: asset.id,
    url: `${ASSET_URL_PREFIX}${asset.filename}`,
    filename: asset.filename,
    kind: asset.kind,
    statisticType: asset.statisticType,
    provenance: {
        sourceUrl: asset.sourceUrl,
        license: asset.license,
        attribution: asset.attribution,
        sha256: asset.sha256,
        bytes: asset.bytes,
    },
});

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const isSafeHttpsUrl = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && PROVENANCE_HOSTS.has(url.hostname) && !url.username && !url.password;
    } catch {
        return false;
    }
};

const hasValidAssetProvenance = (asset: IRecordedManifestAsset): boolean =>
    isSafeHttpsUrl(asset?.sourceUrl) &&
    (asset.license === 'CC0' || asset.license === 'ODbL-derived') &&
    isNonEmptyString(asset.attribution);

const isCanonicalManifest = (manifest: IRecordedManifest): boolean =>
    manifest?.exampleId === EXAMPLE_ID &&
    manifest.retrievalDate === RETRIEVAL_DATE &&
    manifest.input?.neurovaultImageId === '308' &&
    manifest.input.sourceUrl === 'https://neurovault.org/images/308/' &&
    isSafeHttpsUrl(manifest.input.sourceUrl) &&
    isNonEmptyString(manifest.input.collection) &&
    manifest.input.collectionId === '63' &&
    manifest.input.statisticType === 't' &&
    manifest.input.analysisLevel === 'group' &&
    manifest.input.modality === 'fMRI BOLD' &&
    manifest.input.subjectCount === 10 &&
    manifest.input.doi === '10.1186/2047-217X-2-6' &&
    manifest.input.license === 'CC0' &&
    isNonEmptyString(manifest.input.attribution) &&
    manifest.method?.label === 'Recorded Neurosynth Pearson example' &&
    manifest.method.name === 'Pearson correlation' &&
    manifest.method.referenceDataset === 'terms_20k' &&
    manifest.method.resultEndpoint === RESULT_ENDPOINT &&
    isSafeHttpsUrl(manifest.method.resultEndpoint) &&
    manifest.method.resultId === RESULT_ID &&
    manifest.method.rankingRule === 'absolute-correlation-descending' &&
    manifest.method.scoreDefinition === SCORE_DEFINITION &&
    manifest.method.sourceUrl === 'https://neurosynth.org/' &&
    isSafeHttpsUrl(manifest.method.sourceUrl) &&
    isNonEmptyString(manifest.method.attribution) &&
    Array.isArray(manifest.assets) &&
    manifest.assets.every(hasValidAssetProvenance) &&
    Array.isArray(manifest.terms);

export const makeGoldenWalkthroughDraft = (interpretation: string): IDecodeDraft => ({
    ...EMPTY_DECODE_DRAFT,
    neurovaultReference: 'https://neurovault.org/images/308/',
    metadata: {
        ...EMPTY_DECODE_DRAFT.metadata,
        mapType: 't',
        analysisLevel: 'group',
        modality: 'fmri-bold',
        subjectCount: '10',
        cognitiveTask: { id: 'trm_5346938eed092', label: 'Landmark task' },
    },
    interpretation,
    modelId: 'neurosynth-pearson-recorded',
    modelParameters: {},
    exampleId: EXAMPLE_ID,
});

export const loadGoldenWalkthrough = async (): Promise<{ draft: IDecodeDraft; preview: IDecodePreview }> => {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`Unable to load recorded walkthrough manifest (${response.status}).`);
    const manifest: IRecordedManifest = await response.json();
    if (!isCanonicalManifest(manifest)) invalidManifest();

    const assets = new Map(manifest.assets.map((asset) => [asset.id, toVolumeAsset(asset)]));
    const visualization: IDecodeVisualization = {
        anatomical: requireAsset(assets, 'generic-mni'),
        input: requireAsset(assets, 'response-control'),
        comparisonByResultId: Object.fromEntries(
            manifest.terms.flatMap(({ id, mapAssetId }) => (mapAssetId ? [[id, requireAsset(assets, mapAssetId)]] : []))
        ),
    };
    const comparisonAssets = Object.values(visualization.comparisonByResultId);
    const comparisonLicenses = new Set(comparisonAssets.map(({ provenance }) => provenance.license));
    const termMapLicense = comparisonAssets[0]?.provenance.license;
    if (
        comparisonAssets.length === 0 ||
        comparisonAssets.some(({ kind }) => kind !== 'association-z') ||
        comparisonLicenses.size !== 1 ||
        termMapLicense !== 'ODbL-derived'
    ) {
        invalidManifest();
    }

    return {
        draft: makeGoldenWalkthroughDraft(''),
        preview: {
            modelId: RECORDED_PEARSON_MODEL.id,
            modelVersion: RECORDED_PEARSON_MODEL.version,
            parameters: {},
            termMetric: 'correlation',
            provenance: {
                kind: 'recorded',
                label: manifest.method.label,
                version: RECORDED_PEARSON_MODEL.version,
                resultId: manifest.method.resultId,
                method: manifest.method.name,
                scoreDefinition: manifest.method.scoreDefinition,
                referenceDataset: manifest.method.referenceDataset,
                retrievedAt: manifest.retrievalDate,
                rankingRule: manifest.method.rankingRule,
                sourceUrl: manifest.method.sourceUrl,
                resultUrl: manifest.method.resultEndpoint,
                input: {
                    imageId: manifest.input.neurovaultImageId,
                    sourceUrl: manifest.input.sourceUrl,
                    collectionId: manifest.input.collectionId,
                    collectionName: manifest.input.collection,
                    collectionUrl: `https://neurovault.org/collections/${manifest.input.collectionId}/`,
                    doi: manifest.input.doi,
                    doiUrl: `https://doi.org/${manifest.input.doi}`,
                    license: manifest.input.license,
                    attribution: manifest.input.attribution,
                },
                termMaps: {
                    license: termMapLicense,
                    attribution: manifest.method.attribution,
                },
            },
            terms: manifest.terms.map(({ id, label, rank, r, mapAssetId }) => ({
                id,
                label,
                rank,
                metric: 'correlation',
                value: r,
                ...(mapAssetId ? { mapUrl: requireAsset(assets, mapAssetId).url } : {}),
            })),
            studies: [],
            modelSummary: {
                narrative: 'Recorded Pearson spatial-correlation results from the terms_20k reference dataset.',
            },
            atlasReadouts: [],
            visualization,
        },
    };
};
