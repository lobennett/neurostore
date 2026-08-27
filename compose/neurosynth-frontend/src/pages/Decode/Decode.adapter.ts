import { makeExamplePreview } from './Decode.fixtures';
import { loadGoldenWalkthrough } from './Decode.golden';
import type { IDecodeFrontendAdapter } from './Decode.types';

export class DecodePreviewError extends Error {
    constructor(
        readonly operation: string,
        message: string
    ) {
        super(message);
        this.name = 'DecodePreviewError';
    }
}

export const createFixtureDecodeAdapter = (): IDecodeFrontendAdapter => ({
    preview: async (request, scenario) => {
        if (request.exampleId === 'neurovault-308') {
            if (request.source.kind !== 'neurovault' || request.source.imageId !== '308') {
                throw new DecodePreviewError('Recorded example', 'The recorded walkthrough requires NeuroVault image 308.');
            }
            if (request.modelId !== 'neurosynth-pearson-recorded') {
                throw new DecodePreviewError('Recorded example', 'The recorded walkthrough requires the Neurosynth Pearson model.');
            }
            return (await loadGoldenWalkthrough()).preview;
        }
        if (scenario === 'loading') return new Promise(() => undefined);
        if (scenario === 'unsupported') {
            throw new DecodePreviewError('Model compatibility', 'The example model does not support this input.');
        }
        if (scenario === 'lookup-error') {
            throw new DecodePreviewError('NeuroVault lookup', 'The example NeuroVault lookup failed.');
        }
        if (scenario === 'decode-error') {
            throw new DecodePreviewError('Decoder', 'The example decoder run failed.');
        }
        return makeExamplePreview(request, scenario);
    },
});
