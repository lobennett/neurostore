import { Alert, Box, Link, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import type {
    DecodeMetric,
    DecodeResultView,
    IDecodeComparableResult,
    IDecodeModelDefinition,
    IDecodePreview,
    IViewerState,
} from '../Decode.types';
import { DECODE_COLORS } from '../Decode.styles';
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

const externalLinkProps = { target: '_blank', rel: 'noopener noreferrer' } as const;

const RecordedProvenance: React.FC<{ preview: IDecodePreview }> = ({ preview }) => {
    if (preview.provenance.kind !== 'recorded') return null;
    const provenance = preview.provenance;
    const mapSources = Object.entries(preview.visualization?.comparisonByResultId ?? {}).map(([resultId, asset]) => ({
        label: preview.terms.find(({ id }) => id === resultId)?.label ?? resultId,
        url: asset.provenance.sourceUrl,
    }));

    return (
        <Alert severity="info" role="note" sx={{ borderLeft: `4px solid ${DECODE_COLORS.blue}` }}>
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
                {provenance.label}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                {provenance.method} · {provenance.referenceDataset} reference dataset ·{' '}
                <Link href={provenance.sourceUrl} {...externalLinkProps}>
                    Neurosynth method source
                </Link>
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                Scores describe spatial similarity—not probability, diagnosis, or causal evidence. Ranked by absolute
                correlation magnitude, strongest first; signed values are preserved.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                Retrieved {provenance.retrievedAt} · Result ID{' '}
                <Link href={provenance.resultUrl} {...externalLinkProps}>
                    Open recorded result {provenance.resultId}
                </Link>
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                Source:{' '}
                <Link href={provenance.input.sourceUrl} {...externalLinkProps}>
                    NeuroVault image {provenance.input.imageId}
                </Link>{' '}
                from{' '}
                <Link href={provenance.input.collectionUrl} {...externalLinkProps}>
                    collection {provenance.input.collectionId}: {provenance.input.collectionName}
                </Link>{' '}
                ·{' '}
                <Link href={provenance.input.doiUrl} {...externalLinkProps}>
                    Collection DOI {provenance.input.doi}
                </Link>
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                {provenance.input.license} input map · {provenance.input.attribution}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
                {provenance.termMaps.license} term maps · {provenance.termMaps.attribution}
            </Typography>
            {mapSources.length ? (
                <Stack
                    component="ul"
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 0.25, sm: 1.5 }}
                    sx={{ m: 0, mt: 0.5, pl: 2.5 }}
                >
                    {mapSources.map(({ label, url }) => (
                        <Typography component="li" variant="body2" key={url}>
                            <Link href={url} {...externalLinkProps}>
                                {label.charAt(0).toLocaleUpperCase() + label.slice(1)} map source
                            </Link>
                        </Typography>
                    ))}
                </Stack>
            ) : null}
        </Alert>
    );
};

