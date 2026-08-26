import { describe, expect, it } from 'vitest';
import { EMPTY_DECODE_SUBMISSION } from './Decode.fixtures';
import { isAcceptedNiftiFilename, parseNeurovaultImageId, validateDecodeSubmission } from './Decode.helpers';

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
});
