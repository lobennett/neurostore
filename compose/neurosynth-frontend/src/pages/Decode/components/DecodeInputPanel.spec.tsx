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

const renderPanel = (onPreview = vi.fn()) => {
    const Wrapper = () => {
        const [value, setValue] = useState(EMPTY_DECODE_SUBMISSION);
        return <DecodeInputPanel value={value} onChange={setValue} onPreview={onPreview} />;
    };
    return render(<Wrapper />);
};

it('starts with upload selected and no Cognitive Atlas task selected', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'Upload map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: /Cognitive Atlas task/ })).toHaveValue('');
});

it('keeps untouched required fields neutral and select labels clear of their prompts', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByLabelText('Choose a NIfTI file')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Choose a NIfTI file.')).not.toBeInTheDocument();

    for (const label of ['Map type', 'Analysis level', 'Modality']) {
        expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText(label, { selector: 'label' })).toHaveAttribute('data-shrink', 'true');
    }
    expect(screen.queryByText('Choose a map type.')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose an analysis level.')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a modality.')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter the number of subjects.')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Number of subjects'));
    await user.tab();
    expect(screen.getByLabelText('Number of subjects')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the number of subjects.')).toBeInTheDocument();
});

it('keeps both source panels mounted with reciprocal tab relationships', () => {
    renderPanel();

    const tabs = screen.getAllByRole('tab');
    const panels = screen.getAllByRole('tabpanel', { hidden: true });

    expect(panels).toHaveLength(2);
    tabs.forEach((tab) => {
        const panel = panels.find(({ id }) => id === tab.getAttribute('aria-controls'));
        expect(tab.id).not.toBe('');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    });
    expect(panels.find(({ id }) => id === 'decode-source-panel-upload')).not.toHaveAttribute('hidden');
    expect(panels.find(({ id }) => id === 'decode-source-panel-neurovault')).toHaveAttribute('hidden');
    expect(screen.getByLabelText('Choose a NIfTI file')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID', hidden: true })).toBeInTheDocument();
});

it('updates source panel visibility without unmounting either panel', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'NeuroVault image' }));

    expect(document.getElementById('decode-source-panel-upload')).toHaveAttribute('hidden');
    expect(document.getElementById('decode-source-panel-neurovault')).not.toHaveAttribute('hidden');
    expect(screen.getByLabelText('Choose a NIfTI file', { selector: 'input' })).toBeInTheDocument();
});

it('states the required unthresholded group-level 3D MNI152 map input', () => {
    renderPanel();
    const requirements = screen.getByText(/intended input/i);
    expect(requirements).toHaveTextContent(/unthresholded/i);
    expect(requirements).toHaveTextContent(/group-level/i);
    expect(requirements).toHaveTextContent(/3D/i);
    expect(requirements).toHaveTextContent(/MNI152/i);
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

it('previews a valid submission through the guarded preview action', async () => {
    const onPreview = vi.fn();
    renderPanel(onPreview);
    await completeRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: 'Preview results' }));
    expect(onPreview).toHaveBeenCalledOnce();
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
