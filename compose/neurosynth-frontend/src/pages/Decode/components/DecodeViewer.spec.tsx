import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import type { DecodeRunSource, IDecodeVisualization, IAtlasReadout, IViewerState } from '../Decode.types';
import DecodeViewer from './DecodeViewer';

vi.mock('./DecodeNiiVueCanvas', () => ({
    default: ({
        volumes,
        onCoordinateChange,
        onVolumeRangesChange,
    }: {
        volumes: Array<{ id: string }>;
        onCoordinateChange: (coordinate: { x: number; y: number; z: number }) => void;
        onVolumeRangesChange: (ranges: Record<string, { globalMin: number; globalMax: number }>) => void;
    }) => (
        <section aria-label="Recorded decoder maps">
            <span>{volumes.map(({ id }) => id).join(', ')}</span>
            <button type="button" onClick={() => onCoordinateChange({ x: -42, y: 8, z: 30 })}>
                Move map crosshair
            </button>
            <button
                type="button"
                onClick={() =>
                    onVolumeRangesChange({
                        'response-control': { globalMin: -4.25, globalMax: 7.5 },
                    })
                }
            >
                Report map range
            </button>
        </section>
    ),
}));

const atlasReadouts: IAtlasReadout[] = [
    { atlas: 'Harvard-Oxford cortical atlas', region: 'Left inferior frontal gyrus', percentage: 72 },
];

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
let onPreview = vi.fn();

const renderViewer = (
    source: DecodeRunSource = { kind: 'neurovault', imageId: '25' },
    visualization?: IDecodeVisualization
) => {
    onDisplayChange = vi.fn();
    onPreview = vi.fn();

    const Wrapper = () => {
        const [viewer, setViewer] = useState<IViewerState>({ x: 0, y: 0, z: 0, threshold: 0 });
        const handleChange = (nextViewer: IViewerState) => {
            onDisplayChange(nextViewer);
            setViewer(nextViewer);
        };

        return (
            <DecodeViewer
                source={source}
                visualization={visualization}
                atlasReadouts={atlasReadouts}
                value={viewer}
                onChange={handleChange}
            />
        );
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
    expect(screen.getByText('Example atlas readout')).toBeVisible();
    expect(screen.getByText(/has not loaded or inspected your map/)).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Recorded decoder maps' })).not.toBeInTheDocument();
});

it('renders recorded anatomy and input assets and synchronizes canvas coordinates', async () => {
    const user = userEvent.setup();
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);

    expect(await screen.findByRole('region', { name: 'Recorded decoder maps' })).toHaveTextContent(
        'generic-mni, response-control'
    );
    expect(screen.getByText(/Recorded map viewer/)).toBeVisible();
    expect(screen.getByText('Example atlas readout')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Move map crosshair' }));

    expect(screen.getByText(/Selected MNI coordinate: x −42, y 8, z 30/)).toBeVisible();
    expect(onDisplayChange).toHaveBeenLastCalledWith({ x: -42, y: 8, z: 30, threshold: 0 });
});

it('loads only anatomy for a recorded coordinate source and derives signed thresholds from its input range', async () => {
    const user = userEvent.setup();
    const coordinateVisualization: IDecodeVisualization = { anatomical, comparisonByResultId: {} };
    const coordinateViewer = renderViewer(
        { kind: 'coordinates', points: [{ id: 'p1', label: 'Seed', x: 0, y: 0, z: 0 }] },
        coordinateVisualization
    );

    expect(await screen.findByRole('region', { name: 'Recorded decoder maps' })).toHaveTextContent('generic-mni');
    expect(screen.getByRole('region', { name: 'Recorded decoder maps' })).not.toHaveTextContent('response-control');

    coordinateViewer.unmount();
    renderViewer({ kind: 'neurovault', imageId: '308' }, recordedVisualization);
    await user.click(screen.getByRole('button', { name: 'Report map range' }));

    expect(screen.getByText(/Input display range: −4.25 to 7.50/)).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Positive input threshold' })).toHaveAttribute('aria-valuemax', '7.5');
    expect(screen.getByRole('slider', { name: 'Negative input threshold' })).toHaveAttribute('aria-valuemin', '-4.25');
});

it('updates the active coordinate and corresponding text readout', async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.clear(screen.getByLabelText('Viewer x coordinate'));
    await user.type(screen.getByLabelText('Viewer x coordinate'), '-42');

    expect(screen.getByText('Left inferior frontal gyrus')).toBeVisible();
    expect(screen.getByText('72%')).toBeVisible();
    expect(screen.getByText(/Selected MNI coordinate: x −42, y 0, z 0/)).toBeVisible();
});

it('changes display threshold without requesting a new preview', async () => {
    const user = userEvent.setup();
    renderViewer();

    const threshold = screen.getByRole('slider', { name: 'Display threshold' });
    await user.click(threshold);

    expect(onDisplayChange).toHaveBeenCalled();
    expect(onPreview).not.toHaveBeenCalled();
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
    expect(screen.getByText('Left inferior frontal gyrus')).toBeVisible();
    expect(source.points[0]).toEqual({ id: 'p1', label: 'Seed', x: 0, y: 0, z: 0 });
    expect(source.points[1]).toEqual({ id: 'p2', label: 'Language focus', x: -42, y: 0, z: 0 });
});

it('provides semantic example provenance and an explicit no-label state', () => {
    renderViewer();

    const atlas = screen.getByRole('region', { name: 'Example atlas readout' });
    expect(within(atlas).getByRole('list')).toBeVisible();
    expect(within(atlas).getByText('No example atlas label at this coordinate')).toBeVisible();
    expect(atlas).toHaveAccessibleDescription(/deterministic examples/i);
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
                <DecodeViewer
                    source={{ kind: 'neurovault', imageId: '25' }}
                    atlasReadouts={atlasReadouts}
                    value={viewer}
                    onChange={setViewer}
                />
            </>
        );
    };
    render(<Wrapper />);

    await user.clear(screen.getByLabelText('Viewer x coordinate'));
    await user.click(screen.getByRole('button', { name: 'Load another example preview' }));

    expect(screen.getByLabelText('Viewer x coordinate')).toHaveValue(0);
});
