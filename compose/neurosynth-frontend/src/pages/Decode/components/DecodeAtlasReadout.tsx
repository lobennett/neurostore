import { Box, Button, Link, Stack, Typography } from '@mui/material';
import { useId, useState } from 'react';
import type { AtlasReadout, AtlasValueType } from '../Decode.atlas.types';
import { DECODE_COLORS } from '../Decode.styles';
import type { IViewerState } from '../Decode.types';
import useDecodeAtlasReadout from '../useDecodeAtlasReadout';

const ATLAS_SECTIONS = [
    {
        id: 'anatomical',
        heading: 'Anatomical location',
        explanation:
            'Probabilistic atlas labels can overlap, so more than one cortical or subcortical region may match this coordinate.',
        atlasIds: ['harvardoxford-cortical', 'harvardoxford-subcortical'],
    },
    {
        id: 'functional',
        heading: 'Decoder feature space',
        explanation: 'DiFuMo loadings are native feature weights, not parcel probabilities, and are not percentages.',
        atlasIds: ['difumo-512'],
    },
] as const;

const assertNever = (value: never): never => {
    throw new Error(`Unsupported atlas value type: ${String(value)}`);
};

const formatAtlasValue = (valueType: AtlasValueType, value: number) => {
    switch (valueType) {
        case 'probability':
            return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
        case 'loading':
            return value.toPrecision(3);
        default:
            return assertNever(valueType);
    }
};

const valueLabel = (valueType: AtlasValueType) => {
    switch (valueType) {
        case 'probability':
            return 'Probability';
        case 'loading':
            return 'Loading';
        default:
            return assertNever(valueType);
    }
};

const signedCoordinate = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));

interface DecodeAtlasReadoutProps {
    coordinate: Pick<IViewerState, 'x' | 'y' | 'z'>;
}

interface AtlasGroupProps {
    atlas: AtlasReadout;
    expanded: boolean;
    headingId: string;
    onToggle: () => void;
}

