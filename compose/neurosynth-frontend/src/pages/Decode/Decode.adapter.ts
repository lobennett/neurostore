import { FIXTURE_PROVENANCE, makeExamplePreview } from './Decode.fixtures';
import type { IDecodeFrontendAdapter } from './Decode.types';

export const createFixtureDecodeAdapter = (): IDecodeFrontendAdapter => ({
    preview: (request, scenario) => {
        if (scenario === 'loading') return { status: 'loading', request };
        if (scenario === 'unsupported') {
            return {
                status: 'error',
                operation: 'Model compatibility',
                request,
                message: 'The example model does not support this input.',
            };
        }
        if (scenario === 'lookup-error') {
            return {
                status: 'error',
                operation: 'NeuroVault lookup',
                request,
                message: 'The example NeuroVault lookup failed.',
            };
        }
        if (scenario === 'decode-error') {
            return { status: 'error', operation: 'Decoder', request, message: 'The example decoder run failed.' };
        }
        return { status: 'success', request, preview: makeExamplePreview(request, scenario), provenance: FIXTURE_PROVENANCE };
    },
});
