import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { createFixtureDecodeAdapter } from './Decode.adapter';
import type { DecodeFixtureScenario, IDecodeFrontendAdapter } from './Decode.types';
import DecodePage from './DecodePage';

afterEach(() => {
    window.history.replaceState({}, '', '/');
});

const completeNeurovaultDraft = async () => {
    await userEvent.type(screen.getByLabelText('NeuroVault image URL or ID'), '25');
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '121');
};

const openPreview = async () => {
    render(<DecodePage />);
    await completeNeurovaultDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
};

const previewValidNeurovaultInput = async () => {
    await userEvent.type(screen.getByLabelText('NeuroVault image URL or ID'), 'https://neurovault.org/images/25/');
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '121');
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
};

it('defaults to NeuroVLM and shows only its parameters', () => {
    render(<DecodePage />);

    expect(screen.getByRole('radio', { name: /NeuroVLM/ })).toBeChecked();
    expect(screen.getByLabelText('Number of term results')).toHaveValue(50);
    expect(screen.queryByLabelText('NiCLIP prior')).not.toBeInTheDocument();
});

it('blocks the decoder workspace from Sentry Replay capture without changing its content', () => {
    render(<DecodePage />);
    expect(screen.getByRole('main')).toHaveAttribute('data-sentry-block', 'true');
    expect(screen.getByRole('heading', { name: 'Decode a brain map' })).toBeVisible();
});

it('renders model-specific defaults from the registry schema', async () => {
    render(<DecodePage />);

    await userEvent.click(screen.getByRole('radio', { name: /NiCLIP/ }));

    expect(screen.queryByLabelText('Number of term results')).not.toBeInTheDocument();
    expect(screen.getByLabelText('NiCLIP prior')).toHaveValue('literature');
    expect(screen.getByLabelText('Evidence threshold')).toHaveValue(3);
});

it('explains and corrects an incompatible model and source', async () => {
    render(<DecodePage />);

    await userEvent.click(screen.getByRole('radio', { name: /NiCLIP/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'MNI coordinates' }));

    expect(screen.getByText('NiCLIP does not support MNI coordinates.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Use NeuroVLM instead' }));
    expect(screen.getByRole('radio', { name: /NeuroVLM/ })).toBeChecked();
});

it('places the explicit fixture action beside its no-upload disclosure', () => {
    render(<DecodePage />);

    const disclosure = screen.getByText('No map is uploaded and no decoder is run.');
    expect(within(disclosure.parentElement!).getByRole('button', { name: 'Preview example results' })).toBeDisabled();
});

it('records model version and non-default parameters in the preview summary', async () => {
    render(<DecodePage />);
    await completeNeurovaultDraft();
    await userEvent.clear(screen.getByLabelText('Number of term results'));
    await userEvent.type(screen.getByLabelText('Number of term results'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));

    const requestSummary = screen.getByRole('complementary');
    expect(within(requestSummary).getByText(/NeuroVLM.*fixture-v1/)).toBeVisible();
    expect(within(requestSummary).getByText(/Number of term results: 100/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Example decoder results ready.');
});

it('marks results stale after a scientific input changes and previews again explicitly', async () => {
    await openPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'eeg');

    expect(screen.getByRole('status')).toHaveTextContent('Inputs changed. Preview again to refresh example results.');
    expect(screen.getByRole('region', { name: 'Illustrative decoder results' })).toBeVisible();
    expect(screen.getByText('This example preview is out of date.')).toBeVisible();
    expect(screen.getByText(/Declared input: group-level · z statistic · fMRI-BOLD · 121 subjects/)).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    expect(screen.queryByText('This example preview is out of date.')).not.toBeInTheDocument();
    expect(screen.getByText(/Declared input: group-level · z statistic · EEG · 121 subjects/)).toBeVisible();
}, 10_000);

it('uses the successful preview snapshot for result navigation and comparison', async () => {
    await openPreview();
    const results = screen.getByRole('region', { name: 'Illustrative decoder results' });

    expect(within(results).getByRole('note')).toHaveTextContent('Illustrative example — no decoder was called');
    expect(screen.getByRole('tab', { name: 'Terms' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Select visual perception for comparison' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected result' }));
    expect(screen.getAllByText('NeuroVault image 25')).toHaveLength(2);
});

it('hands the immutable adapter snapshot to the result explorer', async () => {
    const fixtureAdapter = createFixtureDecodeAdapter();
    const snapshotAdapter: IDecodeFrontendAdapter = {
        preview: async (request, scenario) => {
            const preview = await fixtureAdapter.preview(request, scenario);
            return {
                ...preview,
                modelId: 'niclip',
                modelVersion: 'result-model-v9',
                parameters: { prior: 'uniform', evidenceThreshold: 7 },
                termMetric: 'bayes-factor',
                provenance: {
                    kind: 'illustrative' as const,
                    label: 'Adapter result snapshot',
                    version: 'result-fixture-v9',
                },
                terms: [
                    {
                        id: 'trm_snapshot_only',
                        label: 'snapshot-only concept',
                        rank: 1,
                        metric: 'similarity' as const,
                        value: 8.4,
                        mapUrl: '/maps/example-snapshot-only',
                    },
                ],
            };
        },
    };
    render(<DecodePage adapter={snapshotAdapter} />);
    await completeNeurovaultDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));

    expect(screen.getByRole('button', { name: 'Select snapshot-only concept for comparison' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Select visual for comparison' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bayes factor' })).toBeVisible();
    expect(screen.getByText('Adapter result snapshot')).toBeVisible();
    expect(screen.getByText(/NiCLIP · result-model-v9/)).toBeVisible();
    expect(screen.getByText(/prior: uniform/)).toBeVisible();
});

