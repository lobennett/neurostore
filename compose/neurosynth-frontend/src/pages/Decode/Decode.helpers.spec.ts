import { describe, expect, it } from 'vitest';
import { EMPTY_DECODE_DRAFT, EMPTY_DECODE_SUBMISSION } from './Decode.fixtures';
import {
    buildDecodeRunRequest,
    isAcceptedNiftiFilename,
    isPreviewStale,
    parseNeurovaultImageId,
    validateDecodeDraft,
    validateDecodeSubmission,
} from './Decode.helpers';
import type { IDecodeDraft } from './Decode.types';

const completeDraft = (overrides: Partial<IDecodeDraft> = {}): IDecodeDraft => ({
    ...EMPTY_DECODE_DRAFT,
    neurovaultReference: 'https://neurovault.org/images/25/',
    metadata: {
        ...EMPTY_DECODE_DRAFT.metadata,
        mapType: 'z',
        analysisLevel: 'group',
        modality: 'fmri-bold',
        subjectCount: '121',
    },
    modelParameters: { resultLimit: 50 },
    ...overrides,
});

describe('decode input helpers', () => {
    it.each(['map.nii', 'map.nii.gz', 'MAP.NII.GZ'])('accepts the supported NIfTI filename %s', (filename) => {
        expect(isAcceptedNiftiFilename(filename)).toBe(true);
    });

    it.each(['map.nii.zip', 'map.gz', 'map', ''])('rejects the unsupported filename %s', (filename) => {
        expect(isAcceptedNiftiFilename(filename)).toBe(false);
    });

    it.each([
        ['308', '308'],
        ['https://neurovault.org/images/308/', '308'],
        ['https://www.neurovault.org/api/images/308?format=json', '308'],
    ])('normalizes NeuroVault reference %s', (reference, expected) => {
        expect(parseNeurovaultImageId(reference)).toBe(expected);
    });

    it.each([
        '0',
        '-1',
        'https://example.org/images/308/',
        'https://neurovault.org/collections/308/',
        'https://neurovault.org/images/not-a-number/',
    ])('rejects non-image NeuroVault reference %s', (reference) => {
        expect(parseNeurovaultImageId(reference)).toBeNull();
    });

    it('reports every missing required value', () => {
        expect(validateDecodeSubmission(EMPTY_DECODE_SUBMISSION)).toEqual({
            source: 'Choose a NIfTI file.',
            mapType: 'Choose a map type.',
            analysisLevel: 'Choose an analysis level.',
            modality: 'Choose a modality.',
            subjectCount: 'Enter the number of subjects.',
        });
    });

    it('requires acknowledgement for subject-level maps', () => {
        expect(
            validateDecodeSubmission({
                ...EMPTY_DECODE_SUBMISSION,
                file: new File(['map'], 'map.nii'),
                metadata: {
                    ...EMPTY_DECODE_SUBMISSION.metadata,
                    mapType: 'z',
                    analysisLevel: 'subject',
                    modality: 'fmri-bold',
                    subjectCount: '1',
                },
            }).subjectWarningAcknowledged
        ).toBe('Acknowledge the subject-level warning to continue.');
    });

    it('builds a request from only the active NeuroVault source', () => {
        const draft = completeDraft({
            activeSource: 'neurovault',
            neurovaultReference: 'https://neurovault.org/images/25/',
            file: new File(['unused'], 'unused.nii.gz'),
        });
        expect(buildDecodeRunRequest(draft).source).toEqual({ kind: 'neurovault', imageId: '25' });
    });

    it('validates every coordinate against the displayed MNI limits', () => {
        const draft = completeDraft({
            activeSource: 'coordinates',
            coordinates: [{ id: 'p1', label: '', x: '91', y: '0', z: '0' }],
        });
        expect(validateDecodeDraft(draft).coordinates).toContain('x must be between -90 and 90');
    });

    it('requires every MNI coordinate value to be a finite number', () => {
        const draft = completeDraft({
            activeSource: 'coordinates',
            coordinates: [{ id: 'p1', label: '', x: '', y: '0', z: '0' }],
        });
        expect(validateDecodeDraft(draft).coordinates).toContain('x must be a finite number');
    });

    it('requires deposit consent only for a local file', () => {
        expect(validateDecodeDraft(completeDraft({ activeSource: 'upload', depositConsent: false })).depositConsent).toBe(
            'Accept the public CC0 deposit terms to continue.'
        );
        expect(validateDecodeDraft(completeDraft({ activeSource: 'neurovault' })).depositConsent).toBeUndefined();
    });

    it('marks scientific input changes stale but ignores viewer display changes', () => {
        const draft = completeDraft({ modelId: 'neurovlm' });
        const request = buildDecodeRunRequest(draft);
        expect(isPreviewStale({ ...draft, modelParameters: { resultLimit: 100 } }, request)).toBe(true);
        expect(isPreviewStale(draft, request)).toBe(false);
    });
});
