import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { IDecodePreviewState } from '../Decode.types';

type SuccessfulPreviewState = Extract<IDecodePreviewState, { status: 'success' }>;

interface DecodePreviewStateProps {
    state: IDecodePreviewState;
    onRetry: () => void;
    onEditInputs: () => void;
    children: (state: SuccessfulPreviewState) => ReactNode;
}

const DecodePreviewState = ({ state, onRetry, onEditInputs, children }: DecodePreviewStateProps) => {
    switch (state.status) {
        case 'loading':
            return (
                <Paper
                    component="section"
                    role="region"
                    aria-label="Decoder preview loading"
                    aria-busy="true"
                    variant="outlined"
                    sx={{ borderLeft: '4px solid #0077b6', p: { xs: 2, md: 3 } }}
                >
                    <Typography component="h2" variant="h6" sx={{ color: '#263238', fontWeight: 700 }}>
                        Preparing illustrative preview…
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        This inspectable fixture does not start a timer, upload a map, or call a decoder.
                    </Typography>
                </Paper>
            );
        case 'error': {
            const message = state.message.replace(/^The example/, 'Example');
            return (
                <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Alert severity="error">
                        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {state.operation} failed
                        </Typography>
                        <Typography variant="body2">{message}</Typography>
                    </Alert>
                    <Box sx={{ bgcolor: '#f4f8fb', borderLeft: '4px solid #023e8a', mt: 2, p: 2 }}>
                        <Typography variant="body2">
                            Your draft is unchanged. Retry this illustrative operation or reopen the inputs to correct
                            it.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.5 }}>
                            <Button variant="contained" onClick={onRetry}>
                                Try preview again
                            </Button>
                            <Button variant="outlined" onClick={onEditInputs}>
                                Edit inputs
                            </Button>
                        </Stack>
                    </Box>
                </Paper>
            );
        }
        case 'success':
            return children(state);
        default: {
            const exhaustiveState: never = state;
            return exhaustiveState;
        }
    }
};

export default DecodePreviewState;
