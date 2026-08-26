import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { EMPTY_DECODE_DRAFT } from '../Decode.fixtures';
import { validateDecodeDraft } from '../Decode.helpers';
import type { IDecodeDraft } from '../Decode.types';
import DecodeFileInput from './DecodeFileInput';
import DecodeNeurovaultInput from './DecodeNeurovaultInput';
import DecodeSourcePanel from './DecodeSourcePanel';

it('reports the selected NIfTI file', async () => {
    const onChange = vi.fn();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii.gz');
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), file);
    expect(onChange).toHaveBeenCalledWith(file);
});

it('reports a repeated NIfTI selection so its parent can reset consent', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii.gz');
    const input = screen.getByLabelText('Choose a NIfTI file');
    await user.upload(input, file);
    await user.upload(input, file);
    expect(onChange).toHaveBeenCalledTimes(2);
});

it('supports dropping a NIfTI file', () => {
    const onChange = vi.fn();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii');
    fireEvent.drop(screen.getByTestId('decode-file-dropzone'), { dataTransfer: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith(file);
});

it('keeps an invalid file visible with correction guidance', async () => {
    render(
        <DecodeFileInput
            file={new File(['volume'], 'motor.zip')}
            error="Choose a .nii or .nii.gz file."
            onChange={vi.fn()}
        />
    );
    expect(screen.getByText('motor.zip')).toBeInTheDocument();
    expect(screen.getByText('Choose a .nii or .nii.gz file.')).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('Choose a NIfTI file')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Choose a NIfTI file')).toHaveAttribute('aria-describedby', 'decode-file-error');
});

const ControlledNeurovaultInput = ({ initialValue = '' }: { initialValue?: string }) => {
    const [value, setValue] = useState(initialValue);
    return <DecodeNeurovaultInput value={value} onChange={setValue} />;
};

it('edits a NeuroVault image reference through a controlled parent', async () => {
    render(<ControlledNeurovaultInput />);
    await userEvent.type(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' }), '308');
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toHaveValue('308');
});

it('forwards deletion from a controlled NeuroVault input', async () => {
    render(<ControlledNeurovaultInput initialValue="308" />);
    const input = screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' });
    await userEvent.clear(input);
    expect(input).toHaveValue('');
});

it('forwards a mid-string replacement from a controlled NeuroVault input', () => {
    render(<ControlledNeurovaultInput initialValue="318" />);
    const input = screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' });
    fireEvent.change(input, { target: { value: '308' } });
    expect(input).toHaveValue('308');
});

let onSourcePanelChange = vi.fn();

const renderSourcePanel = (overrides: Partial<IDecodeDraft> = {}) => {
    onSourcePanelChange = vi.fn();
    const Wrapper = () => {
        const [draft, setDraft] = useState<IDecodeDraft>({ ...EMPTY_DECODE_DRAFT, ...overrides });
        const handleChange = (nextDraft: IDecodeDraft) => {
            onSourcePanelChange(nextDraft);
            setDraft(nextDraft);
        };
        return (
            <DecodeSourcePanel
                draft={draft}
                errors={validateDecodeDraft(draft)}
                onChange={handleChange}
                autoFocusSource={false}
            />
        );
    };
    return render(<Wrapper />);
};

it('states that NeuroVault image URLs are accepted but arbitrary NIfTI URLs are not', () => {
    renderSourcePanel();
    expect(screen.getByText(/Only NeuroVault image links are supported/)).toBeVisible();
});

it('adds, labels, and removes an MNI coordinate', async () => {
    const user = userEvent.setup();
    renderSourcePanel({ activeSource: 'coordinates' });
    await user.type(screen.getByRole('spinbutton', { name: 'x coordinate for point 1' }), '-42');
    await user.click(screen.getByRole('button', { name: 'Add another coordinate' }));
    expect(screen.getByRole('spinbutton', { name: 'x coordinate for point 2' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove point 2' }));
    expect(screen.queryByRole('spinbutton', { name: 'x coordinate for point 2' })).not.toBeInTheDocument();
});

it('exposes axis-specific MNI bounds and accessible range guidance', () => {
    renderSourcePanel({ activeSource: 'coordinates' });
    const ranges = [
        ['x', '-90', '90'],
        ['y', '-126', '90'],
        ['z', '-72', '108'],
    ] as const;

    ranges.forEach(([axis, min, max]) => {
        const coordinate = screen.getByRole('spinbutton', { name: `${axis} coordinate for point 1` });
        expect(coordinate).toHaveAttribute('min', min);
        expect(coordinate).toHaveAttribute('max', max);
        expect(coordinate).toHaveAttribute('step', '1');
        expect(coordinate).toHaveAccessibleDescription(
            `Allowed range: ${min} to ${max} mm. Add at least one valid MNI coordinate.`
        );
        expect(coordinate).toHaveAttribute('aria-describedby', expect.stringContaining('decode-coordinate-errors'));
    });
});

it('requires explicit CC0 public-deposit consent without claiming to upload', async () => {
    const user = userEvent.setup();
    renderSourcePanel({ activeSource: 'upload', file: new File(['map'], 'map.nii.gz') });
    expect(screen.getByText(/publicly accessible under CC0/)).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: /I accept the public CC0 deposit terms/ }));
    expect(onSourcePanelChange).toHaveBeenCalledWith(expect.objectContaining({ depositConsent: true }));
    expect(screen.getByText(/Nothing is uploaded in this preview/)).toBeVisible();
});

it('keeps inactive source values mounted while another source is active', async () => {
    const user = userEvent.setup();
    renderSourcePanel({ neurovaultReference: '308' });
    await user.click(screen.getByRole('tab', { name: 'MNI coordinates' }));
    await user.click(screen.getByRole('tab', { name: 'NeuroVault image' }));
    expect(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' })).toHaveValue('308');
});

it('clears deposit consent when a selected upload changes or is cleared', async () => {
    const user = userEvent.setup();
    renderSourcePanel({ activeSource: 'upload', file: new File(['map'], 'first.nii.gz'), depositConsent: true });
    await user.upload(screen.getByLabelText('Choose a NIfTI file'), new File(['map'], 'second.nii.gz'));
    expect(onSourcePanelChange).toHaveBeenCalledWith(
        expect.objectContaining({ file: expect.any(File), depositConsent: false })
    );
    await user.click(screen.getByRole('button', { name: 'Clear selected file' }));
    expect(onSourcePanelChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ file: null, depositConsent: false })
    );
});
