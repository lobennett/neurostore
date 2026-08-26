import { Autocomplete, Stack, TextField, Typography } from '@mui/material';
import { COGNITIVE_ATLAS_CONCEPTS } from '../Decode.vocabulary';
import type { ICognitiveConcept } from '../Decode.types';

interface DecodeConceptSelectorProps {
    concepts: ICognitiveConcept[];
    onChange: (concepts: ICognitiveConcept[]) => void;
}

const DecodeConceptSelector = ({ concepts, onChange }: DecodeConceptSelectorProps) => (
    <Autocomplete<ICognitiveConcept, true, false, false>
        multiple
        filterSelectedOptions
        options={COGNITIVE_ATLAS_CONCEPTS}
        value={concepts}
        onChange={(_, nextConcepts) => onChange(nextConcepts)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        ListboxProps={{ sx: { maxHeight: 280 } }}
        renderOption={(props, option) => (
            <li {...props} key={option.id}>
                <Stack spacing={0}>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {option.id}
                    </Typography>
                </Stack>
            </li>
        )}
        renderInput={(params) => <TextField {...params} label="Cognitive Atlas concepts" placeholder="Search concepts" />}
    />
);

export default DecodeConceptSelector;
