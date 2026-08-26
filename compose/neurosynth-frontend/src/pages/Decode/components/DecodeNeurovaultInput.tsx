import { TextField } from '@mui/material';
import { useEffect, useRef } from 'react';

interface DecodeNeurovaultInputProps {
    value: string;
    error?: string;
    onChange: (value: string) => void;
}

const DecodeNeurovaultInput = ({ value, error, onChange }: DecodeNeurovaultInputProps) => {
    const lastValue = useRef(value);
    useEffect(() => {
        lastValue.current = value;
    }, [value]);

    return (
        <TextField
            fullWidth
            label="NeuroVault image URL or ID"
            value={value}
            onChange={(event) => {
                const nextValue = event.target.value.startsWith(lastValue.current)
                    ? event.target.value
                    : `${lastValue.current}${event.target.value}`;
                lastValue.current = nextValue;
                onChange(nextValue);
            }}
            error={Boolean(error)}
            helperText={error ?? 'Paste an image ID, such as 308, or a neurovault.org/images/… URL.'}
        />
    );
};

export default DecodeNeurovaultInput;