const AtlasGroup = ({ atlas, expanded, headingId, onToggle }: AtlasGroupProps) => {
    const visibleMatches = expanded ? atlas.matches : atlas.matches.slice(0, 3);
    const canExpand = atlas.matches.length > 3;
    const toggleLabel = expanded ? 'Show top 3' : 'Show all nonzero matches';

    return (
        <Box
            role="group"
            aria-labelledby={headingId}
            sx={{ borderTop: `1px solid ${DECODE_COLORS.navyBorder}`, minWidth: 0, pt: 1.5 }}
        >
            <Typography id={headingId} component="h5" variant="subtitle2" sx={{ color: DECODE_COLORS.ink }}>
                {atlas.name}
            </Typography>
            {visibleMatches.length ? (
                <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, mt: 1.25, p: 0 }}>
                    {visibleMatches.map((match) => (
                        <Box
                            component="li"
                            key={match.id}
                            sx={{
                                display: 'grid',
                                gap: { xs: 0.25, sm: 2 },
                                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
                                minWidth: 0,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    color: DECODE_COLORS.ink,
                                    fontWeight: 500,
                                    minWidth: 0,
                                    overflowWrap: 'anywhere',
                                }}
                            >
                                {match.label}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: DECODE_COLORS.navy,
                                    fontFamily: 'monospace',
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: 700,
                                }}
                            >
                                {valueLabel(atlas.valueType)} {formatAtlasValue(atlas.valueType, match.value)}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                    No nonzero matches at this coordinate
                </Typography>
            )}
            {canExpand ? (
                <Button
                    type="button"
                    size="small"
                    aria-expanded={expanded}
                    aria-label={`${toggleLabel} for ${atlas.name}`}
                    onClick={onToggle}
                    sx={{ mt: 1, px: 0.5 }}
                >
                    {toggleLabel}
                </Button>
            ) : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 1 }} sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                    Version {atlas.version}
                </Typography>
                <Link
                    href={atlas.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Source for ${atlas.name}`}
                    variant="caption"
                >
                    Atlas source
                </Link>
            </Stack>
        </Box>
    );
};

const DecodeAtlasReadout = ({ coordinate }: DecodeAtlasReadoutProps) => {
    const { data, isInitialLoading, isUpdating, isError, retry } = useDecodeAtlasReadout(coordinate);
    const [expandedByAtlas, setExpandedByAtlas] = useState<Record<string, boolean>>({});
    const id = useId();
    const headingId = `${id}-heading`;
    const coordinateId = `${id}-coordinate`;
    const summaryId = `${id}-summary`;
    const provenanceId = `${id}-provenance`;

    return (
        <Box
            component="section"
            role="region"
            aria-labelledby={headingId}
            aria-describedby={`${coordinateId} ${summaryId} ${provenanceId}`}
            sx={{ borderLeft: `2px solid ${DECODE_COLORS.blue}`, minHeight: 240, minWidth: 0, pl: 2 }}
        >
            <Typography
                id={headingId}
                component="h3"
                variant="subtitle1"
                sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}
            >
                Atlas readout at selected coordinate
            </Typography>
            <Typography
                id={coordinateId}
                variant="body2"
                sx={{
                    color: DECODE_COLORS.navy,
                    fontFamily: 'monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                    mt: 0.5,
                }}
            >
                MNI152 coordinate: x {signedCoordinate(coordinate.x)}, y {signedCoordinate(coordinate.y)}, z{' '}
                {signedCoordinate(coordinate.z)} mm
            </Typography>
            <Typography id={summaryId} variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Structural atlas overlap and functional decoder loadings are reported separately because their values
                have different meanings.
            </Typography>
            <Typography id={provenanceId} variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Pinned atlas versions and source links appear with each group.
            </Typography>

            {isUpdating || (isInitialLoading && !isError) ? (
                <Typography role="status" variant="body2" sx={{ color: DECODE_COLORS.navy, mt: 1.5 }}>
                    {isUpdating ? 'Updating atlas readout' : 'Loading atlas readout'}
                </Typography>
            ) : null}

            {isError ? (
                <Box
                    role="alert"
                    sx={{
                        backgroundColor: DECODE_COLORS.surface,
                        border: `1px solid ${DECODE_COLORS.navyBorder}`,
                        mt: 2,
                        p: 2,
                    }}
                >
                    <Typography component="h4" variant="subtitle2" sx={{ color: DECODE_COLORS.ink }}>
                        Atlas readout unavailable
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        The map and decoder results are unaffected. Retry this coordinate when the atlas service is
                        available.
                    </Typography>
                    <Button type="button" size="small" onClick={retry} sx={{ mt: 1 }}>
                        Retry atlas readout
                    </Button>
                </Box>
            ) : (
                <Stack spacing={2.5} sx={{ mt: 2 }}>
                    {ATLAS_SECTIONS.map((section) => {
                        const sectionHeadingId = `${id}-${section.id}-heading`;
                        return (
                            <Box component="section" aria-labelledby={sectionHeadingId} key={section.id}>
                                <Typography
                                    id={sectionHeadingId}
                                    component="h4"
                                    variant="subtitle2"
                                    sx={{ color: DECODE_COLORS.navy, fontWeight: 700 }}
                                >
                                    {section.heading}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    {section.explanation}
                                </Typography>
                                {isInitialLoading || !data ? (
                                    <Box aria-hidden="true" sx={{ minHeight: 32 }} />
                                ) : (
                                    <Stack spacing={2} sx={{ mt: 1.5 }}>
                                        {section.atlasIds.map((atlasId) => {
                                            const atlas = data.atlases.find(
                                                ({ id: candidateId }) => candidateId === atlasId
                                            );
                                            if (!atlas) return null;
                                            return (
                                                <AtlasGroup
                                                    key={atlas.id}
                                                    atlas={atlas}
                                                    expanded={Boolean(expandedByAtlas[atlas.id])}
                                                    headingId={`${id}-${atlas.id}-heading`}
                                                    onToggle={() =>
                                                        setExpandedByAtlas((current) => ({
                                                            ...current,
                                                            [atlas.id]: !current[atlas.id],
                                                        }))
                                                    }
                                                />
                                            );
                                        })}
                                    </Stack>
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Box>
    );
};

export default DecodeAtlasReadout;
