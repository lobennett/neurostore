import { Box, Button, Typography } from '@mui/material';

const DecodeComparison: React.FC<{
    sourceLabel: string;
    selectedTerm?: string;
    onChooseTerm: () => void;
}> = ({ sourceLabel, selectedTerm, onChooseTerm }) => {
    if (!selectedTerm) {
        return (
            <Box>
                <Typography>Select a term before comparing maps.</Typography>
                <Button onClick={onChooseTerm} sx={{ marginTop: 1 }}>
                    Choose a term
                </Button>
            </Box>
        );
    }

    return (
        <Box
            aria-label="Map comparison"
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}
        >
            <Box sx={{ minHeight: 220, padding: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">{sourceLabel}</Typography>
                <Typography variant="body2" color="text.secondary">Submitted map placeholder</Typography>
            </Box>
            <Box sx={{ minHeight: 220, padding: 2, border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2">{selectedTerm} meta-analytic map</Typography>
                <Typography variant="body2" color="text.secondary">Reference map placeholder</Typography>
            </Box>
        </Box>
    );
};

export default DecodeComparison;
