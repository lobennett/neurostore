import {
    Alert,
    Box,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormLabel,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useState } from 'react';
import { DECODE_MODELS } from '../Decode.fixtures';
import type {
    DecodeModelId,
    DecodeSourceKind,
    IDecodeModelDefinition,
    IDecodeParameterErrors,
    IDecodeParameterDefinition,
} from '../Decode.types';

interface DecodeModelPanelProps {
    modelId: DecodeModelId;
    parameters: Record<string, string | number | boolean>;
    parameterErrors?: IDecodeParameterErrors;
    sourceKind: DecodeSourceKind;
    onChange: (modelId: DecodeModelId, parameters: Record<string, string | number | boolean>) => void;
}

const SOURCE_LABELS: Record<DecodeSourceKind, string> = {
    neurovault: 'NeuroVault images',
    upload: 'uploaded NIfTI files',
    coordinates: 'MNI coordinates',
};

const defaultParameters = (model: IDecodeModelDefinition) =>
    Object.fromEntries(model.parameters.map(({ key, defaultValue }) => [key, defaultValue]));

const DecodeParameterControl = ({
    definition,
    value,
    error,
    onChange,
    onBlur,
}: {
    definition: IDecodeParameterDefinition;
    value: string | number | boolean;
    error?: string;
    onChange: (value: string | number | boolean) => void;
    onBlur: () => void;
}) => {
    const errorId = `decode-model-parameter-${definition.key}-error`;
    switch (definition.kind) {
        case 'integer':
        case 'number':
            return (
                <TextField
                    fullWidth
                    label={definition.label}
                    type="number"
                    value={value}
                    error={Boolean(error)}
                    onChange={(event) => {
                        const nextValue = event.target.value;
                        onChange(nextValue === '' ? '' : Number(nextValue));
                    }}
                    onBlur={onBlur}
                    helperText={error ?? definition.description}
                    inputProps={{
                        step: definition.kind === 'integer' ? 1 : 'any',
                        min: definition.min,
                        max: definition.max,
                    }}
                />
            );
        case 'boolean':
            return (
                <Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={Boolean(value)}
                                onBlur={onBlur}
                                onChange={(event) => onChange(event.target.checked)}
                                inputProps={{ 'aria-describedby': error ? errorId : undefined }}
                            />
                        }
                        label={definition.label}
                    />
                    {error ? (
                        <Typography id={errorId} color="error" variant="caption" role="alert">
                            {error}
                        </Typography>
                    ) : null}
                </Box>
            );
        case 'select':
            return (
                <TextField
                    select
                    SelectProps={{ native: true }}
                    fullWidth
                    label={definition.label}
                    value={String(value)}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={onBlur}
                    error={Boolean(error)}
                    helperText={error ?? definition.description}
                    InputLabelProps={{ shrink: true }}
                >
                    {definition.options?.map(({ value: optionValue, label }) => (
                        <option key={optionValue} value={optionValue}>
                            {label}
                        </option>
                    ))}
                </TextField>
            );
        default: {
            const exhaustiveKind: never = definition.kind;
            return exhaustiveKind;
        }
    }
};

const DecodeModelPanel = ({ modelId, parameters, parameterErrors, sourceKind, onChange }: DecodeModelPanelProps) => {
    const [touchedParameters, setTouchedParameters] = useState<Partial<Record<string, boolean>>>({});
    const model = DECODE_MODELS.find(({ id }) => id === modelId) ?? DECODE_MODELS[0];
    const compatible = model.supportedSources.includes(sourceKind);
    const neuroVlm = DECODE_MODELS.find(({ id }) => id === 'neurovlm');

    const selectModel = (nextModelId: string) => {
        const nextModel = DECODE_MODELS.find(({ id }) => id === nextModelId);
        if (nextModel) {
            setTouchedParameters({});
            onChange(nextModel.id, defaultParameters(nextModel));
        }
    };

    return (
        <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend" sx={{ color: 'text.primary', fontWeight: 700, typography: 'h6' }}>
                Decoder model
            </FormLabel>
            <RadioGroup
                value={modelId}
                onChange={(event) => selectModel(event.target.value)}
                sx={{ gap: 1.25, mt: 1.5 }}
            >
                {DECODE_MODELS.map((candidate) => {
                    const selected = candidate.id === modelId;
                    return (
                        <Paper
                            key={candidate.id}
                            variant="outlined"
                            sx={{
                                borderColor: selected ? '#023e8a' : 'divider',
                                borderLeftWidth: selected ? 3 : 1,
                                bgcolor: selected ? '#f4f8fb' : 'background.paper',
                                px: 1.5,
                                py: 1.25,
                            }}
                        >
                            <FormControlLabel
                                value={candidate.id}
                                control={<Radio />}
                                sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                                label={
                                    <Box sx={{ pt: 0.75 }}>
                                        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                                            <Typography component="span" sx={{ fontWeight: 700 }}>
                                                {candidate.name}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ fontFamily: 'monospace' }}
                                            >
                                                {candidate.version}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            {candidate.purpose}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                            sx={{ mt: 0.75 }}
                                        >
                                            Supports{' '}
                                            {candidate.supportedSources
                                                .map((source) => SOURCE_LABELS[source])
                                                .join(', ')}
                                            .
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            {candidate.inputRequirements}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            display="block"
                                            sx={{ mt: 0.75 }}
                                        >
                                            {candidate.interpretationNote}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </Paper>
                    );
                })}
            </RadioGroup>

            {!compatible ? (
                <Alert
                    severity="error"
                    sx={{ mt: 1.5 }}
                    action={
                        neuroVlm ? (
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => selectModel(neuroVlm.id)}
                            >
                                Use NeuroVLM instead
                            </Button>
                        ) : undefined
                    }
                >
                    {model.name} does not support {SOURCE_LABELS[sourceKind]}.
                </Alert>
            ) : null}

            <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle2">{model.name} parameters</Typography>
                    <Button
                        size="small"
                        onClick={() => {
                            setTouchedParameters({});
                            onChange(model.id, defaultParameters(model));
                        }}
                    >
                        Reset parameters
                    </Button>
                </Stack>
                {model.parameters.map((parameter) => (
                    <DecodeParameterControl
                        key={parameter.key}
                        definition={parameter}
                        value={parameters[parameter.key] ?? parameter.defaultValue}
                        error={touchedParameters[parameter.key] ? parameterErrors?.[parameter.key] : undefined}
                        onChange={(value) => onChange(model.id, { ...parameters, [parameter.key]: value })}
                        onBlur={() =>
                            setTouchedParameters((current) => ({ ...current, [parameter.key]: true }))
                        }
                    />
                ))}
            </Stack>
        </FormControl>
    );
};

export default DecodeModelPanel;
