import { Alert, Box, Button, Collapse, Divider, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { usePageMetadata, usePrerenderReady } from '../../../seo/hooks';
import { createFixtureDecodeAdapter } from './Decode.adapter';
import { MAP_TYPE_OPTIONS, NEUROVAULT_MODALITY_OPTIONS } from './Decode.constants';
import { DECODE_MODELS, EMPTY_DECODE_DRAFT } from './Decode.fixtures';
import { buildDecodeRunRequest, isPreviewStale } from './Decode.helpers';
import type {
    DecodeFixtureScenario,
    DecodeResultView,
    IDecodeComparableResult,
    IDecodeFrontendAdapter,
    IDecodePreviewState,
    IDecodeRunRequest,
    IViewerState,
} from './Decode.types';
import DecodeInputPanel from './components/DecodeInputPanel';
import DecodePreviewState from './components/DecodePreviewState';
import DecodeResults from './components/DecodeResults';
import DecodeViewer from './components/DecodeViewer';

const DEFAULT_ADAPTER = createFixtureDecodeAdapter();
const DEFAULT_VIEWER_STATE: IViewerState = { x: 0, y: 0, z: 0, threshold: 0 };

interface DecodePageProps {
    adapter?: IDecodeFrontendAdapter;
    initialFixtureScenario?: DecodeFixtureScenario;
    /** @deprecated Use initialFixtureScenario. */
    fixtureScenario?: DecodeFixtureScenario;
}

const FIXTURE_SCENARIOS = new Set<DecodeFixtureScenario>([
    'success',
    'loading',
    'empty-terms',
    'empty-studies',
    'unsupported',
    'lookup-error',
    'decode-error',
]);

const developmentFixtureScenario = (): DecodeFixtureScenario => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return 'success';
    const scenario = new URLSearchParams(window.location.search).get('fixture');
    return scenario && FIXTURE_SCENARIOS.has(scenario as DecodeFixtureScenario)
        ? (scenario as DecodeFixtureScenario)
        : 'success';
};

const labelForValue = <T extends string>(options: Array<{ value: T; label: string }>, value: T) =>
    options.find((option) => option.value === value)?.label ?? value;

const sourceLabelForRequest = (request: IDecodeRunRequest) => {
    if (request.source.kind === 'neurovault') return `NeuroVault image ${request.source.imageId}`;
    if (request.source.kind === 'upload') return request.source.filename;
    return `${request.source.points.length} MNI ${request.source.points.length === 1 ? 'coordinate' : 'coordinates'}`;
};

const declaredInputForRequest = (request: IDecodeRunRequest) => {
    if (!request.metadata) return 'MNI coordinate input';
    const { metadata } = request;
    const modality = labelForValue(NEUROVAULT_MODALITY_OPTIONS, metadata.modality).replace('fMRI BOLD', 'fMRI-BOLD');
    const fields = [
        `${metadata.analysisLevel}-level`,
        `${labelForValue(MAP_TYPE_OPTIONS, metadata.mapType).replace(' map', '').toLowerCase()}`,
        modality,
    ];
    if (metadata.subjectCount) {
        fields.push(`${metadata.subjectCount} ${metadata.subjectCount === '1' ? 'subject' : 'subjects'}`);
    }
    return fields.join(' · ');
};

