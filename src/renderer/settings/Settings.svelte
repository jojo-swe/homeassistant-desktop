<script lang="ts">
  import { onMount } from 'svelte';

  interface HAEntity {
    entity_id: string;
    name: string;
    state: string;
  }

  interface Shortcut {
    accelerator: string;
    entityId: string;
    service: string;
  }

  interface Settings {
    haBaseUrl?: string;
    haToken?: string;
    pinnedEntities?: string[];
  }

  let allEntities: HAEntity[] = $state([]);
  let pinnedIds: string[] = $state([]);
  let allShortcuts: Shortcut[] = $state([]);
  let haUrl = $state('');
  let haToken = $state('');
  let tokenVisible = $state(false);
  let connStatus = $state('');
  let connStatusOk = $state(false);
  let entitySearch = $state('');
  let shortcutKeys = $state('');
  let shortcutEntity = $state('');
  let toastMsg = $state('');
  let toastVisible = $state(false);
  let toastOk = $state(false);

  const PAGE_SIZE = 50;
  let currentPage = $state(0);
  let currentFiltered: HAEntity[] = $state([]);

  let isLightTheme = $state(false);
  let dragIndex = $state<number | null>(null);
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    const savedTheme = localStorage.getItem('settings-theme');
    if (savedTheme === 'light') {
      isLightTheme = true;
      document.documentElement.setAttribute('data-theme', 'light');
    }
    window.api.on('settings-loaded', (settings: unknown) => {
      const s = settings as Settings;
      haUrl = s.haBaseUrl || '';
      haToken = s.haToken || '';
      pinnedIds = s.pinnedEntities || [];
      loadShortcuts();
    });

    window.api.on('entities-loaded', (entities: unknown) => {
      allEntities = entities as HAEntity[];
      renderEntityList(allEntities);
    });

    window.api.send('settings-open');
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

  function showToast(msg: string, isOk: boolean): void {
    toastMsg = msg;
    toastOk = isOk;
    toastVisible = true;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastVisible = false;
    }, 2500);
  }

  function toggleTokenVisibility(): void {
    tokenVisible = !tokenVisible;
  }

  function showStatus(msg: string, isOk: boolean): void {
    connStatus = msg;
    connStatusOk = isOk;
  }

  async function saveConnection(): Promise<void> {
    if (!haUrl.trim() || !haToken.trim()) {
      showStatus('Please fill in both fields.', false);
      return;
    }
    showStatus('Saving & testing…', true);
    const result = (await window.api.invoke('save-settings', {
      haBaseUrl: haUrl.trim(),
      haToken: haToken.trim(),
    })) as { ok: boolean; error?: string; entities?: HAEntity[] };
    if (result.ok) {
      showStatus('✓ Connected successfully!', true);
      showToast('Settings saved', true);
      allEntities = result.entities || [];
      renderEntityList(allEntities);
    } else {
      showStatus('✗ Connection failed: ' + (result.error || 'Unknown error'), false);
    }
  }

  async function testConnection(): Promise<void> {
    showStatus('Testing…', true);
    const result = (await window.api.invoke('test-connection', {
      haBaseUrl: haUrl.trim(),
      haToken: haToken.trim(),
    })) as { ok: boolean; error?: string };
    showStatus(result.ok ? '✓ Connected!' : '✗ ' + (result.error || 'Failed'), result.ok);
  }

  function filterEntities(): void {
    const q = entitySearch.toLowerCase();
    const filtered = q
      ? allEntities.filter(
          (e) => e.name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q),
        )
      : allEntities;
    renderEntityList(filtered);
  }

  function renderEntityList(entities: HAEntity[]): void {
    currentFiltered = entities;
    currentPage = 0;
  }

  function changePage(dir: number): void {
    currentPage += dir;
  }

  function renderPins(): string[] {
    return pinnedIds;
  }

  function pinName(id: string): string {
    const entity = allEntities.find((e) => e.entity_id === id);
    return entity?.name || id;
  }

  async function togglePin(entityId: string): Promise<void> {
    if (pinnedIds.includes(entityId)) {
      await unpin(entityId);
    } else {
      pinnedIds.push(entityId);
      await window.api.invoke('save-pinned', pinnedIds);
      filterEntities();
    }
  }

  async function unpin(entityId: string): Promise<void> {
    pinnedIds = pinnedIds.filter((id) => id !== entityId);
    await window.api.invoke('save-pinned', pinnedIds);
    filterEntities();
  }

  function onPinDragStart(event: DragEvent, index: number): void {
    dragIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onPinDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  async function onPinDrop(event: DragEvent, index: number): Promise<void> {
    event.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...pinnedIds];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    pinnedIds = reordered;
    dragIndex = null;
    await window.api.invoke('save-pinned', pinnedIds);
  }

  function onPinDragEnd(): void {
    dragIndex = null;
  }

  async function exportConfig(): Promise<void> {
    const result = (await window.api.invoke('export-config')) as { ok: boolean; error?: string };
    if (result.ok) {
      showToast('Config exported', true);
    } else if (result.error !== 'Cancelled') {
      showToast('Export failed: ' + (result.error || 'Unknown'), false);
    }
  }

  async function importConfig(): Promise<void> {
    const result = (await window.api.invoke('import-config')) as { ok: boolean; error?: string };
    if (result.ok) {
      showToast('Config imported — reloading...', true);
      setTimeout(() => window.api.send('settings-open'), 800);
    } else if (result.error !== 'Cancelled') {
      showToast('Import failed: ' + (result.error || 'Unknown'), false);
    }
  }

  async function loadShortcuts(): Promise<void> {
    allShortcuts = (await window.api.invoke('get-shortcuts')) as Shortcut[];
  }

  async function addShortcut(): Promise<void> {
    if (!shortcutKeys.trim() || !shortcutEntity.trim()) return;
    await window.api.invoke('save-shortcut', {
      accelerator: shortcutKeys.trim(),
      entityId: shortcutEntity.trim(),
      service: 'toggle',
    });
    shortcutKeys = '';
    shortcutEntity = '';
    loadShortcuts();
  }

  async function removeShortcut(keys: string): Promise<void> {
    await window.api.invoke('remove-shortcut', keys);
    loadShortcuts();
  }

  const pageItems = $derived.by(() => {
    const start = currentPage * PAGE_SIZE;
    return currentFiltered.slice(start, start + PAGE_SIZE);
  });

  const totalPages = $derived(Math.ceil(currentFiltered.length / PAGE_SIZE));
