// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ErrorComponent from '../../renderer/error/Error.svelte';

const mockSend = vi.fn();
const mockOn = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  (window as any).api = { send: mockSend, on: mockOn };
});

describe('Error.svelte', () => {
  test('renders connection lost title', () => {
    const { getByText } = render(ErrorComponent);
    expect(getByText('Connection Lost')).toBeInTheDocument();
  });

  test('renders error message text', () => {
    const { getByText } = render(ErrorComponent);
    expect(getByText(/not available/i)).toBeInTheDocument();
  });

  test('renders reconnect button with aria-label', () => {
    const { getByLabelText } = render(ErrorComponent);
    expect(getByLabelText('Reconnect to Home Assistant')).toBeInTheDocument();
  });

  test('renders restart button with aria-label', () => {
    const { getByLabelText } = render(ErrorComponent);
    expect(getByLabelText('Restart application')).toBeInTheDocument();
  });

  test('renders theme toggle button with aria-label', () => {
    const { getByLabelText } = render(ErrorComponent);
    expect(getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  test('error card has role="alert"', () => {
    const { getByRole } = render(ErrorComponent);
    expect(getByRole('alert')).toBeInTheDocument();
  });

  test('clicking reconnect sends IPC reconnect', async () => {
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Reconnect to Home Assistant');
    btn.click();
    expect(mockSend).toHaveBeenCalledWith('reconnect');
  });

  test('clicking restart sends IPC restart', async () => {
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Restart application');
    btn.click();
    expect(mockSend).toHaveBeenCalledWith('restart');
  });

  test('clicking theme toggle sets light theme in localStorage', async () => {
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Toggle theme');
    btn.click();
    expect(localStorage.getItem('settings-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('clicking theme toggle twice reverts to dark theme', async () => {
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Toggle theme');
    btn.click();
    btn.click();
    expect(localStorage.getItem('settings-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  test('loads light theme from localStorage on mount', () => {
    localStorage.setItem('settings-theme', 'light');
    render(ErrorComponent);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  test('shows sun icon in light theme', async () => {
    localStorage.setItem('settings-theme', 'light');
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Toggle theme');
    expect(btn.textContent).toContain('🌙');
  });

  test('shows moon icon in dark theme', () => {
    const { getByLabelText } = render(ErrorComponent);
    const btn = getByLabelText('Toggle theme');
    expect(btn.textContent).toContain('☀️');
  });
});
