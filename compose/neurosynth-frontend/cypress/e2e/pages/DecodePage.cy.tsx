describe('DecodePage', () => {
    const GOLDEN_ASSET_PREFIX = '/decoder/examples/neurovault-308/';

    const atlasResponse = (x: number, y: number, z: number) => {
        const coordinateLabel = `x ${x}, y ${y}, z ${z}`;

        return {
            coordinate: { x, y, z },
            space: 'MNI152',
            atlases: [
                {
                    id: 'harvardoxford-cortical',
                    name: 'Harvard–Oxford Cortical Structural Atlas',
                    category: 'anatomical',
                    valueType: 'probability',
                    version: '2103.0',
                    sourceUrl: 'https://example.test/atlases/harvard-oxford-cortical',
                    matches: [
                        {
                            id: 'harvardoxford-cortical:1',
                            label: `Cortical match at ${coordinateLabel}`,
                            value: 54,
                        },
                    ],
                },
                {
                    id: 'harvardoxford-subcortical',
                    name: 'Harvard–Oxford Subcortical Structural Atlas',
                    category: 'anatomical',
                    valueType: 'probability',
                    version: '2103.0',
                    sourceUrl: 'https://example.test/atlases/harvard-oxford-subcortical',
                    matches: [
                        {
                            id: 'harvardoxford-subcortical:1',
                            label: `Subcortical match at ${coordinateLabel}`,
                            value: 42,
                        },
                    ],
                },
                {
                    id: 'difumo-512',
                    name: 'DiFuMo 512',
                    category: 'functional',
                    valueType: 'loading',
                    version: '1.0',
                    sourceUrl: 'https://example.test/atlases/difumo-512',
                    matches: [
                        { id: 'difumo-512:1', label: `DiFuMo match 1 at ${coordinateLabel}`, value: 0.71234 },
                        { id: 'difumo-512:2', label: `DiFuMo match 2 at ${coordinateLabel}`, value: 0.28567 },
                        { id: 'difumo-512:3', label: `DiFuMo match 3 at ${coordinateLabel}`, value: 0.1044 },
                        {
                            id: 'difumo-512:4',
                            label: `A deliberately long DiFuMo coordinate-encoded functional mode at ${coordinateLabel} that wraps on narrow screens`,
                            value: 0.0312,
                        },
                    ],
                },
            ],
        };
    };

    const interceptAtlasReadout = ({ failOnce = false }: { failOnce?: boolean } = {}) => {
        let shouldFail = failOnce;

        cy.intercept({ method: 'GET', url: '**/api/atlases/readout*', middleware: true }, (request) => {
            const url = new URL(request.url);
            const x = Number(url.searchParams.get('x'));
            const y = Number(url.searchParams.get('y'));
            const z = Number(url.searchParams.get('z'));

            expect(Number.isFinite(x), 'atlas x coordinate').to.equal(true);
            expect(Number.isFinite(y), 'atlas y coordinate').to.equal(true);
            expect(Number.isFinite(z), 'atlas z coordinate').to.equal(true);

            if (shouldFail) {
                shouldFail = false;
                request.reply({
                    statusCode: 503,
                    headers: { 'content-type': 'application/problem+json' },
                    body: {
                        type: 'https://neurostore.org/problems/atlas-readout-unavailable',
                        title: 'Atlas readout unavailable',
                        status: 503,
                        detail: 'The atlas service is temporarily unavailable.',
                    },
                });
                return;
            }

            request.reply({ statusCode: 200, body: atlasResponse(x, y, z) });
        }).as('atlasReadout');
    };

    const blockApiRequests = () => {
        interceptAtlasReadout();
        cy.intercept({ hostname: 'localhost', pathname: '/api/**', resourceType: 'xhr' }, (request) =>
            request.destroy()
        ).as('blockedApiXhr');
        cy.intercept({ hostname: 'localhost', pathname: '/api/**', resourceType: 'fetch' }, (request) =>
            request.destroy()
        ).as('blockedApiFetch');
    };

    const expectNoBlockedApiRequests = () => {
        cy.get('@blockedApiXhr.all').should('have.length', 0);
        cy.get('@blockedApiFetch.all').should('have.length', 0);
    };

    const guardRecordedWalkthroughNetwork = (atlasOptions: { failOnce?: boolean } = {}) => {
        const successfulLocalAssets: string[] = [];

        interceptAtlasReadout(atlasOptions);
        cy.intercept('GET', `${GOLDEN_ASSET_PREFIX}**`, (request) => {
            delete request.headers['if-modified-since'];
            delete request.headers['if-none-match'];
            request.headers['cache-control'] = 'no-cache';
            request.continue((response) => {
                expect(response.statusCode, `${new URL(request.url).pathname} status`).to.equal(200);
                successfulLocalAssets.push(new URL(request.url).pathname);
            });
        }).as('goldenAsset');
        cy.intercept({ hostname: 'localhost', pathname: '/api/**' }, (request) => request.destroy()).as(
            'blockedGoldenApi'
        );
        cy.intercept(/^https?:\/\/(?:[^./]+\.)*(?:neurovault|neurosynth)\.org\/.*/, (request) => request.destroy()).as(
            'blockedGoldenExternal'
        );

        return successfulLocalAssets;
    };

    const expectNoRecordedWalkthroughBackendRequests = () => {
        cy.get('@blockedGoldenApi.all').should('have.length', 0);
        cy.get('@blockedGoldenExternal.all').should('have.length', 0);
    };

    const expectSuccessfulAsset = (successfulLocalAssets: string[], filename: string) => {
        cy.wrap(successfulLocalAssets, { log: false }).should('include', `${GOLDEN_ASSET_PREFIX}${filename}`);
    };

    const expectViewerReady = (ariaLabel: string) => {
        cy.get(`[role="region"][aria-label="${ariaLabel}"]`)
            .should('be.visible')
            .and('have.attr', 'aria-busy', 'false')
            .within(() => {
                cy.get('[role="alert"]').should('not.exist');
                cy.contains('Interactive map unavailable because WebGL2 is not supported.').should('not.exist');
                cy.get('canvas').should(($canvas) => {
                    const context = ($canvas[0] as HTMLCanvasElement).getContext('webgl2');
                    expect(context, `${ariaLabel} WebGL2 context`).not.to.be.null;
                    expect(context?.isContextLost(), `${ariaLabel} WebGL2 context lost`).to.equal(false);
                });
            });
    };

    const expectViewerCoordinate = (ariaLabel: string, x: number) => {
        cy.get(`[role="region"][aria-label="${ariaLabel}"]`)
            .next('p[aria-live="polite"]')
            .should('contain.text', `MNI x ${x},`);
    };

    const fieldByLabel = (label: string) =>
        cy
            .contains('label', label)
            .invoke('attr', 'for')
            .then((id) => cy.get(`#${id}`));

    const setRangeValue = (ariaLabel: string, value: string) => {
        cy.get(`input[aria-label="${ariaLabel}"]`).then(($input) => {
            const input = $input[0] as HTMLInputElement;
            const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeValueSetter?.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    };

    const previewPublicNeurovaultImage = () => {
        cy.contains('[role="tab"]', 'NeuroVault image').click();
        cy.contains('label', 'NeuroVault image URL or ID')
            .parent()
            .find('input')
            .type('https://neurovault.org/images/25/');
        cy.contains('label', 'Map type').parent().find('select').select('z');
        cy.contains('label', 'Analysis level').parent().find('select').select('group');
        cy.contains('label', 'Modality').parent().find('select').select('fmri-bold');
        cy.contains('label', 'Number of subjects').parent().find('input').type('121');
        cy.contains('button', 'Preview example results').click();
    };

    it('reviews the complete fixture-backed flow for public NeuroVault image 25', () => {
        cy.viewport(1440, 900);
        blockApiRequests();
        cy.visit('/decode');

        previewPublicNeurovaultImage();

        cy.contains('Example viewer').should('be.visible');
        cy.contains('Illustrative example').should('be.visible');
        cy.get('button[aria-label="Select visual perception for comparison"]').click();
        cy.contains('[role="tab"]', 'Associated studies').click();
        cy.contains('Matches input').should('be.visible');
        cy.contains('[role="tab"]', 'Compare maps').click();
        cy.contains('label', 'Overlay').click();
        cy.get('input[aria-label="Input map opacity"]').should('be.visible');
        expectNoBlockedApiRequests();
    });

    it('keeps mobile comparison panes in order without page overflow', () => {
        cy.viewport(390, 844);
        blockApiRequests();
        cy.visit('/decode');

        previewPublicNeurovaultImage();
        cy.contains('button', 'Previous page')
            .should('be.visible')
            .then(($previous) => {
                cy.contains('button', 'Compare selected result')
                    .should('be.visible')
                    .then(($compare) => {
                        expect($compare[0].getBoundingClientRect().top).to.be.at.least(
                            $previous[0].getBoundingClientRect().bottom
                        );
                    });
            });
        cy.get('button[aria-label="Select visual perception for comparison"]').click();
        cy.contains('button', 'Compare selected result').click();
        cy.get('[role="region"][aria-label="Input map pane"], [role="region"][aria-label="Comparison map pane"]')
            .should('be.visible')
            .and('have.length', 2)
            .then(($panes) => {
                expect($panes[0]).to.have.attr('aria-label', 'Input map pane');
                expect($panes[1]).to.have.attr('aria-label', 'Comparison map pane');
                expect($panes[1].getBoundingClientRect().top).to.be.at.least($panes[0].getBoundingClientRect().bottom);
            });
        cy.document().then((document) => {
            expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
        });
        expectNoBlockedApiRequests();
    });

    it('reviews live atlas coordinates beside the recorded NeuroVault 308 maps without contacting other backends', () => {
        cy.viewport(1440, 900);
        const successfulLocalAssets = guardRecordedWalkthroughNetwork();
        cy.visit('/decode?example=neurovault-308');

        cy.wait('@atlasReadout').then(({ request, response }) => {
            const url = new URL(request.url);
            expect(Object.fromEntries(url.searchParams.entries())).to.deep.equal({ x: '0', y: '0', z: '0' });
            expect(response?.statusCode).to.equal(200);
        });

        cy.contains('Recorded Neurosynth Pearson example').should('be.visible');
        cy.contains('terms_20k reference dataset').should('be.visible');
        cy.contains('NeuroVault image 308').should('be.visible');
        cy.get('[role="note"] li').then(($sources) => {
            expect($sources).to.have.length(3);
            [...$sources].slice(1).forEach((source, index) => {
                expect(source.getBoundingClientRect().top).to.be.at.least(
                    $sources[index].getBoundingClientRect().bottom
                );
            });
        });
        cy.get('#decode-result-panel-terms tbody tr').should('have.length', 20);
        expectSuccessfulAsset(successfulLocalAssets, 'manifest.json');
        expectSuccessfulAsset(successfulLocalAssets, 'generic-mni.nii.gz');
        expectSuccessfulAsset(successfulLocalAssets, 'response-control.nii.gz');
        expectViewerReady('Recorded decoder maps');
        cy.contains('Cortical match at x 0, y 0, z 0').should('be.visible');

        cy.get('button[aria-label="Select premotor for comparison"]').click();
        cy.contains('button', 'Compare selected result').click();
        cy.contains('premotor association map').should('be.visible');
        expectSuccessfulAsset(successfulLocalAssets, 'premotor-association-z.nii.gz');
        expectViewerReady('Submitted map viewer');
        expectViewerReady('premotor association map viewer');

        fieldByLabel('Comparison x coordinate').clear().type('12');
        cy.wait('@atlasReadout').then(({ request, response }) => {
            const url = new URL(request.url);
            expect(Object.fromEntries(url.searchParams.entries())).to.deep.equal({ x: '12', y: '0', z: '0' });
            expect(response?.statusCode).to.equal(200);
        });
        expectViewerCoordinate('Submitted map viewer', 12);
        expectViewerCoordinate('premotor association map viewer', 12);
        cy.contains('MNI152 coordinate: x 12, y 0, z 0 mm').should('be.visible');
        cy.contains('Cortical match at x 12, y 0, z 0').should('be.visible');
        cy.get('button[aria-label="Show all nonzero matches for DiFuMo 512"]').click();
        cy.contains('A deliberately long DiFuMo coordinate-encoded functional mode at x 12, y 0, z 0').should(
            'be.visible'
        );
        expectViewerReady('Submitted map viewer');
        expectViewerReady('premotor association map viewer');
        cy.contains('label', 'Overlay').click();
        expectViewerReady('Submitted and premotor map overlay viewer');
        setRangeValue('Input map opacity', '0.45');
        setRangeValue('Comparison map opacity', '0.35');
        cy.get('input[aria-label="Input map opacity"]').should('have.value', '0.45');
        cy.get('input[aria-label="Comparison map opacity"]').should('have.value', '0.35');

        cy.contains('[role="tab"]', 'Terms').click();
        cy.get('button[aria-label="Select visual for comparison"]').click();
        cy.contains('[role="tab"]', 'Compare maps').click();
        cy.contains('Comparison layer · visual association map').should('be.visible');
        cy.contains('Comparison layer · premotor association map').should('not.exist');
        fieldByLabel('Comparison x coordinate').should('have.value', '12');
        cy.get('input[aria-label="Input map opacity"]').should('have.value', '0.45');
        cy.get('input[aria-label="Comparison map opacity"]').should('have.value', '0.65');
        expectViewerReady('Submitted and visual map overlay viewer');
        expectSuccessfulAsset(successfulLocalAssets, 'visual-association-z.nii.gz');

        cy.contains('[role="tab"]', 'Terms').click();
        cy.get('button[aria-label="Select premotor for comparison"]').click();
        cy.contains('[role="tab"]', 'Compare maps').click();
        cy.contains('Comparison layer · premotor association map').should('be.visible');
        cy.get('input[aria-label="Comparison map opacity"]').should('have.value', '0.35');
        expectViewerReady('Submitted and premotor map overlay viewer');
        expectNoRecordedWalkthroughBackendRequests();
    });

    it('recovers a local atlas 503 at the current coordinate without losing recorded maps or results', () => {
        cy.viewport(1440, 900);
        guardRecordedWalkthroughNetwork({ failOnce: true });
        cy.visit('/decode?example=neurovault-308');

        cy.wait('@atlasReadout').its('response.statusCode').should('equal', 503);
        cy.location('pathname').should('equal', '/decode');
        cy.location('search').should('equal', '?example=neurovault-308');
        cy.get('#decode-result-panel-terms tbody tr').should('have.length', 20);
        expectViewerReady('Recorded decoder maps');
        cy.get('[role="alert"]').should('contain.text', 'Atlas readout unavailable');
        cy.contains('The map and decoder results are unaffected').should('be.visible');

        cy.contains('button', 'Retry atlas readout').click();
        cy.wait('@atlasReadout').then(({ request, response }) => {
            const url = new URL(request.url);
            expect(Object.fromEntries(url.searchParams.entries())).to.deep.equal({ x: '0', y: '0', z: '0' });
            expect(response?.statusCode).to.equal(200);
        });

        cy.get('[role="alert"]').should('not.exist');
        cy.contains('Cortical match at x 0, y 0, z 0').should('be.visible');
        cy.get('#decode-result-panel-terms tbody tr').should('have.length', 20);
        expectViewerReady('Recorded decoder maps');
        cy.location('pathname').should('equal', '/decode');
        cy.location('search').should('equal', '?example=neurovault-308');
        expectNoRecordedWalkthroughBackendRequests();
    });

    it('keeps the negative recorded comparison readable and ordered on mobile', () => {
        cy.viewport(390, 844);
        const successfulLocalAssets = guardRecordedWalkthroughNetwork();
        cy.visit('/decode?example=neurovault-308');

        cy.wait('@atlasReadout').its('response.statusCode').should('equal', 200);
        cy.get('button[aria-label="Show all nonzero matches for DiFuMo 512"]').click();
        cy.document().then((applicationDocument) => {
            cy.contains('A deliberately long DiFuMo coordinate-encoded functional mode at x 0, y 0, z 0')
                .parents('li')
                .find('p')
                .then(($rows) => {
                    const label = $rows[0].getBoundingClientRect();
                    const loading = $rows[1].getBoundingClientRect();
                    expect(loading.top).to.be.at.least(label.bottom);
                    expect(label.right).to.be.at.most(applicationDocument.documentElement.clientWidth);
                });
        });

        cy.get('button[aria-label="Select posterior cingulate for comparison"]')
            .scrollIntoView()
            .parents('tr')
            .within(() => cy.contains('-0.307').scrollIntoView().should('be.visible'));
        cy.get('button[aria-label="Select posterior cingulate for comparison"]').click();
        cy.contains('button', 'Compare selected result').click();
        cy.contains(/^Submitted map$/)
            .should('be.visible')
            .then(($submitted) => {
                cy.contains(/^posterior cingulate association map$/)
                    .should('be.visible')
                    .then(($comparison) => {
                        expect($comparison[0].getBoundingClientRect().top).to.be.at.least(
                            $submitted[0].getBoundingClientRect().bottom
                        );
                    });
            });
        expectSuccessfulAsset(successfulLocalAssets, 'posterior-cingulate-association-z.nii.gz');
        expectViewerReady('Submitted map viewer');
        expectViewerReady('posterior cingulate association map viewer');

        cy.contains('label', 'Overlay').click();
        cy.contains('Comparison layer · posterior cingulate association map').should('be.visible');
        expectViewerReady('Submitted and posterior cingulate map overlay viewer');
        cy.document().then((document) => {
            expect(document.documentElement.scrollWidth).to.equal(document.documentElement.clientWidth);
        });
        expectNoRecordedWalkthroughBackendRequests();
    });
});