</script>

<div class="app">
  <div class="header">
    <img src="../assets/favicon.png" alt="Home Assistant" />
    <h1>Settings</h1>
    <div class="header-actions">
      <button class="icon-btn" onclick={toggleTheme} title="Toggle theme">
        {isLightTheme ? '🌙' : '☀️'}
      </button>
    </div>
  </div>

  <div>
    <div class="section-title">Home Assistant Connection</div>
    <div style="display: flex; flex-direction: column; gap: 10px">
      <div class="field">
        <label for="haUrl">Base URL</label>
        <input type="url" id="haUrl" bind:value={haUrl} placeholder="http://homeassistant.local:8123" />
      </div>

      <div class="field">
        <label for="haToken">Long-Lived Access Token</label>
        <div class="token-wrapper">
          <input type={tokenVisible ? 'text' : 'password'} id="haToken" bind:value={haToken} placeholder="eyJ..." />
          <button class="token-toggle" onclick={toggleTokenVisibility} title="Show/hide token">👁</button>
        </div>
      </div>

      <div class="status-msg" class:ok={connStatusOk} class:error={!connStatusOk}>{connStatus}</div>

      <div class="row">
        <button class="btn btn-primary" onclick={saveConnection}>Save & Test</button>
        <button class="btn btn-secondary" onclick={testConnection}>Test Only</button>
      </div>
    </div>
  </div>

  <div>
    <div class="section-title">Quick Action Entities</div>
    <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px; padding: 0">
      Click entities below to pin them to your tray menu.
    </p>

    <div class="pinned-section">
      {#if pinnedIds.length === 0}
        <span class="empty-state">No entities pinned yet.</span>
      {:else}
        {#each renderPins() as id, i (id)}
          <div
            class="pin-chip"
            class:dragging={dragIndex === i}
            draggable="true"
            role="option"
            aria-label="Pinned entity: {pinName(id)}, drag to reorder"
            ondragstart={(e) => onPinDragStart(e, i)}
            ondragover={(e) => onPinDragOver(e, i)}
            ondrop={(e) => onPinDrop(e, i)}
            ondragend={onPinDragEnd}
          >
            <span class="pin-grip" title="Drag to reorder">⠿</span>
            {pinName(id)}
            <button onclick={() => unpin(id)} title="Remove">×</button>
          </div>
        {/each}
      {/if}
    </div>

    <div style="margin-top: 10px" class="entity-search">
      <div class="field" style="margin-bottom: 8px">
        <label for="entitySearch">Filter entities</label>
        <input type="search" id="entitySearch" bind:value={entitySearch} oninput={filterEntities} placeholder="e.g. light, switch, lamp..." />
      </div>
    </div>

    <div class="entity-list">
      {#if currentFiltered.length === 0}
        <div class="loading">Connect to Home Assistant first to see entities.</div>
      {:else}
        {#each pageItems as e (e.entity_id)}
          <div
            class="entity-item"
            class:pinned={pinnedIds.includes(e.entity_id)}
            role="button"
            tabindex="0"
            onclick={() => togglePin(e.entity_id)}
            onkeydown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') togglePin(e.entity_id); }}
          >
            <div>
              <div class="entity-name">{e.name}</div>
              <div class="entity-id">{e.entity_id}</div>
            </div>
            <span class="entity-state" class:on={e.state === 'on'} class:off={e.state !== 'on'}>{e.state}</span>
          </div>
        {/each}
        {#if totalPages > 1}
          <div class="entity-pagination">
            <button onclick={() => changePage(-1)} disabled={currentPage === 0}>‹ Prev</button>
            <span>Page {currentPage + 1} of {totalPages} ({currentFiltered.length} entities)</span>
            <button onclick={() => changePage(1)} disabled={currentPage >= totalPages - 1}>Next ›</button>
          </div>
        {/if}
      {/if}
    </div>
  </div>

  <div style="margin-top: 10px; margin-bottom: 20px">
    <div class="section-title">Global Shortcuts</div>
    <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 10px; padding: 0">
      Bind global keyboard combos to any toggleable entity.
    </p>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px">
      {#if allShortcuts.length === 0}
        <span class="empty-state">No shortcuts defined.</span>
      {:else}
        {#each allShortcuts as s (s.accelerator)}
          <div class="shortcut-row">
            <div>
              <div class="shortcut-keys">{s.accelerator}</div>
              <div class="shortcut-entity">{s.entityId} (toggle)</div>
            </div>
            <button class="btn btn-danger" onclick={() => removeShortcut(s.accelerator)}>Remove</button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="row" style="align-items: flex-end">
      <div class="field" style="flex: 1">
        <label for="shortcutKeys">Keys (e.g. CommandOrControl+Shift+1)</label>
        <input type="text" id="shortcutKeys" bind:value={shortcutKeys} placeholder="CommandOrControl+Shift+L" />
      </div>
      <div class="field" style="flex: 1">
        <label for="shortcutEntity">Entity ID</label>
        <input type="text" id="shortcutEntity" bind:value={shortcutEntity} placeholder="light.living_room" list="entityDatalist" />
        <datalist id="entityDatalist">
          {#each allEntities as e (e.entity_id)}
            <option value={e.entity_id}>{e.name}</option>
          {/each}
        </datalist>
      </div>
      <button class="btn btn-primary" onclick={addShortcut} style="margin-bottom: 1px">Add</button>
    </div>
  </div>

  <div style="margin-top: 10px">
    <div class="section-title">Configuration</div>
    <div class="row" style="gap: 8px">
      <button class="btn btn-secondary" onclick={exportConfig}>Export Config</button>
      <button class="btn btn-secondary" onclick={importConfig}>Import Config</button>
    </div>
  </div>

  {#if toastVisible}
    <div class="toast show" class:ok={toastOk}>{toastMsg}</div>
  {/if}
</div>

<style>
  :global(html),
  :global(body) {
    height: 100%;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 20px;
    gap: 16px;
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .header img {
    width: 28px;
    height: 28px;
  }

  .header h1 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .header-actions {
    margin-left: auto;
  }

  .icon-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    cursor: pointer;
    font-size: 16px;
    padding: 4px 10px;
    transition: background 0.15s;
  }
  .icon-btn:hover {
    background: var(--surface3);
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .token-wrapper {
    position: relative;
  }
  .token-wrapper input {
    padding-right: 40px;
  }
  .token-toggle {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
  }
  .token-toggle:hover {
    color: var(--text);
  }

  .entity-list {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    max-height: 200px;
    overflow-y: auto;
  }

  .entity-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.12s;
    border-bottom: 1px solid var(--border);
    -webkit-user-select: none;
    user-select: none;
  }
  .entity-item:last-child {
    border-bottom: none;
  }
  .entity-item:hover {
    background: var(--surface3);
  }
  .entity-item.pinned {
    border-left: 3px solid var(--ha-blue);
  }

  .entity-name {
    font-size: 13px;
    font-weight: 500;
  }
  .entity-id {
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 1px;
  }
  .entity-state {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    min-width: 36px;
    text-align: center;
  }
  .entity-state.on {
    background: rgba(3, 169, 244, 0.2);
    color: var(--ha-blue);
  }
  .entity-state.off {
    background: rgba(136, 136, 170, 0.15);
    color: var(--text-muted);
  }

  .pinned-section {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
  }
  .pin-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(3, 169, 244, 0.15);
    border: 1px solid rgba(3, 169, 244, 0.3);
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 500;
    color: var(--ha-blue);
    cursor: grab;
    transition: opacity 0.15s;
  }
  .pin-chip:active {
    cursor: grabbing;
  }
  .pin-chip.dragging {
    opacity: 0.4;
  }
  .pin-grip {
    font-size: 12px;
    opacity: 0.5;
    cursor: grab;
  }
  .pin-chip button {
    background: none;
    border: none;
    color: var(--ha-blue);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    opacity: 0.7;
  }
  .pin-chip button:hover {
    opacity: 1;
  }

  .empty-state {
    color: var(--text-muted);
    font-size: 12px;
    font-style: italic;
    padding: 4px 0;
  }

  .loading {
    color: var(--text-muted);
    font-size: 12px;
    padding: 12px;
    text-align: center;
  }

  .entity-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 11px;
    color: var(--text-muted);
  }
  .entity-pagination button {
    background: var(--surface3);
    border: none;
    border-radius: 4px;
    color: var(--text);
    cursor: pointer;
    font-size: 11px;
    padding: 3px 10px;
  }
  .entity-pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface2);
    padding: 8px 12px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
  }
  .shortcut-keys {
    font-size: 13px;
    font-weight: 600;
    color: var(--ha-blue);
  }
  .shortcut-entity {
    font-size: 11px;
    color: var(--text-muted);
  }

  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--surface3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 12px;
    color: var(--text);
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.2s,
      transform 0.2s;
    pointer-events: none;
    z-index: 1000;
  }
  .toast.show {
    opacity: 1;
    transform: translateY(0);
  }
  .toast.ok {
    border-color: var(--success);
  }
</style>
