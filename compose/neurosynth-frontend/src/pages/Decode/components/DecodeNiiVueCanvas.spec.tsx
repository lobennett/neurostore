import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IDecodeVolumeAsset } from '../Decode.types';
import DecodeNiiVueCanvas, { type DecodeNiiVueCanvasProps, type IDecodeVolumeDisplay } from './DecodeNiiVueCanvas';

const niivueMock = vi.hoisted(() => {
    type MockVolume = {
        id: string;
        name: string;
        opacity: number;
        colormap: string;
        colormapNegative: string;
        cal_min: number;
        cal_max: number;
        cal_minNeg: number;
        cal_maxNeg: number;
        global_min: number;
        global_max: number;
    };

    const instances: MockNiivue[] = [];
    let nextRange = { globalMin: -4.25, globalMax: 7.5 };
    let nextAttach: (() => Promise<unknown>) | undefined;

    class MockNiivue {
        volumes: MockVolume[] = [];
        scene = { crosshairPos: [0, 0, 0] };
        sliceTypeAxial = 0;
        sliceTypeCoronal = 1;
        sliceTypeSagittal = 2;
        sliceTypeMultiplanar = 3;
        onLocationChange: (location: unknown) => void = () => undefined;
        attachToCanvas = vi.fn(() => {
            const attach = nextAttach;
            nextAttach = undefined;
            return attach ? attach() : Promise.resolve(this);
        });
        loadVolumes = vi.fn(async () => {
            this.volumes = [];
            return this;
        });
        addVolumeFromUrl = vi.fn(async (descriptor: { name: string }) => {
            const volume: MockVolume = {
                id: `niivue-${descriptor.name}`,
                name: descriptor.name,
                opacity: 1,
                colormap: 'gray',
                colormapNegative: '',
                cal_min: 0,
                cal_max: 0,
                cal_minNeg: 0,
                cal_maxNeg: 0,
                global_min: nextRange.globalMin,
                global_max: nextRange.globalMax,
            };
            this.volumes.push(volume);
            return volume;
        });
        removeVolume = vi.fn((volume: MockVolume) => {
            this.volumes = this.volumes.filter(({ id }) => id !== volume.id);
        });
        mm2frac = vi.fn(([x, y, z]: number[]) => [x / 10, y / 10, z / 10]);
        drawScene = vi.fn();
        setSliceType = vi.fn();
        setCrosshairWidth = vi.fn();
        updateGLVolume = vi.fn();

        constructor() {
            instances.push(this);
        }
    }

    return {
        MockNiivue,
        instances,
        setNextRange: (globalMin: number, globalMax: number) => {
            nextRange = { globalMin, globalMax };
        },
        deferNextAttach: (attach: () => Promise<unknown>) => {
            nextAttach = attach;
        },
        reset: () => {
            instances.length = 0;
            nextAttach = undefined;
        },
    };
});

vi.mock('@niivue/niivue', () => ({ Niivue: niivueMock.MockNiivue }));

const anatomical: IDecodeVolumeAsset = {
    id: 'mni-template',
    url: '/recorded/mni-template.nii.gz',
    filename: 'mni-template.nii.gz',
    kind: 'anatomical',
    statisticType: 'anatomical',
    provenance: {
        sourceUrl: 'https://example.test/mni-template.nii.gz',
        license: 'CC0',
        sha256: 'anatomical-sha',
        bytes: 1024,
    },
};

const responseControl: IDecodeVolumeAsset = {
    id: 'response-control',
    url: '/recorded/response-control.nii.gz',
    filename: 'response-control.nii.gz',
    kind: 'association-z',
    statisticType: 'z',
    provenance: {
        sourceUrl: 'https://example.test/response-control.nii.gz',
        license: 'ODbL-derived',
        sha256: 'response-sha',
        bytes: 2048,
    },
};