it('resets the draft, preview, navigation, and source focus', async () => {
    await openPreview();
    await userEvent.click(screen.getByRole('button', { name: 'Start another preview' }));

    expect(screen.queryByRole('region', { name: 'Illustrative decoder results' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'NeuroVault image' })).toHaveFocus();
    expect(screen.getByLabelText('NeuroVault image URL or ID')).toHaveValue('');
    expect(screen.getByRole('radio', { name: /NeuroVLM/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Preview example results' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Preview reset. Choose another map source.');
});

it.each([
    ['lookup-error', 'Example NeuroVault lookup failed'],
    ['decode-error', 'Example decoder run failed'],
] as Array<[DecodeFixtureScenario, string]>)('keeps %s inside the decoder workspace', async (scenario, message) => {
    render(<DecodePage initialFixtureScenario={scenario} />);

    await previewValidNeurovaultInput();

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Try preview again' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit inputs' })).toBeVisible();
    expect(screen.getByDisplayValue('https://neurovault.org/images/25/')).toBeInTheDocument();
    expect(screen.queryByText(/return home/i)).not.toBeInTheDocument();
});

it('names model compatibility errors inline and keeps correction in the workspace', async () => {
    render(<DecodePage initialFixtureScenario="unsupported" />);

    await previewValidNeurovaultInput();

    expect(screen.getByRole('alert')).toHaveTextContent('Model compatibility');
    expect(screen.getByRole('alert')).toHaveTextContent(/example model does not support this input/i);
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    expect(screen.getByLabelText('NeuroVault image URL or ID')).toHaveValue('https://neurovault.org/images/25/');
});

