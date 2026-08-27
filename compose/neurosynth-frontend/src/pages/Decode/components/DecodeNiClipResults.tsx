import { Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { IDecodeModelSummary } from '../Decode.types';

const evidenceLabel = (bayesFactor: number) => {
    if (bayesFactor >= 10) return 'strong';
    if (bayesFactor >= 3) return 'moderate';
    if (bayesFactor >= 1) return 'weak';
    return 'against';
};

const DecodeNiClipResults: React.FC<Pick<IDecodeModelSummary, 'domains' | 'tasks'>> = ({
    domains = [],
    tasks = [],
}) => (
    <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Cognitive domains highlighted by this illustrative NiCLIP snapshot.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Posterior probabilities incorporate a literature-derived prior. Bayes factors express the change in evidence
            from that prior; they are not posterior probabilities or direct measures of task presence.
        </Typography>
        <Box aria-label="NiCLIP domains" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {domains.map(({ label, probability }) => (
                <Chip
                    key={label}
                    label={`${label} · ${probability.toFixed(2)}`}
                    title={`Posterior P(${label} | map): ${probability.toFixed(2)}`}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                />
            ))}
        </Box>
        <TableContainer sx={{ border: 1, borderColor: 'divider' }}>
            <Table size="small" aria-label="NiCLIP task predictions">
                <TableHead sx={{ bgcolor: '#f4f8fb' }}>
                    <TableRow>
                        <TableCell>Task</TableCell>
                        <TableCell align="right">Posterior probability</TableCell>
                        <TableCell align="right">Bayes factor</TableCell>
                        <TableCell>Evidence change</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tasks.map(({ label, probability, bayesFactor }) => (
                        <TableRow key={label}>
                            <TableCell>{label}</TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                            >
                                {probability.toFixed(2)}
                            </TableCell>
                            <TableCell
                                align="right"
                                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                            >
                                {bayesFactor.toFixed(1)}
                            </TableCell>
                            <TableCell>{evidenceLabel(bayesFactor)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);

export default DecodeNiClipResults;
