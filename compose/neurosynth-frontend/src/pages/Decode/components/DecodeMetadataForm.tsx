import { Autocomplete, Stack, TextField } from '@mui/material';
import { COGNITIVE_TASK_OPTIONS } from '../Decode.fixtures';
import type { ICognitiveTaskOption, IDecodeMetadata, IDecodeValidationErrors } from '../Decode.types';

interface DecodeMetadataFormProps {
    metadata: IDecodeMetadata;
    errors: IDecodeValidationErrors;
    onChange: <K extends keyof IDecodeMetadata>(key: K, value: IDecodeMetadata[K]) => void;
}

const DecodeMetadataForm = ({ metadata, errors, onChange }: DecodeMetadataFormProps) => {
    return (
        <Stack spacing={2}>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Map type"
                value={metadata.mapType}
                onChange={(event) => onChange('mapType', event.target.value as IDecodeMetadata['mapType'])}
                error={Boolean(errors.mapType)}
                helperText={errors.mapType}
            >
                <option value="">Select map type</option>
                <option value="z">Z map</option>
                <option value="t">T map</option>
            </TextField>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Analysis level"
                value={metadata.analysisLevel}
                onChange={(event) => onChange('analysisLevel', event.target.value as IDecodeMetadata['analysisLevel'])}
                error={Boolean(errors.analysisLevel)}
                helperText={errors.analysisLevel}
            >
                <option value="">Select analysis level</option>
                <option value="group">Group</option>
                <option value="subject">Subject</option>
            </TextField>
            <TextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label="Modality"
                value={metadata.modality}
                onChange={(event) => onChange('modality', event.target.value as IDecodeMetadata['modality'])}
                error={Boolean(errors.modality)}
                helperText={errors.modality}
            >
                <option value="">Select modality</option>
                <option value="fmri-bold">fMRI BOLD</option>
                <option value="pet">PET</option>
                <option value="other">Other</option>
            </TextField>
            <TextField
                fullWidth
                type="number"
                label="Number of subjects"
                value={metadata.subjectCount}
                onChange={(event) => onChange('subjectCount', event.target.value)}
                error={Boolean(errors.subjectCount)}
                helperText={errors.subjectCount}
                inputProps={{ min: 1, step: 1 }}
            />
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
        </Stack>
    );
};

export default DecodeMetadataForm;
