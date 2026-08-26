import { MNI_LIMITS } from './Decode.constants';
import { DECODE_MODELS } from './Decode.fixtures';
import type { IDecodeDraft, IDecodeRunRequest, IDecodeSubmission, IDecodeValidationErrors, IMniPoint } from './Decode.types';

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
        if (!['http:', 'https:'].includes(url.protocol) || !NEUROVAULT_HOSTS.has(url.hostname.toLowerCase())) return null;
        return url.pathname.match(/^\/(?:api\/)?images\/([1-9]\d*)\/?$/)?.[1] ?? null;
    } catch {
        return null;
    }
};

const coordinateErrors = (point: IMniPoint): string[] =>
    (Object.entries(MNI_LIMITS) as Array<[keyof typeof MNI_LIMITS, (typeof MNI_LIMITS)[keyof typeof MNI_LIMITS]]>).flatMap(
        ([axis, limits]) => {
            const value = Number(point[axis]);
            if (!point[axis].trim() || !Number.isFinite(value)) return [`${axis} must be a finite number`];
            return value < limits.min || value > limits.max ? [`${axis} must be between ${limits.min} and ${limits.max}`] : [];
        }
    );

export const validateDecodeDraft = (draft: IDecodeDraft): IDecodeValidationErrors => {
    const errors: IDecodeValidationErrors = {};
    const model = DECODE_MODELS.find(({ id }) => id === draft.modelId);
    if (!model) errors.modelId = 'Choose a supported decoder model.';
    else if (!model.supportedSources.includes(draft.activeSource)) {
        errors.modelId = `${model.name} does not support ${SOURCE_LABELS[draft.activeSource]}.`;
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
        const errorsByPoint = draft.coordinates.flatMap(coordinateErrors);
        if (draft.coordinates.length === 0) errors.coordinates = ['Add at least one valid MNI coordinate.'];
        else if (errorsByPoint.length) errors.coordinates = errorsByPoint;
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
              ? { kind: 'upload' as const, filename: draft.file!.name, license: 'CC0' as const }
              : {
                    kind: 'coordinates' as const,
                    points: draft.coordinates.map(({ id, label, x, y, z }) => ({ id, label, x: Number(x), y: Number(y), z: Number(z) })),
                };
    return {
        source,
        ...(source.kind === 'coordinates' ? {} : { metadata: { ...draft.metadata } }),
        concepts: [...draft.concepts],
        interpretation: draft.interpretation,
        modelId: draft.modelId,
        modelVersion: model.version,
        parameters: { ...draft.modelParameters },
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
    else if (!POSITIVE_INTEGER.test(submission.metadata.subjectCount.trim())) errors.subjectCount = 'Enter a positive whole number.';
    if (submission.metadata.analysisLevel === 'subject' && !submission.subjectWarningAcknowledged) {
        errors.subjectWarningAcknowledged = 'Acknowledge the subject-level warning to continue.';
    }
    return errors;
};
