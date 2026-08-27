import { Niivue } from '@niivue/niivue';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { IDecodeVolumeAsset } from '../Decode.types';

export type DecodeSliceType = 'multiplanar' | 'axial' | 'coronal' | 'sagittal';

export interface IDecodeCoordinate {
    x: number;
    y: number;
    z: number;
}

export interface IDecodeVolumeDisplay {
    opacity: number;
    colormap: string;
    colormapNegative: string;
    calMin: number;
    calMax: number;
    calMinNegative: number;
    calMaxNegative: number;
}

export interface IDecodeVolumeRange {
    /** The unthresholded minimum intensity reported by the loaded NIfTI volume. */
    globalMin: number;
    /** The unthresholded maximum intensity reported by the loaded NIfTI volume. */
    globalMax: number;
}

export type DecodeValuesByVolumeId = Record<string, number>;
export type DecodeVolumeRangesByVolumeId = Record<string, IDecodeVolumeRange>;

export interface DecodeNiiVueCanvasProps {
    ariaLabel: string;
    volumes: IDecodeVolumeAsset[];
    coordinate: IDecodeCoordinate;
    sliceType: DecodeSliceType;
    crosshairs: boolean;
    displayByVolumeId: Record<string, IDecodeVolumeDisplay>;
    onCoordinateChange: (coordinate: IDecodeCoordinate) => void;
    onValuesChange: (valuesByVolumeId: DecodeValuesByVolumeId) => void;
    onVolumeRangesChange: (rangesByVolumeId: DecodeVolumeRangesByVolumeId) => void;
}

type LoadState =
    | { status: 'loading'; filenames: string[] }
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | { status: 'unsupported' };

type LoadedVolume = Awaited<ReturnType<Niivue['addVolumeFromUrl']>>;

interface NiiVueLifecycle {
    niivue: Niivue;
    webgl: WebGL2RenderingContext;
    attached: boolean;
    attachSettled: boolean;
    disposeRequested: boolean;
    disposed: boolean;
    pendingLoads: number;
}

const noLocationChange = () => undefined;

const disposeLifecycleIfIdle = (lifecycle: NiiVueLifecycle): void => {
    if (!lifecycle.disposeRequested || !lifecycle.attachSettled || lifecycle.pendingLoads > 0 || lifecycle.disposed) {
        return;
    }

    lifecycle.disposed = true;
    [...lifecycle.niivue.volumes].reverse().forEach((volume) => lifecycle.niivue.removeVolume(volume));
    lifecycle.webgl.getExtension('WEBGL_lose_context')?.loseContext();
};

const requestLifecycleDisposal = (lifecycle: NiiVueLifecycle): void => {
    lifecycle.disposeRequested = true;
    lifecycle.niivue.onLocationChange = noLocationChange;
    disposeLifecycleIfIdle(lifecycle);
};

const sliceTypeFor = (niivue: Niivue, sliceType: DecodeSliceType): Parameters<Niivue['setSliceType']>[0] => {
    switch (sliceType) {
        case 'axial':
            return niivue.sliceTypeAxial;
        case 'coronal':
            return niivue.sliceTypeCoronal;
        case 'sagittal':
            return niivue.sliceTypeSagittal;
        default:
            return niivue.sliceTypeMultiplanar;
    }
};

const mapLabel = (filename: string): string => filename.replace(/\.nii(?:\.gz)?$/i, '');

const applyCoordinate = (niivue: Niivue, coordinate: IDecodeCoordinate): void => {
    niivue.scene.crosshairPos = niivue.mm2frac([coordinate.x, coordinate.y, coordinate.z]);
    niivue.drawScene();
};

const applyDisplay = (
    niivue: Niivue,
    loadedByAssetId: Map<string, LoadedVolume>,
    displayByVolumeId: Record<string, IDecodeVolumeDisplay>
): void => {
    let changed = false;
    Object.entries(displayByVolumeId).forEach(([assetId, display]) => {
        const volume = loadedByAssetId.get(assetId);
        if (!volume) return;

        volume.opacity = display.opacity;
        volume.colormap = display.colormap;
        volume.colormapNegative = display.colormapNegative;
        volume.cal_min = display.calMin;
        volume.cal_max = display.calMax;
        volume.cal_minNeg = display.calMinNegative;
        volume.cal_maxNeg = display.calMaxNegative;
        changed = true;
    });
    if (changed) niivue.updateGLVolume();
};

