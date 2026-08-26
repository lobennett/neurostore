import { Box, Checkbox, FormControlLabel, FormHelperText, Typography } from '@mui/material';
import type { IDecodeMetadata } from '../Decode.types';

interface DecodeDepositDisclosureProps {
    file: File;
    metadata: IDecodeMetadata;
    consent: boolean;
    error?: string;
    onConsentChange: (consent: boolean) => void;
}

const declared = (value: string) => value || 'Not declared';

const DecodeDepositDisclosure = ({ file, metadata, consent, error, onConsentChange }: DecodeDepositDisclosureProps) => {
    const errorId = 'decode-deposit-consent-error';
    return (
        <Box sx={{ bgcolor: '#f4f8fb', borderLeft: 3, borderColor: '#0077b6', mt: 2, p: 2 }}>
            <Typography component="h3" sx={{ color: '#263238', fontWeight: 700 }} variant="subtitle2">
                Public deposit terms (illustrative preview)
            </Typography>
            <Typography sx={{ overflowWrap: 'anywhere' }}>
                Selected file: <strong>{file.name}</strong>
            </Typography>
            <Typography component="h4" sx={{ fontWeight: 700, mb: 0.5, mt: 1 }} variant="body2">
                Declared metadata
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                <li>Map type: {declared(metadata.mapType)}</li>
                <li>Analysis level: {declared(metadata.analysisLevel)}</li>
                <li>Modality: {declared(metadata.modality)}</li>
                <li>Subject count: {declared(metadata.subjectCount)}</li>
            </Box>
            <Typography sx={{ mt: 1 }} variant="body2">
                This map would be publicly accessible under CC0. A login is not required, and a future signed-in account
                could be associated with the deposit.
            </Typography>
            <Typography sx={{ mt: 1 }} variant="body2">
                Nothing is uploaded in this preview. No deposit ID is created.
            </Typography>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={consent}
                        onChange={(event) => onConsentChange(event.target.checked)}
                        aria-describedby={error ? errorId : undefined}
                    />
                }
                label="I accept the public CC0 deposit terms"
            />
            {error ? (
                <FormHelperText error id={errorId} role="alert">
                    {error}
                </FormHelperText>
            ) : null}
        </Box>
    );
};

export default DecodeDepositDisclosure;
