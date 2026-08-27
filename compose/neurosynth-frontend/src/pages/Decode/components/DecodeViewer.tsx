import { Box, Checkbox, FormControlLabel, Slider, Stack, TextField, Typography } from '@mui/material';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { DecodeRunSource, IDecodeVisualization, IAtlasReadout, IViewerState } from '../Decode.types';
import { DECODE_COLORS } from '../Decode.styles';
import DecodeAtlasReadout from './DecodeAtlasReadout';
import type { DecodeSliceType, IDecodeVolumeDisplay, IDecodeVolumeRange } from './DecodeNiiVueCanvas';

const DecodeNiiVueCanvas = lazy(() => import('./DecodeNiiVueCanvas'));
type CoordinateAxis = 'x' | 'y' | 'z';

const AXIS_BOUNDS: Record<CoordinateAxis, { min: number; max: number }> = {
    x: { min: -90, max: 90 },
    y: { min: -126, max: 90 },
    z: { min: -72, max: 108 },
};

const coordinatePercent = (value: number, axis: CoordinateAxis) => {
    const { min, max } = AXIS_BOUNDS[axis];
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
};
const signedCoordinate = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));
const clampCoordinate = (axis: CoordinateAxis, value: number) =>
    Math.max(AXIS_BOUNDS[axis].min, Math.min(AXIS_BOUNDS[axis].max, value));

