import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DECODE_MODELS } from '../Decode.fixtures';
import type { IDecodeComparableResult, IDecodePreview, IDecodeVisualization, IViewerState } from '../Decode.types';
import DecodeComparison from './DecodeComparison';
import DecodeResults from './DecodeResults';
import DecodeViewer from './DecodeViewer';

interface ICanvasProps {
    ariaLabel: string;
    volumes: Array<{ id: string }>;
    coordinate: { x: number; y: number; z: number };
    displayByVolumeId: Record<
        string,
        {
            opacity: number;
            colormap: string;
            colormapNegative: string;
            calMin: number;
            calMax: number;
            calMinNegative: number;
            calMaxNegative: number;
        }
    >;
    onCoordinateChange: (coordinate: { x: number; y: number; z: number }) => void;
    onVolumeRangesChange: (ranges: Record<string, { globalMin: number; globalMax: number }>) => void;
}

const canvasMock = vi.hoisted(() => ({
    evaluations: 0,
    props: [] as ICanvasProps[],
    suspend: false,
    neverResolves: new Promise<never>(() => undefined),
}));

vi.mock('./DecodeNiiVueCanvas', () => ({
    get default() {
        canvasMock.evaluations += 1;
        return (props: ICanvasProps) => {
            if (canvasMock.suspend) throw canvasMock.neverResolves;
            canvasMock.props.push(props);
            const statisticalVolume = props.volumes.find(({ id }) => id !== 'generic-mni');
            const range =
                statisticalVolume?.id === 'response-control'
                    ? { globalMin: -4.25, globalMax: 7.5 }
                    : { globalMin: -8, globalMax: 9 };

            return (
                <section aria-label={props.ariaLabel}>
                    <span>{props.volumes.map(({ id }) => id).join(', ')}</span>
                    <button
                        type="button"
                        onClick={() =>
                            props.onCoordinateChange(
                                props.ariaLabel === 'Submitted map viewer'
                                    ? { x: -42, y: 8, z: 30 }
                                    : { x: 18, y: -12, z: 44 }
                            )
                        }
                    >
                        Move {props.ariaLabel} crosshair
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            statisticalVolume && props.onVolumeRangesChange({ [statisticalVolume.id]: range })
                        }
                    >
                        Report {props.ariaLabel} range
                    </button>
                </section>
            );
        };
    },
}));

vi.mock('./DecodeAtlasReadout', () => ({
    default: ({ coordinate }: { coordinate: { x: number; y: number; z: number } }) => (
        <section aria-label="Live atlas readout">
            Live coordinate: {coordinate.x}, {coordinate.y}, {coordinate.z}
        </section>
    ),
}));

const asset = (
    id: string,
    kind: 'anatomical' | 'input-statistic' | 'association-z',
    statisticType: 'anatomical' | 't' | 'z'
) => ({
    id,
    url: `/recorded/${id}.nii.gz`,
    filename: `${id}.nii.gz`,
    kind,
    statisticType,
    provenance: {
        sourceUrl: `https://example.test/${id}.nii.gz`,
        license: (kind === 'association-z' ? 'ODbL-derived' : 'CC0') as 'CC0' | 'ODbL-derived',
        sha256: id,
        bytes: 1,
    },
});

const anatomical = asset('generic-mni', 'anatomical', 'anatomical');
const input = asset('response-control', 'input-statistic', 't');
const premotorMap = asset('premotor-map', 'association-z', 'z');
const visualMap = asset('visual-map', 'association-z', 'z');
const posteriorCingulateMap = asset('posterior-cingulate-map', 'association-z', 'z');
const visualization: IDecodeVisualization = {
    anatomical,
    input,
    comparisonByResultId: {
        premotor: premotorMap,
        visual: visualMap,
        'posterior-cingulate': posteriorCingulateMap,
    },
};

const result = (id: string, label: string): IDecodeComparableResult => ({
    id,
    kind: 'term',
    label,
    mapLabel: `${label} association map`,
    mapUrl: `https://should-not-drive-lookup.test/${label}.nii.gz`,
});

const premotor = result('premotor', 'premotor');
const visual = result('visual', 'visual');
const posteriorCingulate = result('posterior-cingulate', 'posterior cingulate');
const unmapped = result('executive', 'executive');

const onChooseTerm = vi.fn();
const onViewerStateChange = vi.fn();

const Harness = ({ selectedResult }: { selectedResult?: IDecodeComparableResult }) => {
    const [viewerState, setViewerState] = useState<IViewerState>({ x: 4, y: -6, z: 18, threshold: 25 });
    return (
        <DecodeComparison
            sourceLabel="NeuroVault image 308"
            selectedResult={selectedResult}
            visualization={visualization}
            viewerState={viewerState}
            onChooseTerm={onChooseTerm}
            onViewerStateChange={(nextState) => {
                onViewerStateChange(nextState);
                setViewerState(nextState);
            }}
        />
    );
};

