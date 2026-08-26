import { Box, Button, FormHelperText, Typography } from '@mui/material';

interface DecodeFileInputProps {
    file: File | null;
    error?: string;
    onChange: (file: File | null) => void;
}

const DecodeFileInput = ({ file, error, onChange }: DecodeFileInputProps) => {
    const selectFile = (nextFile?: File) => onChange(nextFile ?? null);
    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        selectFile(files.item?.(0) ?? files[0] ?? undefined);
    };

    return (
        <Box
            data-testid="decode-file-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            sx={{
                border: 1,
                borderColor: error ? 'error.main' : 'divider',
                borderRadius: 1,
                p: 2,
            }}
        >
            <Button component="label" variant="outlined">
                Choose a NIfTI file
                <input
                    hidden
                    type="file"
                    accept=".nii,.nii.gz"
                    aria-label="Choose a NIfTI file"
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? 'decode-file-error' : undefined}
                    onChange={(event) => selectFile(event.target.files?.item(0) ?? undefined)}
                />
            </Button>
            <Typography>{file?.name ?? 'Drop one .nii or .nii.gz file here'}</Typography>
            {error && (
                <FormHelperText id="decode-file-error" error role="alert">
                    {error}
                </FormHelperText>
            )}
        </Box>
    );
};

export default DecodeFileInput;
