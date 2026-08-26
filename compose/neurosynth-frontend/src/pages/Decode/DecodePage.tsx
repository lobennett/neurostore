import { Box, Button, Divider, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { usePageMetadata, usePrerenderReady } from '../../../seo/hooks';
import { EMPTY_DECODE_SUBMISSION } from './Decode.fixtures';
import { parseNeurovaultImageId } from './Decode.helpers';
import type { DecodeResultView, IDecodeSubmission } from './Decode.types';
import DecodeInputPanel from './components/DecodeInputPanel';
import DecodeResults from './components/DecodeResults';

const mapTypeLabel = (mapType: IDecodeSubmission['metadata']['mapType']) =>
    mapType === 'z' ? 'z statistic' : 't statistic';

const modalityLabel = (modality: IDecodeSubmission['metadata']['modality']) => {
    if (modality === 'fmri-bold') return 'fMRI-BOLD';
    if (modality === 'pet') return 'PET';
    return 'Other modality';
};

const subjectCountLabel = (subjectCount: string) => `${subjectCount} ${subjectCount === '1' ? 'subject' : 'subjects'}`;

const DecodePage: React.FC = () => {
    const [submission, setSubmission] = useState<IDecodeSubmission>(EMPTY_DECODE_SUBMISSION);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [activeResultView, setActiveResultView] = useState<DecodeResultView>('terms');
    const [selectedTerm, setSelectedTerm] = useState<string>();

    usePageMetadata({
        title: 'Decode a brain map | Neurosynth Compose',
        description:
            'Upload an unthresholded statistical map and see which cognitive terms and tasks it is associated with across the literature.',
        canonicalPath: '/decode',
    });
    usePrerenderReady(true);

    const neurovaultImageId = parseNeurovaultImageId(submission.neurovaultReference);
    const sourceLabel =
        submission.source === 'upload'
            ? submission.file?.name ?? 'NIfTI map'
            : `NeuroVault image ${neurovaultImageId ?? submission.neurovaultReference}`;
    const declaredInput = [
        `${submission.metadata.analysisLevel}-level`,
        mapTypeLabel(submission.metadata.mapType),
        modalityLabel(submission.metadata.modality),
        subjectCountLabel(submission.metadata.subjectCount),
    ].join(' · ');

    const openPreview = () => {
        setIsPreviewOpen(true);
        setActiveResultView('terms');
        setSelectedTerm(undefined);
    };

    const resetPreview = () => {
        setSubmission(EMPTY_DECODE_SUBMISSION);
        setIsPreviewOpen(false);
        setActiveResultView('terms');
        setSelectedTerm(undefined);
    };

    return (
        <Box component="main" sx={{ py: { xs: 2, md: 4 } }}>
            <Box sx={{ maxWidth: isPreviewOpen ? 'none' : 800 }}>
                <Typography component="h1" variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    Decode a brain map
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '68ch', mb: 3 }}>
                    Prepare a public, illustrative preview from a NIfTI map or NeuroVault image. No account, upload,
                    or decoder request is involved.
                </Typography>
            </Box>

            {!isPreviewOpen ? (
                <Box sx={{ maxWidth: 800 }}>
                    <DecodeInputPanel value={submission} onChange={setSubmission} onPreview={openPreview} />
                </Box>
            ) : (
                <Box
                    role="region"
                    aria-label="Illustrative decoder results"
                    aria-live="polite"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(240px, 0.42fr) minmax(0, 1fr)' },
                        gap: { xs: 2, md: 3 },
                        alignItems: 'start',
                    }}
                >
                    <Paper component="aside" variant="outlined" sx={{ p: 2.5 }}>
                        <Typography component="h2" variant="h6" sx={{ fontWeight: 700 }}>
                            Submitted map
                        </Typography>
                        <Typography sx={{ mt: 1, overflowWrap: 'anywhere' }}>{sourceLabel}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {submission.source === 'upload'
                                ? 'Local NIfTI file selected in this browser'
                                : `NeuroVault image ID ${neurovaultImageId}`}
                        </Typography>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Declared input
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Declared input: {declaredInput}
                        </Typography>
                        {submission.metadata.cognitiveTask && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Cognitive Atlas task: {submission.metadata.cognitiveTask.label}
                            </Typography>
                        )}
                        {submission.metadata.interpretation && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Your interpretation: {submission.metadata.interpretation}
                            </Typography>
                        )}
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
                        />
                    </Paper>
                </Box>
            )}
        </Box>
    );
};

export default DecodePage;
