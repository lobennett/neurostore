import { Box, Stack, Typography } from '@mui/material';
import type { IAtlasReadout, IViewerState } from '../Decode.types';

const EXAMPLE_COORDINATE_KEY = '-42,0,0';

const coordinateKey = ({ x, y, z }: IViewerState) => `${x},${y},${z}`;

const DecodeAtlasReadout: React.FC<{
    atlasReadouts: IAtlasReadout[];
    coordinate: IViewerState;
}> = ({ atlasReadouts, coordinate }) => {
    const matchingReadouts = coordinateKey(coordinate) === EXAMPLE_COORDINATE_KEY ? atlasReadouts : [];

    return (
        <Box
            component="section"
            role="region"
            aria-label="Example atlas readout"
            aria-describedby="decode-atlas-provenance"
            sx={{ borderLeft: '2px solid #0077b6', pl: 2 }}
        >
            <Typography component="h3" variant="subtitle1" sx={{ color: '#263238', fontWeight: 700 }}>
                Example atlas readout
            </Typography>
            <Typography id="decode-atlas-provenance" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Atlas labels are deterministic examples, not measurements from the selected map.
            </Typography>
            <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, mt: 2, p: 0 }}>
                {matchingReadouts.length ? (
                    matchingReadouts.map(({ atlas, region, percentage }) => (
                        <Box component="li" key={`${atlas}-${region}`}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                {atlas} · example
                            </Typography>
                            <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 0.25 }}>
                                <Typography variant="body2" sx={{ color: '#263238', fontWeight: 500 }}>
                                    {region}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: '#023e8a', fontFamily: 'monospace', fontWeight: 700 }}
                                >
                                    {percentage}%
                                </Typography>
                            </Stack>
                        </Box>
                    ))
                ) : (
                    <Typography component="li" variant="body2" color="text.secondary">
                        No example atlas label at this coordinate
                    </Typography>
                )}
            </Stack>
        </Box>
    );
};

export default DecodeAtlasReadout;