const PlanePlaceholder: React.FC<{
    label: string;
    horizontal: { axis: CoordinateAxis; value: number };
    vertical: { axis: CoordinateAxis; value: number };
}> = ({ label, horizontal, vertical }) => (
    <Box>
        <Typography variant="caption" sx={{ color: DECODE_COLORS.ink, fontWeight: 700, letterSpacing: '0.04em' }}>
            {label} plane
        </Typography>
        <Box
            role="img"
            aria-label={`Abstract example ${label.toLowerCase()} plane at ${horizontal.axis} ${signedCoordinate(horizontal.value)}, ${vertical.axis} ${signedCoordinate(vertical.value)}. No map image is loaded.`}
            sx={{
                aspectRatio: '1.16 / 1',
                backgroundColor: DECODE_COLORS.surface,
                backgroundImage: `linear-gradient(${DECODE_COLORS.blueGrid} 1px, transparent 1px), linear-gradient(90deg, ${DECODE_COLORS.blueGrid} 1px, transparent 1px)`,
                backgroundSize: '18px 18px',
                border: `1px solid ${DECODE_COLORS.navyBorderStrong}`,
                mt: 0.75,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <Box
                aria-hidden="true"
                sx={{
                    backgroundColor: DECODE_COLORS.navy,
                    height: '1px',
                    left: 0,
                    position: 'absolute',
                    right: 0,
                    top: `${100 - coordinatePercent(vertical.value, vertical.axis)}%`,
                }}
            />
            <Box
                aria-hidden="true"
                sx={{
                    backgroundColor: DECODE_COLORS.cyan,
                    bottom: 0,
                    left: `${coordinatePercent(horizontal.value, horizontal.axis)}%`,
                    position: 'absolute',
                    top: 0,
                    width: '1px',
                }}
            />
            <Box
                aria-hidden="true"
                sx={{
                    backgroundColor: '#ffffff',
                    border: `2px solid ${DECODE_COLORS.navy}`,
                    borderRadius: '50%',
                    height: 8,
                    left: `${coordinatePercent(horizontal.value, horizontal.axis)}%`,
                    position: 'absolute',
                    top: `${100 - coordinatePercent(vertical.value, vertical.axis)}%`,
                    transform: 'translate(-50%, -50%)',
                    width: 8,
                }}
            />
        </Box>
    </Box>
);

const displayForVisualization = (visualization?: IDecodeVisualization): Record<string, IDecodeVolumeDisplay> => {
    if (!visualization) return {};
    const display: Record<string, IDecodeVolumeDisplay> = {
        [visualization.anatomical.id]: {
            opacity: 1,
            colormap: 'gray',
            colormapNegative: '',
            calMin: 0,
            calMax: 1,
            calMinNegative: 0,
            calMaxNegative: 0,
        },
    };
    if (visualization.input) {
        display[visualization.input.id] = {
            opacity: 0.8,
            colormap: 'warm',
            colormapNegative: 'winter',
            calMin: 0,
            calMax: 1,
            calMinNegative: 0,
            calMaxNegative: -1,
        };
    }
    return display;
};

const DecodeViewer: React.FC<{
    source: DecodeRunSource;
    visualization?: IDecodeVisualization;
    atlasReadouts: IAtlasReadout[];
    value: IViewerState;
    onChange: (value: IViewerState) => void;
}> = ({ source, visualization, atlasReadouts, value, onChange }) => {
    const [coordinateInputs, setCoordinateInputs] = useState<Record<CoordinateAxis, string>>({
        x: String(value.x),
        y: String(value.y),
        z: String(value.z),
    });
    const [sliceType, setSliceType] = useState<DecodeSliceType>('multiplanar');
    const [crosshairs, setCrosshairs] = useState(true);
    const [inputRange, setInputRange] = useState<IDecodeVolumeRange>();
    const [displayByVolumeId, setDisplayByVolumeId] = useState(() => displayForVisualization(visualization));
    const selectedPointId =
        source.kind === 'coordinates'
            ? (source.points.find(({ x, y, z }) => x === value.x && y === value.y && z === value.z)?.id ?? '')
            : '';
    const inputDisplay = visualization?.input ? displayByVolumeId[visualization.input.id] : undefined;
    const volumes = useMemo(
        () => (visualization ? [visualization.anatomical, ...(visualization.input ? [visualization.input] : [])] : []),
        [visualization]
    );

    useEffect(() => {
        setCoordinateInputs({ x: String(value.x), y: String(value.y), z: String(value.z) });
    }, [value.x, value.y, value.z]);
    useEffect(() => {
        setInputRange(undefined);
        setDisplayByVolumeId(displayForVisualization(visualization));
    }, [visualization]);

    const changeCoordinate = (axis: CoordinateAxis, input: string) => {
        setCoordinateInputs((current) => ({ ...current, [axis]: input }));
        if (input.trim() === '') return;
        const coordinate = Number(input);
        if (Number.isFinite(coordinate)) onChange({ ...value, [axis]: clampCoordinate(axis, coordinate) });
    };
    const updateInputDisplay = (update: Partial<IDecodeVolumeDisplay>) => {
        if (!visualization?.input) return;
        setDisplayByVolumeId((current) => ({
            ...current,
            [visualization.input!.id]: { ...current[visualization.input!.id], ...update },
        }));
    };
    const selectPoint = (pointId: string) => {
        if (source.kind !== 'coordinates') return;
        const point = source.points.find(({ id }) => id === pointId);
        if (!point) return;
        setCoordinateInputs({ x: String(point.x), y: String(point.y), z: String(point.z) });
        onChange({ ...value, x: point.x, y: point.y, z: point.z });
    };
    const handleVolumeRangesChange = (ranges: Record<string, IDecodeVolumeRange>) => {
        if (!visualization?.input) return;
        const nextRange = ranges[visualization.input.id];
        if (!nextRange) return;
        setInputRange(nextRange);
        updateInputDisplay({
            calMin: Math.max(0, nextRange.globalMin),
            calMax: Math.max(0, nextRange.globalMax),
            calMinNegative: Math.min(0, nextRange.globalMax),
            calMaxNegative: Math.min(0, nextRange.globalMin),
        });
    };
    const hasRealVisualization = Boolean(visualization);

    return (
        <Box
            component="section"
            role="region"
            aria-label={hasRealVisualization ? 'Recorded map viewer' : 'Example map viewer'}
            sx={{
                backgroundColor: '#ffffff',
                border: `1px solid ${DECODE_COLORS.navyBorderMedium}`,
                borderTop: `3px solid ${DECODE_COLORS.navy}`,
                p: { xs: 2, md: 3 },
            }}
        >
            <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                <Typography component="h2" variant="h6" sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}>
                    Spatial workspace
                </Typography>
                <Typography variant="body2" sx={{ color: DECODE_COLORS.navy, fontWeight: 500 }}>
                    {hasRealVisualization
                        ? 'Recorded map viewer — loaded recorded anatomy and, when available, the recorded input statistic.'
                        : 'Example viewer — this prototype has not loaded or inspected your map'}
                </Typography>
            </Stack>
            <Box
                sx={{
                    display: 'grid',
                    gap: { xs: 2.5, md: 3 },
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(240px, 1.7fr) minmax(240px, 0.8fr)' },
                }}
            >
                <Box>
                    {hasRealVisualization ? (
                        <Suspense
                            fallback={
                                <Box
                                    role="status"
                                    sx={{ aspectRatio: '1.35 / 1', bgcolor: DECODE_COLORS.surface, p: 2 }}
                                >
                                    Loading recorded map viewer…
                                </Box>
                            }
                        >
                            <DecodeNiiVueCanvas
                                ariaLabel="Recorded decoder maps"
                                volumes={volumes}
                                coordinate={value}
                                sliceType={sliceType}
                                crosshairs={crosshairs}
                                displayByVolumeId={displayByVolumeId}
                                onCoordinateChange={(coordinate) =>
                                    onChange({
                                        ...value,
                                        x: clampCoordinate('x', coordinate.x),
                                        y: clampCoordinate('y', coordinate.y),
                                        z: clampCoordinate('z', coordinate.z),
                                    })
                                }
                                onValuesChange={() => undefined}
                                onVolumeRangesChange={handleVolumeRangesChange}
                            />
                        </Suspense>
                    ) : (
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 1.5,
                                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
                            }}
                        >
                            <PlanePlaceholder
                                label="Sagittal"
                                horizontal={{ axis: 'y', value: value.y }}
                                vertical={{ axis: 'z', value: value.z }}
                            />
                            <PlanePlaceholder
                                label="Coronal"
                                horizontal={{ axis: 'x', value: value.x }}
                                vertical={{ axis: 'z', value: value.z }}
                            />
                            <PlanePlaceholder
                                label="Axial"
                                horizontal={{ axis: 'x', value: value.x }}
                                vertical={{ axis: 'y', value: value.y }}
                            />
                        </Box>
                    )}
                    <Typography
                        sx={{
                            color: DECODE_COLORS.ink,
                            fontFamily: 'monospace',
                            fontVariantNumeric: 'tabular-nums',
                            mt: 2,
                        }}
                    >
                        Selected MNI coordinate: x {signedCoordinate(value.x)}, y {signedCoordinate(value.y)}, z{' '}
                        {signedCoordinate(value.z)}
                    </Typography>
                </Box>
                <Stack spacing={2.5}>
                    {source.kind === 'coordinates' ? (
                        <Box>
                            <Typography component="label" htmlFor="decode-viewer-points" variant="subtitle2">
                                Entered coordinates
                            </Typography>
                            <Box
                                component="select"
                                id="decode-viewer-points"
                                size={Math.max(2, Math.min(source.points.length, 4))}
                                value={selectedPointId}
                                onChange={(event) => selectPoint(event.target.value)}
                                sx={{
                                    backgroundColor: '#ffffff',
                                    border: `1px solid ${DECODE_COLORS.inkBorder}`,
                                    borderRadius: 1,
                                    color: DECODE_COLORS.ink,
                                    font: 'inherit',
                                    mt: 0.75,
                                    p: 0.75,
                                    width: '100%',
                                    '&:focus-visible': {
                                        outline: `3px solid ${DECODE_COLORS.cyanOutline}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                {source.points.map((point, index) => (
                                    <option key={point.id} value={point.id}>
                                        {point.label || `Point ${index + 1}`} · ({signedCoordinate(point.x)},{' '}
                                        {signedCoordinate(point.y)}, {signedCoordinate(point.z)})
                                    </option>
                                ))}
                            </Box>
                        </Box>
                    ) : null}
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Viewer coordinate
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 1,
                                gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
                            }}
                        >
                            {(['x', 'y', 'z'] as const).map((axis) => (
                                <TextField
                                    key={axis}
                                    label={`Viewer ${axis} coordinate`}
                                    type="number"
                                    size="small"
                                    value={coordinateInputs[axis]}
                                    onChange={(event) => changeCoordinate(axis, event.target.value)}
                                    inputProps={{ min: AXIS_BOUNDS[axis].min, max: AXIS_BOUNDS[axis].max, step: 'any' }}
                                />
                            ))}
                        </Box>
                    </Box>
                    {hasRealVisualization ? (
                        <>
                            <Box>
                                <Typography component="label" htmlFor="decode-slice-layout" variant="subtitle2">
                                    Slice layout
                                </Typography>
                                <Box
                                    component="select"
                                    id="decode-slice-layout"
                                    value={sliceType}
                                    onChange={(event) => setSliceType(event.target.value as DecodeSliceType)}
                                    sx={{
                                        backgroundColor: '#ffffff',
                                        border: `1px solid ${DECODE_COLORS.inkBorder}`,
                                        borderRadius: 1,
                                        color: DECODE_COLORS.ink,
                                        font: 'inherit',
                                        mt: 0.75,
                                        p: 0.75,
                                        width: '100%',
                                    }}
                                >
                                    <option value="multiplanar">Multiplanar</option>
                                    <option value="axial">Axial</option>
                                    <option value="coronal">Coronal</option>
                                    <option value="sagittal">Sagittal</option>
                                </Box>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={crosshairs}
                                            onChange={(event) => setCrosshairs(event.target.checked)}
                                        />
                                    }
                                    label="Show crosshairs"
                                    sx={{ mt: 0.5 }}
                                />
                            </Box>
                            {visualization?.input && inputDisplay ? (
                                <Box>
                                    <Typography variant="subtitle2">Recorded input display</Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        display="block"
                                        sx={{ mt: 0.25 }}
                                    >
                                        {inputRange
                                            ? `Input display range: ${inputRange.globalMin.toFixed(2).replace('-', '−')} to ${inputRange.globalMax.toFixed(2)}`
                                            : 'Reading the recorded input range…'}
                                    </Typography>
                                    <Typography
                                        component="label"
                                        htmlFor="decode-input-opacity"
                                        variant="body2"
                                        display="block"
                                        sx={{ mt: 1.5 }}
                                    >
                                        Input opacity
                                    </Typography>
                                    <Slider
                                        id="decode-input-opacity"
                                        aria-label="Input opacity"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={inputDisplay.opacity}
                                        valueLabelDisplay="auto"
                                        valueLabelFormat={(opacity) => `${Math.round(opacity * 100)}%`}
                                        onChange={(_event, opacity) =>
                                            updateInputDisplay({
                                                opacity: Array.isArray(opacity) ? opacity[0] : opacity,
                                            })
                                        }
                                        sx={{ color: DECODE_COLORS.blue, mt: 0.5 }}
                                    />
                                    {inputRange && inputRange.globalMax > 0 ? (
                                        <>
                                            <Typography
                                                component="label"
                                                htmlFor="decode-positive-input-threshold"
                                                variant="body2"
                                                display="block"
                                                sx={{ mt: 1.5 }}
                                            >
                                                Positive input threshold
                                            </Typography>
                                            <Slider
                                                id="decode-positive-input-threshold"
                                                aria-label="Positive input threshold"
                                                min={0}
                                                max={inputRange.globalMax}
                                                step={0.01}
                                                value={inputDisplay.calMin}
                                                valueLabelDisplay="auto"
                                                onChange={(_event, threshold) =>
                                                    updateInputDisplay({
                                                        calMin: Array.isArray(threshold) ? threshold[0] : threshold,
                                                    })
                                                }
                                                sx={{ color: DECODE_COLORS.blue, mt: 0.5 }}
                                            />
                                        </>
                                    ) : null}
                                    {inputRange && inputRange.globalMin < 0 ? (
                                        <>
                                            <Typography
                                                component="label"
                                                htmlFor="decode-negative-input-threshold"
                                                variant="body2"
                                                display="block"
                                                sx={{ mt: 1.5 }}
                                            >
                                                Negative input threshold
                                            </Typography>
                                            <Slider
                                                id="decode-negative-input-threshold"
                                                aria-label="Negative input threshold"
                                                min={inputRange.globalMin}
                                                max={0}
                                                step={0.01}
                                                value={inputDisplay.calMinNegative}
                                                valueLabelDisplay="auto"
                                                onChange={(_event, threshold) =>
                                                    updateInputDisplay({
                                                        calMinNegative: Array.isArray(threshold)
                                                            ? threshold[0]
                                                            : threshold,
                                                    })
                                                }
                                                sx={{ color: DECODE_COLORS.blue, mt: 0.5 }}
                                            />
                                        </>
                                    ) : null}
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                        Display only · does not change the preview request or recorded results.
                                    </Typography>
                                </Box>
                            ) : null}
                        </>
                    ) : (
                        <Box>
                            <Typography component="label" htmlFor="decode-display-threshold" variant="subtitle2">
                                Display threshold
                            </Typography>
                            <Slider
                                id="decode-display-threshold"
                                aria-label="Display threshold"
                                min={0}
                                max={100}
                                value={value.threshold}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(threshold) => `${threshold}%`}
                                onChange={(_event, threshold) =>
                                    onChange({
                                        ...value,
                                        threshold: Array.isArray(threshold) ? threshold[0] : threshold,
                                    })
                                }
                                sx={{ color: DECODE_COLORS.blue, mt: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                Display only · does not change decoder results
                            </Typography>
                        </Box>
                    )}
                    <DecodeAtlasReadout atlasReadouts={atlasReadouts} coordinate={value} />
                </Stack>
            </Box>
        </Box>
    );
};

export default DecodeViewer;
