import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DecodeRunSource, IDecodeVisualization, IViewerState } from '../Decode.types';
import DecodeViewer from './DecodeViewer';

const canvasMock = vi.hoisted(() => ({
    evaluations: 0,
    neverResolves: new Promise<never>(() => undefined),
    props: [] as Array<{
        volumes: Array<{ id: string }>;
        displayByVolumeId: Record<
            string,
            { opacity: number; calMin: number; calMax: number; calMinNegative: number; calMaxNegative: number }
        >;
        sliceType: string;
        crosshairs: boolean;
    }>,
    suspend: false,
}));

const atlasReadoutMock = vi.hoisted(() => ({
    props: [] as Array<Record<string, unknown> & { coordinate: Pick<IViewerState, 'x' | 'y' | 'z'> }>,
}));

vi.mock('./DecodeNiiVueCanvas', () => ({
    get default() {
        canvasMock.evaluations += 1;
        return ({
            volumes,
            displayByVolumeId,
            sliceType,
            crosshairs,
            onCoordinateChange,
            onVolumeRangesChange,
        }: {
            volumes: Array<{ id: string }>;
            displayByVolumeId: Record<
                string,
                { opacity: number; calMin: number; calMax: number; calMinNegative: number; calMaxNegative: number }
            >;
            sliceType: string;
            crosshairs: boolean;
            onCoordinateChange: (coordinate: { x: number; y: number; z: number }) => void;
            onVolumeRangesChange: (ranges: Record<string, { globalMin: number; globalMax: number }>) => void;
        }) => {
            if (canvasMock.suspend) throw canvasMock.neverResolves;
            canvasMock.props.push({ volumes, displayByVolumeId, sliceType, crosshairs });
            return (
                <section aria-label="Recorded decoder maps">
                    <span>{volumes.map(({ id }) => id).join(', ')}</span>
                    <button type="button" onClick={() => onCoordinateChange({ x: -42, y: 8, z: 30 })}>
                        Move map crosshair
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            onVolumeRangesChange({
                                'generic-mni': { globalMin: 0, globalMax: 97 },
                                'response-control': { globalMin: -4.25, globalMax: 7.5 },
                            })
                        }
                    >
                        Report map range
                    </button>
                </section>
            );
        };
    },
}));

vi.mock('./DecodeAtlasReadout', () => ({
    default: function DecodeAtlasReadoutMock(
        props: Record<string, unknown> & { coordinate: Pick<IViewerState, 'x' | 'y' | 'z'> }
    ) {
        atlasReadoutMock.props.push(props);
        const { coordinate } = props;
        return (
            <section aria-label="Live atlas readout">
                Live coordinate: {coordinate.x}, {coordinate.y}, {coordinate.z}
            </section>
        );
    },
}));

beforeEach(() => {
    atlasReadoutMock.props = [];
    canvasMock.suspend = false;
});

const anatomical = {
    id: 'generic-mni',
    url: '/recorded/generic-mni.nii.gz',
    filename: 'generic-mni.nii.gz',
    kind: 'anatomical' as const,
    statisticType: 'anatomical' as const,
    provenance: {
        sourceUrl: 'https://example.test/generic-mni.nii.gz',
        license: 'CC0' as const,
        sha256: 'mni',
        bytes: 1,
    },
};
const input = {
    id: 'response-control',
    url: '/recorded/response-control.nii.gz',
    filename: 'response-control.nii.gz',
    kind: 'input-statistic' as const,
    statisticType: 'z' as const,
    provenance: {
        sourceUrl: 'https://example.test/response-control.nii.gz',
        license: 'CC0' as const,
        sha256: 'input',
        bytes: 1,
    },
};
const recordedVisualization: IDecodeVisualization = { anatomical, input, comparisonByResultId: {} };

let onDisplayChange = vi.fn();

const renderViewer = (
    source: DecodeRunSource = { kind: 'neurovault', imageId: '25' },
    visualization?: IDecodeVisualization
) => {
    onDisplayChange = vi.fn();

    const Wrapper = () => {
        const [viewer, setViewer] = useState<IViewerState>({ x: 0, y: 0, z: 0, threshold: 0 });
        const handleChange = (nextViewer: IViewerState) => {
            onDisplayChange(nextViewer);
            setViewer(nextViewer);
        };

        return <DecodeViewer source={source} visualization={visualization} value={viewer} onChange={handleChange} />;
    };

    return render(<Wrapper />);
};

