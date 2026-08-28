import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AtlasReadoutResponse } from '../Decode.atlas.types';
import useDecodeAtlasReadout from '../useDecodeAtlasReadout';
import DecodeAtlasReadout from './DecodeAtlasReadout';

vi.mock('../useDecodeAtlasReadout');

const mockedUseDecodeAtlasReadout = vi.mocked(useDecodeAtlasReadout);
const retry = vi.fn();
const coordinate = { x: -42.5, y: 0, z: 8.25 };

const response: AtlasReadoutResponse = {
    coordinate,
    space: 'MNI152',
    atlases: [
        {
            id: 'harvardoxford-cortical',
            name: 'Harvard–Oxford Cortical Structural Atlas',
            category: 'anatomical',
            valueType: 'probability',
            version: '2103.0',
            sourceUrl: 'https://example.org/harvard-oxford-cortical',
            matches: [
                { id: 'cortical:1', label: 'Inferior Frontal Gyrus, pars opercularis', value: 54 },
                { id: 'cortical:2', label: 'Precentral Gyrus', value: 21.5 },
                { id: 'cortical:3', label: 'Middle Frontal Gyrus', value: 8 },
                {
                    id: 'cortical:4',
                    label: 'A deliberately long cortical atlas label that must wrap cleanly on a narrow screen',
                    value: 3.25,
                },
            ],
        },
        {
            id: 'harvardoxford-subcortical',
            name: 'Harvard–Oxford Subcortical Structural Atlas',
            category: 'anatomical',
            valueType: 'probability',
            version: '2103.0',
            sourceUrl: 'https://example.org/harvard-oxford-subcortical',
            matches: [
                { id: 'subcortical:1', label: 'Left Putamen', value: 42 },
                { id: 'subcortical:2', label: 'Left Pallidum', value: 17 },
                { id: 'subcortical:3', label: 'Left Thalamus', value: 7.5 },
                { id: 'subcortical:4', label: 'Brain-Stem', value: 2 },
            ],
        },
        {
            id: 'difumo-512',
            name: 'DiFuMo 512',
            category: 'functional',
            valueType: 'loading',
            version: '1.0',
            sourceUrl: 'https://example.org/difumo',
            matches: [
                { id: 'difumo:1', label: 'Language network anterior', value: 0.71234 },
                { id: 'difumo:2', label: 'Executive control lateral', value: 0.28567 },
                { id: 'difumo:3', label: 'Sensorimotor hand', value: 0.1044 },
                { id: 'difumo:4', label: 'Visual association', value: 0.0312 },
            ],
        },
    ],
};

const readyState = {
    data: response,
    isInitialLoading: false,
    isUpdating: false,
    isError: false,
    retry,
};

beforeEach(() => {
    retry.mockReset();
    mockedUseDecodeAtlasReadout.mockReturnValue(readyState);
});

it('names the live readout by its exact selected MNI coordinate and separates anatomical from functional evidence', () => {
    render(<DecodeAtlasReadout coordinate={coordinate} />);

    const panel = screen.getByRole('region', { name: 'Atlas readout at selected coordinate' });
    expect(panel).toHaveAccessibleDescription(/MNI152 coordinate: x −42.5, y 0, z 8.25 mm/);
    expect(within(panel).getByRole('heading', { name: 'Anatomical location' })).toBeVisible();
    expect(within(panel).getByRole('heading', { name: 'Decoder feature space' })).toBeVisible();
    expect(within(panel).getByRole('group', { name: 'Harvard–Oxford Cortical Structural Atlas' })).toBeVisible();
    expect(within(panel).getByRole('group', { name: 'Harvard–Oxford Subcortical Structural Atlas' })).toBeVisible();
    expect(within(panel).getByRole('group', { name: 'DiFuMo 512' })).toBeVisible();
});

it('shows the top three matches in fixed atlas order and expands each atlas independently', async () => {
    const user = userEvent.setup();
    render(<DecodeAtlasReadout coordinate={coordinate} />);

    const groups = screen.getAllByRole('group');
    expect(groups.map((group) => within(group).getByRole('heading').textContent)).toEqual([
        'Harvard–Oxford Cortical Structural Atlas',
        'Harvard–Oxford Subcortical Structural Atlas',
        'DiFuMo 512',
    ]);

    const cortical = groups[0];
    const subcortical = groups[1];
    const corticalToggle = within(cortical).getByRole('button', {
        name: 'Show all nonzero matches for Harvard–Oxford Cortical Structural Atlas',
    });
    const subcorticalToggle = within(subcortical).getByRole('button', {
        name: 'Show all nonzero matches for Harvard–Oxford Subcortical Structural Atlas',
    });

    expect(corticalToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(cortical).queryByText(/deliberately long cortical/)).not.toBeInTheDocument();
    expect(within(subcortical).queryByText('Brain-Stem')).not.toBeInTheDocument();

    await user.click(corticalToggle);

    expect(corticalToggle).toHaveAttribute('aria-expanded', 'true');
    expect(corticalToggle).toHaveTextContent('Show top 3');
    expect(within(cortical).getByText(/deliberately long cortical/)).toBeVisible();
    expect(subcorticalToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(subcortical).queryByText('Brain-Stem')).not.toBeInTheDocument();
});

