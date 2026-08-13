import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

/**
 * The app's behaviour from the outside: can you find a word, travel to it,
 * and get back. The engine is covered by the lib tests; these are the wires.
 */
const setup = () => ({ user: userEvent.setup(), ...render(<App />) });

const card = () => screen.getByText('index', { selector: 'dt' }).closest('.card') as HTMLElement;

describe('the explorer', () => {
  it('opens on a word with its definition and bits', () => {
    setup();
    const detail = card();
    expect(within(detail).getByText('bird', { selector: '.card__word' })).toBeInTheDocument();
    expect(within(detail).getByText('0001 0110 100')).toBeInTheDocument();
    expect(within(detail).getByText('180 of 2047')).toBeInTheDocument();
  });

  it('searches by spelling and says why each word matched', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/search the bip-39/i), 'krane');
    const hits = document.querySelector('.hits') as HTMLElement;
    expect(within(hits).getByRole('button', { name: /^crane/ })).toHaveTextContent('1 edit away');
  });

  it('travels to a searched word and records the trip', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/search the bip-39/i), 'ocean');
    await user.click(screen.getByRole('button', { name: /^ocean/ }));

    expect(within(card()).getByText('ocean', { selector: '.card__word' })).toBeInTheDocument();
    const trail = screen.getByRole('navigation', { name: /words visited/i });
    expect(within(trail).getByRole('button', { name: 'bird' })).toBeInTheDocument();
    expect(within(trail).getByRole('button', { name: 'ocean' })).toBeInTheDocument();
  });

  it('walks back along the trail', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/search the bip-39/i), 'ocean');
    await user.click(screen.getByRole('button', { name: /^ocean/ }));

    const trail = screen.getByRole('navigation', { name: /words visited/i });
    await user.click(within(trail).getByRole('button', { name: 'bird' }));
    expect(within(card()).getByText('bird', { selector: '.card__word' })).toBeInTheDocument();
  });

  it('offers words that are two steps out, not direct neighbours', () => {
    setup();
    const detail = card();
    expect(within(detail).getByText(/two steps out/i)).toBeInTheDocument();
    expect(within(detail).getByText(/reached through the company they share/i)).toBeInTheDocument();
  });

  it('switches between the three views', async () => {
    const { user } = setup();
    const nav = screen.getByRole('navigation', { name: 'View' });

    await user.click(within(nav).getByRole('button', { name: 'Tree' }));
    expect(screen.getByText('Tree', { selector: '.panel__title' })).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Path' }));
    expect(screen.getByLabelText('Second word')).toBeInTheDocument();

    await user.click(within(nav).getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('img', { name: /relation map for bird/i })).toBeInTheDocument();
  });

  it('finds a chain between two words and names each link', async () => {
    const { user } = setup();
    const nav = screen.getByRole('navigation', { name: 'View' });
    await user.click(within(nav).getByRole('button', { name: 'Path' }));

    await user.type(screen.getByLabelText('Second word'), 'ocean');
    await user.click(screen.getByRole('button', { name: 'Find' }));

    const chain = document.querySelector('.path__chain') as HTMLElement;
    expect(within(chain).getByText('bird')).toBeInTheDocument();
    expect(within(chain).getByText('ocean')).toBeInTheDocument();
    expect(screen.getByText(/combined strength/i)).toBeInTheDocument();
  });

  it('deepens the tree on request and can be told to stop staying on topic', async () => {
    const { user } = setup();
    const nav = screen.getByRole('navigation', { name: 'View' });
    await user.click(within(nav).getByRole('button', { name: 'Tree' }));

    const shallow = document.querySelectorAll('.tree__row').length;
    await user.click(screen.getByRole('button', { name: '4 deep' }));
    expect(document.querySelectorAll('.tree__row').length).toBeGreaterThan(shallow);

    const stayOnTopic = screen.getByRole('button', { name: /stay on topic/i });
    expect(stayOnTopic).toHaveAttribute('aria-pressed', 'true');
    await user.click(stayOnTopic);
    expect(stayOnTopic).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/ranked by raw link strength/i)).toBeInTheDocument();
  });

  it('opens a map node into its own fan without losing the centre', async () => {
    const { user } = setup();
    const map = screen.getByRole('img', { name: /relation map for bird/i });
    const before = map.querySelectorAll('.orbit__pill').length;

    await user.click(within(map).getAllByRole('button', { name: /^Open .* own links$/ })[0]);

    const after = screen
      .getByRole('img', { name: /relation map for bird/i })
      .querySelectorAll('.orbit__pill').length;
    expect(after).toBeGreaterThan(before);
    expect(within(card()).getByText('bird', { selector: '.card__word' })).toBeInTheDocument();
  });

  it('shows the letter and sound matches separately from the graph', () => {
    setup();
    expect(screen.getByText(/computed live, not from the index/i)).toBeInTheDocument();
    expect(screen.getByText('sounds like')).toBeInTheDocument();
  });

  it('says plainly that nothing leaves the page', () => {
    setup();
    expect(screen.getByText(/no server, no model, no network request/i)).toBeInTheDocument();
    expect(screen.getAllByText(/never type a real seed phrase/i).length).toBeGreaterThan(0);
  });
});
