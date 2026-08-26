export type DecodeSource = 'upload' | 'neurovault';
export type DecodeMapType = '' | 'z' | 't';
export type DecodeAnalysisLevel = '' | 'group' | 'subject';
export type DecodeModality = '' | 'fmri-bold' | 'pet' | 'other';
export type DecodeResultView = 'terms' | 'niclip' | 'compare';

export interface ICognitiveTaskOption {
    id: string;
    label: string;
}

export interface IDecodeMetadata {
    mapType: DecodeMapType;
    analysisLevel: DecodeAnalysisLevel;
    modality: DecodeModality;
    subjectCount: string;
    cognitiveTask: ICognitiveTaskOption | null;
    interpretation: string;
}

export interface IDecodeSubmission {
    source: DecodeSource;
    file: File | null;
    neurovaultReference: string;
    metadata: IDecodeMetadata;
    subjectWarningAcknowledged: boolean;
}

export type IDecodeValidationErrors = Partial<
    Record<'source' | 'mapType' | 'analysisLevel' | 'modality' | 'subjectCount' | 'subjectWarningAcknowledged', string>
>;

export interface IDecodedTerm {
    term: string;
    correlation: number;
}

export interface INiClipDomain {
    domain: string;
    probability: number;
}

export interface INiClipTask {
    task: string;
    probability: number;
    bayesFactor: number;
}