const DecodePage = ({ adapter = DEFAULT_ADAPTER, initialFixtureScenario, fixtureScenario }: DecodePageProps) => {
    const [activeFixtureScenario] = useState<DecodeFixtureScenario>(
        () => initialFixtureScenario ?? fixtureScenario ?? developmentFixtureScenario()
    );
    const [draft, setDraft] = useState(EMPTY_DECODE_DRAFT);
    const [previewState, setPreviewState] = useState<IDecodePreviewState | null>(null);
    const [inputsExpanded, setInputsExpanded] = useState(true);
    const [activeResultView, setActiveResultView] = useState<DecodeResultView>('terms');
    const [selectedResult, setSelectedResult] = useState<IDecodeComparableResult>();
    const [announcement, setAnnouncement] = useState('');
    const [autoFocusSource, setAutoFocusSource] = useState(false);
    const [workspaceVersion, setWorkspaceVersion] = useState(0);
    const [viewerState, setViewerState] = useState<IViewerState>(DEFAULT_VIEWER_STATE);

    usePageMetadata({
        title: 'Decode a brain map | Neurosynth Compose',
        description:
            'Preview how a public decoder workspace can accept a statistical map or MNI coordinates and present clearly illustrative evidence.',
        canonicalPath: '/decode',
    });
    usePrerenderReady(true);

    const previewIsStale = previewState ? isPreviewStale(draft, previewState.request) : false;

    const changeDraft = (nextDraft: typeof draft) => {
        if (previewState && !previewIsStale && isPreviewStale(nextDraft, previewState.request)) {
            setAnnouncement('Inputs changed. Preview again to refresh example results.');
        }
        setAutoFocusSource(false);
        setDraft(nextDraft);
    };

    const openPreview = () => {
        const request = buildDecodeRunRequest(draft);
        const nextPreviewState = adapter.preview(request, activeFixtureScenario);
        setPreviewState(nextPreviewState);
        const initialCoordinate = request.source.kind === 'coordinates' ? request.source.points[0] : undefined;
        setViewerState(
            initialCoordinate
                ? { x: initialCoordinate.x, y: initialCoordinate.y, z: initialCoordinate.z, threshold: 0 }
                : DEFAULT_VIEWER_STATE
        );
        setInputsExpanded(false);
        setActiveResultView('terms');
        setSelectedResult(undefined);
        setAutoFocusSource(false);
        setAnnouncement(
            nextPreviewState.status === 'success'
                ? 'Example decoder results ready.'
                : nextPreviewState.status === 'loading'
                  ? 'Illustrative preview loading.'
                  : `${nextPreviewState.operation} failed. ${nextPreviewState.message}`
        );
    };

    const resetPreview = () => {
        setDraft(EMPTY_DECODE_DRAFT);
        setPreviewState(null);
        setInputsExpanded(true);
        setActiveResultView('terms');
        setSelectedResult(undefined);
        setAnnouncement('Preview reset. Choose another map source.');
        setAutoFocusSource(true);
        setViewerState(DEFAULT_VIEWER_STATE);
        setWorkspaceVersion((version) => version + 1);
    };

    const previewRequest = previewState?.request;
    const sourceLabel = previewRequest ? sourceLabelForRequest(previewRequest) : '';
    const requestModel = previewRequest ? DECODE_MODELS.find(({ id }) => id === previewRequest.modelId) : undefined;
    const resultModel =
        previewState?.status === 'success'
            ? DECODE_MODELS.find(({ id }) => id === previewState.preview.modelId)
            : undefined;
    const nonDefaultParameters =
        previewRequest && requestModel
            ? requestModel.parameters.filter(
                  ({ key, defaultValue }) =>
                      previewRequest.parameters[key] !== undefined && previewRequest.parameters[key] !== defaultValue
              )
            : [];

    return (
        <Box component="main" sx={{ py: { xs: 2, md: 4 } }}>
            <Box
                role="status"
                aria-live="polite"
                aria-atomic="true"
                sx={{
                    border: 0,
                    clip: 'rect(0 0 0 0)',
                    height: '1px',
                    margin: '-1px',
                    overflow: 'hidden',
                    padding: 0,
                    position: 'absolute',
                    whiteSpace: 'nowrap',
                    width: '1px',
                }}
            >
                {announcement}
            </Box>

            <Box sx={{ maxWidth: '76ch', mb: 3 }}>
                <Typography component="h1" variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 1 }}>
                    Decode a brain map
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Prepare a public, illustrative preview from a NIfTI map, NeuroVault image, or MNI coordinate. Every
                    result on this page is deterministic example data.
                </Typography>
            </Box>

            <Paper component="section" variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{ borderLeft: '4px solid #023e8a', px: { xs: 2, md: 2.5 }, py: 1.5 }}
                >
                    <Box>
                        <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
                            Prepare input
                        </Typography>
                        {!inputsExpanded && previewRequest ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {sourceLabel} · {requestModel?.name}
                            </Typography>
                        ) : null}
                    </Box>
                    {!inputsExpanded && previewState?.status !== 'error' ? (
                        <Button variant="outlined" onClick={() => setInputsExpanded(true)}>
                            Edit inputs
                        </Button>
                    ) : null}
                </Stack>
                <Collapse in={inputsExpanded}>
                    <Divider />
                    <DecodeInputPanel
                        key={workspaceVersion}
                        value={draft}
                        onChange={changeDraft}
                        onPreview={openPreview}
                        autoFocusSource={autoFocusSource}
                    />
                </Collapse>
            </Paper>

            {previewState ? (
                <DecodePreviewState
                    state={previewState}
                    onRetry={openPreview}
                    onEditInputs={() => setInputsExpanded(true)}
                >
                    {(successfulState) => (
                        <Stack spacing={{ xs: 2, md: 3 }}>
                            <DecodeViewer
                                source={successfulState.request.source}
                                atlasReadouts={successfulState.preview.atlasReadouts}
                                value={viewerState}
                                onChange={setViewerState}
                            />
                            <Box
                                role="region"
                                aria-label="Illustrative decoder results"
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: 'minmax(0, 1fr)',
                                        md: 'minmax(250px, 0.38fr) minmax(0, 1fr)',
                                    },
                                    gap: { xs: 2, md: 3 },
                                    alignItems: 'start',
                                }}
                            >
                                <Paper
                                    component="aside"
                                    variant="outlined"
                                    sx={{ p: 2.5, borderTop: '3px solid #023e8a' }}
                                >
                                    {previewIsStale ? (
                                        <Alert severity="warning" sx={{ mb: 2 }}>
                                            This example preview is out of date.
                                        </Alert>
                                    ) : null}
                                    <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
                                        Preview snapshot
                                    </Typography>
                                    <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>{sourceLabel}</Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mt: 0.5, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        {requestModel?.name} · {successfulState.request.modelVersion}
                                    </Typography>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Declared input
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Declared input: {declaredInputForRequest(successfulState.request)}
                                    </Typography>
                                    {successfulState.request.source.kind === 'upload' ? (
                                        <Box
                                            role="region"
                                            aria-label="Example deposit receipt"
                                            sx={{ bgcolor: '#f4f8fb', borderLeft: '4px solid #0096c7', mt: 2, p: 1.5 }}
                                        >
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                Example deposit receipt
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontFamily: 'monospace',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    mt: 0.5,
                                                }}
                                            >
                                                example-deposit-001 · CC0 · {successfulState.request.source.filename}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                display="block"
                                                sx={{ mt: 0.5 }}
                                            >
                                                Illustrative only — no deposit occurred.
                                            </Typography>
                                        </Box>
                                    ) : null}
                                    {nonDefaultParameters.length ? (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                Changed parameters
                                            </Typography>
                                            {nonDefaultParameters.map(({ key, label }) => (
                                                <Typography
                                                    key={key}
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mt: 0.5 }}
                                                >
                                                    {label}: {String(successfulState.request.parameters[key])}
                                                </Typography>
                                            ))}
                                        </Box>
                                    ) : null}
                                    {requestModel ? (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                            sx={{ mt: 2 }}
                                        >
                                            {requestModel.interpretationNote}
                                        </Typography>
                                    ) : null}
                                    <Button variant="outlined" onClick={resetPreview} sx={{ mt: 2 }}>
                                        Start another preview
                                    </Button>
                                </Paper>
                                <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
                                    {resultModel ? (
                                        <DecodeResults
                                            activeView={activeResultView}
                                            preview={successfulState.preview}
                                            model={resultModel}
                                            selectedResult={selectedResult}
                                            sourceLabel={sourceLabel}
                                            viewerState={viewerState}
                                            onViewChange={setActiveResultView}
                                            onSelectComparison={setSelectedResult}
                                            onViewerStateChange={setViewerState}
                                            autoFocusActiveTab
                                        />
                                    ) : null}
                                </Paper>
                            </Box>
                        </Stack>
                    )}
                </DecodePreviewState>
            ) : null}
        </Box>
    );
};

export default DecodePage;
