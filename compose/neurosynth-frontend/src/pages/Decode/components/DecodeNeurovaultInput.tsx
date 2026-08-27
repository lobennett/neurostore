import { Button, Stack, TextField, Typography } from '@mui/material';
import { parseNeurovaultImageId } from '../Decode.helpers';

interface DecodeNeurovaultInputProps {
    value: string;
    error?: string;
    onChange: (value: string) => void;
    onLoadWalkthrough?: () => void;
}

const DecodeNeurovaultInput = ({ value, error, onChange, onLoadWalkthrough }: DecodeNeurovaultInputProps) => {
    const hasRecordedWalkthrough = parseNeurovaultImageId(value) === '308';

    return (
        <Stack spacing={1.25}>
            <TextField
                fullWidth
                label="NeuroVault image URL or ID"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                error={Boolean(error)}
                helperText={
                    <>
                        {error ? `${error} ` : ''}
                        Paste an image ID, such as 308, or a neurovault.org/images/… URL. Only NeuroVault image links
                        are supported; arbitrary NIfTI URLs are not.
                    </>
                }
            />
            {onLoadWalkthrough ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    {hasRecordedWalkthrough ? (
                        <Typography variant="body2">A recorded walkthrough is available for this image</Typography>
                    ) : null}
                    <Button type="button" variant="outlined" onClick={onLoadWalkthrough}>
                        Load real walkthrough
                    </Button>
                </Stack>
            ) : null}
        </Stack>
    );
};

export default DecodeNeurovaultInput;
