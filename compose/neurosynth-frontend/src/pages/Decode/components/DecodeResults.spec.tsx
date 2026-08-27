import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DECODE_MODELS, EXAMPLE_TERMS, makeExamplePreview } from '../Decode.fixtures';
import { COGNITIVE_ATLAS_CONCEPTS } from '../Decode.vocabulary';
import type {
    DecodeModelId,
    DecodeResultView,
    IDecodeComparableResult,
    IDecodePreviewState,
    IDecodeRunRequest,
    IViewerState,
} from '../Decode.types';
import DecodeComparison from './DecodeComparison';
import DecodeResults from './DecodeResults';

const requestFor = (modelId: DecodeModelId, prior: 'literature' | 'uniform' = 'literature'): IDecodeRunRequest => ({
    source: { kind: 'neurovault', imageId: '25' },
    metadata: {
        mapType: 'z',
        analysisLevel: 'group',
        modality: 'fmri-bold',
        subjectCount: '121',
        cognitiveTask: null,
        interpretation: '',
    },
    concepts: [{ id: 'trm_4a3fd79d0b4b5', label: 'visual perception', vocabulary: 'Cognitive Atlas' }],
    interpretation: 'Visual processing',
    modelId,
    modelVersion: 'fixture-v1',
    parameters: modelId === 'niclip' ? { prior, evidenceThreshold: 3 } : { resultLimit: 50 },
});

const successfulPreview = (modelId: DecodeModelId = 'neurovlm', prior: 'literature' | 'uniform' = 'literature') => {
    const request = requestFor(modelId, prior);
    return { status: 'success' as const, request, preview: makeExamplePreview(request, 'success') };
};

const visualFixture = EXAMPLE_TERMS.find(({ label }) => label === 'visual perception')!;
const visualTerm: IDecodeComparableResult = {
    id: visualFixture.id,
    kind: 'term',
    label: visualFixture.label,
    mapLabel: 'visual perception meta-analytic map',
    mapUrl: visualFixture.mapUrl,
};
const onChooseTerm = vi.fn();
const onViewerStateChange = vi.fn();

const renderComparison = ({ selectedResult }: { selectedResult?: IDecodeComparableResult }) => {
    const Harness = () => {
        const [viewerState, setViewerState] = useState<IViewerState>({ x: 4, y: -6, z: 18, threshold: 25 });
        return (
            <DecodeComparison
                sourceLabel="NeuroVault image 25"
                selectedResult={selectedResult}
                viewerState={viewerState}
                onChooseTerm={onChooseTerm}
                onViewerStateChange={(nextState) => {
                    onViewerStateChange(nextState);
                    setViewerState(nextState);
                }}
            />
        );
    };

    onChooseTerm.mockClear();
    onViewerStateChange.mockClear();
    return render(<Harness />);
};

const renderResults = (state: Extract<IDecodePreviewState, { status: 'success' }> = successfulPreview()) => {
    const Harness = () => {
        const [activeView, setActiveView] = useState<DecodeResultView>('terms');
        const [selectedResult, setSelectedResult] = useState<IDecodeComparableResult>();
        const [viewerState, setViewerState] = useState<IViewerState>({ x: 0, y: 0, z: 0, threshold: 0 });
        const model = DECODE_MODELS.find(({ id }) => id === state.preview.modelId)!;

        return (
            <DecodeResults
                activeView={activeView}
                preview={state.preview}
                model={model}
                selectedResult={selectedResult}
                sourceLabel="NeuroVault image 25"
                viewerState={viewerState}
                onViewChange={setActiveView}
                onSelectComparison={setSelectedResult}
                onViewerStateChange={setViewerState}
            />
        );
    };
    return render(<Harness />);
};