it('formats probabilities as percentages and native DiFuMo loadings without percent signs', () => {
    render(<DecodeAtlasReadout coordinate={coordinate} />);

    const cortical = screen.getByRole('group', { name: 'Harvard–Oxford Cortical Structural Atlas' });
    const difumo = screen.getByRole('group', { name: 'DiFuMo 512' });

    expect(within(cortical).getByText('Probability 54%')).toBeVisible();
    expect(within(cortical).getByText('Probability 21.5%')).toBeVisible();
    expect(within(difumo).getByText('Loading 0.712')).toBeVisible();
    within(difumo)
        .getAllByText(/^Loading /)
        .forEach((value) => expect(value).not.toHaveTextContent('%'));
    expect(screen.getByText(/Probabilistic atlas labels can overlap/)).toBeVisible();
    expect(screen.getByText(/loadings are native feature weights, not parcel probabilities/)).toBeVisible();
});

it('shows pinned versions and source provenance for every atlas', () => {
    render(<DecodeAtlasReadout coordinate={coordinate} />);

    expect(screen.getAllByText('Version 2103.0')).toHaveLength(2);
    expect(screen.getByText('Version 1.0')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Source for Harvard–Oxford Cortical Structural Atlas' })).toHaveAttribute(
        'href',
        response.atlases[0].sourceUrl
    );
    expect(screen.getByRole('link', { name: 'Source for DiFuMo 512' })).toHaveAttribute(
        'href',
        response.atlases[2].sourceUrl
    );
});

it('reserves the semantic panel while the initial readout is loading without showing fixture data', () => {
    mockedUseDecodeAtlasReadout.mockReturnValue({ ...readyState, data: undefined, isInitialLoading: true });

    render(<DecodeAtlasReadout coordinate={coordinate} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading atlas readout');
    expect(screen.getByRole('heading', { name: 'Anatomical location' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Decoder feature space' })).toBeVisible();
});

it('keeps prior matches visible while announcing a nonblocking update', () => {
    mockedUseDecodeAtlasReadout.mockReturnValue({ ...readyState, isUpdating: true });

    render(<DecodeAtlasReadout coordinate={{ x: 12, y: -4.5, z: 30 }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Updating atlas readout');
    expect(screen.getByText('Inferior Frontal Gyrus, pars opercularis')).toBeVisible();
    expect(screen.getByText(/MNI152 coordinate: x 12, y −4.5, z 30 mm/)).toBeVisible();
});

it('distinguishes an empty atlas from service failure and retains its provenance', () => {
    mockedUseDecodeAtlasReadout.mockReturnValue({
        ...readyState,
        data: {
            ...response,
            atlases: response.atlases.map((atlas) =>
                atlas.id === 'harvardoxford-subcortical' ? { ...atlas, matches: [] } : atlas
            ),
        },
    });

    render(<DecodeAtlasReadout coordinate={coordinate} />);

    const subcortical = screen.getByRole('group', { name: 'Harvard–Oxford Subcortical Structural Atlas' });
    expect(within(subcortical).getByText('No nonzero matches at this coordinate')).toBeVisible();
    expect(within(subcortical).getByText('Version 2103.0')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('contains failures locally and retries the current atlas readout', async () => {
    const user = userEvent.setup();
    mockedUseDecodeAtlasReadout.mockReturnValue({
        ...readyState,
        data: undefined,
        isError: true,
    });

    render(<DecodeAtlasReadout coordinate={coordinate} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Atlas readout unavailable');
    expect(alert).toHaveTextContent('The map and decoder results are unaffected');
    await user.click(within(alert).getByRole('button', { name: 'Retry atlas readout' }));
    expect(retry).toHaveBeenCalledOnce();
});

it('preserves control focus while live status changes', () => {
    const { rerender } = render(<DecodeAtlasReadout coordinate={coordinate} />);
    const toggle = screen.getByRole('button', {
        name: 'Show all nonzero matches for Harvard–Oxford Cortical Structural Atlas',
    });
    toggle.focus();

    mockedUseDecodeAtlasReadout.mockReturnValue({ ...readyState, isUpdating: true });
    rerender(<DecodeAtlasReadout coordinate={coordinate} />);

    expect(toggle).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Updating atlas readout');
});

it('allows long scientific labels to wrap at a 390px viewport', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    render(<DecodeAtlasReadout coordinate={coordinate} />);

    await user.click(
        screen.getByRole('button', {
            name: 'Show all nonzero matches for Harvard–Oxford Cortical Structural Atlas',
        })
    );
    const label = screen.getByText(/deliberately long cortical atlas label/);

    expect(label).toBeVisible();
    expect(label).toHaveStyle({ overflowWrap: 'anywhere', minWidth: 0 });
});
