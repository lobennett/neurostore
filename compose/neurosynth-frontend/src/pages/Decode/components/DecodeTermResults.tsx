import {
    Box,
    Button,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { filterTerms, paginate, sortTerms } from '../Decode.helpers';
import type { DecodeSortDirection, DecodeTermSort } from '../Decode.helpers';
import type { DecodeMetric, IDecodeComparableResult, IDecodeTerm } from '../Decode.types';

const METRIC_LABELS: Record<DecodeMetric, string> = {
    similarity: 'Similarity',
    correlation: 'Correlation',
    probability: 'Probability',
    'bayes-factor': 'Bayes factor',
};

const PAGE_SIZES = [25, 50, 100];

const directionOptions = (sort: DecodeTermSort, metricLabel: string) => {
    if (sort === 'label') return { asc: 'A to Z', desc: 'Z to A' };
    if (sort === 'value') {
        return {
            asc: `Lowest ${metricLabel.toLocaleLowerCase()} first`,
            desc: `Highest ${metricLabel.toLocaleLowerCase()} first`,
        };
    }
    return { asc: 'Best rank first', desc: 'Lowest rank first' };
};

const DecodeTermResults: React.FC<{
    terms: IDecodeTerm[];
    metric: DecodeMetric;
    selectedResult?: IDecodeComparableResult;
    onSelectComparison: (result: IDecodeComparableResult) => void;
    onCompareSelected: () => void;
}> = ({ terms, metric, selectedResult, onSelectComparison, onCompareSelected }) => {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<DecodeTermSort>('rank');
    const [direction, setDirection] = useState<DecodeSortDirection>('asc');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const metricLabel = METRIC_LABELS[metric];
    const directions = directionOptions(sort, metricLabel);
    const signedMetric = metric === 'correlation';
    const scaleMaximum = metric === 'probability' ? 1 : Math.max(...terms.map(({ value }) => Math.abs(value)), 0.01);
    const navigated = useMemo(
        () => paginate(sortTerms(filterTerms(terms, query), sort, direction), page, pageSize),
        [direction, page, pageSize, query, sort, terms]
    );

    const resetPage = () => setPage(0);

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Ranked example concepts from this preview snapshot. Search labels or stable vocabulary identifiers, then
                select a mapped result for comparison.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                    type="search"
                    size="small"
                    label="Search term results"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        resetPage();
                    }}
                    sx={{ flex: '1 1 240px' }}
                />
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Sort term results"
                    value={sort}
                    onChange={(event) => {
                        setSort(event.target.value as DecodeTermSort);
                        resetPage();
                    }}
                    sx={{ minWidth: 155 }}
                >
                    <option value="rank">Rank</option>
                    <option value="label">Term label</option>
                    <option value="value">{metricLabel} value</option>
                </TextField>
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Sort direction"
                    value={direction}
                    onChange={(event) => {
                        setDirection(event.target.value as DecodeSortDirection);
                        resetPage();
                    }}
                    sx={{ minWidth: 170 }}
                >
                    <option value="asc">{directions.asc}</option>
                    <option value="desc">{directions.desc}</option>
                </TextField>
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Term results per page"
                    value={pageSize}
                    onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        resetPage();
                    }}
                    sx={{ minWidth: 175 }}
                >
                    {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </TextField>
            </Stack>

            <TableContainer sx={{ border: 1, borderColor: 'divider' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#f4f8fb' }}>
                        <TableRow>
                            <TableCell width="64px">Rank</TableCell>
                            <TableCell>Term</TableCell>
                            <TableCell>Vocabulary ID</TableCell>
                            <TableCell width="46%">{metricLabel}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {navigated.items.map((term) => {
                            const directionLabel =
                                term.value === 0 ? 'neutral' : term.value < 0 ? 'negative' : 'positive';
                            const selected = selectedResult?.id === term.id;

                            return (
                                <TableRow key={term.id} hover selected={selected}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                                        {term.rank}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="text"
                                            aria-pressed={selected}
                                            aria-label={`Select ${term.label} for comparison`}
                                            onClick={() =>
                                                onSelectComparison({
                                                    id: term.id,
                                                    kind: 'term',
                                                    label: term.label,
                                                    mapLabel: `${term.label} meta-analytic map`,
                                                    mapUrl: term.mapUrl,
                                                })
                                            }
                                            sx={{
                                                textTransform: 'none',
                                                overflowWrap: 'anywhere',
                                                minWidth: 0,
                                                p: 0.5,
                                            }}
                                        >
                                            {term.label}
                                        </Button>
                                    </TableCell>
                                    <TableCell
                                        sx={{ fontFamily: 'monospace', fontSize: '0.75rem', overflowWrap: 'anywhere' }}
                                    >
                                        {term.id}
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                aria-label={
                                                    signedMetric
                                                        ? `${term.label}: ${directionLabel} ${metricLabel.toLocaleLowerCase()} ${term.value.toFixed(3)}`
                                                        : `${term.label}: ${metricLabel.toLocaleLowerCase()} ${term.value.toFixed(3)}`
                                                }
                                                data-direction={signedMetric ? directionLabel : undefined}
                                                data-scale={
                                                    signedMetric
                                                        ? 'zero-centered'
                                                        : metric === 'probability'
                                                          ? 'zero-to-one'
                                                          : 'zero-to-maximum'
                                                }
                                                sx={{
                                                    display: signedMetric ? 'grid' : 'block',
                                                    gridTemplateColumns: signedMetric ? '1fr 1fr' : undefined,
                                                    position: 'relative',
                                                    flex: 1,
                                                    minWidth: 96,
                                                    bgcolor: '#f4f8fb',
                                                }}
                                            >
                                                {signedMetric ? (
                                                    <>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'flex-end',
                                                                minHeight: 8,
                                                            }}
                                                        >
                                                            {term.value < 0 ? (
                                                                <Box
                                                                    data-testid="decode-correlation-fill"
                                                                    sx={{
                                                                        width: `${(Math.abs(term.value) / scaleMaximum) * 100}%`,
                                                                        bgcolor: '#023e8a',
                                                                        height: 8,
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </Box>
                                                        <Box sx={{ minHeight: 8 }}>
                                                            {term.value > 0 ? (
                                                                <Box
                                                                    data-testid="decode-correlation-fill"
                                                                    sx={{
                                                                        width: `${(Math.abs(term.value) / scaleMaximum) * 100}%`,
                                                                        bgcolor: '#0096c7',
                                                                        height: 8,
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </Box>
                                                        <Box
                                                            data-testid="decode-zero-marker"
                                                            aria-hidden="true"
                                                            sx={{
                                                                position: 'absolute',
                                                                left: '50%',
                                                                top: -2,
                                                                bottom: -2,
                                                                borderLeft: '1px solid #263238',
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    <Box sx={{ minHeight: 8 }}>
                                                        <Box
                                                            data-testid="decode-measure-fill"
                                                            sx={{
                                                                width: `${Math.min(100, Math.max(0, term.value / scaleMaximum) * 100)}%`,
                                                                bgcolor: '#0096c7',
                                                                height: 8,
                                                            }}
                                                        />
                                                    </Box>
                                                )}
                                            </Box>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    minWidth: '5ch',
                                                    textAlign: 'right',
                                                    fontVariantNumeric: 'tabular-nums',
                                                }}
                                            >
                                                {term.value.toFixed(3)}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {navigated.total === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4}>No term results match this search.</TableCell>
                            </TableRow>
                        ) : null}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 2 }}
            >
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {navigated.start}–{navigated.end} of {navigated.total}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                        Previous page
                    </Button>
                    <Button
                        variant="outlined"
                        disabled={navigated.pageCount === 0 || page >= navigated.pageCount - 1}
                        onClick={() => setPage((value) => value + 1)}
                    >
                        Next page
                    </Button>
                    <Button variant="contained" disabled={!selectedResult?.mapUrl} onClick={onCompareSelected}>
                        Compare selected result
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
};

export default DecodeTermResults;
