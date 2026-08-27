import { Box, Divider, Stack, Typography } from '@mui/material';
import type { IDecodeModelDefinition } from '../Decode.types';

const DecodeMethodSummary: React.FC<{ model: IDecodeModelDefinition }> = ({ model }) => (
    <Box
        component="section"
        aria-labelledby="decode-method-heading"
        sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}
    >
        <Typography id="decode-method-heading" component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
            About {model.name} decoding
        </Typography>
        <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            divider={<Divider orientation="vertical" flexItem />}
            sx={{ mt: 1 }}
        >
            <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    Model purpose
                </Typography>
                <Typography variant="body2">{model.purpose}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    Declared input requirement
                </Typography>
                <Typography variant="body2">{model.inputRequirements}</Typography>
            </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {model.interpretationNote}
        </Typography>
        <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 1, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
        >
            Model snapshot: {model.version}
        </Typography>
    </Box>
);

export default DecodeMethodSummary;
