import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { AxiosError, type AxiosAdapter } from 'axios';
import type { ReactNode } from 'react';
import API from 'api/api.config';
import 'api/axios.config';
import {
    _getAccessTokenSilentlyFunc,
    _setAccessTokenSilentlyFunc,
    axiosInstance,
    neurosynthConfig,
} from 'api/api.state';
import { fetchAtlasReadout } from './Decode.atlas.api';
import { parseAtlasReadoutResponse } from './Decode.atlas.types';
import useDecodeAtlasReadout from './useDecodeAtlasReadout';

type Coordinate = { x: number; y: number; z: number };

const responseFor = (coordinate: Coordinate, value = 54) => ({
    coordinate: { x: coordinate.x, y: coordinate.y, z: coordinate.z },
    space: 'MNI152',
    atlases: [
        {
            id: 'harvardoxford-cortical',
            name: 'Harvard–Oxford Cortical Structural Atlas',
            category: 'anatomical',
            valueType: 'probability',
            version: '2103.0',
            sourceUrl: 'https://example.org/harvard-oxford-cortical',
            matches: [
                {
                    id: 'harvardoxford-cortical:4',
                    label: 'Left frontal region',
                    value,
                },
            ],
        },
        {
            id: 'harvardoxford-subcortical',
            name: 'Harvard–Oxford Subcortical Structural Atlas',
            category: 'anatomical',
            valueType: 'probability',
            version: '2103.0',
            sourceUrl: 'https://example.org/harvard-oxford-subcortical',
            matches: [],
        },
        {
            id: 'difumo-512',
            name: 'DiFuMo 512',
            category: 'functional',
            valueType: 'loading',
            version: '1.0',
            sourceUrl: 'https://example.org/difumo',
            matches: [],
        },
    ],
});

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
};

describe('parseAtlasReadoutResponse', () => {
    const requested = { x: -42.5, y: 0, z: 8.25 };

    it('accepts the complete three-atlas contract when match arrays are empty', () => {
        const response = responseFor(requested);
        response.atlases.forEach((atlas) => {
            atlas.matches = [];
        });

        expect(parseAtlasReadoutResponse(response, requested)).toEqual(response);
    });

    it.each([
        ['a non-object response', null],
        ['an unexpected top-level field', { ...responseFor(requested), internal: true }],
        [
            'a missing coordinate',
            (() => {
                const value = clone(responseFor(requested));
                delete (value as Partial<typeof value>).coordinate;
                return value;
            })(),
        ],
        [
            'a missing coordinate axis',
            (() => {
                const value = clone(responseFor(requested));
                delete (value.coordinate as Partial<Coordinate>).z;
                return value;
            })(),
        ],
        ['a nonfinite coordinate', { ...responseFor(requested), coordinate: { ...requested, x: Infinity } }],
        ['the wrong coordinate', { ...responseFor(requested), coordinate: { ...requested, x: -42.4 } }],
        ['the wrong coordinate space', { ...responseFor(requested), space: 'Talairach' }],
        [
            'a missing atlases field',
            (() => {
                const value = clone(responseFor(requested));
                delete (value as Partial<typeof value>).atlases;
                return value;
            })(),
        ],
        ['a non-array atlases field', { ...responseFor(requested), atlases: {} }],
        [
            'a missing configured atlas',
            { ...responseFor(requested), atlases: responseFor(requested).atlases.slice(0, 2) },
        ],
        [
            'an unknown atlas',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[2].id = 'another-atlas';
                return value;
            })(),
        ],
        [
            'configured atlases in the wrong order',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases.reverse();
                return value;
            })(),
        ],
        [
            'duplicate atlas IDs',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[1].id = value.atlases[0].id;
                return value;
            })(),
        ],
        [
            'an unknown category',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].category = 'structural';
                return value;
            })(),
        ],
        [
            'an unknown value type',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].valueType = 'percentage';
                return value;
            })(),
        ],
        [
            'an anatomical/loading mismatch',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].valueType = 'loading';
                return value;
            })(),
        ],
        [
            'a functional/probability mismatch',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[2].valueType = 'probability';
                return value;
            })(),
        ],
        [
            'a missing atlas field',
            (() => {
                const value = clone(responseFor(requested));
                delete (value.atlases[0] as Partial<(typeof value.atlases)[number]>).sourceUrl;
                return value;
            })(),
        ],
        [
            'an unexpected atlas field',
            (() => {
                const value = clone(responseFor(requested));
                return { ...value, atlases: [{ ...value.atlases[0], internal: true }, ...value.atlases.slice(1)] };
            })(),
        ],
        [
            'a malformed source URL',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].sourceUrl = 'not a URL';
                return value;
            })(),
        ],
        [
            'a non-array matches field',
            (() => {
                const value = clone(responseFor(requested));
                return { ...value, atlases: [{ ...value.atlases[0], matches: {} }, ...value.atlases.slice(1)] };
            })(),
        ],
        [
            'a missing match field',
            (() => {
                const value = clone(responseFor(requested));
                delete (value.atlases[0].matches[0] as Partial<(typeof value.atlases)[number]['matches'][number]>)
                    .label;
                return value;
            })(),
        ],
        [
            'an unexpected match field',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].matches[0] = { ...value.atlases[0].matches[0], internal: true } as never;
                return value;
            })(),
        ],
        [
            'a nonfinite match value',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].matches[0].value = Number.NaN;
                return value;
            })(),
        ],
        [
            'duplicate match IDs in one atlas',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[0].matches.push({ ...value.atlases[0].matches[0] });
                return value;
            })(),
        ],
        [
            'duplicate match IDs across atlases',
            (() => {
                const value = clone(responseFor(requested));
                value.atlases[1].matches.push({ ...value.atlases[0].matches[0] });
                return value;
            })(),
        ],
    ])('rejects %s', (_condition, response) => {
        expect(() => parseAtlasReadoutResponse(response, requested)).toThrow('Malformed atlas readout response');
    });

    it.each([
        { x: -90.1, y: 0, z: 0 },
        { x: 90.1, y: 0, z: 0 },
        { x: 0, y: -126.1, z: 0 },
        { x: 0, y: 90.1, z: 0 },
        { x: 0, y: 0, z: -72.1 },
        { x: 0, y: 0, z: 108.1 },
    ])('rejects an echoed coordinate outside the MNI152 request contract: %o', (coordinate) => {
        expect(() => parseAtlasReadoutResponse(responseFor(coordinate), coordinate)).toThrow(
            'Malformed atlas readout response'
        );
    });
});

