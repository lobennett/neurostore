import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_DECODE_DRAFT } from '../Decode.fixtures';
import type { IDecodeDraft } from '../Decode.types';
import { COGNITIVE_ATLAS_CONCEPTS } from '../Decode.vocabulary';
import DecodeDescriptionPanel from './DecodeDescriptionPanel';
import DecodeInputPanel from './DecodeInputPanel';

const onChange = vi.fn();

beforeEach(() => onChange.mockClear());

const renderDescriptionPanel = (overrides: Partial<IDecodeDraft> = {}) => {
    const Wrapper = () => {
        const [draft, setDraft] = useState<IDecodeDraft>({
            ...EMPTY_DECODE_DRAFT,
            metadata: {
                ...EMPTY_DECODE_DRAFT.metadata,
                mapType: 'z',
                analysisLevel: 'group',
                modality: 'fmri-bold',
                subjectCount: '48',
            },
            ...overrides,
        });
        const handleChange = (nextDraft: IDecodeDraft) => {
            onChange(nextDraft);
            setDraft(nextDraft);
        };

        return <DecodeDescriptionPanel draft={draft} errors={{}} onChange={handleChange} />;
    };

    return render(<Wrapper />);
};

const completeRequiredFields = async ({ analysisLevel = 'group' }: { analysisLevel?: 'group' | 'subject' } = {}) => {
    await userEvent.type(screen.getByLabelText('NeuroVault image URL or ID'), '25');
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), analysisLevel);
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

const completeUploadDraft = async () => {
    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.nii.gz'));
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await userEvent.selectOptions(screen.getByLabelText('Modality'), 'fmri-bold');
    await userEvent.type(screen.getByLabelText('Number of subjects'), '48');
};

const renderPanel = (onPreview = vi.fn()) => {
    const Wrapper = () => {
        const [value, setValue] = useState<IDecodeDraft>(EMPTY_DECODE_DRAFT);
        return <DecodeInputPanel value={value} onChange={setValue} onPreview={onPreview} />;
    };
    return render(<Wrapper />);
};

it('provides more than 600 unique, label-sorted Cognitive Atlas concepts including working memory', () => {
    const labels = COGNITIVE_ATLAS_CONCEPTS.map(({ label }) => label);

    expect(COGNITIVE_ATLAS_CONCEPTS.length).toBeGreaterThan(600);
    expect(new Set(COGNITIVE_ATLAS_CONCEPTS.map(({ id }) => id)).size).toBe(COGNITIVE_ATLAS_CONCEPTS.length);
    expect(labels).toEqual(
        [...labels].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    );
    expect(COGNITIVE_ATLAS_CONCEPTS.some(({ label }) => label.toLowerCase() === 'working memory')).toBe(true);
});

it('offers every agreed analysis level and NeuroVault modality', () => {
    renderDescriptionPanel();

    expect(within(screen.getByLabelText('Analysis level')).getAllByRole('option')).toHaveLength(5);
    for (const label of [
        'fMRI BOLD',
        'fMRI CBF',
        'fMRI CBV',
        'Diffusion MRI',
        'Structural MRI',
        'FDG PET',
        'Oxygen-water PET',
        'Other PET',
        'MEG',
        'EEG',
        'Other',
    ]) {
        expect(within(screen.getByLabelText('Modality')).getByRole('option', { name: label })).toBeInTheDocument();
    }
});

it('starts with no concept and searches the checked-in concept snapshot', async () => {
    const user = userEvent.setup();
    renderDescriptionPanel();

    expect(screen.getByRole('combobox', { name: 'Cognitive Atlas concepts' })).toHaveValue('');
    await user.type(screen.getByRole('combobox', { name: 'Cognitive Atlas concepts' }), 'working memory');
    expect(await screen.findByText('working memory')).toBeVisible();
    expect(screen.getAllByText(/trm_/).length).toBeGreaterThan(0);
});

