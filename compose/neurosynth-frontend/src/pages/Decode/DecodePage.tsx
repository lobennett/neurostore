import { Box, Button, Divider, Link, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { usePageMetadata, usePrerenderReady } from '../../../seo/hooks';
import DecodeTermResults from './components/DecodeTermResults';

// Wireframe only: no decoding service is wired up yet, so the results tabs render
// example output to make the layout reviewable. See #1270 for the service.
const EXAMPLE_TERMS = [
    { term: 'visual', correlation: 0.312 },
    { term: 'occipital', correlation: 0.268 },
    { term: 'v1', correlation: 0.213 },
    { term: 'fusiform', correlation: 0.207 },
    { term: 'objects', correlation: 0.207 },
    { term: 'precuneus', correlation: 0.179 },
];

const DecodePage: React.FC = () => {
    const [tab, setTab] = useState(0);
    const [neurovaultUrl, setNeurovaultUrl] = useState('');
    const [mapDescription, setMapDescription] = useState('');
    const [selectedTerm, setSelectedTerm] = useState<string>();

    usePageMetadata({
        title: 'Decode a brain map | Neurosynth Compose',
        description:
            'Upload an unthresholded statistical map and see which cognitive terms and tasks it is associated with across the literature.',
        canonicalPath: '/decode',
    });
    usePrerenderReady(true);

    return (
        <Box sx={{ padding: '1rem 0' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, marginBottom: 1 }}>
                Decode a brain map
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: '70ch', marginBottom: 3 }}>
                Give us an unthresholded group-level statistical map and we will show you the cognitive
                terms and tasks it resembles across the literature. No account needed.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '560px' }}>
                <Button variant="contained" disableElevation sx={{ alignSelf: 'flex-start' }}>
                    Upload a map
                </Button>
                <Typography variant="body2" color="text.secondary">
                    or give us a NeuroVault image
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        label="NeuroVault image URL or ID"
                        value={neurovaultUrl}
                        onChange={(event) => setNeurovaultUrl(event.target.value)}
                    />
                    <Button variant="contained" disableElevation sx={{ whiteSpace: 'nowrap' }}>
                        Decode
                    </Button>
                </Box>
                <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                    label="What do you think this map shows? (optional)"
                    helperText="We compare this against what the decoder finds, and it travels with the map if you deposit it."
                    value={mapDescription}
                    onChange={(event) => setMapDescription(event.target.value)}
                />
            </Box>

            <Divider sx={{ margin: '2rem 0' }} />

            <Tabs value={tab} onChange={(_event, newTab: number) => setTab(newTab)}>
                <Tab value={0} label="Terms" />
                <Tab value={1} label="Compare" />
                <Tab value={2} label="About" />
            </Tabs>

            <Box sx={{ marginTop: 2 }}>
                {tab === 0 && (
                    <DecodeTermResults
                        terms={EXAMPLE_TERMS}
                        selectedTerm={selectedTerm}
                        onSelectTerm={(term) => {
                            setSelectedTerm(term);
                            setTab(1);
                        }}
                    />
                )}
                {tab === 1 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
                            {selectedTerm
                                ? `Your map next to the meta-analytic map for "${selectedTerm}".`
                                : 'Pick a term in the Terms tab to compare it against your map.'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <Box sx={{ flex: '1 1 320px', minHeight: '260px', border: '1px dashed', borderColor: 'divider', borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                                your map
                            </Box>
                            <Box sx={{ flex: '1 1 320px', minHeight: '260px', border: '1px dashed', borderColor: 'divider', borderRadius: '8px', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
                                {selectedTerm ? `${selectedTerm} meta-analytic map` : 'no term selected'}
                            </Box>
                        </Box>
                    </Box>
                )}
                {tab === 2 && (
                    <Box sx={{ maxWidth: '70ch' }}>
                        <Typography variant="body1" sx={{ marginBottom: 2 }}>
                            Decoding compares your map against meta-analytic maps built from the literature.
                            The result tells you which terms have been reported in similar patterns of
                            activation, which is a starting point for interpretation rather than a label for
                            your data.
                        </Typography>
                        <Typography variant="body1" sx={{ marginBottom: 2 }}>
                            Your map needs to be unthresholded and in MNI152 space. Thresholded maps still
                            produce numbers, but the numbers mean less, so we check what we can and warn you.
                        </Typography>
                        <Typography variant="body1">
                            Results are associations, not evidence that your participants performed a task.
                            See the <Link href="https://neurostuff.github.io/compose-docs/">documentation</Link> for
                            the longer version.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default DecodePage;
