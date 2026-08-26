import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const DecodeMethodSummary: React.FC = () => (
    <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="decode-method-content" id="decode-method-header">
            <Typography>About decoding</Typography>
        </AccordionSummary>
        <AccordionDetails id="decode-method-content">
            <Typography variant="body2" color="text.secondary">
                Term correlations compare the spatial pattern of a submitted map with meta-analytic maps. NiCLIP predictions
                estimate task associations from a map; neither result is diagnostic evidence or a causal explanation.
            </Typography>
        </AccordionDetails>
    </Accordion>
);

export default DecodeMethodSummary;
