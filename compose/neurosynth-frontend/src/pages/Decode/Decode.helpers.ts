import { MNI_LIMITS } from './Decode.constants';
import { DECODE_MODELS, RECORDED_PEARSON_MODEL } from './Decode.fixtures';
import { makeGoldenWalkthroughDraft } from './Decode.golden';
import type {
    IDecodeDraft,
    IDecodeParameterDefinition,
    IDecodeRunRequest,
    IDecodeSubmission,
    IDecodeTerm,
    IDecodeValidationErrors,
    IMniPoint,
} from './Decode.types';

export type DecodeTermSort = 'rank' | 'label' | 'magnitude' | 'value';
export type DecodeSortDirection = 'asc' | 'desc';

export const filterTerms = (terms: IDecodeTerm[], query: string): IDecodeTerm[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return terms;
    return terms.filter(({ id, label }) => `${id} ${label}`.toLocaleLowerCase().includes(normalizedQuery));
};

export const sortTerms = (
    terms: IDecodeTerm[],
    sort: DecodeTermSort,
    direction: DecodeSortDirection
): IDecodeTerm[] => {
    const factor = direction === 'asc' ? 1 : -1;
    return [...terms].sort((left, right) => {
        const comparison =
            sort === 'label'
                ? left.label.localeCompare(right.label, undefined, { numeric: true })
                : sort === 'magnitude'
                  ? Math.abs(left.value) - Math.abs(right.value)
                  : sort === 'value'
                    ? left.value - right.value
                    : left.rank - right.rank;
        return comparison * factor || left.rank - right.rank;
    });
};

export const paginate = <T>(
    items: T[],
    page: number,
    pageSize: number
): { items: T[]; start: number; end: number; total: number; pageCount: number } => {
    const total = items.length;
    const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = pageCount === 0 ? 0 : Math.min(Math.max(page, 0), pageCount - 1);
    const offset = safePage * pageSize;
    return {
        items: items.slice(offset, offset + pageSize),
        start: total === 0 ? 0 : offset + 1,
        end: Math.min(offset + pageSize, total),
        total,
        pageCount,
    };
};

const POSITIVE_INTEGER = /^[1-9]\d*$/;
const NEUROVAULT_HOSTS = new Set(['neurovault.org', 'www.neurovault.org']);
const SOURCE_LABELS = {
    neurovault: 'NeuroVault images',
    upload: 'uploaded NIfTI files',
    coordinates: 'MNI coordinates',
} as const;

export const isAcceptedNiftiFilename = (filename: string): boolean => /\.nii(?:\.gz)?$/i.test(filename);

export const parseNeurovaultImageId = (value: string): string | null => {
    const trimmed = value.trim();
    if (POSITIVE_INTEGER.test(trimmed)) return trimmed;
    try {
        const url = new URL(trimmed);
        if (!['http:', 'https:'].includes(url.protocol) || !NEUROVAULT_HOSTS.has(url.hostname.toLowerCase()))
            return null;
        return url.pathname.match(/^\/(?:api\/)?images\/([1-9]\d*)\/?$/)?.[1] ?? null;
    } catch {
        return null;
    }
};

export const isCanonicalGoldenDraft = (draft: IDecodeDraft): boolean => {
    const canonical = makeGoldenWalkthroughDraft('');
    return (
        draft.activeSource === canonical.activeSource &&
        draft.neurovaultReference === canonical.neurovaultReference &&
        draft.metadata.mapType === canonical.metadata.mapType &&
        draft.metadata.analysisLevel === canonical.metadata.analysisLevel &&
        draft.metadata.modality === canonical.metadata.modality &&
        draft.metadata.subjectCount === canonical.metadata.subjectCount &&
        JSON.stringify(draft.metadata.cognitiveTask) === JSON.stringify(canonical.metadata.cognitiveTask) &&
        JSON.stringify(draft.concepts) === JSON.stringify(canonical.concepts) &&
        draft.exampleId === canonical.exampleId &&
        draft.modelId === canonical.modelId &&
        JSON.stringify(draft.modelParameters) === JSON.stringify(canonical.modelParameters)
    );
};

