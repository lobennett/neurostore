import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import DecodePage from './DecodePage';

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

it('defaults to NeuroVLM and shows only its parameters', () => {
    render(<DecodePage />);

    expect(screen.getByRole('radio', { name: /NeuroVLM/ })).toBeChecked();
    expect(screen.getByLabelText('Number of term results')).toHaveValue(50);
    expect(screen.queryByLabelText('NiCLIP prior')).not.toBeInTheDocument();
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

    expect(screen.getByText(/NeuroVLM.*fixture-v1/)).toBeVisible();
    expect(screen.getByText(/Number of term results: 100/)).toBeVisible();
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
});

it('keeps current result navigation compatible with a NeuroVault preview', async () => {
    await openPreview();
    const results = screen.getByRole('region', { name: 'Illustrative decoder results' });

    expect(within(results).getByRole('note')).toHaveTextContent('Illustrative example — no decoder was called');
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Select visual for comparison' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected term' }));
    expect(screen.getAllByText('NeuroVault image 25')).toHaveLength(2);
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
