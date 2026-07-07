<script lang="ts">
  function reconnect(): void {
    window.api.send('reconnect');
  }

  function restart(): void {
    window.api.send('restart');
  }
</script>

<div class="container">
  <div class="error-card">
    <div class="error-icon">
      <svg viewBox="0 0 24 24">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </div>
    <div class="error-title">Connection Lost</div>
    <p class="error-message">
      Your Home Assistant instance is not available. Please check your network connection and try again.
    </p>
    <div class="btn-group">
      <button class="btn btn-primary" onclick={reconnect}>Reconnect</button>
      <button class="btn btn-secondary" onclick={restart}>Restart</button>
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
  }
  .error-card {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 40px 32px;
    text-align: center;
    max-width: 360px;
  }
  .error-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(239, 83, 80, 0.15);
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
