import { Box, Button, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { paginate } from '../Decode.helpers';
import type { IDecodeComparableResult, IDecodeStudy } from '../Decode.types';

type StudySort = 'year' | 'title' | 'authors';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [25, 50, 100];

const DecodeStudyResults: React.FC<{
    studies: IDecodeStudy[];
    selectedResult?: IDecodeComparableResult;
    onSelectComparison: (result: IDecodeComparableResult) => void;
    onCompareSelected: () => void;
}> = ({ studies, selectedResult, onSelectComparison, onCompareSelected }) => {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<StudySort>('year');
    const [direction, setDirection] = useState<SortDirection>('desc');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const navigated = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        const filtered = normalizedQuery
            ? studies.filter(({ id, title, authors, matchBasis, year }) =>
                  `${id} ${title} ${authors} ${year} ${matchBasis}`.toLocaleLowerCase().includes(normalizedQuery)
              )
            : studies;
        const factor = direction === 'asc' ? 1 : -1;
        const sorted = [...filtered].sort((left, right) => {
            const comparison =
                sort === 'year'
                    ? left.year - right.year
                    : sort === 'authors'
                      ? left.authors.localeCompare(right.authors)
                      : left.title.localeCompare(right.title);
            return comparison * factor || left.id.localeCompare(right.id);
        });
        return paginate(sorted, page, pageSize);
    }, [direction, page, pageSize, query, sort, studies]);

    const resetPage = () => setPage(0);

    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Example studies associated with the preview input, a selected concept, or both. These matches were not
                retrieved from a live literature service.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <TextField
                    type="search"
                    size="small"
                    label="Search associated studies"
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
                    label="Sort associated studies"
                    value={sort}
                    onChange={(event) => {
                        setSort(event.target.value as StudySort);
                        resetPage();
                    }}
                    sx={{ minWidth: 190 }}
                >
                    <option value="year">Publication year</option>
                    <option value="title">Study title</option>
                    <option value="authors">Citation</option>
                </TextField>
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Study sort direction"
                    value={direction}
                    onChange={(event) => {
                        setDirection(event.target.value as SortDirection);
                        resetPage();
                    }}
                    sx={{ minWidth: 165 }}
                >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                </TextField>
                <TextField
                    select
                    SelectProps={{ native: true }}
                    size="small"
                    label="Study results per page"
                    value={pageSize}
                    onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        resetPage();
                    }}
                    sx={{ minWidth: 180 }}
                >
                    {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </TextField>
            </Stack>

            <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {navigated.items.map((study) => {
                    const selected = selectedResult?.id === study.id;
                    return (
                        <Paper
                            component="li"
                            key={study.id}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderLeftWidth: selected ? 4 : 1,
                                borderLeftColor: selected ? '#023e8a' : 'divider',
                            }}
                        >
                            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {study.title}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                                {study.authors} ({study.year})
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {study.matchBasis}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                                {study.url ? (
                                    <Link
                                        href={study.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Open related map"
                                    >
                                        Open related map
                                    </Link>
                                ) : null}
                                {study.mapUrl ? (
                                    <Button
                                        size="small"
                                        variant="text"
                                        aria-pressed={selected}
                                        aria-label={`Select ${study.title} for comparison`}
                                        onClick={() =>
                                            onSelectComparison({
                                                id: study.id,
                                                label: study.title,
                                                mapUrl: study.mapUrl,
                                            })
                                        }
                                    >
                                        Select map for comparison
                                    </Button>
                                ) : null}
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>
            {navigated.total === 0 ? <Typography>No associated studies match this search.</Typography> : null}

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

export default DecodeStudyResults;
