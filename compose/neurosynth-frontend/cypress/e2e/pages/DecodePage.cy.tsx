describe('DecodePage', () => {
    it('previews a public NeuroVault image without crashing', () => {
        cy.visit('/decode');

        cy.contains('[role="tab"]', 'NeuroVault image').click();
        cy.contains('label', 'NeuroVault image URL or ID')
            .parent()
            .find('input')
            .type('https://neurovault.org/images/25/');
        cy.contains('label', 'Map type').parent().find('select').select('z');
        cy.contains('label', 'Analysis level').parent().find('select').select('group');
        cy.contains('label', 'Modality').parent().find('select').select('fmri-bold');
        cy.contains('label', 'Number of subjects').parent().find('input').type('121');

        cy.contains('button', 'Preview results').should('be.enabled').click();

        cy.get('[aria-label="Illustrative decoder results"]').should('be.visible');
        cy.contains('About decoding').should('be.visible');
    });
});