const coordinateErrors = (
    point: IMniPoint,
    index: number
): NonNullable<IDecodeValidationErrors['coordinates']>[string] =>
    Object.fromEntries(
        (
            Object.entries(MNI_LIMITS) as Array<[keyof typeof MNI_LIMITS, (typeof MNI_LIMITS)[keyof typeof MNI_LIMITS]]>
        ).flatMap(([axis, limits]) => {
            const value = Number(point[axis]);
            const pointName = point.label.trim() || `Point ${index + 1}`;
            if (!point[axis].trim() || !Number.isFinite(value))
                return [[axis, `${pointName}: ${axis} must be a finite number.`]];
            return value < limits.min || value > limits.max
                ? [[axis, `${pointName}: ${axis} must be between ${limits.min} and ${limits.max}.`]]
                : [];
        })
    );

const validateModelParameter = (
    definition: IDecodeParameterDefinition,
    value: string | number | boolean | undefined
): string | undefined => {
    if (value === undefined || value === '') return `${definition.label} is required.`;
    switch (definition.kind) {
        case 'integer':
        case 'number':
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return `${definition.label} must be a finite number.`;
            }
            if (definition.kind === 'integer' && !Number.isInteger(value)) {
                return `${definition.label} must be a whole number.`;
            }
            if (definition.min !== undefined && value < definition.min) {
                return `${definition.label} must be at least ${definition.min}.`;
            }
            if (definition.max !== undefined && value > definition.max) {
                return `${definition.label} must be at most ${definition.max}.`;
            }
            return undefined;
        case 'boolean':
            return typeof value === 'boolean' ? undefined : `${definition.label} must be selected.`;
        case 'select':
            return typeof value === 'string' && definition.options?.some((option) => option.value === value)
                ? undefined
                : `Choose a valid ${definition.label}.`;
        default: {
            const exhaustiveKind: never = definition.kind;
            return exhaustiveKind;
        }
    }
};

export const validateDecodeDraft = (draft: IDecodeDraft): IDecodeValidationErrors => {
    const errors: IDecodeValidationErrors = {};
    const model = DECODE_MODELS.find(({ id }) => id === draft.modelId);
    if (!model) errors.modelId = 'Choose a supported decoder model.';
    else {
        if (model.id === RECORDED_PEARSON_MODEL.id && !isCanonicalGoldenDraft(draft)) {
            errors.modelId = 'The recorded example is available only for the canonical NeuroVault 308 walkthrough.';
        } else if (!model.supportedSources.includes(draft.activeSource)) {
            errors.modelId = `${model.name} does not support ${SOURCE_LABELS[draft.activeSource]}.`;
        }
        const modelParameters = Object.fromEntries(
            model.parameters.flatMap((definition) => {
                const error = validateModelParameter(definition, draft.modelParameters[definition.key]);
                return error ? [[definition.key, error]] : [];
            })
        );
        if (Object.keys(modelParameters).length) errors.modelParameters = modelParameters;
    }
    if (draft.activeSource === 'upload') {
        if (!draft.file) errors.source = 'Choose a NIfTI file.';
        else if (!isAcceptedNiftiFilename(draft.file.name)) errors.source = 'Choose a .nii or .nii.gz file.';
        if (!draft.depositConsent) errors.depositConsent = 'Accept the public CC0 deposit terms to continue.';
    }
    if (draft.activeSource === 'neurovault' && !parseNeurovaultImageId(draft.neurovaultReference)) {
        errors.source = 'Enter a NeuroVault image ID or image URL.';
    }
    if (draft.activeSource === 'coordinates') {
        if (draft.coordinates.length === 0) errors.source = 'Add at least one valid MNI coordinate.';
        else {
            const errorsByPoint = Object.fromEntries(
                draft.coordinates.flatMap((point, index) => {
                    const pointErrors = coordinateErrors(point, index);
                    return Object.keys(pointErrors).length ? [[point.id, pointErrors]] : [];
                })
            );
            if (Object.keys(errorsByPoint).length) errors.coordinates = errorsByPoint;
        }
        return errors;
    }
    if (!draft.metadata.mapType) errors.mapType = 'Choose a map type.';
    if (!draft.metadata.analysisLevel) errors.analysisLevel = 'Choose an analysis level.';
    if (!draft.metadata.modality) errors.modality = 'Choose a modality.';
    if (draft.metadata.analysisLevel === 'group' || draft.metadata.analysisLevel === 'subject') {
        if (!draft.metadata.subjectCount.trim()) errors.subjectCount = 'Enter the number of subjects.';
        else if (!POSITIVE_INTEGER.test(draft.metadata.subjectCount.trim())) {
            errors.subjectCount = 'Enter a positive whole number.';
        }
    }
    if (draft.metadata.analysisLevel === 'subject' && !draft.subjectWarningAcknowledged) {
        errors.subjectWarningAcknowledged = 'Acknowledge the subject-level warning to continue.';
    }
    return errors;
};

