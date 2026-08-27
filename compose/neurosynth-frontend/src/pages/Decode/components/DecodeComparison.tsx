import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    Radio,
    RadioGroup,
    Slider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { MNI_LIMITS } from '../Decode.constants';
import type {
    DecodeComparisonMode,
    IDecodeComparableResult,
    IDecodeVisualization,
    IDecodeVolumeAsset,
    IViewerState,
} from '../Decode.types';
import { DECODE_COLORS } from '../Decode.styles';
import type { DecodeSliceType, IDecodeVolumeDisplay, IDecodeVolumeRange } from './DecodeNiiVueCanvas';

const DecodeNiiVueCanvas = lazy(() => import('./DecodeNiiVueCanvas'));
type CoordinateAxis = 'x' | 'y' | 'z';
type SignedPalette = 'warm-cool' | 'cool-warm';

const SIGNED_PALETTES: Array<{ value: SignedPalette; label: string; positive: string; negative: string }> = [
    { value: 'warm-cool', label: 'Warm positive · cool negative', positive: 'warm', negative: 'winter' },
    { value: 'cool-warm', label: 'Cool positive · warm negative', positive: 'winter', negative: 'warm' },
];

const signedValue = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));
const formattedRangeValue = (value: number) => value.toFixed(2).replace('-', '−');
const clampCoordinate = (axis: CoordinateAxis, value: number) =>
    Math.max(MNI_LIMITS[axis].min, Math.min(MNI_LIMITS[axis].max, value));

const displayForAsset = (asset: IDecodeVolumeAsset): IDecodeVolumeDisplay => {
    if (asset.kind === 'anatomical') {
        return {
            opacity: 1,
            colormap: 'gray',
            colormapNegative: '',
            calMin: 0,
            calMax: 1,
            calMinNegative: 0,
            calMaxNegative: 0,
        };
    }

    const isInput = asset.kind === 'input-statistic';
    return {
        opacity: isInput ? 0.8 : 0.65,
        colormap: isInput ? 'warm' : 'winter',
        colormapNegative: isInput ? 'winter' : 'warm',
        calMin: 0,
        calMax: 1,
        calMinNegative: 0,
        calMaxNegative: -1,
    };
};

const displaysForVisualization = (visualization?: IDecodeVisualization): Record<string, IDecodeVolumeDisplay> => {
    if (!visualization) return {};
    return [
        visualization.anatomical,
        ...(visualization.input ? [visualization.input] : []),
        ...Object.values(visualization.comparisonByResultId),
    ].reduce<Record<string, IDecodeVolumeDisplay>>((displays, asset) => {
        displays[asset.id] = displayForAsset(asset);
        return displays;
    }, {});
};

const paletteForDisplay = (display: IDecodeVolumeDisplay): SignedPalette =>
    display.colormap === 'winter' ? 'cool-warm' : 'warm-cool';

const ViewerStateLabel = ({ viewerState }: { viewerState: IViewerState }) => (
    <Typography
        variant="caption"
        sx={{
            color: DECODE_COLORS.ink,
            display: 'block',
            fontFamily: 'monospace',
            fontVariantNumeric: 'tabular-nums',
            mt: 1.5,
        }}
    >
        x {signedValue(viewerState.x)} · y {signedValue(viewerState.y)} · z {signedValue(viewerState.z)} · threshold{' '}
        {viewerState.threshold}%
    </Typography>
);