beforeEach(() => {
    canvasMock.props = [];
    canvasMock.suspend = false;
    onChooseTerm.mockClear();
    onViewerStateChange.mockClear();
});

it('does not evaluate the NiiVue boundary before a mapped result is selected', () => {
    render(<Harness />);

    expect(screen.getByText(/Select a mapped term or study/)).toBeVisible();
    expect(canvasMock.evaluations).toBe(0);
});

it('renders premotor in synchronized submitted-map and association-map panes', async () => {
    const user = userEvent.setup();
    render(<Harness selectedResult={premotor} />);

    expect(await screen.findByRole('region', { name: 'Submitted map viewer' })).toHaveTextContent(
        'generic-mni, response-control'
    );
    expect(screen.getByRole('region', { name: 'premotor association map viewer' })).toHaveTextContent(
        'generic-mni, premotor-map'
    );

    await user.click(screen.getByRole('button', { name: 'Move Submitted map viewer crosshair' }));
    expect(onViewerStateChange).toHaveBeenLastCalledWith({ x: -42, y: 8, z: 30, threshold: 25 });
    expect(canvasMock.props.filter(({ ariaLabel }) => ariaLabel.includes('viewer')).at(-1)?.coordinate).toEqual({
        x: -42,
        y: 8,
        z: 30,
    });

    await user.click(screen.getByRole('button', { name: 'Move premotor association map viewer crosshair' }));
    expect(onViewerStateChange).toHaveBeenLastCalledWith({ x: 18, y: -12, z: 44, threshold: 25 });
});

it.each([
    ['x', -90, 90],
    ['y', -126, 90],
    ['z', -72, 108],
] as const)('reuses the MNI %s bounds and clamps both out-of-range directions', (axis, min, max) => {
    render(<Harness selectedResult={premotor} />);
    const field = screen.getByRole('spinbutton', { name: `Comparison ${axis} coordinate` });

    expect(field).toHaveAttribute('min', String(min));
    expect(field).toHaveAttribute('max', String(max));

    fireEvent.change(field, { target: { value: String(max) } });
    expect(onViewerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ [axis]: max }));
    fireEvent.change(field, { target: { value: String(max + 1) } });
    expect(onViewerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ [axis]: max }));
    expect(field).toHaveValue(max);
    fireEvent.change(field, { target: { value: String(min) } });
    expect(onViewerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ [axis]: min }));
    fireEvent.change(field, { target: { value: String(min - 1) } });
    expect(onViewerStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ [axis]: min }));
    expect(field).toHaveValue(min);
});

it('uses unique component-scoped opacity IDs and matching labels with the top viewer present', async () => {
    render(
        <>
            <DecodeViewer
                source={{ kind: 'neurovault', imageId: '308' }}
                visualization={visualization}
                atlasReadouts={[]}
                value={{ x: 4, y: -6, z: 18, threshold: 25 }}
                onChange={vi.fn()}
            />
            <Harness selectedResult={premotor} />
        </>
    );

    await screen.findByRole('region', { name: 'Submitted map viewer' });
    const ids = [
        screen.getByRole('slider', { name: 'Input opacity' }).id,
        screen.getByRole('slider', { name: 'Input map opacity' }).id,
    ];
    expect(ids).toEqual(['decode-viewer-input-opacity', 'decode-comparison-input-opacity']);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(document.querySelector(`label[for="${id}"]`)).toBeInTheDocument());
});

