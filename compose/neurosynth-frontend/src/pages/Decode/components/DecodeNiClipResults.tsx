import { Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { INiClipDomain, INiClipTask } from '../Decode.types';

const evidenceLabel = (bayesFactor: number) => {
    if (bayesFactor >= 10) return 'strong';
    if (bayesFactor >= 3) return 'moderate';
    if (bayesFactor >= 1) return 'weak';
    return 'against';
};

const DecodeNiClipResults: React.FC<{ domains: INiClipDomain[]; tasks: INiClipTask[] }> = ({ domains, tasks }) => (
    <Box>
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 1 }}>
            Cognitive domains highlighted by this illustrative NiCLIP example.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
            Posterior probabilities incorporate a literature-derived prior. Bayes factors express the change in evidence
            from that prior.
        </Typography>
        <Box aria-label="NiCLIP domains" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2 }}>
            {domains.map(({ domain, probability }) => (
                <Chip key={domain} label={domain} title={`P(domain | map): ${probability.toFixed(2)}`} />
            ))}
        </Box>
        <TableContainer>
            <Table size="small" aria-label="NiCLIP task predictions">
                <TableHead>
                    <TableRow>
                        <TableCell>Task</TableCell>
                        <TableCell align="right">P(task | map)</TableCell>
                        <TableCell align="right">Bayes factor</TableCell>
                        <TableCell>Evidence</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {tasks.map(({ task, probability, bayesFactor }) => (
                        <TableRow key={task}>
                            <TableCell>{task}</TableCell>
                            <TableCell align="right">{probability.toFixed(2)}</TableCell>
                            <TableCell align="right">{bayesFactor.toFixed(1)}</TableCell>
                            <TableCell>{evidenceLabel(bayesFactor)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);

export default DecodeNiClipResults;
