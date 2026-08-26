import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { EMPTY_DECODE_SUBMISSION } from '../Decode.fixtures';
import DecodeInputPanel from './DecodeInputPanel';

const completeRequiredFields = async ({ analysisLevel = 'group' }: { analysisLevel?: 'group' | 'subject' } = {}) => {
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.nii'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), analysisLevel);
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

const renderPanel = () => {
    const Wrapper = () => {
        const [value, setValue] = useState(EMPTY_DECODE_SUBMISSION);
        return <DecodeInputPanel value={value} onChange={setValue} onPreview={vi.fn()} />;
    };
    return render(<Wrapper />);
};

it('starts with upload selected and no Cognitive Atlas task selected', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Upload map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: /Cognitive Atlas task/ })).toHaveValue('');
});

it('switches to the NeuroVault source without losing metadata', async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.click(screen.getByRole('tab', { name: 'NeuroVault image' }));
    expect(screen.getByLabelText('Map type')).toHaveValue('z');
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toBeInTheDocument();
});

it('keeps preview disabled until the source and required metadata are valid', async () => {
    renderPanel();
    const preview = screen.getByRole('button', { name: 'Preview results' });
    expect(preview).toBeDisabled();
    await completeRequiredFields();
    expect(preview).toBeEnabled();
});

it('requires acknowledgement before previewing a subject-level map', async () => {
    renderPanel();
    await completeRequiredFields({ analysisLevel: 'subject' });
    expect(screen.getByRole('alert')).toHaveTextContent('NiCLIP was designed for group-level maps');
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /continue with a subject-level map/i }));
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeEnabled();
});

it('keeps an invalid upload visible with its validation error and preview disabled', async () => {
    renderPanel();
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.zip'));
    expect(screen.getByText('map.zip')).toBeInTheDocument();
    expect(screen.getByText('Choose a .nii or .nii.gz file.')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Preview results' })).toBeDisabled();
});
