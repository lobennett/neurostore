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

export const EMPTY_DECODE_DRAFT: IDecodeDraft = {
    activeSource: 'neurovault',
    neurovaultReference: '',
    file: null,
    coordinates: [],
    depositConsent: false,
    metadata: {
        mapType: '',
        analysisLevel: '',
        modality: '',
        subjectCount: '',
        cognitiveTask: null,
        interpretation: '',
    },
    concepts: [],
    interpretation: '',
    confirmedSuggestions: [],
    subjectWarningAcknowledged: false,
    modelId: 'neurovlm',
    modelParameters: { resultLimit: 50 },
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
            'Posterior probabilities include a literature-derived prior; Bayes factors show the change from that prior.',
    },
];

export const FIXTURE_PROVENANCE: IDecodeProvenance = {
    kind: 'fixture',
    label: 'Illustrative example — no decoder was called',
    version: 'fixture-v1',
};

export const EXAMPLE_TERMS: Array<IDecodeTerm & IDecodedTerm> = [
    {
        id: 'trm_visual',
        label: 'visual',
        rank: 1,
        metric: 'correlation',
        value: 0.312,
        mapUrl: '/maps/example-visual',
        term: 'visual',
        correlation: 0.312,
    },
    {
        id: 'trm_occipital',
        label: 'occipital',
        rank: 2,
        metric: 'correlation',
        value: 0.268,
        mapUrl: '/maps/example-occipital',
        term: 'occipital',
        correlation: 0.268,
    },
    {
        id: 'trm_baseline',
        label: 'baseline',
        rank: 3,
        metric: 'correlation',
        value: 0,
        mapUrl: '/maps/example-baseline',
        term: 'baseline',
        correlation: 0,
    },
    {
        id: 'trm_language',
        label: 'language',
        rank: 4,
        metric: 'correlation',
        value: -0.118,
        mapUrl: '/maps/example-language',
        term: 'language',
        correlation: -0.118,
    },
];

export const EXAMPLE_STUDIES: IDecodeStudy[] = [
    {
        id: 'example-study-001',
        title: 'Illustrative visual processing study',
        authors: 'Example et al.',
        year: 2024,
        matchBasis: 'Matches input and selected concept',
        url: '/studies/example-study-001',
        mapUrl: '/maps/example-study-001',
    },
];

export const EXAMPLE_NICLIP_DOMAINS: INiClipDomain[] = [
    { domain: 'Perception', probability: 0.78 },
    { domain: 'Attention', probability: 0.55 },
    { domain: 'Action', probability: 0.21 },
];

export const EXAMPLE_NICLIP_TASKS: INiClipTask[] = [
    { task: 'Visual perception', probability: 0.21, bayesFactor: 14.2 },
    { task: 'Motion detection', probability: 0.14, bayesFactor: 7.1 },
    { task: 'Spatial attention', probability: 0.09, bayesFactor: 4.3 },
];

export const EXAMPLE_ATLAS_READOUTS: IAtlasReadout[] = [
    { atlas: 'Example cortical atlas', region: 'Occipital cortex', percentage: 72 },
    { atlas: 'Example subcortical atlas', region: 'No example label', percentage: 0 },
];

export const makeExamplePreview = (request: IDecodeRunRequest, scenario: DecodeFixtureScenario): IDecodePreview => ({
    modelId: request.modelId,
    modelVersion: request.modelVersion,
    parameters: { ...request.parameters },
    terms: scenario === 'empty-terms' ? [] : EXAMPLE_TERMS,
    studies: scenario === 'empty-studies' ? [] : EXAMPLE_STUDIES,
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
export const EMPTY_DECODE_SUBMISSION = {
    source: 'upload' as const,
    file: null,
    neurovaultReference: '',
    metadata: {
        mapType: '',
        analysisLevel: '',
        modality: '',
        subjectCount: '',
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
