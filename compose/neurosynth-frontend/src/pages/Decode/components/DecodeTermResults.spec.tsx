import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import type { DecodeMetric, IDecodeComparableResult, IDecodeTerm } from '../Decode.types';
import DecodeTermResults from './DecodeTermResults';

const makeTerms = (count: number, metric: DecodeMetric = 'similarity'): IDecodeTerm[] =>
    Array.from({ length: count }, (_, index) => {
        const rank = index + 1;
        return {
            id: `trm_${String(rank).padStart(3, '0')}`,
            label: rank % 10 === 0 ? `memory concept ${rank}` : `concept ${rank}`,
            rank,
            metric,
            value: Number((1 - index / Math.max(count, 1)).toFixed(3)),
            mapUrl: `/maps/example-term-${rank}`,
        };
    });

const renderTermResults = ({
    terms = makeTerms(3),
    metric = 'similarity',
    recorded = false,
}: {
    terms?: IDecodeTerm[];
    metric?: DecodeMetric;
    recorded?: boolean;
} = {}) => {
    const Harness = () => {
        const [selectedResult, setSelectedResult] = useState<IDecodeComparableResult>();
        return (
            <DecodeTermResults
                terms={terms}
                metric={metric}
                recorded={recorded}
                selectedResult={selectedResult}
                onSelectComparison={setSelectedResult}
                onCompareSelected={() => undefined}
            />
        );
    };
    return render(<Harness />);
};

it('defaults recorded correlations to strongest absolute magnitude first', () => {
    renderTermResults({
        recorded: true,
        metric: 'correlation',
        terms: [
            { id: 'medial', label: 'medial', rank: 20, metric: 'correlation', value: -0.298 },
            { id: 'posterior', label: 'posterior cingulate', rank: 16, metric: 'correlation', value: -0.307 },
            { id: 'premotor', label: 'premotor', rank: 1, metric: 'correlation', value: 0.442 },
        ],
    });

    expect(screen.getByRole('combobox', { name: 'Sort term results' })).toHaveValue('magnitude');
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveValue('desc');
    expect(within(screen.getByRole('combobox', { name: 'Sort term results' })).getByText('Magnitude')).toBeVisible();
    expect(within(screen.getByRole('combobox', { name: 'Sort direction' })).getByText('Strongest first')).toBeVisible();
    expect(
        screen
            .getAllByRole('row')
            .slice(1)
            .map((row) => within(row).getByRole('button').textContent)
    ).toEqual(['premotor', 'posterior cingulate', 'medial']);
    expect(screen.getByText(/Recorded terms from this walkthrough snapshot/)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Term / result ID' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Vocabulary ID' })).not.toBeInTheDocument();
});

it('keeps illustrative results on rank ascending by default', () => {
    renderTermResults();

    expect(screen.getByRole('combobox', { name: 'Sort term results' })).toHaveValue('rank');
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveValue('asc');
});

it('resets illustrative navigation to recorded magnitude defaults when provenance mode changes', async () => {
    const user = userEvent.setup();
    const props = {
        terms: makeTerms(3, 'correlation'),
        metric: 'correlation' as const,
        selectedResult: undefined,
        onSelectComparison: () => undefined,
        onCompareSelected: () => undefined,
    };
    const { rerender } = render(<DecodeTermResults {...props} recorded={false} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort term results' }), 'label');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort direction' }), 'desc');

    rerender(<DecodeTermResults {...props} recorded />);

    expect(screen.getByRole('combobox', { name: 'Sort term results' })).toHaveValue('magnitude');
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveValue('desc');
});

it('resets recorded navigation to illustrative rank defaults when provenance mode changes', async () => {
    const user = userEvent.setup();
    const props = {
        terms: makeTerms(3, 'correlation'),
        metric: 'correlation' as const,
        selectedResult: undefined,
        onSelectComparison: () => undefined,
        onCompareSelected: () => undefined,
    };
    const { rerender } = render(<DecodeTermResults {...props} recorded />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort term results' }), 'value');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort direction' }), 'asc');

    rerender(<DecodeTermResults {...props} recorded={false} />);

    expect(screen.getByRole('combobox', { name: 'Sort term results' })).toHaveValue('rank');
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveValue('asc');
});

it('selects mapped and unmapped recorded terms with accurate comparison affordances', async () => {
    const user = userEvent.setup();
    renderTermResults({
        recorded: true,
        metric: 'correlation',
        terms: [
            {
                id: 'premotor',
                label: 'premotor',
                rank: 1,
                metric: 'correlation',
                value: 0.442,
                mapUrl: '/decoder/examples/neurovault-308/premotor-association-z.nii.gz',
            },
            { id: 'motor', label: 'motor', rank: 2, metric: 'correlation', value: 0.395 },
        ],
    });

    expect(screen.getByRole('button', { name: 'Select premotor for comparison' })).toBeVisible();
    expect(screen.getByText('Map not bundled')).toBeVisible();
    const unmapped = screen.getByRole('button', { name: 'Select motor; comparison map not bundled' });
    await user.click(unmapped);
    expect(unmapped).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Compare selected result' })).toBeEnabled();
});