const DecodeNiiVueCanvas = ({
    ariaLabel,
    volumes,
    coordinate,
    sliceType,
    crosshairs,
    displayByVolumeId,
    onCoordinateChange,
    onValuesChange,
    onVolumeRangesChange,
}: DecodeNiiVueCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const niivueRef = useRef<Niivue | null>(null);
    const lifecycleRef = useRef<NiiVueLifecycle | null>(null);
    const loadGeneration = useRef(0);
    const loadedByAssetId = useRef(new Map<string, LoadedVolume>());
    const assetIdByNiiVueId = useRef(new Map<string, string>());
    const callbacksRef = useRef({ onCoordinateChange, onValuesChange, onVolumeRangesChange });
    const displayRef = useRef(displayByVolumeId);
    const coordinateRef = useRef(coordinate);
    const [attachedVersion, setAttachedVersion] = useState(0);
    const [retryCount, setRetryCount] = useState(0);
    const [loadState, setLoadState] = useState<LoadState>({
        status: 'loading',
        filenames: volumes.map(({ filename }) => filename),
    });
    const [summaryCoordinate, setSummaryCoordinate] = useState(coordinate);
    const [valuesByVolumeId, setValuesByVolumeId] = useState<DecodeValuesByVolumeId>({});

    callbacksRef.current = { onCoordinateChange, onValuesChange, onVolumeRangesChange };
    displayRef.current = displayByVolumeId;
    coordinateRef.current = coordinate;

    const volumeSignature = useMemo(
        () => volumes.map(({ id, url, filename }) => `${id}\u0000${url}\u0000${filename}`).join('\u0001'),
        [volumes]
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const webgl = canvas.getContext('webgl2');
        if (!webgl) {
            setLoadState({ status: 'unsupported' });
            return;
        }

        const niivue = new Niivue();
        const lifecycle: NiiVueLifecycle = {
            niivue,
            webgl,
            attached: false,
            attachSettled: false,
            disposeRequested: false,
            disposed: false,
            pendingLoads: 0,
        };
        const generation = ++loadGeneration.current;
        let mounted = true;
        niivueRef.current = niivue;
        lifecycleRef.current = lifecycle;
        niivue.onLocationChange = (location: unknown) => {
            const typedLocation = location as {
                mm?: ArrayLike<number>;
                values?: Array<{ id?: string; name?: string; value?: number }>;
            };
            const mm = typedLocation.mm;
            if (!mm || mm.length < 3) return;

            const nextCoordinate = {
                x: Math.round(mm[0]),
                y: Math.round(mm[1]),
                z: Math.round(mm[2]),
            };
            const nextValues: DecodeValuesByVolumeId = {};
            typedLocation.values?.forEach((value) => {
                const assetId =
                    (value.id && assetIdByNiiVueId.current.get(value.id)) ||
                    (value.name && loadedByAssetId.current.has(value.name) ? value.name : undefined);
                if (assetId && typeof value.value === 'number') nextValues[assetId] = value.value;
            });

            setSummaryCoordinate(nextCoordinate);
            setValuesByVolumeId(nextValues);
            callbacksRef.current.onCoordinateChange(nextCoordinate);
            callbacksRef.current.onValuesChange(nextValues);
        };

        const attach = async () => {
            try {
                await niivue.attachToCanvas(canvas);
                lifecycle.attachSettled = true;
                lifecycle.attached = true;
                if (!mounted || generation !== loadGeneration.current) {
                    requestLifecycleDisposal(lifecycle);
                    return;
                }
                setAttachedVersion((version) => version + 1);
            } catch {
                lifecycle.attachSettled = true;
                requestLifecycleDisposal(lifecycle);
                if (!mounted || generation !== loadGeneration.current) return;
                setLoadState({ status: 'error', message: 'Could not initialize interactive map' });
            }
        };
        void attach();

        return () => {
            mounted = false;
            ++loadGeneration.current;
            requestLifecycleDisposal(lifecycle);

            loadedByAssetId.current.clear();
            assetIdByNiiVueId.current.clear();
            if (niivueRef.current === niivue) niivueRef.current = null;
            if (lifecycleRef.current === lifecycle) lifecycleRef.current = null;
        };
    }, [retryCount]);

    useEffect(() => {
        const niivue = niivueRef.current;
        const lifecycle = lifecycleRef.current;
        if (!niivue || !lifecycle?.attached || lifecycle.disposed) return;

        const generation = ++loadGeneration.current;
        const requestedVolumes = [...volumes];
        let active = true;
        lifecycle.pendingLoads += 1;
        setLoadState({ status: 'loading', filenames: requestedVolumes.map(({ filename }) => filename) });
        setValuesByVolumeId({});

        const isCurrent = () => active && generation === loadGeneration.current && niivueRef.current === niivue;
        const removeStaleVolume = (volume: LoadedVolume) => {
            if (lifecycle.attached && !lifecycle.disposed && niivue.volumes.includes(volume)) {
                niivue.removeVolume(volume);
            }
        };

        const load = async () => {
            [...niivue.volumes].reverse().forEach((volume) => niivue.removeVolume(volume));
            loadedByAssetId.current.clear();
            assetIdByNiiVueId.current.clear();

            for (const asset of requestedVolumes) {
                let loadedVolume: LoadedVolume;
                try {
                    loadedVolume = await niivue.addVolumeFromUrl({ url: asset.url, name: asset.filename });
                } catch {
                    if (!isCurrent()) return;
                    setLoadState({ status: 'error', message: `Could not load ${asset.filename}` });
                    return;
                }
                if (!isCurrent()) {
                    removeStaleVolume(loadedVolume);
                    return;
                }

                loadedByAssetId.current.set(asset.id, loadedVolume);
                assetIdByNiiVueId.current.set(loadedVolume.id, asset.id);
            }

            if (!isCurrent()) return;
            applyDisplay(niivue, loadedByAssetId.current, displayRef.current);
            niivue.setSliceType(sliceTypeFor(niivue, sliceType));
            niivue.setCrosshairWidth(crosshairs ? 1 : 0);
            applyCoordinate(niivue, coordinateRef.current);

            const rangesByVolumeId: DecodeVolumeRangesByVolumeId = {};
            loadedByAssetId.current.forEach((volume, assetId) => {
                if (typeof volume.global_min !== 'number' || typeof volume.global_max !== 'number') return;
                rangesByVolumeId[assetId] = { globalMin: volume.global_min, globalMax: volume.global_max };
            });
            callbacksRef.current.onVolumeRangesChange(rangesByVolumeId);
            setLoadState({ status: 'ready' });
        };
        void load().finally(() => {
            lifecycle.pendingLoads -= 1;
            disposeLifecycleIfIdle(lifecycle);
        });

        return () => {
            active = false;
            if (generation === loadGeneration.current) ++loadGeneration.current;
        };
    }, [attachedVersion, volumeSignature]);

    useEffect(() => {
        setSummaryCoordinate(coordinate);
        const niivue = niivueRef.current;
        const lifecycle = lifecycleRef.current;
        if (!niivue || !lifecycle?.attached || lifecycle.disposed || loadState.status !== 'ready') return;
        applyCoordinate(niivue, coordinate);
    }, [coordinate.x, coordinate.y, coordinate.z, loadState.status]);

    useEffect(() => {
        const niivue = niivueRef.current;
        const lifecycle = lifecycleRef.current;
        if (!niivue || !lifecycle?.attached || lifecycle.disposed || loadState.status !== 'ready') return;
        niivue.setSliceType(sliceTypeFor(niivue, sliceType));
        niivue.setCrosshairWidth(crosshairs ? 1 : 0);
        niivue.drawScene();
    }, [crosshairs, loadState.status, sliceType]);

    useEffect(() => {
        const niivue = niivueRef.current;
        const lifecycle = lifecycleRef.current;
        if (!niivue || !lifecycle?.attached || lifecycle.disposed || loadState.status !== 'ready') return;
        applyDisplay(niivue, loadedByAssetId.current, displayByVolumeId);
    }, [displayByVolumeId, loadState.status]);

    const summary = [
        `MNI x ${summaryCoordinate.x}, y ${summaryCoordinate.y}, z ${summaryCoordinate.z}`,
        ...volumes
            .filter(({ kind }) => kind !== 'anatomical')
            .map(({ id, filename }) => {
                const value = valuesByVolumeId[id];
                return `${mapLabel(filename)} value ${typeof value === 'number' ? value.toFixed(3) : 'unavailable'}`;
            }),
    ].join(' · ');

    return (
        <>
            <div
                role="region"
                aria-label={ariaLabel}
                aria-busy={loadState.status === 'loading'}
                style={{
                    aspectRatio: '1.35 / 1',
                    background: '#111827',
                    color: '#ffffff',
                    display: 'grid',
                    overflow: 'hidden',
                    placeItems: 'center',
                    position: 'relative',
                    width: '100%',
                }}
            >
                <canvas
                    aria-label={`${ariaLabel} interactive canvas`}
                    style={{ height: '100%', width: '100%' }}
                    ref={canvasRef}
                />
                {loadState.status === 'loading' && (
                    <div style={{ position: 'absolute' }} role="status">
                        Loading {loadState.filenames.join(', ')}
                    </div>
                )}
                {loadState.status === 'error' && (
                    <div style={{ position: 'absolute', textAlign: 'center' }} role="alert">
                        <div>{loadState.message}</div>
                        <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                            Retry
                        </button>
                    </div>
                )}
                {loadState.status === 'unsupported' && (
                    <div style={{ position: 'absolute', textAlign: 'center' }} role="status">
                        Interactive map unavailable because WebGL2 is not supported.
                    </div>
                )}
            </div>
            <p aria-live="polite">{summary}</p>
        </>
    );
};

export default DecodeNiiVueCanvas;
