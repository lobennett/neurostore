import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { DecodeResultView } from '../Decode.types';
import DecodeResults from './DecodeResults';

const ResultHarness = () => {
    const [activeView, setActiveView] = useState<DecodeResultView>('terms');
    const [selectedTerm, setSelectedTerm] = useState<string>();

    return (
        <DecodeResults
            activeView={activeView}
            selectedTerm={selectedTerm}
            sourceLabel="motor.nii.gz"
            onViewChange={setActiveView}
            onSelectTerm={setSelectedTerm}
        />
    );
};

it('labels all displayed outputs as illustrative', () => {
    render(<ResultHarness />);

    expect(screen.getByText(/illustrative example/i)).toBeInTheDocument();
});

it('switches from correlations to NiCLIP predictions explicitly', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('tab', { name: 'NiCLIP predictions' }));

    expect(screen.getByRole('columnheader', { name: 'Bayes factor' })).toBeInTheDocument();
    expect(screen.getByText('Perception')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'NiCLIP task predictions' }).parentElement).toHaveClass(
        'MuiTableContainer-root'
    );
});

it('explains NiCLIP probabilities and Bayes factors in relation to the literature-derived prior', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('tab', { name: 'NiCLIP predictions' }));

    expect(screen.getByText(/posterior probabilities incorporate a literature-derived prior/i)).toBeInTheDocument();
    expect(screen.getByText(/Bayes factors express the change in evidence from that prior/i)).toBeInTheDocument();
});

it('states the expected map input in the expanded decoding guidance', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('button', { name: 'About decoding' }));

    expect(
        screen.getByText(/one unthresholded, group-level, 3D z- or t-statistic map in MNI152 space/i)
    ).toBeInTheDocument();
});

it('keeps every result panel mounted with reciprocal tab relationships and one accessible panel', () => {
    render(<ResultHarness />);

    const tabs = screen.getAllByRole('tab');
    const panels = screen.getAllByRole('tabpanel', { hidden: true });

    expect(panels).toHaveLength(3);
    tabs.forEach((tab) => {
        const panel = panels.find(({ id }) => id === tab.getAttribute('aria-controls'));
        expect(tab.id).not.toBe('');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    });
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(document.getElementById('decode-result-panel-terms')).not.toHaveAttribute('hidden');
    expect(document.getElementById('decode-result-panel-niclip')).toHaveAttribute('hidden');
    expect(document.getElementById('decode-result-panel-compare')).toHaveAttribute('hidden');
    expect(within(document.getElementById('decode-result-panel-niclip')!).getByText('Perception')).toBeInTheDocument();
});

it('uses horizontally scrollable result tabs for narrow screens', () => {
    render(<ResultHarness />);

    const tabList = screen.getByRole('tablist', { name: 'Decoder result views' });
    expect(tabList.parentElement).toHaveClass('MuiTabs-scrollableX');
});

it('opens comparison only after selecting a term and choosing compare', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('button', { name: 'Select visual for comparison' }));
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Compare selected term' }));
    expect(screen.getByRole('tab', { name: 'Compare maps' })).toHaveFocus();
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText('visual meta-analytic map')).toBeInTheDocument();
});

it('directs an empty comparison back to term selection', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('tab', { name: 'Compare maps' }));
    expect(screen.getByText('Select a term before comparing maps.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choose a term' }));
    const termsTab = screen.getByRole('tab', { name: 'Term correlations' });
    expect(termsTab).toHaveAttribute('aria-selected', 'true');
    expect(termsTab).toHaveFocus();
});