it('makes terms the first and default result view', () => {
    renderResults();
    const tabs = screen.getAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual([
        'Terms',
        'Associated studies',
        'Model summary',
        'Compare maps',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('columnheader', { name: 'Correlation' })).toBeVisible();
});

it('uses enough official Cognitive Atlas fixture terms to exercise pagination', () => {
    const officialIds = new Set(COGNITIVE_ATLAS_CONCEPTS.map(({ id }) => id));
    expect(EXAMPLE_TERMS).toHaveLength(65);
    expect(EXAMPLE_TERMS.every(({ id }) => officialIds.has(id))).toBe(true);
});

it('honors the validated NeuroVLM result limit while retaining pagination', () => {
    const request = { ...requestFor('neurovlm'), parameters: { resultLimit: 12 } };
    const preview = makeExamplePreview(request, 'success');
    expect(preview.terms).toHaveLength(12);
    expect(preview.terms.map(({ rank }) => rank)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
});

it('renders only registry-declared result views and normalizes an unavailable active view', () => {
    const state = successfulPreview();
    const onViewChange = vi.fn();
    const termsOnlyModel = { ...DECODE_MODELS[0], outputViews: ['terms' as const] };

    render(
        <DecodeResults
            activeView="compare"
            preview={state.preview}
            model={termsOnlyModel}
            sourceLabel="NeuroVault image 25"
            viewerState={{ x: 0, y: 0, z: 0, threshold: 0 }}
            onViewChange={onViewChange}
            onSelectComparison={vi.fn()}
            onViewerStateChange={vi.fn()}
        />
    );

    expect(screen.getAllByRole('tab').map(({ textContent }) => textContent)).toEqual(['Terms']);
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Compare selected result' })).not.toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith('terms');
});

it('states whether each study matches the input, selected concept, or both', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('tab', { name: 'Associated studies' }));

    expect(screen.getAllByText('Matches input and selected concept').length).toBeGreaterThan(0);
    expect(screen.getByText(/Example et al\..*2024/)).toBeVisible();
    const relatedMap = screen.getAllByRole('link', { name: 'Open related map' })[0];
    expect(relatedMap).toHaveAttribute('href', 'https://neurovault.org/images/25/');
    expect(relatedMap).toHaveAttribute('target', '_blank');
    expect(relatedMap).toHaveAttribute('rel', 'noopener noreferrer');
});

it('uses the same search, sort, page-size, and pagination pattern for studies', async () => {
    const user = userEvent.setup();
    renderResults();
    await user.click(screen.getByRole('tab', { name: 'Associated studies' }));

    expect(screen.getByRole('searchbox', { name: 'Search associated studies' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sort associated studies' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Study results per page' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('51–55 of 55')).toBeVisible();
});

it('derives study provenance from the concepts in the immutable request', async () => {
    const request = { ...requestFor('neurovlm'), concepts: [] };
    renderResults({ status: 'success', request, preview: makeExamplePreview(request, 'success') });
    await userEvent.click(screen.getByRole('tab', { name: 'Associated studies' }));
    expect(screen.getAllByText('Matches input only').length).toBeGreaterThan(0);
    expect(screen.queryByText('Matches input and selected concept')).not.toBeInTheDocument();
});

it('keeps fixture provenance and the reverse-inference limit visible in every view', async () => {
    const user = userEvent.setup();
    renderResults();

    for (const tabName of ['Terms', 'Associated studies', 'Model summary', 'Compare maps']) {
        await user.click(screen.getByRole('tab', { name: tabName }));
        expect(screen.getByText('Illustrative example — no decoder was called')).toBeVisible();
        expect(screen.getByText(/NeuroVLM · fixture-v1/)).toBeVisible();
        expect(screen.getByText(/resultLimit: 50/)).toBeVisible();
        expect(
            screen.getByText(/ranked associations do not establish the cognitive state that produced the input/i)
        ).toBeVisible();
    }
});

it('shows NeuroVLM ranked concepts and its example narrative in the model summary', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('tab', { name: 'Model summary' }));

    expect(screen.getByText('Illustrative model summary — no decoder was called.')).toBeVisible();
    expect(screen.getByRole('list', { name: 'NeuroVLM ranked concepts' })).toBeVisible();
    expect(screen.getByText(/Correlation values describe signed spatial association/i)).toBeVisible();
    expect(screen.getByText(/visual perception · correlation 0\.312/i)).toBeVisible();
    expect(screen.getByText(/About NeuroVLM decoding/)).toBeVisible();
    expect(screen.getByText(DECODE_MODELS[0].interpretationNote)).toBeVisible();
});