it('renders a timer-free, busy loading state inside the decoder workspace', async () => {
    render(<DecodePage initialFixtureScenario="loading" />);

    await previewValidNeurovaultInput();

    expect(screen.getByRole('region', { name: 'Decoder preview loading' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Preparing illustrative preview…')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it.each([
    ['empty-terms', 'Terms', 'No example term results are available for this preview.'],
    ['empty-studies', 'Associated studies', 'No example associated studies are available for this preview.'],
] as Array<[DecodeFixtureScenario, string, string]>)(
    'shows %s inside its result tab',
    async (scenario, tab, message) => {
        render(<DecodePage initialFixtureScenario={scenario} />);
        await previewValidNeurovaultInput();

        await userEvent.click(screen.getByRole('tab', { name: tab }));

        const panel = screen.getByRole('tabpanel', { name: tab });
        expect(panel).toHaveAccessibleName(tab);
        expect(within(panel).getByText(message)).toBeVisible();
    }
);

it('retries an inline failure with the same preserved draft', async () => {
    const fixtureAdapter = createFixtureDecodeAdapter();
    let attempts = 0;
    const retryAdapter: IDecodeFrontendAdapter = {
        preview: async (request) => {
            attempts += 1;
            return fixtureAdapter.preview(request, attempts === 1 ? 'lookup-error' : 'success');
        },
    };
    render(<DecodePage adapter={retryAdapter} />);
    await previewValidNeurovaultInput();

    await userEvent.click(screen.getByRole('button', { name: 'Try preview again' }));

    expect(screen.getByRole('region', { name: 'Illustrative decoder results' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    expect(screen.getByLabelText('NeuroVault image URL or ID')).toHaveValue('https://neurovault.org/images/25/');
});

it('accepts an exact development fixture query scenario without using draft query content', async () => {
    window.history.replaceState({}, '', '/decode?fixture=empty-terms&draft=https://secret.example/map.nii');
    render(<DecodePage />);
    await previewValidNeurovaultInput();

    expect(screen.getByText('No example term results are available for this preview.')).toBeVisible();
});

it('falls back to success for an invalid development fixture query scenario', async () => {
    window.history.replaceState({}, '', '/decode?fixture=empty-Terms');
    render(<DecodePage />);
    await previewValidNeurovaultInput();

    expect(screen.getByRole('button', { name: 'Select visual perception for comparison' })).toBeVisible();
});

it('lets the page own loading and success around a Promise-based adapter', async () => {
    const fixtureAdapter = createFixtureDecodeAdapter();
    let resolvePreview!: (preview: Awaited<ReturnType<IDecodeFrontendAdapter['preview']>>) => void;
    const adapter: IDecodeFrontendAdapter = {
        preview: () => new Promise((resolve) => (resolvePreview = resolve)),
    };
    render(<DecodePage adapter={adapter} />);
    await completeNeurovaultDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    expect(screen.getByRole('region', { name: 'Decoder preview loading' })).toBeVisible();

    const request = {
        source: { kind: 'neurovault' as const, imageId: '25' },
        metadata: {
            mapType: 'z' as const,
            analysisLevel: 'group' as const,
            modality: 'fmri-bold' as const,
            subjectCount: '121',
            cognitiveTask: null,
            interpretation: '',
        },
        concepts: [],
        interpretation: '',
        modelId: 'neurovlm' as const,
        modelVersion: 'fixture-v1',
        parameters: { resultLimit: 50 },
    };
    resolvePreview(await fixtureAdapter.preview(request, 'success'));
    expect(await screen.findByRole('region', { name: 'Illustrative decoder results' })).toBeVisible();
});

it('ignores an older preview Promise that settles after a newer attempt', async () => {
    const fixtureAdapter = createFixtureDecodeAdapter();
    const pending: Array<{
        request: Parameters<IDecodeFrontendAdapter['preview']>[0];
        resolve: (preview: Awaited<ReturnType<IDecodeFrontendAdapter['preview']>>) => void;
    }> = [];
    const adapter: IDecodeFrontendAdapter = {
        preview: (request) =>
            new Promise((resolve) => {
                pending.push({ request, resolve });
            }),
    };
    render(<DecodePage adapter={adapter} />);
    await completeNeurovaultDraft();
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));

    const secondPreview = await fixtureAdapter.preview(pending[1].request, 'success');
    await act(async () => {
        pending[1].resolve({
            ...secondPreview,
            provenance: { ...secondPreview.provenance, label: 'Second attempt result' },
        });
    });
    expect(await screen.findByText('Second attempt result')).toBeVisible();

    const firstPreview = await fixtureAdapter.preview(pending[0].request, 'success');
    await act(async () => {
        pending[0].resolve({
            ...firstPreview,
            provenance: { ...firstPreview.provenance, label: 'Superseded first attempt' },
        });
    });
    expect(screen.getByText('Second attempt result')).toBeVisible();
    expect(screen.queryByText('Superseded first attempt')).not.toBeInTheDocument();
});

it('does not duplicate a failure in the polite status region', async () => {
    render(<DecodePage initialFixtureScenario="lookup-error" />);
    await previewValidNeurovaultInput();
    expect(await screen.findByRole('alert')).toHaveTextContent('Example NeuroVault lookup failed');
    expect(screen.getByRole('status')).toHaveTextContent('');
});

it('marks an upload preview stale when a different same-name file is selected after renewed consent', async () => {
    render(<DecodePage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));
    const first = new File(['same-size'], 'same-map.nii.gz', { type: 'application/gzip', lastModified: 100 });
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), first);
    await userEvent.click(screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ }));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    await screen.findByRole('region', { name: 'Illustrative decoder results' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit inputs' }));
    const second = new File(['different'], 'same-map.nii.gz', {
        type: 'application/gzip',
        lastModified: 100,
    });
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), second);
    await userEvent.click(screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ }));
    expect(await screen.findByText('This example preview is out of date.')).toBeVisible();
});

it('shows an explicitly illustrative CC0 receipt without claiming a deposit occurred', async () => {
    render(<DecodePage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'example-map.nii.gz'));
    await userEvent.click(screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ }));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '121');
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));

    const receipt = screen.getByRole('region', { name: 'Example deposit receipt' });
    expect(receipt).toHaveTextContent('CC0');
    expect(receipt).toHaveTextContent('example-map.nii.gz');
    expect(receipt).toHaveTextContent('example-deposit-001');
    expect(receipt).toHaveTextContent('Illustrative only — no deposit occurred.');
});
