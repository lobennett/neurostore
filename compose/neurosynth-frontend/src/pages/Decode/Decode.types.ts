export type DecodeSourceKind = 'neurovault' | 'upload' | 'coordinates';
export type DecodeExampleId = 'neurovault-308';
export type DecodeModelId = 'neurovlm' | 'niclip' | 'neurosynth-pearson-recorded';
export type DecodeStatisticType = 'anatomical' | 't' | 'z';
export type DecodeMetric = 'similarity' | 'correlation' | 'probability' | 'bayes-factor';
export type DecodeFixtureScenario =
    'success' | 'loading' | 'empty-terms' | 'empty-studies' | 'unsupported' | 'lookup-error' | 'decode-error';

export type DecodeMapType = '' | 'z' | 't';
export type DecodeAnalysisLevel = '' | 'group' | 'subject' | 'meta-analysis' | 'other';
export type DecodeThresholding = '' | 'unthresholded';
export type DecodeTargetTemplate = '' | 'GenericMNI';
export type DecodeModality =
    | ''
    | 'fmri-bold'
    | 'fmri-cbf'
    | 'fmri-cbv'
    | 'diffusion-mri'
    | 'structural-mri'
    | 'fdg-pet'
    | 'oxygen-water-pet'
    | 'other-pet'
    | 'meg'
    | 'eeg'
    | 'other';
export type DecodeResultView = 'terms' | 'studies' | 'model-summary' | 'compare';
export type DecodeComparisonMode = 'side-by-side' | 'overlay';

export interface ISelectOption<T extends string = string> {
    value: T;
    label: string;
}

export interface ICognitiveTaskOption {
    id: string;
    label: string;
}

export interface ICognitiveConcept {
    id: string;
    label: string;
    vocabulary: 'Cognitive Atlas';
    definition?: string;
}

export interface IMniPoint {
    id: string;
    label: string;
    x: string;
    y: string;
    z: string;
}

export type DecodeRunSource =
    | { kind: 'neurovault'; imageId: string }
    | {
          kind: 'upload';
          filename: string;
          license: 'CC0';
          size: number;
          mediaType: string;
          lastModified: number;
          /** Opaque local identity for this file-selection event; no file content is read. */
          selectionId: number;
      }
    | { kind: 'coordinates'; points: Array<{ id: string; label: string; x: number; y: number; z: number }> };

export interface IDecodeMetadata {
    mapType: DecodeMapType;
    analysisLevel: DecodeAnalysisLevel;
    modality: DecodeModality;
    subjectCount: string;
    thresholding: DecodeThresholding;
    targetTemplate: DecodeTargetTemplate;
    contrast: string;
    /** @deprecated Replaced by the concepts field on IDecodeDraft. */
    cognitiveTask: ICognitiveTaskOption | null;
    /** @deprecated Replaced by the interpretation field on IDecodeDraft. */
    interpretation: string;
}

export interface IDecodeDraft {
    activeSource: DecodeSourceKind;
    neurovaultReference: string;
    file: File | null;
    fileSelectionId: number;
    coordinates: IMniPoint[];
    depositConsent: boolean;
    metadata: IDecodeMetadata;
    concepts: ICognitiveConcept[];
    interpretation: string;
    confirmedSuggestions: ICognitiveConcept[];
    subjectWarningAcknowledged: boolean;
    exampleId: DecodeExampleId | null;
    modelId: DecodeModelId;
    modelParameters: Record<string, string | number | boolean>;
}

export interface IDecodeRunRequest {
    source: DecodeRunSource;
    metadata?: IDecodeMetadata;
    concepts: ICognitiveConcept[];
    interpretation: string;
    modelId: DecodeModelId;
    modelVersion: string;
    parameters: Record<string, string | number | boolean>;
    exampleId?: DecodeExampleId;
}

export type DecodeParameterKind = 'integer' | 'number' | 'boolean' | 'select';

export interface IDecodeParameterDefinition {
    key: string;
    label: string;
    kind: DecodeParameterKind;
    defaultValue: string | number | boolean;
    description?: string;
    min?: number;
    max?: number;
    options?: ISelectOption[];
}

export interface IDecodeModelDefinition {
    id: DecodeModelId;
    name: string;
    purpose: string;
    version: string;
    supportedSources: DecodeSourceKind[];
    inputRequirements: string;
    parameters: IDecodeParameterDefinition[];
    outputViews: DecodeResultView[];
    interpretationNote: string;
    subjectLevelSuitability: string;
    exampleOnly?: DecodeExampleId;
}

export interface IDecodeTerm {
    id: string;
    label: string;
    rank: number;
    metric: DecodeMetric;
    value: number;
    definition?: string;
    mapUrl?: string;
}

