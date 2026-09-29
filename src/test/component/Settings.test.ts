// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import Settings from '../../renderer/settings/Settings.svelte';

type Reply = (value: unknown) => void;
let sceneReplies: Reply[];
const invoke = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  sceneReplies = [];
  invoke.mockImplementation((channel: string) => {
    if (channel === 'suggest-scene') return new Promise((resolve) => sceneReplies.push(resolve));
    if (channel === 'activate-scene') return Promise.resolve({ ok: true });
    return Promise.resolve([]);
  });
  (window as any).api = { send: vi.fn(), on: vi.fn(), invoke };
});

async function requestScene(container: HTMLElement, text: string) {
  const input = container.querySelector('#sceneRequest') as HTMLInputElement;
  await fireEvent.input(input, { target: { value: text } });
  return input;
}

describe('Settings.svelte scene selector', () => {
  test('shows search errors in the status line, marked as an error', async () => {
    const { container, getByText } = render(Settings);
    await requestScene(container, 'movie');
    await fireEvent.click(getByText('Find Scene'));
    sceneReplies[0]({ ok: false, error: 'TypeSafe is not configured.' });
    const status = container.querySelector('.scene-status-msg')!;
    await waitFor(() => expect(status).toHaveTextContent('TypeSafe is not configured.'));
    expect(status).toHaveClass('visible', 'error');
  });

  test('ignores a late suggestion for a request the user has since changed', async () => {
    const { container, getByText, queryByText } = render(Settings);
    const input = await requestScene(container, 'movie');
    await fireEvent.click(getByText('Find Scene'));
    await fireEvent.input(input, { target: { value: 'reading' } });
    sceneReplies[0]({ ok: true, sceneId: 'scene.movie_time', name: 'Movie Time' });
    await waitFor(() => expect(getByText('Find Scene')).not.toBeDisabled());
    expect(queryByText('Activate Movie Time')).toBeNull();
    const status = container.querySelector('.scene-status-msg')!;
    expect(status.textContent).toBe('');
    expect(status).not.toHaveClass('visible');
  });

  test('activates the reviewed suggestion and reports it', async () => {
    const { container, getByText, queryByText } = render(Settings);
    await requestScene(container, 'movie');
    await fireEvent.click(getByText('Find Scene'));
    sceneReplies[0]({ ok: true, sceneId: 'scene.movie_time', name: 'Movie Time' });
    await fireEvent.click(await waitFor(() => getByText('Activate Movie Time')));
    await waitFor(() =>
      expect(container.querySelector('.scene-status-msg')).toHaveTextContent('Activated Movie Time.')
    );
    expect(invoke).toHaveBeenCalledWith('activate-scene', 'scene.movie_time');
    expect(queryByText('Activate Movie Time')).toBeNull();
  });
});