it('composes a three-volume overlay with independent signed display settings and preserves them by asset', async () => {
    const user = userEvent.setup();
    render(<Harness selectedResult={premotor} />);
    await screen.findByRole('region', { name: 'Submitted map viewer' });

    await user.click(screen.getByRole('button', { name: 'Report Submitted map viewer range' }));
    await user.click(screen.getByRole('button', { name: 'Report premotor association map viewer range' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Input map opacity' }), { target: { value: '0.45' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Comparison map opacity' }), { target: { value: '0.35' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Positive input threshold' }), {
        target: { value: '2.5' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Positive comparison threshold' }), {
        target: { value: '3.25' },
    });

    await user.click(screen.getByRole('radio', { name: 'Overlay' }));
    const overlay = await screen.findByRole('region', { name: 'Submitted and premotor map overlay viewer' });
    expect(overlay).toHaveTextContent('generic-mni, response-control, premotor-map');
    expect(screen.getByText('Input layer · NeuroVault image 308')).toBeVisible();
    expect(screen.getByText('Comparison layer · premotor association map')).toBeVisible();

    const overlayProps = canvasMock.props.filter(({ ariaLabel }) => ariaLabel.includes('overlay viewer')).at(-1)!;
    expect(overlayProps.displayByVolumeId['response-control']).toMatchObject({
        opacity: 0.45,
        colormap: 'warm',
        colormapNegative: 'winter',
        calMin: 2.5,
    });
    expect(overlayProps.displayByVolumeId['premotor-map']).toMatchObject({
        opacity: 0.35,
        colormap: 'winter',
        colormapNegative: 'warm',
        calMin: 3.25,
    });

    await user.click(screen.getByRole('radio', { name: 'Side by side' }));
    expect(screen.getByRole('slider', { name: 'Input map opacity' })).toHaveValue('0.45');
    expect(screen.getByRole('slider', { name: 'Comparison map opacity' })).toHaveValue('0.35');
});

it('resolves visual and posterior-cingulate maps by stable result ID and restores each map settings', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness selectedResult={visual} />);

    expect(await screen.findByRole('region', { name: 'visual association map viewer' })).toHaveTextContent(
        'generic-mni, visual-map'
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Comparison map opacity' }), {
        target: { value: '0.25' },
    });

    rerender(<Harness selectedResult={posteriorCingulate} />);
    expect(await screen.findByRole('region', { name: 'posterior cingulate association map viewer' })).toHaveTextContent(
        'generic-mni, posterior-cingulate-map'
    );
    expect(screen.getByRole('slider', { name: 'Comparison map opacity' })).toHaveValue('0.65');
    fireEvent.change(screen.getByRole('slider', { name: 'Comparison map opacity' }), {
        target: { value: '0.55' },
    });

    rerender(<Harness selectedResult={{ ...visual, label: 'premotor', mapLabel: 'misleading label' }} />);
    expect(await screen.findByRole('region', { name: 'premotor association map viewer' })).toHaveTextContent(
        'generic-mni, visual-map'
    );
    expect(screen.getByRole('slider', { name: 'Comparison map opacity' })).toHaveValue('0.25');
});

it('keeps the submitted map and input controls when the selected comparison map is unavailable', async () => {
    render(<Harness selectedResult={unmapped} />);

    const unavailable = screen.getByRole('status', { name: 'Unavailable comparison map' });
    expect(within(unavailable).getByText('Comparison map not included in this walkthrough')).toBeVisible();
    expect(within(unavailable).getByText('Selected result: executive')).toBeVisible();
    expect(await screen.findByRole('region', { name: 'Submitted map viewer' })).toHaveTextContent(
        'generic-mni, response-control'
    );
    expect(screen.getByRole('slider', { name: 'Input map opacity' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: 'Comparison map opacity' })).not.toBeInTheDocument();
    expect(screen.queryByText('https://should-not-drive-lookup.test/executive.nii.gz')).not.toBeInTheDocument();
});

it('names each suspended canvas fallback for its pane and overlay', async () => {
    const user = userEvent.setup();
    canvasMock.suspend = true;
    render(<Harness selectedResult={premotor} />);

    expect(screen.getByRole('status', { name: 'Submitted map loading' })).toHaveTextContent('Loading Submitted map…');
    expect(screen.getByRole('status', { name: 'premotor association map loading' })).toHaveTextContent(
        'Loading premotor association map…'
    );

    await user.click(screen.getByRole('radio', { name: 'Overlay' }));
    expect(screen.getByRole('status', { name: 'Submitted and premotor map overlay loading' })).toHaveTextContent(
        'Loading Submitted and premotor map overlay…'
    );
});

it('receives the recorded visualization through the result workspace', async () => {
    const preview: IDecodePreview = {
        modelId: 'neurovlm',
        modelVersion: 'fixture-v1',
        parameters: { resultLimit: 20 },
        termMetric: 'correlation',
        provenance: { kind: 'illustrative', label: 'Recorded route test', version: 'fixture-v1' },
        terms: [],
        studies: [],
        modelSummary: { narrative: '' },
        atlasReadouts: [],
        visualization,
    };

    render(
        <DecodeResults
            activeView="compare"
            preview={preview}
            model={DECODE_MODELS[0]}
            selectedResult={premotor}
            sourceLabel="NeuroVault image 308"
            viewerState={{ x: 4, y: -6, z: 18, threshold: 25 }}
            onViewChange={vi.fn()}
            onSelectComparison={vi.fn()}
            onViewerStateChange={vi.fn()}
        />
    );

    expect(await screen.findByRole('region', { name: 'Submitted map viewer' })).toHaveTextContent(
        'generic-mni, response-control'
    );
});
