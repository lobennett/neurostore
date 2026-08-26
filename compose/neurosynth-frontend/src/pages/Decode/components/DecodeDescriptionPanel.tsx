import { Alert, Checkbox, FormControlLabel, FormHelperText, Stack, Typography } from '@mui/material';
import type { IDecodeDraft, IDecodeMetadata, IDecodeValidationErrors } from '../Decode.types';
import DecodeConceptSelector from './DecodeConceptSelector';
import DecodeInterpretation from './DecodeInterpretation';
import DecodeMetadataForm from './DecodeMetadataForm';

interface DecodeDescriptionPanelProps {
    draft: IDecodeDraft;
    errors: IDecodeValidationErrors;
    onChange: (draft: IDecodeDraft) => void;
}

const DecodeDescriptionPanel = ({ draft, errors, onChange }: DecodeDescriptionPanelProps) => {
    const updateMetadata = <K extends keyof IDecodeMetadata>(key: K, value: IDecodeMetadata[K]) =>
        onChange({ ...draft, metadata: { ...draft.metadata, [key]: value } });
    const isMapInput = draft.activeSource !== 'coordinates';
    const isSubjectMap = isMapInput && draft.metadata.analysisLevel === 'subject';

    return (
        <Stack component="section" spacing={2} aria-label="Map description">
            <Typography component="h2" variant="h6">
                Map description
            </Typography>
            {isMapInput && (
                <DecodeMetadataForm
                    metadata={draft.metadata}
                    errors={errors}
                    onChange={updateMetadata}
                    includeLegacyCognitiveFields={false}
                />
            )}
            {isSubjectMap && (
                <Alert severity="warning" role="alert">
                    NiCLIP was designed for group-level maps. Subject-level results may be unreliable.
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={draft.subjectWarningAcknowledged}
                                onChange={(event) => onChange({ ...draft, subjectWarningAcknowledged: event.target.checked })}
                            />
                        }
                        label="Continue with a subject-level map"
                    />
                    {errors.subjectWarningAcknowledged && <FormHelperText error>{errors.subjectWarningAcknowledged}</FormHelperText>}
                </Alert>
            )}
            <DecodeConceptSelector concepts={draft.concepts} onChange={(concepts) => onChange({ ...draft, concepts })} />
            <DecodeInterpretation
                interpretation={draft.interpretation}
                confirmedSuggestions={draft.confirmedSuggestions}
                onInterpretationChange={(interpretation) => onChange({ ...draft, interpretation })}
                onConfirmSuggestion={(suggestion) =>
                    onChange({
                        ...draft,
                        confirmedSuggestions: draft.confirmedSuggestions.some(({ id }) => id === suggestion.id)
                            ? draft.confirmedSuggestions
                            : [...draft.confirmedSuggestions, suggestion],
                    })
                }
            />
        </Stack>
    );
};

export default DecodeDescriptionPanel;
