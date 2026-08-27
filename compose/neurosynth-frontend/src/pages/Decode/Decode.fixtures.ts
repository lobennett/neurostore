import type {
    DecodeFixtureScenario,
    ICognitiveTaskOption,
    IDecodeDraft,
    IDecodeModelDefinition,
    IDecodePreview,
    IDecodeProvenance,
    IDecodeRunRequest,
    IDecodedTerm,
    IDecodeStudy,
    IDecodeTerm,
    IAtlasReadout,
    INiClipDomain,
    INiClipTask,
} from './Decode.types';
import { COGNITIVE_ATLAS_CONCEPTS } from './Decode.vocabulary';

export const EMPTY_DECODE_DRAFT: IDecodeDraft = {
    activeSource: 'neurovault',
    neurovaultReference: '',
    file: null,
    fileSelectionId: 0,
    coordinates: [],
    depositConsent: false,
    metadata: {
        mapType: '',
        analysisLevel: '',
        modality: '',
        subjectCount: '',
        thresholding: '',
        targetTemplate: '',
        contrast: '',
        cognitiveTask: null,
        interpretation: '',
    },
    concepts: [],
    interpretation: '',
    confirmedSuggestions: [],
    subjectWarningAcknowledged: false,
    exampleId: null,
    modelId: 'neurovlm',
    modelParameters: { resultLimit: 50 },
};

export const RECORDED_PEARSON_MODEL: IDecodeModelDefinition = {
    id: 'neurosynth-pearson-recorded',
    name: 'Neurosynth Pearson',
    purpose: 'Replays a recorded spatial-correlation example for interface review.',
    version: 'terms_20k-recorded-2026-08-26',
    supportedSources: ['neurovault'],
    inputRequirements: 'Available only for the canonical NeuroVault 308 walkthrough.',
    parameters: [],
    outputViews: ['terms', 'studies', 'model-summary', 'compare'],
    interpretationNote:
        'Pearson correlation measures spatial similarity; it is not a probability or proof of cognitive state.',
    subjectLevelSuitability: 'This recorded example is a group-level map.',
    exampleOnly: 'neurovault-308',
};

export const DECODE_MODELS: IDecodeModelDefinition[] = [
    {
        id: 'neurovlm',
        name: 'NeuroVLM',
        purpose: 'Ranks cognitive concepts associated with an input map or location.',
        version: 'fixture-v1',
        supportedSources: ['neurovault', 'upload', 'coordinates'],
        inputRequirements:
            'For map sources, provide a 3D, unthresholded z- or t-statistic map in MNI152 space; for coordinate sources, provide MNI coordinates.',
        parameters: [
            { key: 'resultLimit', label: 'Number of term results', kind: 'integer', defaultValue: 50, min: 1 },
        ],
        outputViews: ['terms', 'studies', 'model-summary', 'compare'],
        interpretationNote:
            'An association or high rank is evidence for interpretation, not proof of the cognitive state that produced the input.',
        subjectLevelSuitability:
            "This interface has not established NeuroVLM's suitability for subject-level maps; interpret the example cautiously.",
    },
    {
        id: 'niclip',
        name: 'NiCLIP',
        purpose: 'Summarizes domain and task associations for statistical maps.',
        version: 'fixture-v1',
        supportedSources: ['neurovault', 'upload'],
        inputRequirements: 'Provide a 3D, unthresholded z- or t-statistic map in MNI152 space.',
        parameters: [
            {
                key: 'prior',
                label: 'NiCLIP prior',
                kind: 'select',
                defaultValue: 'literature',
                options: [
                    { value: 'literature', label: 'Literature-derived prior' },
                    { value: 'uniform', label: 'Uniform prior' },
                ],
            },
            {
                key: 'evidenceThreshold',
                label: 'Evidence threshold',
                kind: 'number',
                defaultValue: 3,
            },
        ],
        outputViews: ['terms', 'studies', 'model-summary', 'compare'],
        interpretationNote:
            'Posterior probabilities depend on the selected prior; Bayes factors show the change in evidence relative to that prior.',
        subjectLevelSuitability:
            "This interface has not established NiCLIP's suitability for subject-level maps; interpret the example cautiously.",
    },
    RECORDED_PEARSON_MODEL,
];

export const FIXTURE_PROVENANCE: IDecodeProvenance = {
    kind: 'illustrative',
    label: 'Illustrative example — no decoder was called',
    version: 'fixture-v1',
};

const preferredFixtureConcepts = ['visual perception', 'working memory', 'response inhibition'];
const fixtureConcepts = [
    ...preferredFixtureConcepts.flatMap((label) =>
        COGNITIVE_ATLAS_CONCEPTS.filter((concept) => concept.label.toLocaleLowerCase() === label)
    ),
    ...COGNITIVE_ATLAS_CONCEPTS.filter(
        (concept) => !preferredFixtureConcepts.includes(concept.label.toLocaleLowerCase())
    ),
].slice(0, 65);

