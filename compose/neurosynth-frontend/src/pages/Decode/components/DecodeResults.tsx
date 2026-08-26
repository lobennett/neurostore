import { Alert, Box, Tab, Tabs } from '@mui/material';
import { EXAMPLE_NICLIP_DOMAINS, EXAMPLE_NICLIP_TASKS, EXAMPLE_TERMS } from '../Decode.fixtures';
import type { DecodeResultView } from '../Decode.types';
import DecodeComparison from './DecodeComparison';
import DecodeMethodSummary from './DecodeMethodSummary';
import DecodeNiClipResults from './DecodeNiClipResults';
import DecodeTermResults from './DecodeTermResults';

const tabId = (view: DecodeResultView) => `decode-result-tab-${view}`;
const panelId = (view: DecodeResultView) => `decode-result-panel-${view}`;

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
            <Tab id={tabId('terms')} aria-controls={panelId('terms')} value="terms" label="Term correlations" />
            <Tab id={tabId('niclip')} aria-controls={panelId('niclip')} value="niclip" label="NiCLIP predictions" />
            <Tab id={tabId('compare')} aria-controls={panelId('compare')} value="compare" label="Compare maps" />
        </Tabs>
        <Box id={panelId(activeView)} role="tabpanel" aria-labelledby={tabId(activeView)} sx={{ paddingY: 2 }}>
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