it('keeps an explicitly illustrative, no-map viewer when visualization is absent', () => {
    renderViewer();

    const viewer = screen.getByRole('region', { name: 'Example map viewer' });
    expect(viewer).toBeVisible();
    expect(within(viewer).getByText('Sagittal plane')).toBeVisible();
    expect(within(viewer).getByText('Coronal plane')).toBeVisible();
    expect(within(viewer).getByText('Axial plane')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Live atlas readout' })).toBeVisible();
    expect(screen.getAllByRole('region', { name: 'Live atlas readout' })).toHaveLength(1);
    expect(atlasReadoutMock.props.at(-1)).toStrictEqual({ coordinate: { x: 0, y: 0, z: 0, threshold: 0 } });
    expect(screen.getByText(/has not loaded or inspected your map/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Recorded decoder maps' })).not.toBeInTheDocument();
    expect(canvasMock.evaluations).toBe(0);
});

it('renders recorded anatomy and input assets and synchronizes canvas coordinates', async () => {
    const user = userEvent.setup();
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);

    expect(await screen.findByRole('region', { name: 'Recorded decoder maps' })).toHaveTextContent(
        'generic-mni, response-control'
    );
    expect(screen.getByText(/Recorded map viewer/)).toBeVisible();
    expect(screen.getByRole('region', { name: 'Live atlas readout' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Move map crosshair' }));

    expect(screen.getByText(/Selected MNI coordinate: x −42, y 8, z 30/)).toBeVisible();
    expect(atlasReadoutMock.props.at(-1)?.coordinate).toEqual({ x: -42, y: 8, z: 30, threshold: 0 });
    expect(onDisplayChange).toHaveBeenLastCalledWith({ x: -42, y: 8, z: 30, threshold: 0 });
});

it('places the live atlas readout directly beneath the selected coordinate in the map column', () => {
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);

    const selectedCoordinate = screen.getByText(/Selected MNI coordinate: x 0, y 0, z 0/);
    const mapColumn = selectedCoordinate.parentElement;

    expect(mapColumn).not.toBeNull();
    expect(within(mapColumn as HTMLElement).getByRole('region', { name: 'Live atlas readout' })).toBeVisible();
});

it('loads only anatomy and no input controls for a coordinate source with an over-complete visualization', async () => {
    renderViewer(
        { kind: 'coordinates', points: [{ id: 'p1', label: 'Seed', x: 0, y: 0, z: 0 }] },
        recordedVisualization
    );

    expect(await screen.findByRole('region', { name: 'Recorded decoder maps' })).toHaveTextContent('generic-mni');
    expect(screen.getByRole('region', { name: 'Recorded decoder maps' })).not.toHaveTextContent('response-control');
    expect(screen.queryByText('Recorded input display')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Input opacity' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Live atlas readout' })).toHaveLength(1);
});

it('mounts one live atlas child for an upload source without a visualization', () => {
    renderViewer({
        kind: 'upload',
        filename: 'local-map.nii.gz',
        license: 'CC0',
        size: 1024,
        mediaType: 'application/gzip',
        lastModified: 1,
        selectionId: 1,
    });

    expect(screen.getAllByRole('region', { name: 'Live atlas readout' })).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Example map viewer' })).toBeVisible();
});

it('keeps the live atlas child available while a recorded map is still loading', async () => {
    canvasMock.suspend = true;
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);

    expect(await screen.findByRole('status')).toHaveTextContent('Loading recorded map viewer');
    expect(screen.getAllByRole('region', { name: 'Live atlas readout' })).toHaveLength(1);
});

it('calibrates the 0–97 anatomy and signed input from their loaded ranges', async () => {
    const user = userEvent.setup();
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);
    await screen.findByRole('region', { name: 'Recorded decoder maps' });
    await user.click(screen.getByRole('button', { name: 'Report map range' }));

    expect(screen.getByText(/Input display range: −4.25 to 7.50/)).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Positive input threshold' })).toHaveAttribute('aria-valuemax', '7.5');
    expect(screen.getByRole('slider', { name: 'Negative input threshold' })).toHaveAttribute('aria-valuemin', '-4.25');
    expect(canvasMock.props.at(-1)?.displayByVolumeId['response-control']).toMatchObject({
        calMin: 0,
        calMax: 7.5,
        calMinNegative: 0,
        calMaxNegative: -4.25,
    });
    expect(canvasMock.props.at(-1)?.displayByVolumeId['generic-mni']).toMatchObject({
        calMin: 0,
        calMax: 97,
        calMinNegative: 0,
        calMaxNegative: 0,
    });

    fireEvent.change(screen.getByRole('slider', { name: 'Input opacity' }), { target: { value: '0.45' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Positive input threshold' }), { target: { value: '2.5' } });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Slice layout' }), 'axial');
    await user.click(screen.getByRole('checkbox', { name: 'Show crosshairs' }));

    expect(canvasMock.props.at(-1)).toMatchObject({
        sliceType: 'axial',
        crosshairs: false,
        displayByVolumeId: { 'response-control': { opacity: 0.45, calMin: 2.5 } },
    });
});

