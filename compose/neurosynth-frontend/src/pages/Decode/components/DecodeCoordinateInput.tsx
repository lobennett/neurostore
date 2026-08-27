import { Box, Button, FormHelperText, TextField, Typography } from '@mui/material';
import { MNI_LIMITS } from '../Decode.constants';
import type { IDecodeCoordinateErrors, IMniPoint } from '../Decode.types';
import { DECODE_COLORS } from '../Decode.styles';

interface DecodeCoordinateInputProps {
    points: IMniPoint[];
    errors?: IDecodeCoordinateErrors;
    groupError?: string;
    onChange: (points: IMniPoint[]) => void;
}

let fallbackPointCounter = 0;

const emptyPoint = (index: number): IMniPoint => ({
    id: `point-${globalThis.crypto?.randomUUID?.() ?? ++fallbackPointCounter}`,
    label: `Point ${index + 1}`,
    x: '',
    y: '',
    z: '',
});

const DecodeCoordinateInput = ({ points, errors, groupError, onChange }: DecodeCoordinateInputProps) => {
    const displayedPoints = points.length ? points : [emptyPoint(0)];
    const groupErrorId = 'decode-coordinate-group-error';

    const updatePoint = <K extends keyof Pick<IMniPoint, 'label' | 'x' | 'y' | 'z'>>(
        index: number,
        field: K,
        value: IMniPoint[K]
    ) => {
        const currentPoints = points.length ? points : displayedPoints;
        onChange(
            currentPoints.map((point, pointIndex) => (pointIndex === index ? { ...point, [field]: value } : point))
        );
    };

    const addPoint = () => onChange([...displayedPoints, emptyPoint(displayedPoints.length)]);
    const removePoint = (index: number) => onChange(displayedPoints.filter((_, pointIndex) => pointIndex !== index));

    return (
        <Box component="fieldset" sx={{ border: 0, m: 0, minWidth: 0, p: 0 }}>
            <Typography component="legend" variant="subtitle2" sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}>
                MNI coordinates
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>
                Enter MNI locations in millimetres. Coordinate entries remain in this frontend preview only.
            </Typography>
            {displayedPoints.map((point, index) => {
                const pointNumber = index + 1;
                return (
                    <Box
                        key={point.id}
                        sx={{ borderTop: index ? 1 : 0, borderColor: 'divider', pt: index ? 2 : 0, mt: index ? 2 : 0 }}
                    >
                        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, mb: 1 }}>
                            <Typography
                                component="h3"
                                variant="subtitle2"
                                sx={{ color: DECODE_COLORS.ink, fontWeight: 700 }}
                            >
                                {point.label || `Point ${pointNumber}`}
                            </Typography>
                            {index > 0 && (
                                <Button color="inherit" onClick={() => removePoint(index)} size="small">
                                    Remove point {pointNumber}
                                </Button>
                            )}
                        </Box>
                        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { sm: 'repeat(4, minmax(0, 1fr))' } }}>
                            <TextField
                                label={`Point ${pointNumber} name (optional)`}
                                value={point.label}
                                onChange={(event) => updatePoint(index, 'label', event.target.value)}
                            />
                            {(['x', 'y', 'z'] as const).map((axis) => {
                                const limits = MNI_LIMITS[axis];
                                const rangeId = `decode-coordinate-${point.id}-${axis}-range`;
                                const fieldError = errors?.[point.id]?.[axis];
                                const fieldErrorId = `decode-coordinate-${point.id}-${axis}-error`;
                                return (
                                    <TextField
                                        key={axis}
                                        label={`${axis} coordinate for point ${pointNumber}`}
                                        type="number"
                                        value={point[axis]}
                                        onChange={(event) => updatePoint(index, axis, event.target.value)}
                                        error={Boolean(fieldError)}
                                        helperText={
                                            <>
                                                <span id={rangeId}>
                                                    Allowed range: {limits.min} to {limits.max} mm.
                                                </span>
                                                {fieldError ? (
                                                    <span id={fieldErrorId} role="alert" style={{ display: 'block' }}>
                                                        {fieldError}
                                                    </span>
                                                ) : null}
                                            </>
                                        }
                                        inputProps={{
                                            min: limits.min,
                                            max: limits.max,
                                            step: 'any',
                                            'aria-describedby': [rangeId, fieldError ? fieldErrorId : undefined]
                                                .filter(Boolean)
                                                .join(' '),
                                        }}
                                    />
                                );
                            })}
                        </Box>
                    </Box>
                );
            })}
            {groupError ? (
                <FormHelperText error id={groupErrorId} role="alert" sx={{ mt: 1 }}>
                    {groupError}
                </FormHelperText>
            ) : null}
            <Button onClick={addPoint} sx={{ mt: 2 }} variant="outlined">
                Add another coordinate
            </Button>
        </Box>
    );
};

export default DecodeCoordinateInput;
