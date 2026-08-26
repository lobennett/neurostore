import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import DecodePage from './DecodePage';

const completeUpload = async () => {
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'motor.nii.gz'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

it('reveals illustrative results from a complete public submission', async () => {
    render(<DecodePage />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await completeUpload();
    await userEvent.type(screen.getByLabelText(/What do you think this map relates to/), 'Motor response');
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));

    const results = screen.getByRole('region', { name: 'Illustrative decoder results' });
    expect(results).not.toHaveAttribute('aria-live');
    expect(within(results).getByRole('note')).toHaveTextContent('Illustrative example — no decoder was called');
    expect(within(results).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Term correlations' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Illustrative results ready.');
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText(/no decoder was called/i)).toBeInTheDocument();
});

it('uses the active NeuroVault source in the preview and comparison', async () => {
    render(<DecodePage />);
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'motor.nii.gz'));
    await userEvent.click(screen.getByRole('tab', { name: 'NeuroVault image' }));
    await userEvent.type(screen.getByLabelText('NeuroVault image URL or ID'), 'https://neurovault.org/images/308/');
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select visual for comparison' }));
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected term' }));

    expect(screen.getAllByText('NeuroVault image 308')).toHaveLength(2);
    expect(screen.queryByText('motor.nii.gz')).not.toBeInTheDocument();
});

it('summarizes declared metadata without claiming it was verified', async () => {
    render(<DecodePage />);
    await completeUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));

    expect(screen.getByText(/Declared input: group-level · z statistic · fMRI-BOLD · 48 subjects/)).toBeInTheDocument();
    expect(screen.queryByText(/verified MNI/i)).not.toBeInTheDocument();
});

it('resets the complete workspace', async () => {
    render(<DecodePage />);
    await completeUpload();
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start another preview' }));

    expect(screen.queryByRole('region', { name: 'Illustrative decoder results' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Upload map' })).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Preview reset. Choose another map source.');
    expect(screen.getByLabelText('Number of subjects')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
});
