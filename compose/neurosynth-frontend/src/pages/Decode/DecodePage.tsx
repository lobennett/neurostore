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
    IDecodeFrontendAdapter,
    IDecodePreviewState,
    IDecodeRunRequest,
} from './Decode.types';
import DecodeInputPanel from './components/DecodeInputPanel';
import DecodeResults from './components/DecodeResults';

const DEFAULT_ADAPTER = createFixtureDecodeAdapter();

interface DecodePageProps {
    adapter?: IDecodeFrontendAdapter;
    fixtureScenario?: DecodeFixtureScenario;
}

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

const DecodePage = ({ adapter = DEFAULT_ADAPTER, fixtureScenario = 'success' }: DecodePageProps) => {
    const [draft, setDraft] = useState(EMPTY_DECODE_DRAFT);
    const [previewState, setPreviewState] = useState<IDecodePreviewState | null>(null);
    const [inputsExpanded, setInputsExpanded] = useState(true);
    const [activeResultView, setActiveResultView] = useState<DecodeResultView>('terms');
    const [selectedTerm, setSelectedTerm] = useState<string>();
    const [announcement, setAnnouncement] = useState('');
    const [autoFocusSource, setAutoFocusSource] = useState(false);
    const [workspaceVersion, setWorkspaceVersion] = useState(0);

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
        setPreviewState(adapter.preview(request, fixtureScenario));
        setInputsExpanded(false);
        setActiveResultView('terms');
        setSelectedTerm(undefined);
        setAutoFocusSource(false);
        setAnnouncement('Example decoder results ready.');
    };

    const resetPreview = () => {
        setDraft(EMPTY_DECODE_DRAFT);
        setPreviewState(null);
        setInputsExpanded(true);
        setActiveResultView('terms');
        setSelectedTerm(undefined);
        setAnnouncement('Preview reset. Choose another map source.');
        setAutoFocusSource(true);
        setWorkspaceVersion((version) => version + 1);
    };

    const previewRequest = previewState?.request;
    const sourceLabel = previewRequest ? sourceLabelForRequest(previewRequest) : '';
    const model = previewRequest ? DECODE_MODELS.find(({ id }) => id === previewRequest.modelId) : undefined;
    const nonDefaultParameters =
        previewRequest && model
            ? model.parameters.filter(
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
                    height: 1,
                    margin: -1,
                    overflow: 'hidden',
                    padding: 0,
                    position: 'absolute',
                    whiteSpace: 'nowrap',
                    width: 1,
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
                                {sourceLabel} · {model?.name}
                            </Typography>
                        ) : null}
                    </Box>
                    {!inputsExpanded ? (
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

            {previewState?.status === 'success' ? (
                <Box
                    role="region"
                    aria-label="Illustrative decoder results"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(250px, 0.38fr) minmax(0, 1fr)' },
                        gap: { xs: 2, md: 3 },
                        alignItems: 'start',
                    }}
                >
                    <Paper component="aside" variant="outlined" sx={{ p: 2.5, borderTop: '3px solid #023e8a' }}>
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
                            {model?.name} · {previewState.request.modelVersion}
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Declared input
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Declared input: {declaredInputForRequest(previewState.request)}
                        </Typography>
                        {nonDefaultParameters.length ? (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Changed parameters
                                </Typography>
                                {nonDefaultParameters.map(({ key, label }) => (
                                    <Typography key={key} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {label}: {String(previewState.request.parameters[key])}
                                    </Typography>
                                ))}
                            </Box>
                        ) : null}
                        {model ? (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                                {model.interpretationNote}
                            </Typography>
                        ) : null}
                        <Button variant="outlined" onClick={resetPreview} sx={{ mt: 2 }}>
                            Start another preview
                        </Button>
                    </Paper>
                    <Paper component="section" variant="outlined" sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
                        <DecodeResults
                            activeView={activeResultView}
                            selectedTerm={selectedTerm}
                            sourceLabel={sourceLabel}
                            onViewChange={setActiveResultView}
                            onSelectTerm={setSelectedTerm}
                            autoFocusActiveTab
                        />
                    </Paper>
                </Box>
            ) : null}
        </Box>
    );
};

export default DecodePage;