const defaultDisplay: Record<string, IDecodeVolumeDisplay> = {
    'mni-template': {
        opacity: 0.7,
        colormap: 'gray',
        colormapNegative: '',
        calMin: 0,
        calMax: 100,
        calMinNegative: 0,
        calMaxNegative: 0,
    },
    'response-control': {
        opacity: 0.85,
        colormap: 'warm',
        colormapNegative: 'winter',
        calMin: 2.5,
        calMax: 7.5,
        calMinNegative: -2.5,
        calMaxNegative: -7.5,
    },
};

const makeProps = (overrides: Partial<DecodeNiiVueCanvasProps> = {}): DecodeNiiVueCanvasProps => ({
    ariaLabel: 'Recorded decoder maps',
    volumes: [anatomical, responseControl],
    coordinate: { x: 0, y: 0, z: 0 },
    sliceType: 'multiplanar',
    crosshairs: true,
    displayByVolumeId: defaultDisplay,
    onCoordinateChange: vi.fn(),
    onValuesChange: vi.fn(),
    onVolumeRangesChange: vi.fn(),
    ...overrides,
});

let loseContext: ReturnType<typeof vi.fn>;
let getContextSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    niivueMock.reset();
    niivueMock.setNextRange(-4.25, 7.5);
    loseContext = vi.fn();
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((kind: string) => {
        if (kind !== 'webgl2') return null;
        return {
            getExtension: vi.fn((name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null)),
        };
    }) as typeof HTMLCanvasElement.prototype.getContext);
});

afterEach(() => {
    getContextSpy.mockRestore();
});

