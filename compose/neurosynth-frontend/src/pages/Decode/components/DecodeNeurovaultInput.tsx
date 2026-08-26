import { TextField } from '@mui/material';

interface DecodeNeurovaultInputProps {
    value: string;
    error?: string;
    onChange: (value: string) => void;
}

const DecodeNeurovaultInput = ({ value, error, onChange }: DecodeNeurovaultInputProps) => {
    return (
        <TextField
            fullWidth
            label="NeuroVault image URL or ID"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            error={Boolean(error)}
            helperText={error ?? 'Paste an image ID, such as 308, or a neurovault.org/images/… URL.'}
        />
    );
};

export default DecodeNeurovaultInput;