it('keeps a text suggestion separate until the visitor confirms it', async () => {
    const user = userEvent.setup();
    renderDescriptionPanel();

    await user.type(screen.getByRole('textbox', { name: /What do you think/ }), 'response inhibition');
    expect(screen.getByText('Example suggestion: response inhibition')).toBeVisible();
    expect(screen.queryByText('Confirmed concept')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm response inhibition' }));
    const confirmed = onChange.mock.calls.at(-1)?.[0] as IDecodeDraft;
    expect(confirmed.confirmedSuggestions).toEqual([
        expect.objectContaining({ id: 'trm_4a3fd79d0af66', label: 'response inhibition' }),
    ]);
    expect(confirmed.concepts).toEqual([
        expect.objectContaining({ id: 'trm_4a3fd79d0af66', label: 'response inhibition' }),
    ]);
});

it('shows participant count only for group and subject maps while retaining its entered value', async () => {
    const user = userEvent.setup();
    renderDescriptionPanel();

    expect(screen.getByLabelText('Number of subjects')).toHaveValue(48);
    await user.selectOptions(screen.getByLabelText('Analysis level'), 'meta-analysis');
    expect(screen.queryByLabelText('Number of subjects')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Analysis level'), 'other');
    expect(screen.queryByLabelText('Number of subjects')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    expect(screen.getByLabelText('Number of subjects')).toHaveValue(48);
    await user.selectOptions(screen.getByLabelText('Analysis level'), 'subject');
    expect(screen.getByLabelText('Number of subjects')).toHaveValue(48);
});

it('starts with NeuroVault selected and no Cognitive Atlas concept selected', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: 'NeuroVault image' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('combobox', { name: 'Cognitive Atlas concepts' })).toHaveValue('');
});

it('keeps untouched required fields neutral and select labels clear of their prompts', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByLabelText('NeuroVault image URL or ID')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Enter a NeuroVault image ID or image URL.')).not.toBeInTheDocument();

    for (const label of ['Map type', 'Analysis level', 'Modality']) {
        expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText(label, { selector: 'label' })).toHaveAttribute('data-shrink', 'true');
    }
    expect(screen.queryByText('Choose a map type.')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose an analysis level.')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a modality.')).not.toBeInTheDocument();
    expect(screen.queryByText('Enter the number of subjects.')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Analysis level'), 'group');
    await user.click(screen.getByLabelText('Number of subjects'));
    await user.tab();
    expect(screen.getByLabelText('Number of subjects')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the number of subjects.')).toBeInTheDocument();
});

it('keeps both source panels mounted with reciprocal tab relationships', () => {
    renderPanel();

    const tabs = screen.getAllByRole('tab');
    const panels = screen.getAllByRole('tabpanel', { hidden: true });

    expect(panels).toHaveLength(3);
    tabs.forEach((tab) => {
        const panel = panels.find(({ id }) => id === tab.getAttribute('aria-controls'));
        expect(tab.id).not.toBe('');
        expect(panel).toHaveAttribute('aria-labelledby', tab.id);
    });
    expect(panels.find(({ id }) => id === 'decode-draft-source-panel-neurovault')).not.toHaveAttribute('hidden');
    expect(panels.find(({ id }) => id === 'decode-draft-source-panel-upload')).toHaveAttribute('hidden');
    expect(screen.getByLabelText('Choose a NIfTI file')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toBeInTheDocument();
});

it('updates source panel visibility without unmounting either panel', async () => {
    renderPanel();

    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));

    expect(document.getElementById('decode-draft-source-panel-neurovault')).toHaveAttribute('hidden');
    expect(document.getElementById('decode-draft-source-panel-upload')).not.toHaveAttribute('hidden');
    expect(screen.getByLabelText('Choose a NIfTI file', { selector: 'input' })).toBeInTheDocument();
});

it('states the required unthresholded group-level 3D MNI152 map input', () => {
    renderPanel();
    const requirements = screen.getAllByText(/3D, unthresholded z- or t-statistic map in MNI152 space/i);
    expect(requirements.length).toBeGreaterThan(0);
});

it('switches between sources without losing metadata', async () => {
    renderPanel();
    await userEvent.selectOptions(screen.getByLabelText('Map type'), 'z');
    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));
    await userEvent.click(screen.getByRole('tab', { name: 'NeuroVault image' }));
    expect(screen.getByLabelText('Map type')).toHaveValue('z');
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toBeInTheDocument();
});

it('keeps preview disabled until the source and required metadata are valid', async () => {
    renderPanel();
    const preview = screen.getByRole('button', { name: 'Preview example results' });
    expect(preview).toBeDisabled();
    await completeRequiredFields();
    expect(preview).toBeEnabled();
});

