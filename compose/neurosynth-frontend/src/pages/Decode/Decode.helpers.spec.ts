import { describe, expect, it } from 'vitest';
import { EMPTY_DECODE_DRAFT, EMPTY_DECODE_SUBMISSION } from './Decode.fixtures';
import { makeGoldenWalkthroughDraft } from './Decode.golden';
import {
    buildDecodeRunRequest,
    isAcceptedNiftiFilename,
    isCanonicalGoldenDraft,
    isPreviewStale,
    parseNeurovaultImageId,
    sortTerms,
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
    it('sorts signed correlations by absolute magnitude without changing their signs', () => {
        const terms = [
            { id: 'medial', label: 'medial', rank: 4, metric: 'correlation' as const, value: 0.3 },
            { id: 'negative', label: 'negative', rank: 3, metric: 'correlation' as const, value: -0.307 },
            { id: 'motor', label: 'motor', rank: 2, metric: 'correlation' as const, value: 0.395 },
            { id: 'premotor', label: 'premotor', rank: 1, metric: 'correlation' as const, value: 0.442 },
        ];

        expect(sortTerms(terms, 'magnitude', 'desc').map(({ value }) => value)).toEqual([0.442, 0.395, -0.307, 0.3]);
    });

    it('recognizes canonical walkthrough inputs while preserving free-text interpretation', () => {
        const draft = makeGoldenWalkthroughDraft('reviewer notes');

        expect(draft.metadata.cognitiveTask).toEqual({ id: 'trm_5346938eed092', label: 'Landmark task' });
        expect(isCanonicalGoldenDraft(draft)).toBe(true);
        expect(isCanonicalGoldenDraft({ ...draft, interpretation: 'different notes' })).toBe(true);
        expect(
            isCanonicalGoldenDraft({
                ...draft,
                metadata: { ...draft.metadata, subjectCount: '11' },
            })
        ).toBe(false);
    });

    it('rejects the recorded model outside the canonical walkthrough state', () => {
        const draft = makeGoldenWalkthroughDraft('');

        expect(validateDecodeDraft({ ...draft, exampleId: null }).modelId).toBe(
            'The recorded example is available only for the canonical NeuroVault 308 walkthrough.'
        );
        expect(
            validateDecodeDraft({
                ...draft,
                metadata: { ...draft.metadata, modality: 'eeg' },
            }).modelId
        ).toBe('The recorded example is available only for the canonical NeuroVault 308 walkthrough.');
    });

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

    it.each([
        ['meta-analysis', 'meta-analysis'],
        ['other', 'other'],
    ] as const)('omits retained participant count from a %s request', (_, analysisLevel) => {
        const draft = completeDraft({
            metadata: {
                ...completeDraft().metadata,
                analysisLevel,
                subjectCount: '121',
            },
        });

        expect(buildDecodeRunRequest(draft).metadata).toEqual({
            mapType: 'z',
            analysisLevel,
            modality: 'fmri-bold',
            subjectCount: '',
            cognitiveTask: null,
            interpretation: '',
        });
    });

    it('validates every coordinate against the displayed MNI limits', () => {
        const draft = completeDraft({
            activeSource: 'coordinates',
            coordinates: [{ id: 'p1', label: '', x: '91', y: '0', z: '0' }],
        });
        expect(validateDecodeDraft(draft).coordinates).toEqual({
            p1: { x: 'Point 1: x must be between -90 and 90.' },
        });
    });

    it('requires every MNI coordinate value to be a finite number', () => {
        const draft = completeDraft({
            activeSource: 'coordinates',
            coordinates: [{ id: 'p1', label: '', x: '', y: '0', z: '0' }],
        });
        expect(validateDecodeDraft(draft).coordinates).toEqual({ p1: { x: 'Point 1: x must be a finite number.' } });
    });

    it('requires deposit consent only for a local file', () => {
        expect(
            validateDecodeDraft(completeDraft({ activeSource: 'upload', depositConsent: false })).depositConsent
        ).toBe('Accept the public CC0 deposit terms to continue.');
        expect(validateDecodeDraft(completeDraft({ activeSource: 'neurovault' })).depositConsent).toBeUndefined();
    });

    it('rejects a model that does not support the active source', () => {
        const draft = completeDraft({
            activeSource: 'coordinates',
            coordinates: [{ id: 'p1', label: '', x: '0', y: '0', z: '0' }],
            modelId: 'niclip',
        });
        expect(validateDecodeDraft(draft).modelId).toBe('NiCLIP does not support MNI coordinates.');
        expect(() => buildDecodeRunRequest(draft)).toThrow('Cannot build a decoder request from an invalid draft.');
    });

    it.each([
        ['', 'Number of term results is required.'],
        [Number.NaN, 'Number of term results must be a finite number.'],
        [-1, 'Number of term results must be at least 1.'],
        [2.5, 'Number of term results must be a whole number.'],
    ])('rejects invalid registry-defined integer parameter %s', (resultLimit, expectedError) => {
        const draft = completeDraft({ modelParameters: { resultLimit } });

        expect(validateDecodeDraft(draft).modelParameters?.resultLimit).toBe(expectedError);
        expect(() => buildDecodeRunRequest(draft)).toThrow('Cannot build a decoder request from an invalid draft.');
    });

    it('rejects a select value outside the selected model parameter schema', () => {
        const draft = completeDraft({
            modelId: 'niclip',
            modelParameters: { prior: 'unsupported', evidenceThreshold: 3 },
        });

        expect(validateDecodeDraft(draft).modelParameters?.prior).toBe('Choose a valid NiCLIP prior.');
    });

    it('marks scientific input changes stale but ignores viewer display changes', () => {
        const draft = completeDraft({ modelId: 'neurovlm' });
        const request = buildDecodeRunRequest(draft);
        expect(isPreviewStale({ ...draft, modelParameters: { resultLimit: 100 } }, request)).toBe(true);
        expect(isPreviewStale(draft, request)).toBe(false);
    });

    it('serializes confirmed official concepts and treats confirmation as a stale scientific change', () => {
        const draft = completeDraft();
        const request = buildDecodeRunRequest(draft);
        const suggestion = {
            id: 'trm_4a3fd79d0af66',
            label: 'response inhibition',
            vocabulary: 'Cognitive Atlas' as const,
        };
        const confirmed = { ...draft, concepts: [suggestion], confirmedSuggestions: [suggestion] };
        expect(buildDecodeRunRequest(confirmed).concepts).toEqual([suggestion]);
        expect(isPreviewStale(confirmed, request)).toBe(true);
    });

    it('includes non-content file metadata in upload identity', () => {
        const first = completeDraft({
            activeSource: 'upload',
            file: new File(['a'], 'same.nii.gz', { type: 'application/gzip', lastModified: 10 }),
            fileSelectionId: 1,
            depositConsent: true,
        });
        const request = buildDecodeRunRequest(first);
        const second = {
            ...first,
            file: new File(['b'], 'same.nii.gz', { type: 'application/gzip', lastModified: 10 }),
            fileSelectionId: 2,
        };
        expect(request.source).toEqual(
            expect.objectContaining({
                filename: 'same.nii.gz',
                size: 1,
                mediaType: 'application/gzip',
                lastModified: 10,
                selectionId: 1,
            })
        );
        expect(isPreviewStale(second, request)).toBe(true);
    });
});
