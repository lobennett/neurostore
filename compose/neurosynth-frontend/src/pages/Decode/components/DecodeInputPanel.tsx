import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import { NEUROVAULT_MODALITY_OPTIONS } from '../Decode.constants';
import { isCanonicalGoldenDraft, parseNeurovaultImageId, validateDecodeDraft } from '../Decode.helpers';
import type { DecodeModelId, IDecodeDraft } from '../Decode.types';
import DecodeDescriptionPanel from './DecodeDescriptionPanel';
import DecodeModelPanel from './DecodeModelPanel';
import DecodeSourcePanel from './DecodeSourcePanel';
import { DECODE_COLORS } from '../Decode.styles';

interface DecodeInputPanelProps {
    value: IDecodeDraft;
    onChange: (value: IDecodeDraft) => void;
    onPreview: () => void;
    onLoadWalkthrough?: () => void;
    autoFocusSource?: boolean;
    autoFocusWalkthroughReview?: boolean;
}

const DecodeInputPanel = ({
    value,
    onChange,
    onPreview,
    onLoadWalkthrough,
    autoFocusSource = false,
    autoFocusWalkthroughReview = false,
}: DecodeInputPanelProps) => {
    const walkthroughReviewRef = useRef<HTMLElement>(null);
    const errors = validateDecodeDraft(value);
    const isValid = Object.keys(errors).length === 0;
    const hasActiveSourceAttempt =
        value.activeSource === 'neurovault'
            ? Boolean(value.neurovaultReference.trim())
            : value.activeSource === 'upload'
              ? Boolean(value.file)
              : value.coordinates.length > 0;
    const visibleErrors = hasActiveSourceAttempt ? errors : { ...errors, source: undefined, coordinates: undefined };
    const canonicalWalkthrough = isCanonicalGoldenDraft(value);
    const walkthroughImageId = parseNeurovaultImageId(value.neurovaultReference);
    const modalityLabel =
        NEUROVAULT_MODALITY_OPTIONS.find(({ value: modality }) => modality === value.metadata.modality)?.label ??
        value.metadata.modality;
    const changeModel = (modelId: DecodeModelId, modelParameters: Record<string, string | number | boolean>) =>
        onChange({ ...value, exampleId: modelId === value.modelId ? value.exampleId : null, modelId, modelParameters });

    useEffect(() => {
        if (autoFocusWalkthroughReview && canonicalWalkthrough) walkthroughReviewRef.current?.focus();
    }, [autoFocusWalkthroughReview, canonicalWalkthrough]);

    return (
        <Paper component="section" elevation={0} sx={{ bgcolor: DECODE_COLORS.surface, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2.5} divider={<Divider flexItem />}>
                <Box>
                    <Typography component="h2" variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        Input source
                    </Typography>
                    <DecodeSourcePanel
                        draft={value}
                        errors={visibleErrors}
                        onChange={onChange}
                        autoFocusSource={autoFocusSource}
                        onLoadWalkthrough={onLoadWalkthrough}
                    />
                </Box>
                {canonicalWalkthrough ? (
                    <Paper
                        ref={walkthroughReviewRef}
                        component="section"
                        aria-label="Recorded walkthrough review"
                        tabIndex={-1}
                        variant="outlined"
                        sx={{
                            borderLeft: `4px solid ${DECODE_COLORS.blue}`,
                            p: 2,
                            '&:focus-visible': { outline: `3px solid ${DECODE_COLORS.cyan}` },
                        }}
                    >
                        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Review recorded walkthrough
                        </Typography>
                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <Typography variant="body2">NeuroVault image {walkthroughImageId}</Typography>
                            <Typography variant="body2">
                                {value.metadata.thresholding === 'unthresholded' ? 'Unthresholded' : 'Thresholded'}{' '}
                                {value.metadata.mapType}-statistic map
                            </Typography>
                            <Typography variant="body2">{value.metadata.targetTemplate} target template</Typography>
                            <Typography variant="body2">
                                {value.metadata.analysisLevel === 'group'
                                    ? 'Group-level'
                                    : value.metadata.analysisLevel}{' '}
                                {modalityLabel} · {value.metadata.subjectCount} subjects
                            </Typography>
                            <Typography variant="body2">
                                {value.metadata.cognitiveTask?.label} · {value.metadata.cognitiveTask?.id}
                            </Typography>
                            <Typography variant="body2">Contrast: {value.metadata.contrast}</Typography>
                        </Stack>
                    </Paper>
                ) : null}
                <DecodeDescriptionPanel draft={value} errors={errors} onChange={onChange} />
                <DecodeModelPanel
                    modelId={value.modelId}
                    parameters={value.modelParameters}
                    parameterErrors={errors.modelParameters}
                    sourceKind={value.activeSource}
                    exampleId={value.exampleId}
                    onChange={changeModel}
                />
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                    <Button variant="contained" disabled={!isValid} onClick={onPreview}>
                        {canonicalWalkthrough ? 'Open recorded walkthrough' : 'Preview example results'}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                        {canonicalWalkthrough
                            ? 'Uses bundled public maps and a recorded result; no decoder runs and nothing is uploaded.'
                            : 'No map is uploaded and no decoder is run.'}
                    </Typography>
                    {value.exampleId === 'neurovault-308' && !canonicalWalkthrough && onLoadWalkthrough ? (
                        <Button variant="outlined" onClick={onLoadWalkthrough}>
                            Restore walkthrough values
                        </Button>
                    ) : null}
                </Stack>
            </Stack>
        </Paper>
    );
};

export default DecodeInputPanel;
