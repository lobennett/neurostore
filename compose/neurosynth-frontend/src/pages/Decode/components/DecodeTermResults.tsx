import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { IDecodedTerm } from '../Decode.types';

const DecodeTermResults: React.FC<{
    terms: IDecodedTerm[];
    selectedTerm?: string;
    onSelectTerm: (term: string) => void;
    onCompareSelected: () => void;
}> = ({ terms, selectedTerm, onSelectTerm, onCompareSelected }) => {
    const strongest = Math.max(...terms.map((term) => Math.abs(term.correlation)), 0.01);

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
                Terms whose meta-analytic maps look most like yours. Select one to compare the two maps
                side by side.
            </Typography>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Term</TableCell>
                        <TableCell width="55%">Correlation</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {terms.map(({ term, correlation }) => (
                        <TableRow
                            key={term}
                            hover
                            selected={term === selectedTerm}
                        >
                            <TableCell>
                                <Button
                                    variant="text"
                                    aria-pressed={term === selectedTerm}
                                    aria-label={`Select ${term} for comparison`}
                                    onClick={() => onSelectTerm(term)}
                                    sx={{ textTransform: 'none' }}
                                >
                                    {term}
                                </Button>
                            </TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                        aria-label={`${term}: ${correlation < 0 ? 'negative' : 'positive'} correlation ${correlation.toFixed(3)}`}
                                        data-direction={correlation < 0 ? 'negative' : 'positive'}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            position: 'relative',
                                            flex: 1,
                                            backgroundColor: 'grey.100',
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', minHeight: 8 }}>
                                            {correlation < 0 && (
                                                <Box sx={{ width: `${(Math.abs(correlation) / strongest) * 100}%`, bgcolor: 'primary.dark', height: 8 }} />
                                            )}
                                        </Box>
                                        <Box sx={{ minHeight: 8 }}>
                                            {correlation >= 0 && (
                                                <Box sx={{ width: `${(Math.abs(correlation) / strongest) * 100}%`, bgcolor: 'primary.main', height: 8 }} />
                                            )}
                                        </Box>
                                        <Box
                                            aria-hidden="true"
                                            sx={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px solid', borderColor: 'text.secondary' }}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {correlation.toFixed(3)}
                                    </Typography>
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Button variant="contained" disabled={!selectedTerm} onClick={onCompareSelected} sx={{ marginTop: 2 }}>
                Compare selected term
            </Button>
        </Box>
    );
};

export default DecodeTermResults;