export const EXAMPLE_TERMS: Array<IDecodeTerm & IDecodedTerm> = fixtureConcepts.map((concept, index) => {
    const rank = index + 1;
    const correlation = index === 2 ? 0 : Number((0.312 - index * 0.007).toFixed(3));
    return {
        id: concept.id,
        label: concept.label,
        rank,
        metric: 'correlation',
        value: correlation,
        mapUrl: index === 0 ? 'https://neurovault.org/images/25/' : `/maps/example-term-${rank}`,
        term: concept.label,
        correlation,
    };
});

const makeExampleStudies = (request: IDecodeRunRequest): IDecodeStudy[] =>
    Array.from({ length: 55 }, (_, index) => ({
        id: `example-study-${String(index + 1).padStart(3, '0')}`,
        title: index === 0 ? 'Illustrative visual processing study' : `Illustrative associated study ${index + 1}`,
        authors: index === 0 ? 'Example et al.' : `Example authors ${index + 1}`,
        year: 2024 - (index % 12),
        matchBasis: request.concepts.length ? 'Matches input and selected concept' : 'Matches input only',
        url: 'https://neurovault.org/images/25/',
        mapUrl: 'https://neurovault.org/images/25/',
    }));

export const EXAMPLE_NICLIP_DOMAINS: INiClipDomain[] = [
    { domain: 'Perception', probability: 0.78 },
    { domain: 'Attention', probability: 0.55 },
    { domain: 'Action', probability: 0.21 },
];

export const EXAMPLE_NICLIP_TASKS: INiClipTask[] = [
    { task: 'Visual perception', probability: 0.21, bayesFactor: 14.2 },
    { task: 'Motion detection', probability: 0.14, bayesFactor: 7.1 },
    { task: 'Spatial attention', probability: 0.09, bayesFactor: 1 },
];

export const EXAMPLE_ATLAS_READOUTS: IAtlasReadout[] = [
    { atlas: 'Example cortical atlas', region: 'Occipital cortex', percentage: 72 },
    { atlas: 'Example subcortical atlas', region: 'No example label', percentage: 0 },
];

export const makeExamplePreview = (request: IDecodeRunRequest, scenario: DecodeFixtureScenario): IDecodePreview => ({
    modelId: request.modelId,
    modelVersion: request.modelVersion,
    parameters: { ...request.parameters },
    termMetric: 'correlation',
    provenance: FIXTURE_PROVENANCE,
    terms:
        scenario === 'empty-terms'
            ? []
            : EXAMPLE_TERMS.slice(
                  0,
                  request.modelId === 'neurovlm'
                      ? Number(request.parameters.resultLimit ?? EXAMPLE_TERMS.length)
                      : EXAMPLE_TERMS.length
              ),
    studies: scenario === 'empty-studies' ? [] : makeExampleStudies(request),
    modelSummary: {
        narrative: 'Illustrative model summary — no decoder was called.',
        domains: EXAMPLE_NICLIP_DOMAINS.map(({ domain, probability }) => ({ label: domain, probability })),
        tasks: EXAMPLE_NICLIP_TASKS.map(({ task, probability, bayesFactor }) => ({
            label: task,
            probability,
            bayesFactor,
        })),
    },
    atlasReadouts: EXAMPLE_ATLAS_READOUTS,
});

/** @deprecated Use EMPTY_DECODE_DRAFT. Kept until input components migrate. */
export const EMPTY_DECODE_SUBMISSION: import('./Decode.types').IDecodeSubmission = {
    source: 'upload' as const,
    file: null,
    neurovaultReference: '',
    metadata: {
        mapType: '',
        analysisLevel: '',
        modality: '',
        subjectCount: '',
        thresholding: '',
        targetTemplate: '',
        contrast: '',
        cognitiveTask: null,
        interpretation: '',
    },
    subjectWarningAcknowledged: false,
};

export const COGNITIVE_TASK_OPTIONS: ICognitiveTaskOption[] = [
    { id: 'visual-perception', label: 'Visual perception' },
    { id: 'response-inhibition', label: 'Response inhibition' },
    { id: 'working-memory', label: 'Working memory' },
];

/** @deprecated Use EXAMPLE_TERMS. */
export const EXAMPLE_DECODED_TERMS: IDecodedTerm[] = EXAMPLE_TERMS;
/** @deprecated Use EXAMPLE_DECODED_TERMS. */
export const EXAMPLE_LEGACY_TERMS = EXAMPLE_DECODED_TERMS;
