import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import DecodeTermResults from './DecodeTermResults';

const terms = [
    { term: 'visual', correlation: 0.3 },
    { term: 'language', correlation: -0.15 },
];

it('renders positive and negative correlations on opposite sides of zero', () => {
    render(<DecodeTermResults terms={terms} onSelectTerm={vi.fn()} onCompareSelected={vi.fn()} />);

    expect(screen.getByLabelText('visual: positive correlation 0.300')).toHaveAttribute('data-direction', 'positive');
    expect(screen.getByLabelText('language: negative correlation -0.150')).toHaveAttribute('data-direction', 'negative');
});

it('selects a term with the keyboard without changing views', async () => {
    const onSelectTerm = vi.fn();
    render(<DecodeTermResults terms={terms} onSelectTerm={onSelectTerm} onCompareSelected={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Select visual for comparison' });
    button.focus();

    await userEvent.keyboard('{Enter}');

    expect(onSelectTerm).toHaveBeenCalledWith('visual');
});

it('enables explicit comparison only after a term is selected', async () => {
    const onCompareSelected = vi.fn();
    const { rerender } = render(
        <DecodeTermResults terms={terms} onSelectTerm={vi.fn()} onCompareSelected={onCompareSelected} />,
    );
    expect(screen.getByRole('button', { name: 'Compare selected term' })).toBeDisabled();

    rerender(
        <DecodeTermResults
            terms={terms}
            selectedTerm="visual"
            onSelectTerm={vi.fn()}
            onCompareSelected={onCompareSelected}
        />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compare selected term' }));

    expect(onCompareSelected).toHaveBeenCalledOnce();
});