const MapPlaceholder = ({
    ariaLabel,
    label,
    viewerState,
}: {
    ariaLabel: string;
    label: string;
    viewerState: IViewerState;
}) => (
    <Box
        role="region"
        aria-label={ariaLabel}
        sx={{ border: `1px solid ${DECODE_COLORS.navyBorderStrong}`, minHeight: 240, p: 2, overflowWrap: 'anywhere' }}
    >
        <Typography variant="subtitle2" sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}>
            {label}
        </Typography>
        <Box
            aria-hidden="true"
            sx={{
                backgroundColor: DECODE_COLORS.surface,
                backgroundImage: `linear-gradient(${DECODE_COLORS.blueGrid} 1px, transparent 1px), linear-gradient(90deg, ${DECODE_COLORS.blueGrid} 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
                border: `1px solid ${DECODE_COLORS.navyBorder}`,
                minHeight: 150,
                mt: 1.25,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <Box sx={{ bgcolor: DECODE_COLORS.navy, height: 1, left: 0, position: 'absolute', right: 0, top: '50%' }} />
            <Box sx={{ bgcolor: DECODE_COLORS.cyan, bottom: 0, left: '50%', position: 'absolute', top: 0, width: 1 }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
            Map placeholder — no image loaded
        </Typography>
        <ViewerStateLabel viewerState={viewerState} />
    </Box>
);

const CanvasFallback = ({ label }: { label: string }) => (
    <Box
        role="status"
        aria-label={`${label} loading`}
        sx={{ aspectRatio: '1.35 / 1', bgcolor: DECODE_COLORS.surface, p: 2 }}
    >
        Loading {label}…
    </Box>
);

const UnavailableComparison = ({ selectedResult }: { selectedResult: IDecodeComparableResult }) => (
    <Box
        role="status"
        aria-label="Unavailable comparison map"
        sx={{ bgcolor: DECODE_COLORS.surface, borderLeft: `4px solid ${DECODE_COLORS.navy}`, p: 2 }}
    >
        <Typography sx={{ fontWeight: 700 }}>Comparison map not included in this walkthrough</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Selected result: {selectedResult.label}
        </Typography>
    </Box>
);

const DecodeComparison: React.FC<{
    sourceLabel: string;
    selectedResult?: IDecodeComparableResult;
    visualization?: IDecodeVisualization;
    viewerState: IViewerState;
    onChooseTerm: () => void;
    onViewerStateChange: (value: IViewerState) => void;
}> = ({ sourceLabel, selectedResult, visualization, viewerState, onChooseTerm, onViewerStateChange }) => {
    const [mode, setMode] = useState<DecodeComparisonMode>('side-by-side');
    const [illustrativeInputOpacity, setIllustrativeInputOpacity] = useState(100);
    const [illustrativeComparisonOpacity, setIllustrativeComparisonOpacity] = useState(65);
    const [illustrativeInputColor, setIllustrativeInputColor] = useState('deep-navy');
    const [illustrativeComparisonColor, setIllustrativeComparisonColor] = useState('slice-cyan');
    const [coordinateInputs, setCoordinateInputs] = useState<Record<CoordinateAxis, string>>({
        x: String(viewerState.x),
        y: String(viewerState.y),
        z: String(viewerState.z),
    });
    const [sliceType, setSliceType] = useState<DecodeSliceType>('multiplanar');
    const [crosshairs, setCrosshairs] = useState(true);
    const [rangesByAssetId, setRangesByAssetId] = useState<Record<string, IDecodeVolumeRange>>({});
    const [displayByAssetId, setDisplayByAssetId] = useState(() => displaysForVisualization(visualization));

    useEffect(() => {
        setCoordinateInputs({ x: String(viewerState.x), y: String(viewerState.y), z: String(viewerState.z) });
    }, [viewerState.x, viewerState.y, viewerState.z]);

    useEffect(() => {
        const defaults = displaysForVisualization(visualization);
        setDisplayByAssetId((current) => ({ ...defaults, ...current }));
    }, [visualization]);

    const comparisonAsset = selectedResult ? visualization?.comparisonByResultId[selectedResult.id] : undefined;
    const inputAsset = visualization?.input;
    const isRecordedComparison = Boolean(visualization);
    const canRenderSubmittedMap = Boolean(visualization && inputAsset);
    const coordinate = useMemo(
        () => ({ x: viewerState.x, y: viewerState.y, z: viewerState.z }),
        [viewerState.x, viewerState.y, viewerState.z]
    );

    if (!selectedResult) {
        return (
            <Box sx={{ borderLeft: `4px solid ${DECODE_COLORS.navy}`, bgcolor: DECODE_COLORS.surface, p: 2 }}>
                <Typography>
                    Select a mapped term or study to compare with the input. Return to Terms to choose one.
                </Typography>
                <Button onClick={onChooseTerm} sx={{ marginTop: 1 }}>
                    Choose a term
                </Button>
            </Box>
        );
    }

    const changeCoordinate = (axis: CoordinateAxis, inputValue: string) => {
        if (inputValue.trim() === '') {
            setCoordinateInputs((current) => ({ ...current, [axis]: inputValue }));
            return;
        }
        const nextCoordinate = Number(inputValue);
        if (!Number.isFinite(nextCoordinate)) {
            setCoordinateInputs((current) => ({ ...current, [axis]: inputValue }));
            return;
        }
        const clampedCoordinate = clampCoordinate(axis, nextCoordinate);
        setCoordinateInputs((current) => ({
            ...current,
            [axis]: clampedCoordinate === nextCoordinate ? inputValue : String(clampedCoordinate),
        }));
        onViewerStateChange({ ...viewerState, [axis]: clampedCoordinate });
    };
    const synchronizeCanvasCoordinate = (nextCoordinate: { x: number; y: number; z: number }) =>
        onViewerStateChange({
            ...viewerState,
            x: clampCoordinate('x', nextCoordinate.x),
            y: clampCoordinate('y', nextCoordinate.y),
            z: clampCoordinate('z', nextCoordinate.z),
        });
    const updateDisplay = (asset: IDecodeVolumeAsset | undefined, update: Partial<IDecodeVolumeDisplay>) => {
        if (!asset) return;
        setDisplayByAssetId((current) => ({
            ...current,
            [asset.id]: { ...(current[asset.id] ?? displayForAsset(asset)), ...update },
        }));
    };
    const recordRanges = (ranges: Record<string, IDecodeVolumeRange>) => {
        setRangesByAssetId((current) => ({ ...current, ...ranges }));
        setDisplayByAssetId((current) => {
            const next = { ...current };
            Object.entries(ranges).forEach(([assetId, range]) => {
                const display = next[assetId];
                if (!display) return;
                next[assetId] = {
                    ...display,
                    calMin: Math.min(Math.max(0, display.calMin), Math.max(0, range.globalMax)),
                    calMax: Math.max(0, range.globalMax),
                    calMinNegative: Math.max(Math.min(0, display.calMinNegative), Math.min(0, range.globalMin)),
                    calMaxNegative: Math.min(0, range.globalMin),
                };
            });
            return next;
        });
    };
    const renderCanvas = (ariaLabel: string, loadingLabel: string, volumes: IDecodeVolumeAsset[]) => (
        <Suspense fallback={<CanvasFallback label={loadingLabel} />}>
            <DecodeNiiVueCanvas
                ariaLabel={ariaLabel}
                volumes={volumes}
                coordinate={coordinate}
                sliceType={sliceType}
                crosshairs={crosshairs}
                displayByVolumeId={displayByAssetId}
                onCoordinateChange={synchronizeCanvasCoordinate}
                onValuesChange={() => undefined}
                onVolumeRangesChange={recordRanges}
            />
        </Suspense>
    );
    const renderDisplayControls = (asset: IDecodeVolumeAsset, role: 'input' | 'comparison') => {
        const display = displayByAssetId[asset.id] ?? displayForAsset(asset);
        const range = rangesByAssetId[asset.id];
        const capitalizedRole = role === 'input' ? 'Input' : 'Comparison';
        const palette = paletteForDisplay(display);
        return (
            <Stack spacing={1}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {capitalizedRole} map display
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {range
                        ? `${capitalizedRole} range: ${formattedRangeValue(range.globalMin)} to ${formattedRangeValue(range.globalMax)}`
                        : `Reading the ${role} map range…`}
                </Typography>
                <Typography component="label" htmlFor={`decode-comparison-${role}-opacity`} variant="body2">
                    {capitalizedRole} map opacity
                </Typography>
                <Slider
                    aria-label={`${capitalizedRole} map opacity`}
                    slotProps={{ input: { id: `decode-comparison-${role}-opacity` } }}
                    min={0}
                    max={1}
                    step={0.05}
                    value={display.opacity}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(opacity) => `${Math.round(opacity * 100)}%`}
                    onChange={(_event, opacity) =>
                        updateDisplay(asset, { opacity: Array.isArray(opacity) ? opacity[0] : opacity })
                    }
                    sx={{ color: role === 'input' ? '#d84315' : DECODE_COLORS.blue }}
                />
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label={`${capitalizedRole} signed colors`}
                    value={palette}
                    onChange={(event) => {
                        const nextPalette = SIGNED_PALETTES.find(({ value }) => value === event.target.value);
                        if (!nextPalette) return;
                        updateDisplay(asset, {
                            colormap: nextPalette.positive,
                            colormapNegative: nextPalette.negative,
                        });
                    }}
                >
                    {SIGNED_PALETTES.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </TextField>
                {range && range.globalMax > 0 ? (
                    <>
                        <Typography
                            component="label"
                            htmlFor={`decode-comparison-positive-${role}-threshold`}
                            variant="body2"
                        >
                            Positive {role} threshold
                        </Typography>
                        <Slider
                            aria-label={`Positive ${role} threshold`}
                            slotProps={{ input: { id: `decode-comparison-positive-${role}-threshold` } }}
                            min={0}
                            max={range.globalMax}
                            step={0.01}
                            value={display.calMin}
                            valueLabelDisplay="auto"
                            onChange={(_event, threshold) =>
                                updateDisplay(asset, {
                                    calMin: Array.isArray(threshold) ? threshold[0] : threshold,
                                })
                            }
                        />
                    </>
                ) : null}
                {range && range.globalMin < 0 ? (
                    <>
                        <Typography
                            component="label"
                            htmlFor={`decode-comparison-negative-${role}-threshold`}
                            variant="body2"
                        >
                            Negative {role} threshold
                        </Typography>
                        <Slider
                            aria-label={`Negative ${role} threshold`}
                            slotProps={{ input: { id: `decode-comparison-negative-${role}-threshold` } }}
                            min={range.globalMin}
                            max={0}
                            step={0.01}
                            value={display.calMinNegative}
                            valueLabelDisplay="auto"
                            onChange={(_event, threshold) =>
                                updateDisplay(asset, {
                                    calMinNegative: Array.isArray(threshold) ? threshold[0] : threshold,
                                })
                            }
                        />
                    </>
                ) : null}
            </Stack>
        );
    };

    return (
        <Stack spacing={2.5} aria-label="Map comparison">
            <Box>
                <Typography component="h2" variant="h6" sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}>
                    Compare maps
                </Typography>
                <RadioGroup
                    row
                    aria-label="Comparison layout"
                    value={mode}
                    onChange={(event) => setMode(event.target.value as DecodeComparisonMode)}
                    sx={{ mt: 0.5 }}
                >
                    <FormControlLabel value="side-by-side" control={<Radio />} label="Side by side" />
                    <FormControlLabel value="overlay" control={<Radio />} label="Overlay" />
                </RadioGroup>
            </Box>

            <Box sx={{ bgcolor: DECODE_COLORS.surface, borderLeft: `4px solid ${DECODE_COLORS.navy}`, p: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Synchronized display controls
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gap: 1.25,
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
                    }}
                >
                    {(['x', 'y', 'z'] as const).map((axis) => (
                        <TextField
                            key={axis}
                            label={`Comparison ${axis} coordinate`}
                            type="number"
                            size="small"
                            value={coordinateInputs[axis]}
                            onChange={(event) => changeCoordinate(axis, event.target.value)}
                            inputProps={{ min: MNI_LIMITS[axis].min, max: MNI_LIMITS[axis].max, step: 'any' }}
                        />
                    ))}
                </Box>
                {isRecordedComparison ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5 }}>
                        <TextField
                            select
                            SelectProps={{ native: true }}
                            size="small"
                            label="Comparison slice layout"
                            value={sliceType}
                            onChange={(event) => setSliceType(event.target.value as DecodeSliceType)}
                            sx={{ minWidth: 190 }}
                        >
                            <option value="multiplanar">Multiplanar</option>
                            <option value="axial">Axial</option>
                            <option value="coronal">Coronal</option>
                            <option value="sagittal">Sagittal</option>
                        </TextField>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={crosshairs}
                                    onChange={(event) => setCrosshairs(event.target.checked)}
                                />
                            }
                            label="Show comparison crosshairs"
                        />
                    </Box>
                ) : (
                    <>
                        <Typography
                            component="label"
                            htmlFor="decode-comparison-threshold"
                            variant="subtitle2"
                            sx={{ mt: 2 }}
                        >
                            Comparison display threshold
                        </Typography>
                        <Slider
                            id="decode-comparison-threshold"
                            aria-label="Comparison display threshold"
                            min={0}
                            max={100}
                            value={viewerState.threshold}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(threshold) => `${threshold}%`}
                            onChange={(_event, threshold) =>
                                onViewerStateChange({
                                    ...viewerState,
                                    threshold: Array.isArray(threshold) ? threshold[0] : threshold,
                                })
                            }
                            sx={{ color: DECODE_COLORS.blue }}
                        />
                    </>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Display only · coordinates are synchronized and presentation controls do not change recorded
                    results.
                </Typography>
            </Box>

            {canRenderSubmittedMap && visualization && inputAsset ? (
                <>
                    {mode === 'side-by-side' ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 2,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ color: DECODE_COLORS.ink, fontWeight: 700, mb: 1 }}
                                >
                                    Submitted map
                                </Typography>
                                {renderCanvas('Submitted map viewer', 'Submitted map', [
                                    visualization.anatomical,
                                    inputAsset,
                                ])}
                            </Box>
                            {comparisonAsset ? (
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{ color: DECODE_COLORS.ink, fontWeight: 700, mb: 1 }}
                                    >
                                        {selectedResult.label} association map
                                    </Typography>
                                    {renderCanvas(
                                        `${selectedResult.label} association map viewer`,
                                        `${selectedResult.label} association map`,
                                        [visualization.anatomical, comparisonAsset]
                                    )}
                                </Box>
                            ) : (
                                <UnavailableComparison selectedResult={selectedResult} />
                            )}
                        </Box>
                    ) : comparisonAsset ? (
                        <Box>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={{ xs: 0.5, sm: 2 }}
                                sx={{ mb: 1.5, overflowWrap: 'anywhere' }}
                            >
                                <Typography variant="body2">Input layer · {sourceLabel}</Typography>
                                <Typography variant="body2">
                                    Comparison layer · {selectedResult.label} association map
                                </Typography>
                            </Stack>
                            {renderCanvas(
                                `Submitted and ${selectedResult.label} map overlay viewer`,
                                `Submitted and ${selectedResult.label} map overlay`,
                                [visualization.anatomical, inputAsset, comparisonAsset]
                            )}
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 2,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle2"
                                    sx={{ color: DECODE_COLORS.ink, fontWeight: 700, mb: 1 }}
                                >
                                    Submitted map
                                </Typography>
                                {renderCanvas('Submitted map viewer', 'Submitted map', [
                                    visualization.anatomical,
                                    inputAsset,
                                ])}
                            </Box>
                            <UnavailableComparison selectedResult={selectedResult} />
                        </Box>
                    )}
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2,
                            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                        }}
                    >
                        {renderDisplayControls(inputAsset, 'input')}
                        {comparisonAsset ? renderDisplayControls(comparisonAsset, 'comparison') : null}
                    </Box>
                </>
            ) : isRecordedComparison ? (
                <UnavailableComparison selectedResult={selectedResult} />
            ) : mode === 'side-by-side' ? (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 2,
                    }}
                >
                    <MapPlaceholder ariaLabel="Input map pane" label={sourceLabel} viewerState={viewerState} />
                    <MapPlaceholder
                        ariaLabel="Comparison map pane"
                        label={selectedResult.mapLabel}
                        viewerState={viewerState}
                    />
                </Box>
            ) : (
                <Box>
                    <Box
                        role="region"
                        aria-label="Overlay map pane"
                        sx={{ border: `1px solid ${DECODE_COLORS.navyBorderStrong}`, p: 2 }}
                    >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ mb: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                {sourceLabel}
                            </Typography>
                            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                {selectedResult.mapLabel}
                            </Typography>
                        </Stack>
                        <Box sx={{ bgcolor: DECODE_COLORS.surface, minHeight: 230 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                            Map placeholder — no image loaded
                        </Typography>
                        <ViewerStateLabel viewerState={viewerState} />
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gap: 2,
                            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                            mt: 2,
                        }}
                    >
                        <Stack spacing={1}>
                            <Typography component="label" htmlFor="decode-comparison-input-opacity" variant="subtitle2">
                                Input map opacity
                            </Typography>
                            <Slider
                                aria-label="Input map opacity"
                                slotProps={{ input: { id: 'decode-comparison-input-opacity' } }}
                                min={0}
                                max={100}
                                value={illustrativeInputOpacity}
                                onChange={(_event, value) =>
                                    setIllustrativeInputOpacity(Array.isArray(value) ? value[0] : value)
                                }
                            />
                            <TextField
                                select
                                SelectProps={{ native: true }}
                                size="small"
                                label="Input map color"
                                value={illustrativeInputColor}
                                onChange={(event) => setIllustrativeInputColor(event.target.value)}
                            >
                                <option value="deep-navy">Deep coordinate navy</option>
                                <option value="atlas-blue">Atlas blue</option>
                                <option value="slice-cyan">Slice cyan</option>
                            </TextField>
                        </Stack>
                        <Stack spacing={1}>
                            <Typography
                                component="label"
                                htmlFor="decode-comparison-result-opacity"
                                variant="subtitle2"
                            >
                                Comparison map opacity
                            </Typography>
                            <Slider
                                aria-label="Comparison map opacity"
                                slotProps={{ input: { id: 'decode-comparison-result-opacity' } }}
                                min={0}
                                max={100}
                                value={illustrativeComparisonOpacity}
                                onChange={(_event, value) =>
                                    setIllustrativeComparisonOpacity(Array.isArray(value) ? value[0] : value)
                                }
                            />
                            <TextField
                                select
                                SelectProps={{ native: true }}
                                size="small"
                                label="Comparison map color"
                                value={illustrativeComparisonColor}
                                onChange={(event) => setIllustrativeComparisonColor(event.target.value)}
                            >
                                <option value="deep-navy">Deep coordinate navy</option>
                                <option value="atlas-blue">Atlas blue</option>
                                <option value="slice-cyan">Slice cyan</option>
                            </TextField>
                        </Stack>
                    </Box>
                </Box>
            )}
        </Stack>
    );
};

export default DecodeComparison;