it('distinguishes NiCLIP posteriors and Bayes factors from the literature prior', async () => {
    const user = userEvent.setup();
    renderResults(successfulPreview('niclip'));

    await user.click(screen.getByRole('tab', { name: 'Model summary' }));

    expect(screen.getByLabelText('NiCLIP domains')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Posterior probability' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Bayes factor' })).toBeVisible();
    expect(screen.getByText(/posterior probabilities incorporate a literature-derived prior/i)).toBeVisible();
    expect(screen.getByText(/Bayes factors express the change in evidence from that prior/i)).toBeVisible();
    expect(screen.getByText(/About NiCLIP decoding/)).toBeVisible();
});

it('explains NiCLIP quantities relative to a uniform preview prior', async () => {
    const user = userEvent.setup();
    renderResults(successfulPreview('niclip', 'uniform'));

    await user.click(screen.getByRole('tab', { name: 'Model summary' }));

    expect(screen.getByText(/posterior probabilities incorporate the selected uniform prior/i)).toBeVisible();
    expect(screen.getByText(/Bayes factors express the change in evidence from that uniform prior/i)).toBeVisible();
    expect(screen.queryByText(/literature-derived prior/i)).not.toBeInTheDocument();
});

it('distinguishes a Bayes factor of exactly one from weak evidence', async () => {
    renderResults(successfulPreview('niclip'));
    await userEvent.click(screen.getByRole('tab', { name: 'Model summary' }));
    expect(screen.getByRole('cell', { name: 'no evidence change' })).toBeVisible();
});

it('renders model, metric, parameters, and fixture provenance from the preview snapshot', () => {
    const state = successfulPreview();
    const resultState = {
        ...state,
        preview: {
            ...state.preview,
            modelId: 'niclip' as const,
            modelVersion: 'result-model-v9',
            parameters: { prior: 'uniform', evidenceThreshold: 7 },
            termMetric: 'bayes-factor' as const,
            provenance: {
                kind: 'illustrative' as const,
                label: 'Result snapshot provenance',
                version: 'result-fixture-v9',
            },
            terms: [{ ...state.preview.terms[0], metric: 'similarity' as const, value: 8.4 }],
        },
    };

    renderResults(resultState);

    expect(screen.getByText('Result snapshot provenance')).toBeVisible();
    expect(screen.getByText(/NiCLIP · result-model-v9/)).toBeVisible();
    expect(screen.getByText(/prior: uniform/)).toBeVisible();
    expect(screen.getByText(/evidenceThreshold: 7/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Bayes factor' })).toBeVisible();
    expect(screen.queryByText('Illustrative example — no decoder was called')).not.toBeInTheDocument();
});

it('keeps every result panel mounted with reciprocal tab relationships and one accessible panel', () => {
    renderResults();

    const tabs = screen.getAllByRole('tab');
    const panels = screen.getAllByRole('tabpanel', { hidden: true });

    expect(panels).toHaveLength(4);
    tabs.forEach((tab) => {
        const panel = panels.find(({ id }) => id === tab.getAttribute('aria-controls'));
        expect(tab.id).not.toBe('');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    });
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(document.getElementById('decode-result-panel-terms')).not.toHaveAttribute('hidden');
    expect(document.getElementById('decode-result-panel-studies')).toHaveAttribute('hidden');
    expect(
        within(document.getElementById('decode-result-panel-studies')!).getByText(/Example et al/)
    ).toBeInTheDocument();
});

it('opens comparison only after selecting a result and choosing compare', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('button', { name: 'Select visual perception for comparison' }));
    expect(screen.getByRole('tab', { name: 'Terms' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Compare selected result' }));
    expect(screen.getByRole('tab', { name: 'Compare maps' })).toHaveFocus();
    expect(screen.getByText('NeuroVault image 25')).toBeVisible();
    expect(screen.getByText('visual perception meta-analytic map')).toBeVisible();
});

it('renders a selected study related-map label verbatim in both comparison modes', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('tab', { name: 'Associated studies' }));
    await user.click(
        screen.getByRole('button', { name: 'Select Illustrative visual processing study for comparison' })
    );
    await user.click(screen.getByRole('button', { name: 'Compare selected result' }));

    expect(screen.getByText('Illustrative visual processing study related map')).toBeVisible();
    expect(screen.queryByText('Illustrative visual processing study meta-analytic map')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Overlay' }));
    expect(screen.getByText('Illustrative visual processing study related map')).toBeVisible();
    expect(screen.queryByText('Illustrative visual processing study meta-analytic map')).not.toBeInTheDocument();
});

it('directs an empty comparison back to term selection', async () => {
    const user = userEvent.setup();
    renderResults();

    await user.click(screen.getByRole('tab', { name: 'Compare maps' }));
    await user.click(screen.getByRole('button', { name: 'Choose a term' }));

    const termsTab = screen.getByRole('tab', { name: 'Terms' });
    expect(termsTab).toHaveAttribute('aria-selected', 'true');
    expect(termsTab).toHaveFocus();
});

it('preserves the selected result while switching comparison modes', async () => {
    renderComparison({ selectedResult: visualTerm });

    expect(screen.getByText('visual perception meta-analytic map')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Overlay' }));

    expect(screen.getByText('visual perception meta-analytic map')).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Input map opacity' })).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Comparison map opacity' })).toBeVisible();
});

