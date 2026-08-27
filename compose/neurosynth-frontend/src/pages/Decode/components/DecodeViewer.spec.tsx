import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import type { DecodeRunSource, IAtlasReadout, IViewerState } from '../Decode.types';
import DecodeViewer from './DecodeViewer';

const atlasReadouts: IAtlasReadout[] = [
    { atlas: 'Harvard-Oxford cortical atlas', region: 'Left inferior frontal gyrus', percentage: 72 },
];

let onDisplayChange = vi.fn();
let onPreview = vi.fn();

const renderViewer = (source: DecodeRunSource = { kind: 'neurovault', imageId: '25' }) => {
    onDisplayChange = vi.fn();
    onPreview = vi.fn();

    const Wrapper = () => {
        const [viewer, setViewer] = useState<IViewerState>({ x: 0, y: 0, z: 0, threshold: 0 });
        const handleChange = (nextViewer: IViewerState) => {
            onDisplayChange(nextViewer);
            setViewer(nextViewer);
        };

        return <DecodeViewer source={source} atlasReadouts={atlasReadouts} value={viewer} onChange={handleChange} />;
    };

    return render(<Wrapper />);
};

it('labels the viewer, planes, and atlas values as examples', () => {
    renderViewer();

    const viewer = screen.getByRole('region', { name: 'Example map viewer' });
    expect(viewer).toBeVisible();
    expect(within(viewer).getByText('Sagittal plane')).toBeVisible();
    expect(within(viewer).getByText('Coronal plane')).toBeVisible();
    expect(within(viewer).getByText('Axial plane')).toBeVisible();
    expect(screen.getByText('Example atlas readout')).toBeVisible();
    expect(screen.getByText(/has not loaded or inspected your map/)).toBeVisible();
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