describe('DecodeNiiVueCanvas', () => {
    it('attaches one instance and loads supplied assets sequentially after clearing old volumes', async () => {
        const onVolumeRangesChange = vi.fn();
        render(<DecodeNiiVueCanvas {...makeProps({ onVolumeRangesChange })} />);

        await waitFor(() =>
            expect(screen.getByRole('region', { name: 'Recorded decoder maps' })).toHaveAttribute('aria-busy', 'false')
        );
        const instance = niivueMock.instances[0];

        expect(niivueMock.instances).toHaveLength(1);
        expect(instance.attachToCanvas).toHaveBeenCalledTimes(1);
        expect(instance.addVolumeFromUrl.mock.calls.map(([descriptor]) => descriptor)).toEqual([
            expect.objectContaining({ url: anatomical.url, name: anatomical.filename }),
            expect.objectContaining({ url: responseControl.url, name: responseControl.filename }),
        ]);
        expect(onVolumeRangesChange).toHaveBeenLastCalledWith({
            'mni-template': { globalMin: -4.25, globalMax: 7.5 },
            'response-control': { globalMin: -4.25, globalMax: 7.5 },
        });
    });

    it('applies display configuration through stable asset identities', async () => {
        render(<DecodeNiiVueCanvas {...makeProps()} />);

        await waitFor(() => expect(niivueMock.instances[0]?.volumes).toHaveLength(2));
        const instance = niivueMock.instances[0];
        const responseVolume = instance.volumes.find(({ name }) => name === responseControl.filename);

        expect(responseVolume).toMatchObject({
            opacity: 0.85,
            colormap: 'warm',
            colormapNegative: 'winter',
            cal_min: 2.5,
            cal_max: 7.5,
            cal_minNeg: -2.5,
            cal_maxNeg: -7.5,
        });
    });

    it('replaces loaded volumes when descriptors change', async () => {
        const { rerender } = render(<DecodeNiiVueCanvas {...makeProps({ volumes: [anatomical] })} />);
        await waitFor(() => expect(niivueMock.instances[0]?.volumes).toHaveLength(1));

        rerender(<DecodeNiiVueCanvas {...makeProps({ volumes: [responseControl] })} />);

        await waitFor(() =>
            expect(niivueMock.instances[0]?.volumes.map(({ name }) => name)).toEqual([responseControl.filename])
        );
        expect(niivueMock.instances).toHaveLength(1);
        expect(niivueMock.instances[0].removeVolume).toHaveBeenCalledWith(
            expect.objectContaining({ name: anatomical.filename })
        );
    });

    it('ignores a late completion from an obsolete volume generation', async () => {
        const onVolumeRangesChange = vi.fn();
        const { rerender } = render(
            <DecodeNiiVueCanvas {...makeProps({ volumes: [anatomical], onVolumeRangesChange })} />
        );
        const instance = niivueMock.instances[0];
        let resolveOldLoad!: (volume: Awaited<ReturnType<typeof instance.addVolumeFromUrl>>) => void;
        instance.addVolumeFromUrl.mockImplementationOnce(
            () => new Promise((resolve) => (resolveOldLoad = resolve)) as ReturnType<typeof instance.addVolumeFromUrl>
        );

        await waitFor(() => expect(instance.addVolumeFromUrl).toHaveBeenCalledTimes(1));
        rerender(<DecodeNiiVueCanvas {...makeProps({ volumes: [responseControl], onVolumeRangesChange })} />);
        await waitFor(() =>
            expect(screen.getByRole('region', { name: 'Recorded decoder maps' })).toHaveAttribute('aria-busy', 'false')
        );

        await act(async () => {
            resolveOldLoad({
                id: 'obsolete-volume',
                name: anatomical.id,
                opacity: 1,
                colormap: 'gray',
                colormapNegative: '',
                cal_min: 0,
                cal_max: 0,
                cal_minNeg: 0,
                cal_maxNeg: 0,
                global_min: -99,
                global_max: 99,
            });
            await Promise.resolve();
        });

        expect(onVolumeRangesChange).toHaveBeenLastCalledWith({
            'response-control': { globalMin: -4.25, globalMax: 7.5 },
        });
        expect(screen.queryByText(/mni-template value/)).not.toBeInTheDocument();
    });

    it('forwards rounded MNI coordinates and values by asset ID', async () => {
        const onCoordinateChange = vi.fn();
        const onValuesChange = vi.fn();
        render(<DecodeNiiVueCanvas {...makeProps({ onCoordinateChange, onValuesChange })} />);
        await waitFor(() =>
            expect(screen.getByRole('region', { name: 'Recorded decoder maps' })).toHaveAttribute('aria-busy', 'false')
        );
        const instance = niivueMock.instances[0];

        act(() => {
            instance.onLocationChange({
                mm: [1.6, -2.4, 3.5, 1],
                values: [{ id: `niivue-${responseControl.filename}`, value: 2.314 }],
            });
        });

        expect(onCoordinateChange).toHaveBeenCalledWith({ x: 2, y: -2, z: 4 });
        expect(onValuesChange).toHaveBeenCalledWith({ 'response-control': 2.314 });
        expect(screen.getByText('MNI x 2, y -2, z 4 · response-control value 2.314')).toBeVisible();
    });

    it('shows pending filenames inside the busy canvas region', () => {
        render(<DecodeNiiVueCanvas {...makeProps()} />);

        const region = screen.getByRole('region', { name: 'Recorded decoder maps' });
        expect(region).toHaveAttribute('aria-busy', 'true');
        expect(region).toHaveTextContent('mni-template.nii.gz');
        expect(region).toHaveTextContent('response-control.nii.gz');
    });

    it('names the exact failed file and retries the sequential load', async () => {
        render(<DecodeNiiVueCanvas {...makeProps()} />);
        const instance = niivueMock.instances[0];
        const loadVolume = instance.addVolumeFromUrl.getMockImplementation()!;
        instance.addVolumeFromUrl.mockImplementationOnce(loadVolume).mockRejectedValueOnce(new Error('offline'));

        expect(await screen.findByText('Could not load response-control.nii.gz')).toBeVisible();
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(instance.addVolumeFromUrl).toHaveBeenCalledTimes(4));
        expect(screen.queryByText('Could not load response-control.nii.gz')).not.toBeInTheDocument();
    });

    it('keeps a textual map and coordinate fallback when WebGL2 is unavailable', () => {
        getContextSpy.mockReturnValue(null);

        render(<DecodeNiiVueCanvas {...makeProps()} />);

        const region = screen.getByRole('region', { name: 'Recorded decoder maps' });
        expect(within(region).getByText('Interactive map unavailable because WebGL2 is not supported.')).toBeVisible();
        expect(screen.getByText('MNI x 0, y 0, z 0 · response-control value unavailable')).toBeVisible();
        expect(niivueMock.instances).toHaveLength(0);
    });

    it('controls coordinate, slice type, and crosshairs without re-creating the instance', async () => {
        const { rerender } = render(<DecodeNiiVueCanvas {...makeProps()} />);
        await waitFor(() => expect(niivueMock.instances[0]?.volumes).toHaveLength(2));
        const instance = niivueMock.instances[0];

        rerender(
            <DecodeNiiVueCanvas
                {...makeProps({ coordinate: { x: 10, y: -20, z: 30 }, sliceType: 'axial', crosshairs: false })}
            />
        );

        expect(instance.mm2frac).toHaveBeenLastCalledWith([10, -20, 30]);
        expect(instance.scene.crosshairPos).toEqual([1, -2, 3]);
        expect(instance.setSliceType).toHaveBeenLastCalledWith(instance.sliceTypeAxial);
        expect(instance.setCrosshairWidth).toHaveBeenLastCalledWith(0);
        expect(niivueMock.instances).toHaveLength(1);
    });

    it('clears callbacks, volumes, and the WebGL context on unmount', async () => {
        const { unmount } = render(<DecodeNiiVueCanvas {...makeProps()} />);
        await waitFor(() => expect(niivueMock.instances[0]?.volumes).toHaveLength(2));
        const instance = niivueMock.instances[0];
        const activeCallback = instance.onLocationChange;

        unmount();

        expect(instance.onLocationChange).not.toBe(activeCallback);
        expect(instance.removeVolume).toHaveBeenCalledTimes(2);
        expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it('disposes the initialized context when attachment completes after unmount', async () => {
        let finishAttach!: () => void;
        niivueMock.deferNextAttach(() => new Promise<void>((resolve) => (finishAttach = resolve)));
        const { unmount } = render(<DecodeNiiVueCanvas {...makeProps()} />);
        const instance = niivueMock.instances[0];

        unmount();
        await act(async () => finishAttach());

        expect(instance.removeVolume).not.toHaveBeenCalled();
        expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it('removes a late volume before losing the context after unmount', async () => {
        let resolveVolume!: (
            volume: Awaited<ReturnType<(typeof niivueMock.instances)[number]['addVolumeFromUrl']>>
        ) => void;
        const { unmount } = render(<DecodeNiiVueCanvas {...makeProps({ volumes: [responseControl] })} />);
        const instance = niivueMock.instances[0];
        const lateVolume = {
            id: 'late-response-control',
            name: responseControl.filename,
            opacity: 1,
            colormap: 'gray',
            colormapNegative: '',
            cal_min: 0,
            cal_max: 0,
            cal_minNeg: 0,
            cal_maxNeg: 0,
            global_min: -4.25,
            global_max: 7.5,
        };
        instance.addVolumeFromUrl.mockImplementationOnce(
            () => new Promise((resolve) => (resolveVolume = resolve)) as ReturnType<typeof instance.addVolumeFromUrl>
        );
        await waitFor(() => expect(instance.addVolumeFromUrl).toHaveBeenCalledTimes(1));

        unmount();
        await act(async () => {
            instance.volumes.push(lateVolume);
            resolveVolume(lateVolume);
            await Promise.resolve();
        });

        expect(instance.removeVolume).toHaveBeenCalledWith(lateVolume);
        expect(loseContext).toHaveBeenCalledTimes(1);
        expect(instance.removeVolume.mock.invocationCallOrder.at(-1)).toBeLessThan(
            loseContext.mock.invocationCallOrder[0]
        );
    });
});