it('passes typed coordinate edits to the live atlas child', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.clear(screen.getByLabelText('Viewer x coordinate'));
    await user.type(screen.getByLabelText('Viewer x coordinate'), '-42');
    await user.clear(screen.getByLabelText('Viewer y coordinate'));
    await user.type(screen.getByLabelText('Viewer y coordinate'), '8.5');
    await user.clear(screen.getByLabelText('Viewer z coordinate'));
    await user.type(screen.getByLabelText('Viewer z coordinate'), '30');

    expect(screen.getByRole('region', { name: 'Live atlas readout' })).toHaveTextContent(
        'Live coordinate: -42, 8.5, 30'
    );
    expect(atlasReadoutMock.props.at(-1)?.coordinate).toEqual({ x: -42, y: 8.5, z: 30, threshold: 0 });
    expect(screen.getByText(/Selected MNI coordinate: x −42, y 8.5, z 30/)).toBeVisible();
});

it('keeps the live atlas x, y, and z unchanged across threshold-only changes', () => {
    renderViewer();

    const threshold = screen.getByRole('slider', { name: 'Display threshold' });
    fireEvent.change(threshold, { target: { value: '40' } });

    expect(onDisplayChange).toHaveBeenLastCalledWith({ x: 0, y: 0, z: 0, threshold: 40 });
    expect(atlasReadoutMock.props.at(-1)?.coordinate).toEqual({ x: 0, y: 0, z: 0, threshold: 40 });
});

it('selects among entered coordinates without changing the decoder source', async () => {
    const user = userEvent.setup();
    const source: DecodeRunSource = {
        kind: 'coordinates',
        points: [
            { id: 'p1', label: 'Seed', x: 0, y: 0, z: 0 },
            { id: 'p2', label: 'Language focus', x: -42, y: 0, z: 0 },
        ],
    };
    renderViewer(source);

    await user.selectOptions(screen.getByRole('listbox', { name: 'Entered coordinates' }), 'p2');

    expect(screen.getByLabelText('Viewer x coordinate')).toHaveValue(-42);
    expect(screen.getByRole('region', { name: 'Live atlas readout' })).toHaveTextContent('Live coordinate: -42, 0, 0');
    expect(atlasReadoutMock.props.at(-1)?.coordinate).toEqual({ x: -42, y: 0, z: 0, threshold: 0 });
    expect(source.points[0]).toEqual({ id: 'p1', label: 'Seed', x: 0, y: 0, z: 0 });
    expect(source.points[1]).toEqual({ id: 'p2', label: 'Language focus', x: -42, y: 0, z: 0 });
});

it('keeps the live atlas child mounted at the current viewer coordinate', () => {
    renderViewer();

    expect(screen.getByRole('region', { name: 'Live atlas readout' })).toHaveTextContent('Live coordinate: 0, 0, 0');
});

it('synchronizes a temporarily blank field when a new preview resets the coordinate', async () => {
    const user = userEvent.setup();
    const Wrapper = () => {
        const [viewer, setViewer] = useState<IViewerState>({ x: -42, y: 0, z: 0, threshold: 0 });
        return (
            <>
                <button type="button" onClick={() => setViewer({ x: 0, y: 0, z: 0, threshold: 0 })}>
                    Load another example preview
                </button>
                <DecodeViewer source={{ kind: 'neurovault', imageId: '25' }} value={viewer} onChange={setViewer} />
            </>
        );
    };
    render(<Wrapper />);

    await user.clear(screen.getByLabelText('Viewer x coordinate'));
    await user.click(screen.getByRole('button', { name: 'Load another example preview' }));

    expect(screen.getByLabelText('Viewer x coordinate')).toHaveValue(0);
});
