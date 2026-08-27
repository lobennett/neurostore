import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFixtureDecodeAdapter } from './Decode.adapter';
import { loadGoldenWalkthrough } from './Decode.golden';

const fixtureRoot = resolve(process.cwd(), 'public/decoder/examples/neurovault-308');

afterEach(() => vi.unstubAllGlobals());

describe('NeuroVault 308 golden walkthrough assets', () => {
    it('pins the recorded response and five verified NIfTI files', async () => {
        const manifest = JSON.parse(await readFile(resolve(fixtureRoot, 'manifest.json'), 'utf8'));
        const assets = await Promise.all(
            manifest.assets.map(async (asset: { filename: string; bytes: number; sha256: string }) => {
                const bytes = await readFile(resolve(fixtureRoot, asset.filename));
                expect(bytes.byteLength).toBe(asset.bytes);
                expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
                return bytes.byteLength;
            })
        );

        expect(manifest.exampleId).toBe('neurovault-308');
        expect(manifest.input.neurovaultImageId).toBe('308');
        expect(manifest.method.label).toBe('Recorded Neurosynth Pearson example');
        expect(manifest.method.referenceDataset).toBe('terms_20k');
        expect(manifest.terms).toHaveLength(20);
        expect(manifest.terms.map(({ r }: { r: number }) => Math.abs(r))).toEqual(
            [...manifest.terms].map(({ r }: { r: number }) => Math.abs(r)).sort((a, b) => b - a)
        );
        expect(manifest.terms.find(({ id }: { id: string }) => id === 'posterior-cingulate')?.r).toBe(-0.307);
        expect(manifest.terms.filter(({ mapAssetId }: { mapAssetId?: string }) => mapAssetId)).toHaveLength(3);
        expect(assets.reduce((sum, bytes) => sum + bytes, 0)).toBe(7_553_823);
    });
});

describe('loadGoldenWalkthrough', () => {
    it('projects the recorded manifest into the canonical draft and preview', async () => {
        const manifest = await readFile(resolve(fixtureRoot, 'manifest.json'), 'utf8');
        const fetchStub = vi.fn().mockResolvedValue(new Response(manifest, { status: 200 }));
        vi.stubGlobal('fetch', fetchStub);

        const { draft, preview } = await loadGoldenWalkthrough();

        expect(draft.activeSource).toBe('neurovault');
        expect(draft.neurovaultReference).toBe('https://neurovault.org/images/308/');
        expect(draft.metadata).toMatchObject({
            mapType: 't',
            analysisLevel: 'group',
            modality: 'fmri-bold',
            subjectCount: '10',
        });
        expect(draft.modelId).toBe('neurosynth-pearson-recorded');
        expect(preview.provenance.kind).toBe('recorded');
        expect(preview.provenance.resultId).toBe('6a6a9cdb07754185b6218dff275112fe');
        expect(preview.provenance).toMatchObject({
            resultUrl: 'https://neurosynth.org/api/decode/6a6a9cdb07754185b6218dff275112fe',
            input: {
                imageId: '308',
                sourceUrl: 'https://neurovault.org/images/308/',
                collectionId: '63',
                collectionName: 'A test-retest fMRI dataset for motor, language and spatial attention functions',
                collectionUrl: 'https://neurovault.org/collections/63/',
                doi: '10.1186/2047-217X-2-6',
                doiUrl: 'https://doi.org/10.1186/2047-217X-2-6',
                license: 'CC0',
            },
            termMaps: {
                license: 'ODbL-derived',
                attribution: 'Neurosynth contributors and Neurosynth database; term maps are ODbL-derived',
            },
        });
        expect(preview.visualization?.comparisonByResultId['premotor'].id).toBe('premotor-map');
        expect(preview.visualization?.comparisonByResultId['premotor'].provenance.attribution).toBe(
            'Neurosynth database-derived association map; ODbL provenance'
        );
        expect(preview.terms.map(({ value }) => value)).toContain(-0.307);
    });

    it('routes only the canonical recorded request through the manifest adapter', async () => {
        const manifest = await readFile(resolve(fixtureRoot, 'manifest.json'), 'utf8');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(manifest, { status: 200 })));

        const preview = await createFixtureDecodeAdapter().preview(
            {
                source: { kind: 'neurovault', imageId: '308' },
                concepts: [],
                interpretation: '',
                modelId: 'neurosynth-pearson-recorded',
                modelVersion: 'terms_20k-recorded-2026-08-26',
                parameters: {},
                exampleId: 'neurovault-308',
            },
            'success'
        );

        expect(preview.provenance.kind).toBe('recorded');
    });

    it('rejects a manifest whose recorded result is not canonical', async () => {
        const manifest = JSON.parse(await readFile(resolve(fixtureRoot, 'manifest.json'), 'utf8'));
        manifest.method.resultId = 'different-recorded-result';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(manifest)));

        await expect(loadGoldenWalkthrough()).rejects.toThrow('does not match the canonical walkthrough');
    });
});
