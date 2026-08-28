import type { IViewerState } from './Decode.types';

export type AtlasValueType = 'probability' | 'loading';
export type AtlasCategory = 'anatomical' | 'functional';
export type AtlasCoordinate = Pick<IViewerState, 'x' | 'y' | 'z'>;

export type AtlasMatch = {
    id: string;
    label: string;
    value: number;
};

export type AtlasReadout = {
    id: string;
    name: string;
    category: AtlasCategory;
    valueType: AtlasValueType;
    version: string;
    sourceUrl: string;
    matches: AtlasMatch[];
};

export type AtlasReadoutResponse = {
    coordinate: AtlasCoordinate;
    space: 'MNI152';
    atlases: AtlasReadout[];
};

type AtlasContract = Pick<AtlasReadout, 'id' | 'category' | 'valueType'>;

const ATLAS_CONTRACT: readonly AtlasContract[] = [
    {
        id: 'harvardoxford-cortical',
        category: 'anatomical',
        valueType: 'probability',
    },
    {
        id: 'harvardoxford-subcortical',
        category: 'anatomical',
        valueType: 'probability',
    },
    {
        id: 'difumo-512',
        category: 'functional',
        valueType: 'loading',
    },
];

function malformed(): never {
    throw new Error('Malformed atlas readout response');
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
    const keys = Object.keys(value);
    return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

const parseNonemptyString = (value: unknown): string => {
    if (typeof value !== 'string' || value.length === 0) return malformed();
    return value;
};

const parseSourceUrl = (value: unknown): string => {
    const sourceUrl = parseNonemptyString(value);
    try {
        const url = new URL(sourceUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') malformed();
    } catch {
        malformed();
    }
    return sourceUrl;
};

const parseFiniteNumber = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return malformed();
    return value;
};

const parseCoordinate = (value: unknown, requested: AtlasCoordinate): AtlasCoordinate => {
    if (!isRecord(value) || !hasExactKeys(value, ['x', 'y', 'z'])) return malformed();
    const coordinate = {
        x: parseFiniteNumber(value.x),
        y: parseFiniteNumber(value.y),
        z: parseFiniteNumber(value.z),
    };
    if (
        coordinate.x < -90 ||
        coordinate.x > 90 ||
        coordinate.y < -126 ||
        coordinate.y > 90 ||
        coordinate.z < -72 ||
        coordinate.z > 108
    )
        return malformed();
    if (coordinate.x !== requested.x || coordinate.y !== requested.y || coordinate.z !== requested.z)
        return malformed();
    return coordinate;
};

const parseMatch = (value: unknown): AtlasMatch => {
    if (!isRecord(value) || !hasExactKeys(value, ['id', 'label', 'value'])) return malformed();
    return {
        id: parseNonemptyString(value.id),
        label: parseNonemptyString(value.label),
        value: parseFiniteNumber(value.value),
    };
};

const parseAtlas = (value: unknown, contract: AtlasContract): AtlasReadout => {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['id', 'name', 'category', 'valueType', 'version', 'sourceUrl', 'matches']) ||
        !Array.isArray(value.matches)
    ) {
        return malformed();
    }

    const id = parseNonemptyString(value.id);
    if (id !== contract.id || value.category !== contract.category || value.valueType !== contract.valueType)
        return malformed();

    return {
        id,
        name: parseNonemptyString(value.name),
        category: contract.category,
        valueType: contract.valueType,
        version: parseNonemptyString(value.version),
        sourceUrl: parseSourceUrl(value.sourceUrl),
        matches: value.matches.map(parseMatch),
    };
};

export const parseAtlasReadoutResponse = (
    value: unknown,
    requestedCoordinate: AtlasCoordinate
): AtlasReadoutResponse => {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['coordinate', 'space', 'atlases']) ||
        value.space !== 'MNI152' ||
        !Array.isArray(value.atlases) ||
        value.atlases.length !== ATLAS_CONTRACT.length
    ) {
        return malformed();
    }

    const atlases = value.atlases.map((atlas, index) => parseAtlas(atlas, ATLAS_CONTRACT[index]));
    const atlasIds = new Set<string>();
    const matchIds = new Set<string>();
    atlases.forEach((atlas) => {
        if (atlasIds.has(atlas.id)) malformed();
        atlasIds.add(atlas.id);
        atlas.matches.forEach((match) => {
            if (matchIds.has(match.id)) malformed();
            matchIds.add(match.id);
        });
    });

    return {
        coordinate: parseCoordinate(value.coordinate, requestedCoordinate),
        space: 'MNI152',
        atlases,
    };
};
