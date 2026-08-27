import { Alert, Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import type {
    DecodeMetric,
    DecodeResultView,
    IDecodeComparableResult,
    IDecodeModelDefinition,
    IDecodePreview,
} from '../Decode.types';
import DecodeComparison from './DecodeComparison';
import DecodeMethodSummary from './DecodeMethodSummary';
import DecodeNiClipResults from './DecodeNiClipResults';
import DecodeStudyResults from './DecodeStudyResults';
import DecodeTermResults from './DecodeTermResults';

const RESULT_VIEWS: Array<{ value: DecodeResultView; label: string }> = [
    { value: 'terms', label: 'Terms' },
    { value: 'studies', label: 'Associated studies' },
    { value: 'model-summary', label: 'Model summary' },
    { value: 'compare', label: 'Compare maps' },
];

const METRIC_SUMMARIES: Record<DecodeMetric, { quantity: string; explanation: string }> = {
    correlation: {
        quantity: 'correlation',
        explanation:
            'Correlation values describe signed spatial association between the input and each example concept map.',
    },
    similarity: {
        quantity: 'similarity',
        explanation: 'Similarity values describe model-estimated closeness between the input and each example concept.',
    },
    probability: {
        quantity: 'probability',
        explanation: 'Probability values describe the model probability assigned to each example concept.',
    },
    'bayes-factor': {
        quantity: 'Bayes factor',
        explanation:
            'Bayes factors describe evidence change relative to the configured prior for each example concept.',
    },
};

const tabId = (view: DecodeResultView) => `decode-result-tab-${view}`;
const panelId = (view: DecodeResultView) => `decode-result-panel-${view}`;

const DecodeResults: React.FC<{
    activeView: DecodeResultView;
    preview: IDecodePreview;
    model: IDecodeModelDefinition;
    selectedResult?: IDecodeComparableResult;
    sourceLabel: string;
    onViewChange: (view: DecodeResultView) => void;
    onSelectComparison: (result: IDecodeComparableResult) => void;
    autoFocusActiveTab?: boolean;
}> = ({
    activeView,
    preview,
    model,
    selectedResult,
    sourceLabel,
    onViewChange,
    onSelectComparison,
    autoFocusActiveTab = false,
}) => {
    const tabRefs = useRef<Partial<Record<DecodeResultView, HTMLDivElement | null>>>({});
    const pendingFocusView = useRef<DecodeResultView | undefined>(undefined);
    const termMetricSummary = METRIC_SUMMARIES[preview.termMetric];
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
            <Stack spacing={1} sx={{ mb: 2 }}>
                <Alert severity="info" role="note" sx={{ borderLeft: '4px solid #0077b6' }}>
                    <Box component="span">{preview.provenance.label}</Box> · {preview.provenance.version}
                </Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ px: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {model.name} · {preview.modelVersion}
                    </Typography>
                    {Object.entries(preview.parameters).map(([key, value]) => (
                        <Typography
                            key={key}
                            variant="body2"
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                        >
                            {key}: {String(value)}
                        </Typography>
                    ))}
                </Stack>
                <Box sx={{ px: 1.5, py: 1, bgcolor: '#f4f8fb', borderLeft: '4px solid #023e8a' }}>
                    <Typography variant="body2" color="text.secondary">
                        Ranked associations do not establish the cognitive state that produced the input. They support
                        interpretation, not reverse-inference proof.
                    </Typography>
                </Box>
            </Stack>

            <Tabs
                value={activeView}
                onChange={(_event, view: DecodeResultView) => onViewChange(view)}
                aria-label="Decoder result views"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
                {RESULT_VIEWS.map(({ value, label }) => (
                    <Tab
                        key={value}
                        ref={(element) => {
                            tabRefs.current[value] = element;
                        }}
                        id={tabId(value)}
                        aria-controls={panelId(value)}
                        value={value}
                        label={label}
                        autoFocus={autoFocusActiveTab && activeView === value}
                    />
                ))}
            </Tabs>

            <Box
                id={panelId('terms')}
                role="tabpanel"
                aria-labelledby={tabId('terms')}
                hidden={activeView !== 'terms'}
                sx={{ py: 2 }}
            >
                <DecodeTermResults
                    terms={preview.terms}
                    metric={preview.termMetric}
                    selectedResult={selectedResult}
                    onSelectComparison={onSelectComparison}
                    onCompareSelected={() => changeViewAndFocusTab('compare')}
                />
            </Box>
            <Box
                id={panelId('studies')}
                role="tabpanel"
                aria-labelledby={tabId('studies')}
                hidden={activeView !== 'studies'}
                sx={{ py: 2 }}
            >
                <DecodeStudyResults
                    studies={preview.studies}
                    selectedResult={selectedResult}
                    onSelectComparison={onSelectComparison}
                    onCompareSelected={() => changeViewAndFocusTab('compare')}
                />
            </Box>
            <Box
                id={panelId('model-summary')}
                role="tabpanel"
                aria-labelledby={tabId('model-summary')}
                hidden={activeView !== 'model-summary'}
                sx={{ py: 2 }}
            >
                <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                    {model.name} example summary
                </Typography>
                {model.id === 'niclip' ? (
                    <DecodeNiClipResults
                        domains={preview.modelSummary.domains}
                        tasks={preview.modelSummary.tasks}
                        parameters={preview.parameters}
                    />
                ) : (
                    <Box>
                        <Typography variant="body2" color="text.secondary">
                            {preview.modelSummary.narrative}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {termMetricSummary.explanation}
                        </Typography>
                        <Box
                            component="ol"
                            aria-label="NeuroVLM ranked concepts"
                            sx={{ m: 0, mt: 2, pl: 3, columnCount: { xs: 1, sm: 2 }, columnGap: 3 }}
                        >
                            {preview.terms.slice(0, 10).map(({ id, label, value }) => (
                                <Typography
                                    component="li"
                                    variant="body2"
                                    key={id}
                                    sx={{ mb: 0.75, breakInside: 'avoid' }}
                                >
                                    {label} · {termMetricSummary.quantity} {value.toFixed(3)}
                                </Typography>
                            ))}
                        </Box>
                    </Box>
                )}
                <DecodeMethodSummary model={model} />
            </Box>
            <Box
                id={panelId('compare')}
                role="tabpanel"
                aria-labelledby={tabId('compare')}
                hidden={activeView !== 'compare'}
                sx={{ py: 2 }}
            >
                <DecodeComparison
                    sourceLabel={sourceLabel}
                    selectedTerm={selectedResult?.label}
                    onChooseTerm={() => changeViewAndFocusTab('terms')}
                />
            </Box>
        </Box>
    );
};

export default DecodeResults;
