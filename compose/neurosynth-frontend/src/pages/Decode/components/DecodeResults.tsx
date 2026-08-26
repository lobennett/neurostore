import { Alert, Box, Tab, Tabs } from '@mui/material';
import { useEffect, useRef } from 'react';
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
    autoFocusActiveTab?: boolean;
}> = ({ activeView, selectedTerm, sourceLabel, onViewChange, onSelectTerm, autoFocusActiveTab = false }) => {
    const tabRefs = useRef<Partial<Record<DecodeResultView, HTMLDivElement | null>>>({});
    const pendingFocusView = useRef<DecodeResultView>();

    const changeViewAndFocusTab = (view: DecodeResultView) => {
        pendingFocusView.current = view;
        onViewChange(view);
    };

    useEffect(() => {
        if (pendingFocusView.current === activeView) {
            tabRefs.current[activeView]?.focus();
            pendingFocusView.current = undefined;
        }
    }, [activeView]);

    return (
        <Box>
            <Alert severity="info" sx={{ marginBottom: 2 }}>
                Illustrative example — no decoder was called
            </Alert>
            <Tabs
                value={activeView}
                onChange={(_event, view: DecodeResultView) => onViewChange(view)}
                aria-label="Decoder result views"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
            >
                <Tab
                    ref={(element) => {
                        tabRefs.current.terms = element;
                    }}
                    id={tabId('terms')}
                    aria-controls={panelId('terms')}
                    value="terms"
                    label="Term correlations"
                    autoFocus={autoFocusActiveTab && activeView === 'terms'}
                />
                <Tab
                    ref={(element) => {
                        tabRefs.current.niclip = element;
                    }}
                    id={tabId('niclip')}
                    aria-controls={panelId('niclip')}
                    value="niclip"
                    label="NiCLIP predictions"
                    autoFocus={autoFocusActiveTab && activeView === 'niclip'}
                />
                <Tab
                    ref={(element) => {
                        tabRefs.current.compare = element;
                    }}
                    id={tabId('compare')}
                    aria-controls={panelId('compare')}
                    value="compare"
                    label="Compare maps"
                    autoFocus={autoFocusActiveTab && activeView === 'compare'}
                />
            </Tabs>
            <Box
                id={panelId('terms')}
                role="tabpanel"
                aria-labelledby={tabId('terms')}
                hidden={activeView !== 'terms'}
                sx={{ paddingY: 2 }}
            >
                <DecodeTermResults
                    terms={EXAMPLE_TERMS}
                    selectedTerm={selectedTerm}
                    onSelectTerm={onSelectTerm}
                    onCompareSelected={() => changeViewAndFocusTab('compare')}
                />
            </Box>
            <Box
                id={panelId('niclip')}
                role="tabpanel"
                aria-labelledby={tabId('niclip')}
                hidden={activeView !== 'niclip'}
                sx={{ paddingY: 2 }}
            >
                <DecodeNiClipResults domains={EXAMPLE_NICLIP_DOMAINS} tasks={EXAMPLE_NICLIP_TASKS} />
            </Box>
            <Box
                id={panelId('compare')}
                role="tabpanel"
                aria-labelledby={tabId('compare')}
                hidden={activeView !== 'compare'}
                sx={{ paddingY: 2 }}
            >
                <DecodeComparison
                    sourceLabel={sourceLabel}
                    selectedTerm={selectedTerm}
                    onChooseTerm={() => changeViewAndFocusTab('terms')}
                />
            </Box>
            <DecodeMethodSummary />
        </Box>
    );
};

export default DecodeResults;