const hasErrors = (errors: IDecodeValidationErrors) => Object.values(errors).some((value) => value !== undefined);

export const buildDecodeRunRequest = (draft: IDecodeDraft): IDecodeRunRequest => {
    if (hasErrors(validateDecodeDraft(draft))) throw new Error('Cannot build a decoder request from an invalid draft.');
    const model = DECODE_MODELS.find(({ id }) => id === draft.modelId);
    if (!model) throw new Error('Cannot build a decoder request for an unknown model.');
    const source =
        draft.activeSource === 'neurovault'
            ? { kind: 'neurovault' as const, imageId: parseNeurovaultImageId(draft.neurovaultReference)! }
            : draft.activeSource === 'upload'
              ? {
                    kind: 'upload' as const,
                    filename: draft.file!.name,
                    license: 'CC0' as const,
                    size: draft.file!.size,
                    mediaType: draft.file!.type,
                    lastModified: draft.file!.lastModified,
                    selectionId: draft.fileSelectionId,
                }
              : {
                    kind: 'coordinates' as const,
                    points: draft.coordinates.map(({ id, label, x, y, z }) => ({
                        id,
                        label,
                        x: Number(x),
                        y: Number(y),
                        z: Number(z),
                    })),
                };
    const metadata = {
        ...draft.metadata,
        subjectCount:
            draft.metadata.analysisLevel === 'group' || draft.metadata.analysisLevel === 'subject'
                ? draft.metadata.subjectCount
                : '',
    };
    return {
        source,
        ...(source.kind === 'coordinates' ? {} : { metadata }),
        concepts: [...draft.concepts],
        interpretation: draft.interpretation,
        modelId: draft.modelId,
        modelVersion: model.version,
        parameters: { ...draft.modelParameters },
        ...(draft.exampleId ? { exampleId: draft.exampleId } : {}),
    };
};

export const isPreviewStale = (draft: IDecodeDraft, request: IDecodeRunRequest): boolean => {
    try {
        return JSON.stringify(buildDecodeRunRequest(draft)) !== JSON.stringify(request);
    } catch {
        return true;
    }
};

/** @deprecated Use validateDecodeDraft. Kept until existing input components migrate. */
export const validateDecodeSubmission = (submission: IDecodeSubmission): IDecodeValidationErrors => {
    const errors: IDecodeValidationErrors = {};
    if (submission.source === 'upload') {
        if (!submission.file) errors.source = 'Choose a NIfTI file.';
        else if (!isAcceptedNiftiFilename(submission.file.name)) errors.source = 'Choose a .nii or .nii.gz file.';
    } else if (!parseNeurovaultImageId(submission.neurovaultReference)) {
        errors.source = 'Enter a NeuroVault image ID or image URL.';
    }
    if (!submission.metadata.mapType) errors.mapType = 'Choose a map type.';
    if (!submission.metadata.analysisLevel) errors.analysisLevel = 'Choose an analysis level.';
    if (!submission.metadata.modality) errors.modality = 'Choose a modality.';
    if (!submission.metadata.subjectCount.trim()) errors.subjectCount = 'Enter the number of subjects.';
    else if (!POSITIVE_INTEGER.test(submission.metadata.subjectCount.trim()))
        errors.subjectCount = 'Enter a positive whole number.';
    if (submission.metadata.analysisLevel === 'subject' && !submission.subjectWarningAcknowledged) {
        errors.subjectWarningAcknowledged = 'Acknowledge the subject-level warning to continue.';
    }
    return errors;
};