describe('fetchAtlasReadout', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses the shared public Axios instance with exact decimals and the supplied AbortSignal', async () => {
        const coordinate = { x: -42.5, y: 0.125, z: 8.25 };
        const signal = new AbortController().signal;
        const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: responseFor(coordinate) });

        await expect(fetchAtlasReadout(coordinate, signal)).resolves.toEqual(responseFor(coordinate));
        expect(get).toHaveBeenCalledWith(`${neurosynthConfig.basePath}/atlases/readout`, {
            params: coordinate,
            signal,
            skipAuth: true,
        });
    });

    it('never acquires or sends an auth token for the public atlas endpoint', async () => {
        const coordinate = { x: -42.5, y: 0.125, z: 8.25 };
        const getAccessToken = vi.fn().mockResolvedValue('private-token');
        const originalGetAccessToken = _getAccessTokenSilentlyFunc;
        const originalAdapter = axiosInstance.defaults.adapter;
        const originalAuthorization = axiosInstance.defaults.headers.common.Authorization;
        let observedAuthorization: unknown;
        const adapter: AxiosAdapter = async (config) => {
            observedAuthorization = config.headers.get('Authorization');
            return {
                config,
                data: responseFor(coordinate),
                headers: {},
                status: 200,
                statusText: 'OK',
            };
        };

        _setAccessTokenSilentlyFunc(getAccessToken);
        axiosInstance.defaults.headers.common.Authorization = 'Bearer stale-token';
        axiosInstance.defaults.adapter = adapter;
        try {
            await fetchAtlasReadout(coordinate, new AbortController().signal);
        } finally {
            _setAccessTokenSilentlyFunc(originalGetAccessToken as () => Promise<string>);
            axiosInstance.defaults.adapter = originalAdapter;
            if (originalAuthorization === undefined) {
                delete axiosInstance.defaults.headers.common.Authorization;
            } else {
                axiosInstance.defaults.headers.common.Authorization = originalAuthorization;
            }
        }

        expect(getAccessToken).not.toHaveBeenCalled();
        expect(observedAuthorization).toBeUndefined();
    });

    it('continues to acquire and send auth tokens for ordinary shared requests', async () => {
        const getAccessToken = vi.fn().mockResolvedValue('private-token');
        const originalGetAccessToken = _getAccessTokenSilentlyFunc;
        const originalAdapter = axiosInstance.defaults.adapter;
        let observedAuthorization: unknown;
        const adapter: AxiosAdapter = async (config) => {
            observedAuthorization = config.headers.get('Authorization');
            return {
                config,
                data: {},
                headers: {},
                status: 200,
                statusText: 'OK',
            };
        };

        _setAccessTokenSilentlyFunc(getAccessToken);
        axiosInstance.defaults.adapter = adapter;
        try {
            await axiosInstance.get('/authenticated-resource');
        } finally {
            _setAccessTokenSilentlyFunc(originalGetAccessToken as () => Promise<string>);
            axiosInstance.defaults.adapter = originalAdapter;
        }

        expect(getAccessToken).toHaveBeenCalledOnce();
        expect(observedAuthorization).toBe('Bearer private-token');
    });

    it('rejects a transport response that does not match the requested coordinate', async () => {
        vi.spyOn(axiosInstance, 'get').mockResolvedValue({
            data: responseFor({ x: 1, y: 2, z: 4 }),
        });

        await expect(fetchAtlasReadout({ x: 1, y: 2, z: 3 }, new AbortController().signal)).rejects.toThrow(
            'Malformed atlas readout response'
        );
    });
});