export interface IDecodeStudy {
    id: string;
    title: string;
    authors: string;
    year: number;
    matchBasis: string;
    url?: string;
    mapUrl?: string;
}

export interface IAtlasReadout {
    atlas: string;
    region: string;
    percentage: number;
}

export interface IDecodeModelSummary {
    narrative: string;
    domains?: Array<{ label: string; probability: number }>;
    tasks?: Array<{ label: string; probability: number; bayesFactor: number }>;
}

export interface IDecodePreview {
    modelId: DecodeModelId;
    modelVersion: string;
    parameters: Record<string, string | number | boolean>;
    termMetric: DecodeMetric;
    provenance: IDecodeProvenance;
    terms: IDecodeTerm[];
    studies: IDecodeStudy[];
    modelSummary: IDecodeModelSummary;
    atlasReadouts: IAtlasReadout[];
    visualization?: IDecodeVisualization;
}

export interface IDecodeAssetProvenance {
    sourceUrl: string;
    license: 'CC0' | 'ODbL-derived';
    attribution?: string;
    sha256: string;
    bytes: number;
}

export interface IDecodeVolumeAsset {
    id: string;
    url: string;
    filename: string;
    kind: 'anatomical' | 'input-statistic' | 'association-z';
    statisticType: DecodeStatisticType;
    provenance: IDecodeAssetProvenance;
}

export interface IDecodeVisualization {
    anatomical: IDecodeVolumeAsset;
    input?: IDecodeVolumeAsset;
    comparisonByResultId: Record<string, IDecodeVolumeAsset>;
}

export type IDecodeProvenance =
    | { kind: 'illustrative'; label: string; version: string }
    | {
          kind: 'recorded';
          label: 'Recorded Neurosynth Pearson example';
          version: string;
          resultId: string;
          method: 'Pearson correlation';
          scoreDefinition: string;
          referenceDataset: 'terms_20k';
          retrievedAt: string;
          rankingRule: 'absolute-correlation-descending';
          sourceUrl: string;
          resultUrl: string;
          input: {
              imageId: string;
              sourceUrl: string;
              collectionId: string;
              collectionName: string;
              collectionUrl: string;
              doi: string;
              doiUrl: string;
              license: 'CC0';
              attribution: string;
              thresholding: 'unthresholded';
              targetTemplate: 'GenericMNI';
              cognitiveAtlasTask: ICognitiveTaskOption;
              contrast: string;
          };
          termMaps: {
              license: 'ODbL-derived';
              attribution: string;
          };
      };

export type IDecodePreviewState =
    | { status: 'loading'; request: IDecodeRunRequest }
    | { status: 'error'; operation: string; request: IDecodeRunRequest; message: string }
    | { status: 'success'; request: IDecodeRunRequest; preview: IDecodePreview };

export interface IDecodeFrontendAdapter {
    preview(request: IDecodeRunRequest, scenario: DecodeFixtureScenario): Promise<IDecodePreview>;
}

export interface IViewerState {
    x: number;
    y: number;
    z: number;
    threshold: number;
}

export interface IDecodeComparableResult {
    id: string;
    kind: 'term' | 'study';
    label: string;
    mapLabel: string;
    mapUrl?: string;
}

export type IDecodeParameterErrors = Partial<Record<string, string>>;
export type DecodeCoordinateAxis = 'x' | 'y' | 'z';
export type IDecodeCoordinateErrors = Record<string, Partial<Record<DecodeCoordinateAxis, string>>>;

export interface IDecodeValidationErrors {
    source?: string;
    modelId?: string;
    coordinates?: IDecodeCoordinateErrors;
    depositConsent?: string;
    mapType?: string;
    analysisLevel?: string;
    modality?: string;
    subjectCount?: string;
    subjectWarningAcknowledged?: string;
    modelParameters?: IDecodeParameterErrors;
}

/** @deprecated Use DecodeSourceKind and IDecodeDraft. */
export type DecodeSource = 'upload' | 'neurovault';

/** @deprecated Use IDecodeDraft. Kept until source components migrate. */
export interface IDecodeSubmission {
    source: DecodeSource;
    file: File | null;
    neurovaultReference: string;
    metadata: IDecodeMetadata;
    subjectWarningAcknowledged: boolean;
}

/** @deprecated Use IDecodeTerm. */
export interface IDecodedTerm {
    term: string;
    correlation: number;
}

/** @deprecated Use IDecodeModelSummary. */
export interface INiClipDomain {
    domain: string;
    probability: number;
}

/** @deprecated Use IDecodeModelSummary. */
export interface INiClipTask {
    task: string;
    probability: number;
    bayesFactor: number;
}
