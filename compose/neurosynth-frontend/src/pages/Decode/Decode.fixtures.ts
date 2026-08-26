import type { IDecodeSubmission, IDecodedTerm, INiClipDomain, INiClipTask, ICognitiveTaskOption } from './Decode.types';

export const EMPTY_DECODE_SUBMISSION: IDecodeSubmission = {
    source: 'upload',
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

export const EXAMPLE_TERMS: IDecodedTerm[] = [
    { term: 'visual', correlation: 0.312 },
    { term: 'occipital', correlation: 0.268 },
    { term: 'baseline', correlation: 0 },
    { term: 'language', correlation: -0.118 },
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
