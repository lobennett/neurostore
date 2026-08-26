import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Tab, Tabs, Typography } from '@mui/material';
import { validateDecodeSubmission } from '../Decode.helpers';
import type { DecodeSource, IDecodeMetadata, IDecodeSubmission } from '../Decode.types';
import DecodeFileInput from './DecodeFileInput';
import DecodeMetadataForm from './DecodeMetadataForm';
import DecodeNeurovaultInput from './DecodeNeurovaultInput';

interface DecodeInputPanelProps {
    value: IDecodeSubmission;
    onChange: (value: IDecodeSubmission) => void;
    onPreview: () => void;
    autoFocusSource?: boolean;
}

const sourceTabId = (source: DecodeSource) => `decode-source-tab-${source}`;
const sourcePanelId = (source: DecodeSource) => `decode-source-panel-${source}`;

const DecodeInputPanel = ({ value, onChange, onPreview, autoFocusSource = false }: DecodeInputPanelProps) => {
    const errors = validateDecodeSubmission(value);
    const isValid = Object.keys(errors).length === 0;
    const updateMetadata = <K extends keyof IDecodeMetadata>(key: K, nextValue: IDecodeMetadata[K]) => {
        onChange({ ...value, metadata: { ...value.metadata, [key]: nextValue } });
    };
    const changeSource = (source: DecodeSource) => onChange({ ...value, source });
    const handlePreview = () => {
        if (isValid) onPreview();
    };

    return (
        <Paper component="section" elevation={0} sx={{ p: 3 }}>
            <Tabs
                value={value.source}
                onChange={(_, source: DecodeSource) => changeSource(source)}
                aria-label="Map source"
            >
                <Tab
                    id={sourceTabId('upload')}
                    aria-controls={sourcePanelId('upload')}
                    value="upload"
                    label="Upload map"
                    autoFocus={autoFocusSource && value.source === 'upload'}
                />
                <Tab
                    id={sourceTabId('neurovault')}
                    aria-controls={sourcePanelId('neurovault')}
                    value="neurovault"
                    label="NeuroVault image"
                    autoFocus={autoFocusSource && value.source === 'neurovault'}
                />
            </Tabs>
            <Box
                id={sourcePanelId('upload')}
                role="tabpanel"
                aria-labelledby={sourceTabId('upload')}
                hidden={value.source !== 'upload'}
                sx={{ mt: 2 }}
            >
                <DecodeFileInput
                    file={value.file}
                    error={value.source === 'upload' ? errors.source : undefined}
                    onChange={(file) => onChange({ ...value, file })}
                />
            </Box>
            <Box
                id={sourcePanelId('neurovault')}
                role="tabpanel"
                aria-labelledby={sourceTabId('neurovault')}
                hidden={value.source !== 'neurovault'}
                sx={{ mt: 2 }}
            >
                <DecodeNeurovaultInput
                    value={value.neurovaultReference}
                    error={value.source === 'neurovault' ? errors.source : undefined}
                    onChange={(neurovaultReference) => onChange({ ...value, neurovaultReference })}
                />
            </Box>
            <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                <Typography>
                    The intended input is one unthresholded, group-level, 3D z- or t-statistic map in MNI152 space.
                </Typography>
            </Paper>
            <Box sx={{ mt: 3 }}>
                <Typography component="h2" variant="h6" gutterBottom>
                    Map metadata
                </Typography>
                <DecodeMetadataForm metadata={value.metadata} errors={errors} onChange={updateMetadata} />
            </Box>
            {value.metadata.analysisLevel === 'subject' && (
                <Alert severity="warning" role="alert" sx={{ mt: 2 }}>
                    NiCLIP was designed for group-level maps. Subject-level results may be unreliable.
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={value.subjectWarningAcknowledged}
                                onChange={(event) =>
                                    onChange({ ...value, subjectWarningAcknowledged: event.target.checked })
                                }
                            />
                        }
                        label="Continue with a subject-level map"
                    />
                </Alert>
            )}
            <Button variant="contained" disabled={!isValid} onClick={handlePreview} sx={{ mt: 3 }}>
                Preview results
            </Button>
        </Paper>
    );
};

export default DecodeInputPanel;
