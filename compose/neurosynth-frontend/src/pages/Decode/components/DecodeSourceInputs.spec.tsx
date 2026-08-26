import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import DecodeFileInput from './DecodeFileInput';
import DecodeNeurovaultInput from './DecodeNeurovaultInput';

it('reports the selected NIfTI file', async () => {
    const onChange = vi.fn();
    render(<DecodeFileInput file={null} onChange={onChange} />);
    const file = new File(['volume'], 'motor.nii.gz');
    await userEvent.upload(screen.getByLabelText('Choose a NIfTI file'), file);
    expect(onChange).toHaveBeenCalledWith(file);
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
});

it('edits a NeuroVault image reference', async () => {
    const onChange = vi.fn();
    render(<DecodeNeurovaultInput value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'NeuroVault image URL or ID' }), '308');
    expect(onChange).toHaveBeenLastCalledWith('308');
});
