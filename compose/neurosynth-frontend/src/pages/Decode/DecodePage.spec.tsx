import { render, screen } from '@testing-library/react';
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
    await completeUpload();
    await userEvent.type(screen.getByLabelText(/What do you think this map relates to/), 'Motor response');
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));

    expect(screen.getByRole('region', { name: 'Illustrative decoder results' })).toBeInTheDocument();
    expect(screen.getByText('motor.nii.gz')).toBeInTheDocument();
    expect(screen.getByText(/no decoder was called/i)).toBeInTheDocument();
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
    expect(screen.getByLabelText('Number of subjects')).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
});
