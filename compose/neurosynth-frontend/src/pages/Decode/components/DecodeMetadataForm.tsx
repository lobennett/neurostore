import { Autocomplete, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { ANALYSIS_LEVEL_OPTIONS, MAP_TYPE_OPTIONS, NEUROVAULT_MODALITY_OPTIONS } from '../Decode.constants';
import { COGNITIVE_TASK_OPTIONS } from '../Decode.fixtures';
import type { ICognitiveTaskOption, IDecodeMetadata, IDecodeValidationErrors } from '../Decode.types';

interface DecodeMetadataFormProps {
    metadata: IDecodeMetadata;
    errors: IDecodeValidationErrors;
    onChange: <K extends keyof IDecodeMetadata>(key: K, value: IDecodeMetadata[K]) => void;
    includeLegacyCognitiveFields?: boolean;
}

type RequiredMetadataKey = 'mapType' | 'analysisLevel' | 'modality' | 'subjectCount';

const DecodeMetadataForm = ({ metadata, errors, onChange, includeLegacyCognitiveFields = true }: DecodeMetadataFormProps) => {
    const [touched, setTouched] = useState<Partial<Record<RequiredMetadataKey, boolean>>>({});
    const markTouched = (key: RequiredMetadataKey) => setTouched((current) => ({ ...current, [key]: true }));
    const visibleError = (key: RequiredMetadataKey) => (touched[key] ? errors[key] : undefined);

    return (
        <Stack spacing={2}>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Map type"
                value={metadata.mapType}
                onChange={(event) => onChange('mapType', event.target.value as IDecodeMetadata['mapType'])}
                onBlur={() => markTouched('mapType')}
                error={Boolean(visibleError('mapType'))}
                helperText={visibleError('mapType')}
                InputLabelProps={{ shrink: true }}
            >
                <option value="">Select map type</option>
                {MAP_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </TextField>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Analysis level"
                value={metadata.analysisLevel}
                onChange={(event) => onChange('analysisLevel', event.target.value as IDecodeMetadata['analysisLevel'])}
                onBlur={() => markTouched('analysisLevel')}
                error={Boolean(visibleError('analysisLevel'))}
                helperText={visibleError('analysisLevel')}
                InputLabelProps={{ shrink: true }}
            >
                <option value="">Select analysis level</option>
                {ANALYSIS_LEVEL_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </TextField>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Modality"
                value={metadata.modality}
                onChange={(event) => onChange('modality', event.target.value as IDecodeMetadata['modality'])}
                onBlur={() => markTouched('modality')}
                error={Boolean(visibleError('modality'))}
                helperText={visibleError('modality')}
                InputLabelProps={{ shrink: true }}
            >
                <option value="">Select modality</option>
                {NEUROVAULT_MODALITY_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                        {label}
                    </option>
                ))}
            </TextField>
            <TextField
                fullWidth
                type="number"
                label="Number of subjects"
                value={metadata.subjectCount}
                onChange={(event) => onChange('subjectCount', event.target.value)}
                onBlur={() => markTouched('subjectCount')}
                error={Boolean(visibleError('subjectCount'))}
                helperText={visibleError('subjectCount')}
                inputProps={{ min: 1, step: 1 }}
            />
            {includeLegacyCognitiveFields && (
                <>
                    <Autocomplete<ICognitiveTaskOption>
                        options={COGNITIVE_TASK_OPTIONS}
                        value={metadata.cognitiveTask}
                        onChange={(_, option) => onChange('cognitiveTask', option)}
                        getOptionLabel={(option) => option.label}
                        renderInput={(params) => <TextField {...params} label="Cognitive Atlas task (optional)" />}
                    />
                    <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="What do you think this map relates to? (optional)"
                        value={metadata.interpretation}
                        onChange={(event) => onChange('interpretation', event.target.value)}
                    />
                </>
            )}
        </Stack>
    );
};

export default DecodeMetadataForm;