describe('useDecodeAtlasReadout', () => {
    let queryClient: QueryClient;
    let fetchReadout: ReturnType<typeof vi.spyOn>;

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    beforeEach(() => {
        vi.useFakeTimers();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { gcTime: Infinity, retry: false },
            },
        });
        fetchReadout = vi.spyOn(API.NeurosynthServices.AtlasReadoutService, 'fetchAtlasReadout');
    });

    afterEach(() => {
        queryClient.clear();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const advance = async (milliseconds: number) => {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(milliseconds);
        });
    };

    const settle = async () => {
        await act(async () => {
            await Promise.resolve();
            await vi.advanceTimersByTimeAsync(0);
        });
    };

    it('waits exactly 200 ms and sends exact decimal x/y/z values', async () => {
        const coordinate = { x: -42.5, y: 0.125, z: 8.25, threshold: 3.1 };
        fetchReadout.mockResolvedValue(responseFor(coordinate));

        const { result } = renderHook(() => useDecodeAtlasReadout(coordinate), { wrapper });

        expect(result.current.isInitialLoading).toBe(true);
        expect(result.current.isUpdating).toBe(false);
        await advance(199);
        expect(fetchReadout).not.toHaveBeenCalled();
        await advance(1);
        expect(fetchReadout).toHaveBeenCalledTimes(1);
        expect(fetchReadout.mock.calls[0][0]).toEqual({ x: -42.5, y: 0.125, z: 8.25 });
        expect(fetchReadout.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
        expect(
            queryClient
                .getQueryCache()
                .getAll()
                .map(({ queryKey }) => queryKey)
        ).toEqual([['atlas-readout', -42.5, 0.125, 8.25]]);
        await settle();
        expect(result.current.data?.coordinate).toEqual({ x: -42.5, y: 0.125, z: 8.25 });
        expect(result.current.isInitialLoading).toBe(false);
    });

    it('keeps prior data and updates state immediately while the next coordinate is debounced and fetched', async () => {
        const first = { x: 1, y: 2, z: 3, threshold: 3.1 };
        const second = { x: 4, y: 5, z: 6, threshold: 3.1 };
        const next = deferred<ReturnType<typeof responseFor>>();
        fetchReadout.mockResolvedValueOnce(responseFor(first)).mockReturnValueOnce(next.promise);

        const { result, rerender } = renderHook(({ coordinate }) => useDecodeAtlasReadout(coordinate), {
            initialProps: { coordinate: first },
            wrapper,
        });
        await advance(200);
        await settle();
        expect(result.current.data?.coordinate).toEqual({ x: 1, y: 2, z: 3 });

        rerender({ coordinate: second });
        expect(result.current.data?.coordinate).toEqual({ x: 1, y: 2, z: 3 });
        expect(result.current.isUpdating).toBe(true);
        await advance(200);
        expect(result.current.data?.coordinate).toEqual({ x: 1, y: 2, z: 3 });
        expect(result.current.isUpdating).toBe(true);

        next.resolve(responseFor(second));
        await settle();
        expect(result.current.data?.coordinate).toEqual({ x: 4, y: 5, z: 6 });
        expect(result.current.isUpdating).toBe(false);
    });

    it('aborts the superseded request and prevents its late response from replacing current data', async () => {
        const first = { x: 1, y: 2, z: 3 };
        const second = { x: 4, y: 5, z: 6 };
        const oldRequest = deferred<ReturnType<typeof responseFor>>();
        const currentRequest = deferred<ReturnType<typeof responseFor>>();
        fetchReadout.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);

        const { result, rerender } = renderHook(({ coordinate }) => useDecodeAtlasReadout(coordinate), {
            initialProps: { coordinate: first },
            wrapper,
        });
        await advance(200);
        expect(fetchReadout).toHaveBeenCalledTimes(1);
        const oldSignal = fetchReadout.mock.calls[0][1] as AbortSignal;

        rerender({ coordinate: second });
        await advance(200);
        expect(fetchReadout).toHaveBeenCalledTimes(2);
        expect(oldSignal.aborted).toBe(true);

        currentRequest.resolve(responseFor(second, 60));
        await settle();
        expect(result.current.data?.coordinate).toEqual(second);
        oldRequest.resolve(responseFor(first, 99));
        await settle();

        expect(result.current.data?.coordinate).toEqual(second);
        expect(result.current.data?.atlases[0].matches[0].value).toBe(60);
    });

    it('does not debounce or query on threshold-only changes', async () => {
        const initial = { x: 1, y: 2, z: 3, threshold: 3.1 };
        fetchReadout.mockResolvedValue(responseFor(initial));
        const { result, rerender } = renderHook(({ coordinate }) => useDecodeAtlasReadout(coordinate), {
            initialProps: { coordinate: initial },
            wrapper,
        });
        await advance(200);
        await settle();
        expect(result.current.data).toBeDefined();

        rerender({ coordinate: { ...initial, threshold: 9.9 } });
        await advance(200);

        expect(fetchReadout).toHaveBeenCalledTimes(1);
        expect(result.current.isUpdating).toBe(false);
    });

    it.each([new AxiosError('unavailable'), new Error('Malformed atlas readout response')])(
        'keeps %s in local query error state without retrying',
        async (error) => {
            fetchReadout.mockRejectedValue(error);
            const { result } = renderHook(() => useDecodeAtlasReadout({ x: 1, y: 2, z: 3 }), { wrapper });

            await advance(200);
            await settle();
            expect(result.current.isError).toBe(true);
            await advance(1000);

            expect(result.current.isInitialLoading).toBe(false);
            expect(result.current.isUpdating).toBe(false);
            expect(fetchReadout).toHaveBeenCalledTimes(1);
        }
    );

    it('retries the currently selected coordinate', async () => {
        const first = { x: 1, y: 2, z: 3 };
        const current = { x: 4.25, y: 5.5, z: 6.75 };
        fetchReadout
            .mockRejectedValueOnce(new AxiosError('unavailable'))
            .mockRejectedValueOnce(new AxiosError('unavailable'))
            .mockResolvedValueOnce(responseFor(current));
        const { result, rerender } = renderHook(({ coordinate }) => useDecodeAtlasReadout(coordinate), {
            initialProps: { coordinate: first },
            wrapper,
        });
        await advance(200);
        await settle();
        expect(result.current.isError).toBe(true);

        rerender({ coordinate: current });
        await advance(200);
        await settle();
        expect(result.current.isError).toBe(true);
        act(() => result.current.retry());
        await settle();
        expect(result.current.data?.coordinate).toEqual(current);

        expect(fetchReadout).toHaveBeenCalledTimes(3);
        expect(fetchReadout.mock.calls[2][0]).toEqual(current);
    });
});
