<script lang="ts">
  import { onMount } from 'svelte';

  let url = $state('');
  let feedback = $state('');
  let feedbackValid = $state(false);
  let urlInvalid = $state(false);
  let urlValid = $state(false);
  let submitDisabled = $state(true);
  let showForm = $state(true);
  let showCheckWrapper = $state(false);
  let showCheckmark = $state(false);
  let discoveryVisible = $state(false);
  let discoveredInstances: string[] = $state([]);

  let existingInstances: string[] = [];

  onMount(() => {
    setTimeout(() => document.getElementById('url')?.focus(), 300);

    window.api.send('get-instances');
    window.api.on('get-instances', (result: unknown) => {
      existingInstances = result as string[];
      window.api.on('bonjour-instance', (instance: unknown) => {
        const inst = instance as { internal_url?: string; external_url?: string };
        if (inst.internal_url && existingInstances.indexOf(inst.internal_url) === -1) {
          showInstance(inst.internal_url);
        }
        if (inst.external_url && existingInstances.indexOf(inst.external_url) === -1) {
          showInstance(inst.external_url);
        }
      });
      window.api.send('start-bonjour');
    });

    window.api.send('ha-instance');
    window.api.on('ha-instance', (u: unknown) => {
      const targetUrl = u as string;
      if (showCheckmark) {
        const checkEl = document.getElementById('check-wrapper');
        if (checkEl) {
          checkEl.addEventListener('animationend', () => {
            window.location.href = targetUrl;
          });
        }
      } else {
        window.location.href = targetUrl;
      }
    });
  });

  function showInstance(instanceUrl: string): void {
    if (instanceUrl === '') return;
    discoveryVisible = true;
    if (!discoveredInstances.includes(instanceUrl)) {
      discoveredInstances.push(instanceUrl);
    }
  }

  function addInstance(instanceUrl: string): void {
    url = instanceUrl;
    checkUrl();
  }

  function saveInstance(): void {
    submitDisabled = true;
    showForm = false;
    showCheckWrapper = true;
    window.api.send('ha-instance', url);
  }

  function isValidUrl(s: string): boolean {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  }

  function checkUrl(): void {
    submitDisabled = true;
    urlInvalid = false;
    urlValid = false;
    feedback = '';
    feedbackValid = false;

    if (!url.startsWith('http') || !isValidUrl(url)) {
      urlInvalid = true;
      feedback = 'Please provide a valid URL starting with http:// or https://';
      return;
    }

    const parsed = new URL(url);
    if (parsed.pathname.length > 1 && !parsed.pathname.startsWith('/lovelace') && !parsed.pathname.startsWith('/energy')) {
      urlInvalid = true;
      feedback = 'URL path should be /lovelace or /energy';
      return;
    }

    urlValid = true;
    feedback = 'Checking connection…';
    feedbackValid = true;

    fetch(`${parsed.origin}/auth/providers`)
      .then((response) => response.text())
      .then((data) => {
        if (!data.includes('homeassistant')) {
          urlValid = false;
          urlInvalid = true;
          feedback = 'No Home Assistant instance found at this URL';
          feedbackValid = false;
          return;
        }
        feedback = '✓ Home Assistant detected!';
        submitDisabled = false;
      })
      .catch(() => {
        urlValid = false;
        urlInvalid = true;
        feedback = 'Could not reach the URL — check your connection';
        feedbackValid = false;
      });
  }
</script>

<div class="container">
  <div class="header">
    <img src="../assets/favicon.png" alt="Home Assistant Logo" />
    <h1>Home Assistant</h1>
  </div>

  <p class="subtitle">Enter your Home Assistant URL below, or pick a discovered instance.</p>

  {#if discoveryVisible}
    <div class="discovery-section visible">
      <div class="discovery-title">Discovered Instances</div>
      <div id="availableInstances">
        {#each discoveredInstances as instanceUrl}
          <button class="instance-btn" onclick={() => addInstance(instanceUrl)}>{instanceUrl}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if showCheckWrapper}
    <div class="check-wrapper visible">
      <div id="check-wrapper" class="success-checkmark">
        <div class="check-icon center">
          <span class="icon-line line-tip"></span>
          <span class="icon-line line-long"></span>
          <div class="icon-circle"></div>
          <div class="icon-fix"></div>
        </div>
        <p>Your URL is checked, and you will be forwarded to Home Assistant automatically.</p>
      </div>
    </div>
  {/if}

  {#if showForm}
    <div class="url-form">
      <input
        type="url"
        required
        id="url"
        bind:value={url}
        oninput={checkUrl}
        placeholder="http://homeassistant.local:8123"
        class:is-invalid={urlInvalid}
        class:is-valid={urlValid}
      />
      <div class="feedback" class:valid={feedbackValid}>{feedback}</div>
      <button class="btn btn-primary" id="submit" onclick={saveInstance} disabled={submitDisabled}>Connect</button>
    </div>
  {/if}
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    padding: 20px;
    gap: 20px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header img {
    width: 32px;
    height: 32px;
  }
  .header h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }
  .subtitle {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    max-width: 320px;
  }
  .url-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 320px;
  }
  .url-form input {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
  }
  .url-form input:focus {
    border-color: var(--ha-blue);
  }
  .url-form input.is-invalid {
    border-color: var(--danger);
  }
  .url-form input.is-valid {
    border-color: var(--success);
  }
  .feedback {
    font-size: 12px;
    min-height: 16px;
    color: var(--danger);
  }
  .feedback.valid {
    color: var(--success);
  }
  .btn-primary {
    width: 100%;
  }
  .discovery-section {
    width: 320px;
  }
  .discovery-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .instance-btn {
    display: block;
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    padding: 10px 14px;
    cursor: pointer;
    margin-bottom: 6px;
    transition: border-color 0.15s;
    text-align: left;
  }
  .instance-btn:hover {
    border-color: var(--ha-blue);
  }
  .check-wrapper {
    text-align: center;
  }
  .check-wrapper p {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 12px;
  }
</style>