it('offers a direct route back to terms when nothing comparable is selected', async () => {
    renderComparison({ selectedResult: undefined });

    await userEvent.click(screen.getByRole('button', { name: 'Choose a term' }));

    expect(onChooseTerm).toHaveBeenCalledOnce();
});

it('uses one synchronized coordinate and threshold for both side-by-side panes', async () => {
    renderComparison({ selectedResult: visualTerm });

    expect(screen.getByRole('radiogroup', { name: 'Comparison layout' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Input map pane' })).toHaveTextContent(
        'x 4 · y −6 · z 18 · threshold 25%'
    );
    expect(screen.getByRole('region', { name: 'Comparison map pane' })).toHaveTextContent(
        'x 4 · y −6 · z 18 · threshold 25%'
    );
    expect(screen.getAllByText('Map placeholder — no image loaded')).toHaveLength(2);

    await userEvent.clear(screen.getByLabelText('Comparison x coordinate'));
    await userEvent.type(screen.getByLabelText('Comparison x coordinate'), '12');

    expect(onViewerStateChange).toHaveBeenLastCalledWith({ x: 12, y: -6, z: 18, threshold: 25 });
    expect(screen.getByRole('region', { name: 'Input map pane' })).toHaveTextContent(
        'x 12 · y −6 · z 18 · threshold 25%'
    );
    expect(screen.getByRole('region', { name: 'Comparison map pane' })).toHaveTextContent(
        'x 12 · y −6 · z 18 · threshold 25%'
    );
});

it('labels independent overlay opacity and named color presets', async () => {
    renderComparison({ selectedResult: visualTerm });

    await userEvent.click(screen.getByRole('radio', { name: 'Overlay' }));

    expect(screen.getByText('Map placeholder — no image loaded')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Input map color' })).toHaveValue('deep-navy');
    expect(screen.getByRole('combobox', { name: 'Comparison map color' })).toHaveValue('slice-cyan');
    expect(screen.getAllByRole('option', { name: 'Deep coordinate navy' })).toHaveLength(2);
    expect(screen.getAllByRole('option', { name: 'Slice cyan' })).toHaveLength(2);
});

it('keeps overlay title text at theme contrast while retaining cyan for the comparison graphic', async () => {
    renderComparison({ selectedResult: visualTerm });

    await userEvent.click(screen.getByRole('radio', { name: 'Overlay' }));

    expect(screen.getByText('visual perception meta-analytic map')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.87)' });
    expect(screen.getByRole('combobox', { name: 'Comparison map color' })).toHaveValue('slice-cyan');
});
