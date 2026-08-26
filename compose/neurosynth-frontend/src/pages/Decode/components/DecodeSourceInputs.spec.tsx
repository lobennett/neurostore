import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
