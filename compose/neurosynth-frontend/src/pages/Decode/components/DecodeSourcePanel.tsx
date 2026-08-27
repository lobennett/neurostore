import { Box, Tab, Tabs } from '@mui/material';
import type { DecodeSourceKind, IDecodeDraft, IDecodeValidationErrors } from '../Decode.types';
import DecodeCoordinateInput from './DecodeCoordinateInput';
import DecodeDepositDisclosure from './DecodeDepositDisclosure';
import DecodeFileInput from './DecodeFileInput';
import DecodeNeurovaultInput from './DecodeNeurovaultInput';

interface DecodeSourcePanelProps {
    draft: IDecodeDraft;
    errors: IDecodeValidationErrors;
    onChange: (draft: IDecodeDraft) => void;
    autoFocusSource?: boolean;
}

const tabId = (source: DecodeSourceKind) => `decode-draft-source-tab-${source}`;
const panelId = (source: DecodeSourceKind) => `decode-draft-source-panel-${source}`;

const DecodeSourcePanel = ({ draft, errors, onChange, autoFocusSource = false }: DecodeSourcePanelProps) => {
    const changeSource = (activeSource: DecodeSourceKind) => onChange({ ...draft, activeSource });

    return (
        <Box component="section" aria-label="Decoder map source">
            <Tabs
                aria-label="Decoder map source"
                onChange={(_event, activeSource: DecodeSourceKind) => changeSource(activeSource)}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
                value={draft.activeSource}
            >
                <Tab
                    aria-controls={panelId('neurovault')}
                    autoFocus={autoFocusSource && draft.activeSource === 'neurovault'}
                    id={tabId('neurovault')}
                    label="NeuroVault image"
                    value="neurovault"
                />
                <Tab
                    aria-controls={panelId('upload')}
                    autoFocus={autoFocusSource && draft.activeSource === 'upload'}
                    id={tabId('upload')}
                    label="Upload NIfTI"
                    value="upload"
                />
                <Tab
                    aria-controls={panelId('coordinates')}
                    autoFocus={autoFocusSource && draft.activeSource === 'coordinates'}
                    id={tabId('coordinates')}
                    label="MNI coordinates"
                    value="coordinates"
                />
            </Tabs>
            <Box
                aria-labelledby={tabId('neurovault')}
                hidden={draft.activeSource !== 'neurovault'}
                id={panelId('neurovault')}
                role="tabpanel"
                sx={{ pt: 2 }}
            >
                <DecodeNeurovaultInput
                    error={draft.activeSource === 'neurovault' ? errors.source : undefined}
                    onChange={(neurovaultReference) => onChange({ ...draft, neurovaultReference })}
                    value={draft.neurovaultReference}
                />
            </Box>
            <Box
                aria-labelledby={tabId('upload')}
                hidden={draft.activeSource !== 'upload'}
                id={panelId('upload')}
                role="tabpanel"
                sx={{ pt: 2 }}
            >
                <DecodeFileInput
                    error={draft.activeSource === 'upload' ? errors.source : undefined}
                    file={draft.file}
                    onChange={(file) =>
                        onChange({
                            ...draft,
                            file,
                            fileSelectionId: draft.fileSelectionId + 1,
                            depositConsent: false,
                        })
                    }
                />
                {draft.file ? (
                    <DecodeDepositDisclosure
                        consent={draft.depositConsent}
                        error={draft.activeSource === 'upload' ? errors.depositConsent : undefined}
                        file={draft.file}
                        metadata={draft.metadata}
                        onConsentChange={(depositConsent) => onChange({ ...draft, depositConsent })}
                    />
                ) : null}
            </Box>
            <Box
                aria-labelledby={tabId('coordinates')}
                hidden={draft.activeSource !== 'coordinates'}
                id={panelId('coordinates')}
                role="tabpanel"
                sx={{ pt: 2 }}
            >
                <DecodeCoordinateInput
                    errors={draft.activeSource === 'coordinates' ? errors.coordinates : undefined}
                    groupError={draft.activeSource === 'coordinates' ? errors.source : undefined}
                    onChange={(coordinates) => onChange({ ...draft, coordinates })}
                    points={draft.coordinates}
                />
            </Box>
        </Box>
    );
};

export default DecodeSourcePanel;