it('searches, sorts, and paginates model-labeled term results', async () => {
    const user = userEvent.setup();
    renderTermResults({ terms: makeTerms(65), metric: 'similarity' });

    expect(screen.getByRole('columnheader', { name: 'Similarity' })).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: 'Search term results' }), 'memory');
    expect(screen.getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText('1–6 of 6')).toBeVisible();

    await user.clear(screen.getByRole('searchbox', { name: 'Search term results' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('51–65 of 65')).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort term results' }), 'label');
    expect(screen.getByText('1–50 of 65')).toBeVisible();
    expect(within(screen.getAllByRole('row')[1]).getByText('concept 1')).toBeVisible();
});

it('resets pagination when the direction or page size changes', async () => {
    const user = userEvent.setup();
    renderTermResults({ terms: makeTerms(65) });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('51–65 of 65')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort direction' }), 'desc');
    expect(screen.getByText('1–50 of 65')).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Term results per page' }), '25');
    expect(screen.getByText('1–25 of 65')).toBeVisible();
});

it('describes descending numeric rank as worst rank first', async () => {
    renderTermResults();
    const direction = screen.getByRole('combobox', { name: 'Sort direction' });
    expect(within(direction).getByRole('option', { name: 'Worst rank first' })).toBeInTheDocument();
});

it('keeps a comparable selection while navigating away from its page', async () => {
    const user = userEvent.setup();
    renderTermResults({ terms: makeTerms(65) });

    const selectFirst = screen.getByRole('button', { name: 'Select concept 1 for comparison' });
    await user.click(selectFirst);
    expect(selectFirst).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('button', { name: 'Compare selected result' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByRole('button', { name: 'Select concept 1 for comparison' })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
});

it('keeps signed correlation values and a zero-centred display', () => {
    renderTermResults({
        metric: 'correlation',
        terms: [
            {
                id: 'language',
                label: 'language',
                rank: 1,
                value: -0.118,
                metric: 'correlation',
                mapUrl: '/maps/example-language',
            },
        ],
    });

    expect(screen.getByText('-0.118')).toBeVisible();
    const correlationBar = screen.getByLabelText('language: negative correlation -0.118');
    expect(correlationBar).toBeVisible();
    expect(correlationBar).toHaveAttribute('data-scale', 'zero-centered');
    expect(within(correlationBar).getByTestId('decode-zero-marker')).toBeInTheDocument();
});

it('renders an exact zero correlation as neutral with no directional fill', () => {
    renderTermResults({
        metric: 'correlation',
        terms: [
            {
                id: 'baseline',
                label: 'baseline',
                rank: 1,
                value: 0,
                metric: 'correlation',
            },
        ],
    });

    const zeroBar = screen.getByLabelText('baseline: neutral correlation 0.000');
    expect(zeroBar).toHaveAttribute('data-direction', 'neutral');
    expect(within(zeroBar).queryByTestId('decode-correlation-fill')).not.toBeInTheDocument();
});

it.each([
    ['probability', 0.42, 'attention: probability 0.420', 'zero-to-one'],
    ['bayes-factor', 14.2, 'attention: bayes factor 14.200', 'zero-to-maximum'],
] as const)('renders %s on a non-directional full-width scale', (metric, value, accessibleName, scale) => {
    renderTermResults({
        metric,
        terms: [{ id: 'attention', label: 'attention', rank: 1, value, metric }],
    });

    const measureBar = screen.getByLabelText(accessibleName);
    expect(measureBar).toHaveAttribute('data-scale', scale);
    expect(measureBar).not.toHaveAttribute('data-direction');
    expect(within(measureBar).queryByTestId('decode-zero-marker')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(new RegExp(`positive ${metric}`))).not.toBeInTheDocument();
});

it.each([
    ['similarity', 'Similarity'],
    ['correlation', 'Correlation'],
    ['probability', 'Probability'],
    ['bayes-factor', 'Bayes factor'],
] as const)('labels %s values explicitly', (metric, label) => {
    renderTermResults({ terms: makeTerms(1, metric), metric });
    expect(screen.getByRole('columnheader', { name: label })).toBeVisible();
});

it('contains the results table in a horizontally scrollable table container', () => {
    renderTermResults();
    expect(screen.getByRole('table').parentElement).toHaveClass('MuiTableContainer-root');
});
