import snapshot from './Decode.vocabulary.json';
import type { ICognitiveConcept } from './Decode.types';

type CognitiveAtlasSnapshotRecord = {
    id?: unknown;
    name?: unknown;
};

const LEGACY_COGNITIVE_ATLAS_ID = /^trm_[0-9a-f]{13}$/;

export const COGNITIVE_ATLAS_SNAPSHOT = {
    retrievedAt: '2026-08-26',
    source: 'https://www.cognitiveatlas.org/api/v-alpha/concept',
} as const;

export const COGNITIVE_ATLAS_CONCEPTS: ICognitiveConcept[] = Array.from(
    new Map(
        (snapshot as CognitiveAtlasSnapshotRecord[])
            .filter(
                (record) =>
                    typeof record.id === 'string' &&
                    LEGACY_COGNITIVE_ATLAS_ID.test(record.id) &&
                    typeof record.name === 'string'
            )
            .map((record) => [
                record.id as string,
                { id: record.id as string, label: record.name as string, vocabulary: 'Cognitive Atlas' as const },
            ])
    ).values()
).sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
