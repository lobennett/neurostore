describe('DecodePage', () => {
    const blockApiRequests = () => {
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
        cy.get('button[aria-label="Select visual for comparison"]').click();
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
        cy.get('button[aria-label="Select visual for comparison"]').click();
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
});
