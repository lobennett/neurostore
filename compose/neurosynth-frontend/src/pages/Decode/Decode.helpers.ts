import type { IDecodeSubmission, IDecodeValidationErrors } from './Decode.types';

const POSITIVE_INTEGER = /^[1-9]\d*$/;
const NEUROVAULT_HOSTS = new Set(['neurovault.org', 'www.neurovault.org']);

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
