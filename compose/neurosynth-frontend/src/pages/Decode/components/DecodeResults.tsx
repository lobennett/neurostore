import { Alert, Box, Tab, Tabs } from '@mui/material';
import { EXAMPLE_NICLIP_DOMAINS, EXAMPLE_NICLIP_TASKS, EXAMPLE_TERMS } from '../Decode.fixtures';
import type { DecodeResultView } from '../Decode.types';
import DecodeComparison from './DecodeComparison';
import DecodeMethodSummary from './DecodeMethodSummary';
import DecodeNiClipResults from './DecodeNiClipResults';
import DecodeTermResults from './DecodeTermResults';

const DecodeResults: React.FC<{
    activeView: DecodeResultView;
    selectedTerm?: string;
    sourceLabel: string;
    onViewChange: (view: DecodeResultView) => void;
    onSelectTerm: (term: string) => void;
}> = ({ activeView, selectedTerm, sourceLabel, onViewChange, onSelectTerm }) => (
    <Box>
        <Alert severity="info" sx={{ marginBottom: 2 }}>Illustrative example — no decoder was called</Alert>
        <Tabs value={activeView} onChange={(_event, view: DecodeResultView) => onViewChange(view)} aria-label="Decoder result views">
            <Tab value="terms" label="Term correlations" />
            <Tab value="niclip" label="NiCLIP predictions" />
            <Tab value="compare" label="Compare maps" />
        </Tabs>
        <Box sx={{ paddingY: 2 }}>
            {activeView === 'terms' && (
                <DecodeTermResults
                    terms={EXAMPLE_TERMS}
                    selectedTerm={selectedTerm}
                    onSelectTerm={onSelectTerm}
                    onCompareSelected={() => onViewChange('compare')}
                />
            )}
            {activeView === 'niclip' && <DecodeNiClipResults domains={EXAMPLE_NICLIP_DOMAINS} tasks={EXAMPLE_NICLIP_TASKS} />}
            {activeView === 'compare' && (
                <DecodeComparison sourceLabel={sourceLabel} selectedTerm={selectedTerm} onChooseTerm={() => onViewChange('terms')} />
            )}
        </Box>
        <DecodeMethodSummary />
    </Box>
);

export default DecodeResults;
