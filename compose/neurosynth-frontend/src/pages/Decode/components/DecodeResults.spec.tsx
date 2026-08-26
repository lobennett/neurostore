import { useState } from 'react';
import { render, screen } from '@testing-library/react';
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
});

it('associates the active tab with its result panel', () => {
    render(<ResultHarness />);

    const activeTab = screen.getByRole('tab', { name: 'Term correlations' });
    const resultPanel = screen.getByRole('tabpanel');

    expect(activeTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('aria-controls', resultPanel.id);
    expect(resultPanel).toHaveAttribute('aria-labelledby', activeTab.id);
});

it('opens comparison only after selecting a term and choosing compare', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('button', { name: 'Select visual for comparison' }));
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Compare selected term' }));
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText('visual meta-analytic map')).toBeInTheDocument();
});

it('directs an empty comparison back to term selection', async () => {
    const user = userEvent.setup();
    render(<ResultHarness />);

    await user.click(screen.getByRole('tab', { name: 'Compare maps' }));
    expect(screen.getByText('Select a term before comparing maps.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choose a term' }));
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveAttribute('aria-selected', 'true');
});
