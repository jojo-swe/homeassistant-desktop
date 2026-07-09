<script lang="ts">
  import { onMount } from 'svelte';

  let isLightTheme = $state(false);

  onMount(() => {
    const savedTheme = localStorage.getItem('settings-theme');
    if (savedTheme === 'light') {
      isLightTheme = true;
      document.documentElement.setAttribute('data-theme', 'light');
    }
  });

  function toggleTheme(): void {
    isLightTheme = !isLightTheme;
    if (isLightTheme) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('settings-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('settings-theme', 'dark');
    }
  }

  function reconnect(): void {
    window.api.send('reconnect');
  }

  function restart(): void {
    window.api.send('restart');
  }
</script>

<div class="container">
  <button class="theme-toggle glass" onclick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
    {isLightTheme ? '🌙' : '☀️'}
  </button>
  <div class="error-card glass-elevated" role="alert">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </div>
    <div class="error-title">Connection Lost</div>
    <p class="error-message">
      Your Home Assistant instance is not available. Please check your network connection and try again.
    </p>
    <div class="btn-group">
      <button class="btn btn-primary" onclick={reconnect} aria-label="Reconnect to Home Assistant">Reconnect</button>
      <button class="btn btn-secondary" onclick={restart} aria-label="Restart application">Restart</button>
    </div>
  </div>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 20px;
    gap: 24px;
    position: relative;
  }
  .theme-toggle {
    position: absolute;
    top: 16px;
    right: 16px;
    color: var(--text);
    cursor: pointer;
    font-size: 16px;
    padding: 4px 10px;
  }
  .error-card {
    padding: 40px 32px;
    text-align: center;
    max-width: 360px;
  }
  .error-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(239, 83, 80, 0.15);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
  }
  .error-icon svg {
    width: 28px;
    height: 28px;
    stroke: var(--danger);
    stroke-width: 2;
    fill: none;
    stroke-linecap: round;
  }
  .error-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
  }
  .error-message {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .btn-group {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 24px;
  }
</style>
