import snapshot from './Decode.vocabulary.json';
import type { ICognitiveConcept } from './Decode.types';

type CognitiveAtlasSnapshotRecord = {
    id?: unknown;
    name?: unknown;
    definition_text?: unknown;
};

const LEGACY_COGNITIVE_ATLAS_ID = /^trm_[0-9a-f]{13}$/;
const EXCLUDED_PLACEHOLDER_IDS = new Set(['trm_4a7b128b8b2d0']);
const PLACEHOLDER_LABEL = /^test(?:\s+term)?$/i;

const hasSubstantiveDefinition = (record: CognitiveAtlasSnapshotRecord) =>
    typeof record.definition_text === 'string' &&
    record.definition_text.trim().length > 0 &&
    record.definition_text.trim().toLowerCase() !== 'none';

const preferCanonicalLabelRecord = (current: CognitiveAtlasSnapshotRecord, candidate: CognitiveAtlasSnapshotRecord) => {
    const definitionDifference =
        Number(hasSubstantiveDefinition(candidate)) - Number(hasSubstantiveDefinition(current));
    if (definitionDifference !== 0) return definitionDifference > 0 ? candidate : current;
    return String(candidate.id).localeCompare(String(current.id)) < 0 ? candidate : current;
};

export const COGNITIVE_ATLAS_SNAPSHOT = {
    retrievedAt: '2026-08-26',
    source: 'https://www.cognitiveatlas.org/api/v-alpha/concept',
} as const;

const canonicalRecordsByLabel = (snapshot as CognitiveAtlasSnapshotRecord[])
    .filter(
        (record) =>
            typeof record.id === 'string' &&
            LEGACY_COGNITIVE_ATLAS_ID.test(record.id) &&
            !EXCLUDED_PLACEHOLDER_IDS.has(record.id) &&
            typeof record.name === 'string' &&
            record.name.trim().length > 0 &&
            !PLACEHOLDER_LABEL.test(record.name.trim())
    )
    .reduce<Map<string, CognitiveAtlasSnapshotRecord>>((byLabel, record) => {
        const normalizedLabel = (record.name as string).trim().toLowerCase();
        const current = byLabel.get(normalizedLabel);
        byLabel.set(normalizedLabel, current ? preferCanonicalLabelRecord(current, record) : record);
        return byLabel;
    }, new Map());

export const COGNITIVE_ATLAS_CONCEPTS: ICognitiveConcept[] = Array.from(canonicalRecordsByLabel.values())
    .map((record) => ({
        id: record.id as string,
        label: (record.name as string).trim(),
        vocabulary: 'Cognitive Atlas' as const,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