it('previews a valid submission through the guarded preview action', async () => {
    const onPreview = vi.fn();
    renderPanel(onPreview);
    await completeRequiredFields();
    await userEvent.click(screen.getByRole('button', { name: 'Preview example results' }));
    expect(onPreview).toHaveBeenCalledOnce();
});

it.each([
    ['', 'Number of term results is required.'],
    ['-1', 'Number of term results must be at least 1.'],
    ['2.5', 'Number of term results must be a whole number.'],
])('blocks an invalid result limit %s until one touched correction is resolved', async (value, correction) => {
    const user = userEvent.setup();
    renderPanel();
    await completeRequiredFields();
    const parameter = screen.getByLabelText('Number of term results');
    const preview = screen.getByRole('button', { name: 'Preview example results' });

    await user.clear(parameter);
    if (value) await user.type(parameter, value);
    expect(preview).toBeDisabled();
    expect(screen.queryByText(correction)).not.toBeInTheDocument();

    await user.tab();
    expect(parameter).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByText(correction)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Reset parameters' }));
    expect(parameter).toHaveValue(50);
    expect(preview).toBeEnabled();
    expect(screen.queryByText(correction)).not.toBeInTheDocument();
});

it('keeps deposit consent neutral until interaction and shows one correction after unchecking', async () => {
    const user = userEvent.setup();
    renderPanel();
    await completeUploadDraft();
    const consent = screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ });
    const preview = screen.getByRole('button', { name: 'Preview example results' });

    expect(screen.getByText(/publicly accessible under CC0/)).toBeVisible();
    expect(screen.getByText(/Nothing is uploaded in this preview/)).toBeVisible();
    expect(screen.queryByText('Accept the public CC0 deposit terms to continue.')).not.toBeInTheDocument();
    expect(preview).toBeDisabled();

    await user.click(consent);
    expect(preview).toBeEnabled();
    await user.click(consent);
    expect(preview).toBeDisabled();
    expect(screen.getAllByText('Accept the public CC0 deposit terms to continue.')).toHaveLength(1);
    expect(consent).toHaveAccessibleDescription('Accept the public CC0 deposit terms to continue.');
});

it('keeps subject acknowledgement neutral until interaction and shows one correction after unchecking', async () => {
    const user = userEvent.setup();
    renderPanel();
    await completeRequiredFields({ analysisLevel: 'subject' });
    expect(screen.getByRole('alert')).toHaveTextContent('identifiable patterns or sensitive information');
    expect(screen.getByRole('alert')).toHaveTextContent("NeuroVLM's suitability for subject-level maps");
    expect(screen.queryByText('Acknowledge the subject-level warning to continue.')).not.toBeInTheDocument();
    const acknowledgement = screen.getByRole('checkbox', { name: /continue with a subject-level map/i });
    const preview = screen.getByRole('button', { name: 'Preview example results' });
    expect(preview).toBeDisabled();

    await user.click(acknowledgement);
    expect(preview).toBeEnabled();
    await user.click(acknowledgement);
    expect(preview).toBeDisabled();
    expect(screen.getAllByText('Acknowledge the subject-level warning to continue.')).toHaveLength(1);
    expect(acknowledgement).toHaveAccessibleDescription('Acknowledge the subject-level warning to continue.');
});

it('uses selected-model suitability copy in the subject-level caution', async () => {
    renderPanel();
    await completeRequiredFields({ analysisLevel: 'subject' });
    await userEvent.click(screen.getByRole('radio', { name: /NiCLIP/ }));
    expect(screen.getByRole('alert')).toHaveTextContent("NiCLIP's suitability for subject-level maps");
    expect(screen.getByRole('alert')).not.toHaveTextContent("NeuroVLM's suitability");
});

it('keeps an invalid upload visible with its validation error and preview disabled', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: 'Upload NIfTI' }));
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'map.zip'));
    expect(within(screen.getByTestId('decode-file-dropzone')).getByText('map.zip')).toBeInTheDocument();
    expect(screen.getByText('Choose a .nii or .nii.gz file.')).toHaveAttribute('role', 'alert');
    expect(screen.getAllByText('Choose a .nii or .nii.gz file.')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Preview example results' })).toBeDisabled();
});
