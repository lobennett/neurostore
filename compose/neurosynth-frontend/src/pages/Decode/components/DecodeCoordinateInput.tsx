import { Box, Button, FormHelperText, TextField, Typography } from '@mui/material';
import type { IMniPoint } from '../Decode.types';

interface DecodeCoordinateInputProps {
    points: IMniPoint[];
    errors?: string[];
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

const DecodeCoordinateInput = ({ points, errors, onChange }: DecodeCoordinateInputProps) => {
    const displayedPoints = points.length ? points : [emptyPoint(0)];
    const errorId = 'decode-coordinate-errors';
    const describedBy = errors?.length ? errorId : undefined;

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
            <Typography component="legend" variant="subtitle2" sx={{ color: '#263238', fontWeight: 700 }}>
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
                            <Typography component="h3" variant="subtitle2" sx={{ color: '#263238', fontWeight: 700 }}>
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
                                inputProps={{ 'aria-describedby': describedBy }}
                            />
                            {(['x', 'y', 'z'] as const).map((axis) => (
                                <TextField
                                    key={axis}
                                    label={`${axis} coordinate for point ${pointNumber}`}
                                    type="number"
                                    value={point[axis]}
                                    onChange={(event) => updatePoint(index, axis, event.target.value)}
                                    inputProps={{ 'aria-describedby': describedBy }}
                                />
                            ))}
                        </Box>
                    </Box>
                );
            })}
            {errors?.length ? (
                <FormHelperText error id={errorId} role="alert" sx={{ mt: 1 }}>
                    {errors.join('. ')}
                </FormHelperText>
            ) : null}
            <Button onClick={addPoint} sx={{ mt: 2 }} variant="outlined">
                Add another coordinate
            </Button>
        </Box>
    );
};

export default DecodeCoordinateInput;
