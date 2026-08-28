import { useQuery } from '@tanstack/react-query';
import API from 'api/api.config';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AtlasCoordinate } from './Decode.atlas.types';

const coordinatesMatch = (first: AtlasCoordinate, second: AtlasCoordinate) =>
    first.x === second.x && first.y === second.y && first.z === second.z;

const useDecodeAtlasReadout = (coordinate: AtlasCoordinate) => {
    const currentCoordinate = useMemo(
        () => ({ x: coordinate.x, y: coordinate.y, z: coordinate.z }),
        [coordinate.x, coordinate.y, coordinate.z]
    );
    const [debouncedCoordinate, setDebouncedCoordinate] = useState<AtlasCoordinate>();

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedCoordinate(currentCoordinate), 200);
        return () => window.clearTimeout(timeout);
    }, [currentCoordinate]);

    const queryCoordinate = debouncedCoordinate ?? currentCoordinate;
    const query = useQuery({
        queryKey: ['atlas-readout', queryCoordinate.x, queryCoordinate.y, queryCoordinate.z],
        queryFn: ({ signal }) => API.NeurosynthServices.AtlasReadoutService.fetchAtlasReadout(queryCoordinate, signal),
        enabled: debouncedCoordinate !== undefined,
        retry: false,
        placeholderData: (previous) => previous,
    });
    const isWaitingForDebounce =
        debouncedCoordinate === undefined || !coordinatesMatch(currentCoordinate, debouncedCoordinate);

    const retry = useCallback(() => {
        if (debouncedCoordinate === undefined || !coordinatesMatch(currentCoordinate, debouncedCoordinate)) {
            setDebouncedCoordinate(currentCoordinate);
            return;
        }
        void query.refetch();
    }, [currentCoordinate, debouncedCoordinate, query]);

    const isError = query.isError && !isWaitingForDebounce;
    const isInitialLoading = query.data === undefined && !isError;
    const isUpdating = query.data !== undefined && (isWaitingForDebounce || query.isFetching);

    return {
        data: query.data,
        isInitialLoading,
        isUpdating,
        isError,
        retry,
    };
};

export default useDecodeAtlasReadout;
