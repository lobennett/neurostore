import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

export interface IDecodedTerm {
    term: string;
    correlation: number;
}

const DecodeTermResults: React.FC<{
    terms: IDecodedTerm[];
    selectedTerm?: string;
    onSelectTerm: (term: string) => void;
}> = ({ terms, selectedTerm, onSelectTerm }) => {
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
                            onClick={() => onSelectTerm(term)}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>{term}</TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ flex: 1, height: '9px', backgroundColor: 'grey.100', borderRadius: '5px' }}>
                                        <Box
                                            sx={{
                                                width: `${(Math.abs(correlation) / strongest) * 100}%`,
                                                height: '100%',
                                                backgroundColor: 'primary.main',
                                                borderRadius: '5px',
                                            }}
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
        </Box>
    );
};

export default DecodeTermResults;
