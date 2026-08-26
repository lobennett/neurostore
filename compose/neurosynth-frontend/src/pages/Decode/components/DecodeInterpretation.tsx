import { Button, Stack, TextField, Typography } from '@mui/material';
import { COGNITIVE_TASK_OPTIONS } from '../Decode.fixtures';
import type { ICognitiveConcept } from '../Decode.types';

interface DecodeInterpretationProps {
    interpretation: string;
    confirmedSuggestions: ICognitiveConcept[];
    onInterpretationChange: (interpretation: string) => void;
    onConfirmSuggestion: (suggestion: ICognitiveConcept) => void;
}

const DecodeInterpretation = ({
    interpretation,
    confirmedSuggestions,
    onInterpretationChange,
    onConfirmSuggestion,
}: DecodeInterpretationProps) => {
    const suggestionLabel = interpretation.trim();
    const matchingTask = COGNITIVE_TASK_OPTIONS.find(({ label }) => label.toLocaleLowerCase() === suggestionLabel.toLocaleLowerCase());
    const suggestion = matchingTask
        ? { id: `fixture-${matchingTask.id}`, label: suggestionLabel, vocabulary: 'Cognitive Atlas' as const }
        : null;
    const isConfirmed = suggestion ? confirmedSuggestions.some(({ id }) => id === suggestion.id) : false;

    return (
        <Stack spacing={1}>
            <TextField
                fullWidth
                multiline
                minRows={3}
                label="What do you think this map relates to? (optional)"
                value={interpretation}
                onChange={(event) => onInterpretationChange(event.target.value)}
            />
            {suggestion && !isConfirmed && (
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">Example suggestion: {suggestion.label}</Typography>
                    <Button size="small" onClick={() => onConfirmSuggestion(suggestion)}>
                        Confirm {suggestion.label}
                    </Button>
                </Stack>
            )}
            {suggestion && isConfirmed && <Typography variant="body2">Confirmed concept: {suggestion.label}</Typography>}
        </Stack>
    );
};

export default DecodeInterpretation;
