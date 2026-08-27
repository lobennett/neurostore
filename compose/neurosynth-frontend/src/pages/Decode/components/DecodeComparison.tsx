import { Box, Button, FormControlLabel, Radio, RadioGroup, Slider, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { IDecodeComparableResult, IViewerState } from '../Decode.types';
import { DECODE_COLORS } from '../Decode.styles';

type ComparisonMode = 'side-by-side' | 'overlay';
type ColorPreset = 'deep-navy' | 'atlas-blue' | 'slice-cyan';
type CoordinateAxis = 'x' | 'y' | 'z';

const COLOR_PRESETS: Array<{ value: ColorPreset; label: string; color: string }> = [
    { value: 'deep-navy', label: 'Deep coordinate navy', color: DECODE_COLORS.navy },
    { value: 'atlas-blue', label: 'Atlas blue', color: DECODE_COLORS.blue },
    { value: 'slice-cyan', label: 'Slice cyan', color: DECODE_COLORS.cyan },
];

const colorForPreset = (preset: ColorPreset) =>
    COLOR_PRESETS.find(({ value }) => value === preset)?.color ?? DECODE_COLORS.navy;

const signedValue = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));

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

const MapPlaceholder: React.FC<{
    ariaLabel: string;
    label: string;
    viewerState: IViewerState;
}> = ({ ariaLabel, label, viewerState }) => (
    <Box
        role="region"
        aria-label={ariaLabel}
        sx={{ border: '1px solid rgba(2, 62, 138, 0.28)', minHeight: 240, p: 2, overflowWrap: 'anywhere' }}
    >
        <Typography variant="subtitle2" sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}>
            {label}
        </Typography>
        <Box
            aria-hidden="true"
            sx={{
                backgroundColor: DECODE_COLORS.surface,
                backgroundImage:
                    'linear-gradient(rgba(0, 119, 182, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 119, 182, 0.08) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                border: '1px solid rgba(2, 62, 138, 0.16)',
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

const DecodeComparison: React.FC<{
    sourceLabel: string;
    selectedResult?: IDecodeComparableResult;
    viewerState: IViewerState;
    onChooseTerm: () => void;
    onViewerStateChange: (value: IViewerState) => void;
}> = ({ sourceLabel, selectedResult, viewerState, onChooseTerm, onViewerStateChange }) => {
    const [mode, setMode] = useState<ComparisonMode>('side-by-side');
    const [inputOpacity, setInputOpacity] = useState(100);
    const [comparisonOpacity, setComparisonOpacity] = useState(65);
    const [inputColor, setInputColor] = useState<ColorPreset>('deep-navy');
    const [comparisonColor, setComparisonColor] = useState<ColorPreset>('slice-cyan');
    const [coordinateInputs, setCoordinateInputs] = useState<Record<CoordinateAxis, string>>({
        x: String(viewerState.x),
        y: String(viewerState.y),
        z: String(viewerState.z),
    });

    useEffect(() => {
        setCoordinateInputs({ x: String(viewerState.x), y: String(viewerState.y), z: String(viewerState.z) });
    }, [viewerState.x, viewerState.y, viewerState.z]);

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

    const changeCoordinate = (axis: CoordinateAxis, input: string) => {
        setCoordinateInputs((current) => ({ ...current, [axis]: input }));
        if (input.trim() === '') return;
        const coordinate = Number(input);
        if (!Number.isFinite(coordinate)) return;
        onViewerStateChange({ ...viewerState, [axis]: coordinate });
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
                    onChange={(event) => setMode(event.target.value as ComparisonMode)}
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
                        />
                    ))}
                </Box>
                <Typography component="label" htmlFor="decode-comparison-threshold" variant="subtitle2" sx={{ mt: 2 }}>
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
                <Typography variant="caption" color="text.secondary">
                    Display only · the same coordinate and threshold apply to both placeholders
                </Typography>
            </Box>

            {mode === 'side-by-side' ? (
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
                        sx={{ border: '1px solid rgba(2, 62, 138, 0.28)', p: 2 }}
                    >
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={{ xs: 0.5, sm: 2 }}
                            sx={{ mb: 1.5, overflowWrap: 'anywhere' }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Input layer
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                    {sourceLabel}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Comparison layer
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                    {selectedResult.mapLabel}
                                </Typography>
                            </Box>
                        </Stack>
                        <Box
                            sx={{
                                bgcolor: DECODE_COLORS.surface,
                                border: '1px solid rgba(2, 62, 138, 0.16)',
                                minHeight: 230,
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <Box
                                aria-hidden="true"
                                sx={{
                                    backgroundImage: `repeating-linear-gradient(0deg, transparent 0 18px, ${colorForPreset(inputColor)} 19px 20px)`,
                                    inset: 0,
                                    opacity: inputOpacity / 100,
                                    position: 'absolute',
                                }}
                            />
                            <Box
                                aria-hidden="true"
                                sx={{
                                    backgroundImage: `repeating-linear-gradient(90deg, transparent 0 18px, ${colorForPreset(comparisonColor)} 19px 20px)`,
                                    inset: 0,
                                    opacity: comparisonOpacity / 100,
                                    position: 'absolute',
                                }}
                            />
                        </Box>
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
                            <Typography component="label" htmlFor="decode-input-opacity" variant="subtitle2">
                                Input map opacity
                            </Typography>
                            <Slider
                                id="decode-input-opacity"
                                aria-label="Input map opacity"
                                min={0}
                                max={100}
                                value={inputOpacity}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(opacity) => `${opacity}%`}
                                onChange={(_event, opacity) =>
                                    setInputOpacity(Array.isArray(opacity) ? opacity[0] : opacity)
                                }
                                sx={{ color: colorForPreset(inputColor) }}
                            />
                            <TextField
                                select
                                SelectProps={{ native: true }}
                                size="small"
                                label="Input map color"
                                value={inputColor}
                                onChange={(event) => setInputColor(event.target.value as ColorPreset)}
                            >
                                {COLOR_PRESETS.map(({ value, label }) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </TextField>
                        </Stack>
                        <Stack spacing={1}>
                            <Typography component="label" htmlFor="decode-comparison-opacity" variant="subtitle2">
                                Comparison map opacity
                            </Typography>
                            <Slider
                                id="decode-comparison-opacity"
                                aria-label="Comparison map opacity"
                                min={0}
                                max={100}
                                value={comparisonOpacity}
                                valueLabelDisplay="auto"
                                valueLabelFormat={(opacity) => `${opacity}%`}
                                onChange={(_event, opacity) =>
                                    setComparisonOpacity(Array.isArray(opacity) ? opacity[0] : opacity)
                                }
                                sx={{ color: colorForPreset(comparisonColor) }}
                            />
                            <TextField
                                select
                                SelectProps={{ native: true }}
                                size="small"
                                label="Comparison map color"
                                value={comparisonColor}
                                onChange={(event) => setComparisonColor(event.target.value as ColorPreset)}
                            >
                                {COLOR_PRESETS.map(({ value, label }) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </TextField>
                        </Stack>
                    </Box>
                </Box>
            )}
        </Stack>
    );
};

export default DecodeComparison;
