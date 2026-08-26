import type { DecodeAnalysisLevel, DecodeMapType, DecodeModality, ISelectOption } from './Decode.types';

export const MAP_TYPE_OPTIONS: ISelectOption<Exclude<DecodeMapType, ''>>[] = [
    { value: 'z', label: 'Z statistic map' },
    { value: 't', label: 'T statistic map' },
];

export const ANALYSIS_LEVEL_OPTIONS: ISelectOption<Exclude<DecodeAnalysisLevel, ''>>[] = [
    { value: 'group', label: 'Group' },
    { value: 'subject', label: 'Subject' },
    { value: 'meta-analysis', label: 'Meta-analysis' },
    { value: 'other', label: 'Other' },
];

export const NEUROVAULT_MODALITY_OPTIONS: ISelectOption<Exclude<DecodeModality, ''>>[] = [
    { value: 'fmri-bold', label: 'fMRI BOLD' },
    { value: 'fmri-cbf', label: 'fMRI CBF' },
    { value: 'fmri-cbv', label: 'fMRI CBV' },
    { value: 'diffusion-mri', label: 'Diffusion MRI' },
    { value: 'structural-mri', label: 'Structural MRI' },
    { value: 'fdg-pet', label: 'FDG PET' },
    { value: 'oxygen-water-pet', label: 'Oxygen-water PET' },
    { value: 'other-pet', label: 'Other PET' },
    { value: 'meg', label: 'MEG' },
    { value: 'eeg', label: 'EEG' },
    { value: 'other', label: 'Other' },
];

export const MNI_LIMITS = {
    x: { min: -90, max: 90 },
    y: { min: -126, max: 90 },
    z: { min: -72, max: 108 },
} as const;