const DecodeResults: React.FC<{
    activeView: DecodeResultView;
    preview: IDecodePreview;
    model: IDecodeModelDefinition;
    selectedResult?: IDecodeComparableResult;
    sourceLabel: string;
    viewerState: IViewerState;
    onViewChange: (view: DecodeResultView) => void;
    onSelectComparison: (result: IDecodeComparableResult) => void;
    onViewerStateChange: (value: IViewerState) => void;
    autoFocusActiveTab?: boolean;
}> = ({
    activeView,
    preview,
    model,
    selectedResult,
    sourceLabel,
    viewerState,
    onViewChange,
    onSelectComparison,
    onViewerStateChange,
    autoFocusActiveTab = false,
}) => {
    const tabRefs = useRef<Partial<Record<DecodeResultView, HTMLDivElement | null>>>({});
    const pendingFocusView = useRef<DecodeResultView | undefined>(undefined);
    const recorded = preview.provenance.kind === 'recorded';
    const termMetricSummary = METRIC_SUMMARIES[preview.termMetric];
    const availableResultViews = RESULT_VIEWS.filter(({ value }) => model.outputViews.includes(value));
    const resolvedActiveView = model.outputViews.includes(activeView)
        ? activeView
        : (availableResultViews[0]?.value ?? 'terms');
    const canCompare = model.outputViews.includes('compare');
    const changeViewAndFocusTab = (view: DecodeResultView) => {
        pendingFocusView.current = view;
        onViewChange(view);
    };

    useEffect(() => {
        if (!model.outputViews.includes(activeView)) {
            onViewChange(resolvedActiveView);
            return;
        }
        if (pendingFocusView.current === resolvedActiveView) {
            tabRefs.current[resolvedActiveView]?.focus();
            pendingFocusView.current = undefined;
        }
    }, [activeView, model.outputViews, onViewChange, resolvedActiveView]);

    return (
        <Box>
            <Stack spacing={1} sx={{ mb: 2 }}>
                {recorded ? (
                    <RecordedProvenance preview={preview} />
                ) : (
                    <Alert severity="info" role="note" sx={{ borderLeft: `4px solid ${DECODE_COLORS.blue}` }}>
                        <Box component="span">{preview.provenance.label}</Box> · {preview.provenance.version}
                    </Alert>
                )}
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
                <Box
                    sx={{
                        px: 1.5,
                        py: 1,
                        bgcolor: DECODE_COLORS.surface,
                        borderLeft: `4px solid ${DECODE_COLORS.navy}`,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        Ranked associations do not establish the cognitive state that produced the input. They support
                        interpretation, not reverse-inference proof.
                    </Typography>
                </Box>
            </Stack>

            <Tabs
                value={resolvedActiveView}
                onChange={(_event, view: DecodeResultView) => onViewChange(view)}
                aria-label="Decoder result views"
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
                {availableResultViews.map(({ value, label }) => (
                    <Tab
                        key={value}
                        ref={(element) => {
                            tabRefs.current[value] = element;
                        }}
                        id={tabId(value)}
                        aria-controls={panelId(value)}
                        value={value}
                        label={label}
                        autoFocus={autoFocusActiveTab && resolvedActiveView === value}
                    />
                ))}
            </Tabs>

            {model.outputViews.includes('terms') ? (
                <Box
                    id={panelId('terms')}
                    role="tabpanel"
                    aria-labelledby={tabId('terms')}
                    hidden={resolvedActiveView !== 'terms'}
                    sx={{ py: 2 }}
                >
                    {preview.terms.length === 0 ? (
                        <Box
                            sx={{ bgcolor: DECODE_COLORS.surface, borderLeft: `4px solid ${DECODE_COLORS.navy}`, p: 2 }}
                        >
                            <Typography>No example term results are available for this preview.</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Edit the inputs or try the preview again to inspect a different fixture state.
                            </Typography>
                        </Box>
                    ) : (
                        <DecodeTermResults
                            terms={preview.terms}
                            metric={preview.termMetric}
                            recorded={recorded}
                            selectedResult={selectedResult}
                            onSelectComparison={onSelectComparison}
                            onCompareSelected={canCompare ? () => changeViewAndFocusTab('compare') : undefined}
                        />
                    )}
                </Box>
            ) : null}
            {model.outputViews.includes('studies') ? (
                <Box
                    id={panelId('studies')}
                    role="tabpanel"
                    aria-labelledby={tabId('studies')}
                    hidden={resolvedActiveView !== 'studies'}
                    sx={{ py: 2 }}
                >
                    {preview.studies.length === 0 ? (
                        <Box
                            sx={{ bgcolor: DECODE_COLORS.surface, borderLeft: `4px solid ${DECODE_COLORS.navy}`, p: 2 }}
                        >
                            <Typography>No example associated studies are available for this preview.</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                The Terms and Model summary tabs remain available for this preview.
                            </Typography>
                        </Box>
                    ) : (
                        <DecodeStudyResults
                            studies={preview.studies}
                            selectedResult={selectedResult}
                            onSelectComparison={onSelectComparison}
                            onCompareSelected={canCompare ? () => changeViewAndFocusTab('compare') : undefined}
                        />
                    )}
                </Box>
            ) : null}
            {model.outputViews.includes('model-summary') ? (
                <Box
                    id={panelId('model-summary')}
                    role="tabpanel"
                    aria-labelledby={tabId('model-summary')}
                    hidden={resolvedActiveView !== 'model-summary'}
                    sx={{ py: 2 }}
                >
                    <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        {recorded ? 'Recorded result summary' : `${model.name} example summary`}
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
                                {recorded
                                    ? 'Pearson correlation describes signed spatial similarity between the input image and each reference term map; it is not a probability.'
                                    : termMetricSummary.explanation}
                            </Typography>
                            <Box
                                component="ol"
                                aria-label={recorded ? 'Recorded Pearson ranked concepts' : 'NeuroVLM ranked concepts'}
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
                    <DecodeMethodSummary model={model} recorded={recorded} />
                </Box>
            ) : null}
            {canCompare ? (
                <Box
                    id={panelId('compare')}
                    role="tabpanel"
                    aria-labelledby={tabId('compare')}
                    hidden={resolvedActiveView !== 'compare'}
                    sx={{ py: 2 }}
                >
                    <DecodeComparison
                        sourceLabel={sourceLabel}
                        selectedResult={selectedResult}
                        visualization={preview.visualization}
                        viewerState={viewerState}
                        onChooseTerm={() => changeViewAndFocusTab('terms')}
                        onViewerStateChange={onViewerStateChange}
                    />
                </Box>
            ) : null}
        </Box>
    );
};

export default DecodeResults;
