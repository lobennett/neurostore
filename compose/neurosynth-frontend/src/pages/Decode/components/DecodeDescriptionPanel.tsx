import { Alert, Checkbox, FormControlLabel, FormHelperText, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { DECODE_MODELS } from '../Decode.fixtures';
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
    const [subjectAcknowledgementTouched, setSubjectAcknowledgementTouched] = useState(false);
    const updateMetadata = <K extends keyof IDecodeMetadata>(key: K, value: IDecodeMetadata[K]) => {
        if (key === 'analysisLevel') setSubjectAcknowledgementTouched(false);
        onChange({ ...draft, metadata: { ...draft.metadata, [key]: value } });
    };
    const isMapInput = draft.activeSource !== 'coordinates';
    const isSubjectMap = isMapInput && draft.metadata.analysisLevel === 'subject';
    const subjectAcknowledgementError = subjectAcknowledgementTouched ? errors.subjectWarningAcknowledged : undefined;
    const subjectAcknowledgementErrorId = 'decode-subject-acknowledgement-error';
    const selectedModel = DECODE_MODELS.find(({ id }) => id === draft.modelId);

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
                    Subject-level maps may contain identifiable patterns or sensitive information. Review them before
                    any future public deposit. {selectedModel?.subjectLevelSuitability}
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={draft.subjectWarningAcknowledged}
                                onChange={(event) => {
                                    setSubjectAcknowledgementTouched(true);
                                    onChange({ ...draft, subjectWarningAcknowledged: event.target.checked });
                                }}
                                inputProps={{
                                    'aria-describedby': subjectAcknowledgementError
                                        ? subjectAcknowledgementErrorId
                                        : undefined,
                                }}
                            />
                        }
                        label="Continue with a subject-level map"
                    />
                    {subjectAcknowledgementError ? (
                        <FormHelperText error id={subjectAcknowledgementErrorId} role="alert">
                            {subjectAcknowledgementError}
                        </FormHelperText>
                    ) : null}
                </Alert>
            )}
            <DecodeConceptSelector
                concepts={draft.concepts}
                onChange={(concepts) => onChange({ ...draft, concepts })}
            />
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
                        concepts: draft.concepts.some(({ id }) => id === suggestion.id)
                            ? draft.concepts
                            : [...draft.concepts, suggestion],
                    })
                }
            />
        </Stack>
    );
};

export default DecodeDescriptionPanel;
