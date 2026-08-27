import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureRoot = resolve(process.cwd(), 'public/decoder/examples/neurovault-308');

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
