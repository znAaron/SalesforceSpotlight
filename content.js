/**
 * Salesforce Spotlight — footer bar, typeahead, keyboard navigation.
 *
 * Chrome DevTools on this script: open DevTools on the Salesforce tab (F12).
 * Console → filter “[Spotlight]”.
 * Sources → left sidebar → Page → chrome-extension://…/content.js → breakpoints.
 * API calls run in the background service worker with Bearer auth using the My Domain sid.
 * Content script handles UI only and sends messages to background.
 */

(function initSalesforceSpotlight() {
  if (window.__sfnavInjected) {
    return;
  }
  window.__sfnavInjected = true;

  const SFNAV_DEBUG = true;
  /** @param {...unknown} args */
  function dbg(...args) {
    if (SFNAV_DEBUG) console.log('[Spotlight]', ...args);
  }
  /** @param {...unknown} args */
  function dbgWarn(...args) {
    if (SFNAV_DEBUG) console.warn('[Spotlight]', ...args);
  }

  const HOST_ID = 'sfnav-extension-host';
  const REOPEN_ID = 'sfnav-reopen-button';
  const DEBOUNCE_MS = 150;
  const MAX_RESULTS = 10;

  /** Inlined from content.css — avoid fetch(chrome-extension://…) which MV3 / page CSP can block. */
  const SFNAV_SHADOW_CSS = `/* Scoped to Shadow DOM root — class names prefixed with sfnav- */

.sfnav-root {
  --sfnav-bg: rgba(15, 23, 42, 0.75);
  --sfnav-border: rgba(255, 255, 255, 0.1);
  --sfnav-glow: rgba(139, 92, 246, 0.15);
  --sfnav-text: #f8fafc;
  --sfnav-muted: #94a3b8;
  --sfnav-input-bg: rgba(255, 255, 255, 0.06);
  --sfnav-accent: #8b5cf6;
  --sfnav-font: "Salesforce Sans", -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2147483646;
  pointer-events: none;
  font-family: var(--sfnav-font);
  font-size: 13px;
  line-height: 1.35;
  box-sizing: border-box;
}

.sfnav-root *,
.sfnav-root *::before,
.sfnav-root *::after {
  box-sizing: border-box;
}

.sfnav-bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 8px 24px;
  background: var(--sfnav-bg);
  border: 1px solid var(--sfnav-border);
  border-radius: 28px;
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px inset rgba(255, 255, 255, 0.05), 0 0 20px var(--sfnav-glow);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sfnav-brand-stack {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  line-height: 1.15;
}

.sfnav-brand {
  background: linear-gradient(135deg, #60a5fa, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: 13px;
  white-space: nowrap;
}

.sfnav-brand-version {
  font-size: 10px;
  font-weight: 600;
  color: var(--sfnav-muted);
  letter-spacing: 0.06em;
}

.sfnav-search-wrap {
  flex: 1 1 auto;
  width: 400px;
  position: relative;
}

.sfnav-input {
  width: 100%;
  height: 40px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 20px;
  background: var(--sfnav-input-bg);
  color: var(--sfnav-text);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sfnav-input::placeholder {
  color: var(--sfnav-muted);
}

.sfnav-input:focus {
  border-color: rgba(139, 92, 246, 0.5);
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.sfnav-input:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* Native search clear (X) — white icon, pointer cursor, stronger on hover */
.sfnav-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  margin-right: 6px;
  cursor: pointer;
  background-color: #fff;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E");
  -webkit-mask-size: 14px 14px;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  opacity: 0.9;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sfnav-input::-webkit-search-cancel-button:hover {
  opacity: 1;
  transform: scale(1.08);
}

.sfnav-input::-webkit-search-cancel-button:active {
  transform: scale(0.95);
}

.sfnav-input::-moz-search-clear-button {
  cursor: pointer;
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.sfnav-input::-moz-search-clear-button:hover {
  opacity: 1;
}

.sfnav-status {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--sfnav-muted);
  line-height: 1.25;
}

.sfnav-status-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfnav-status-summary[hidden] {
  display: none !important;
}

.sfnav-status-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.sfnav-status-grid[hidden] {
  display: none !important;
}

.sfnav-status-row {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sfnav-status--error {
  color: #fbbf24;
}

.sfnav-status--loading .sfnav-status-summary::before {
  content: "";
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 8px;
  vertical-align: -2px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #c084fc;
  border-radius: 50%;
  animation: sfnav-spin 0.65s linear infinite;
}

@keyframes sfnav-spin {
  to {
    transform: rotate(360deg);
  }
}

.sfnav-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 10px;
}

.sfnav-btn {
  pointer-events: auto;
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--sfnav-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--sfnav-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sfnav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.sfnav-btn-close {
  opacity: 0.9;
}

.sfnav-dropdown {
  pointer-events: auto;
  position: absolute;
  left: 50%;
  bottom: calc(100% + 16px);
  transform: translateX(-50%);
  width: min(600px, calc(100vw - 32px));
  max-height: 360px;
  overflow-y: auto;
  padding: 8px;
  /* Lighter glass so more of the page shows through */
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(20px) saturate(165%);
  -webkit-backdrop-filter: blur(20px) saturate(165%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22), 0 0 0 1px inset rgba(255, 255, 255, 0.06);
  animation: sfnav-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(192, 132, 252, 0.55) rgba(255, 255, 255, 0.08);
}

.sfnav-dropdown::-webkit-scrollbar {
  width: 8px;
}

.sfnav-dropdown::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 100px;
  margin: 8px 4px 8px 0;
}

.sfnav-dropdown::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    rgba(192, 132, 252, 0.65),
    rgba(96, 165, 250, 0.45)
  );
  border-radius: 100px;
  border: 2px solid transparent;
  background-clip: content-box;
  min-height: 40px;
}

.sfnav-dropdown::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    rgba(216, 180, 254, 0.7),
    rgba(125, 211, 252, 0.6)
  );
  background-clip: content-box;
}

.sfnav-dropdown[hidden] {
  display: none !important;
}

@keyframes sfnav-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.sfnav-result {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  margin: 2px 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--sfnav-text);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sfnav-result:hover,
.sfnav-result--active {
  background: rgba(139, 92, 246, 0.2);
  transform: translateX(4px);
}

.sfnav-result-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sfnav-badge {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--sfnav-text);
  box-shadow: 0 0 0 1px inset rgba(255, 255, 255, 0.1);
}

.sfnav-badge--flow {
  background: rgba(59, 130, 246, 0.25);
  color: #93c5fd;
  box-shadow: 0 0 0 1px inset rgba(59, 130, 246, 0.3);
}

.sfnav-badge--object {
  background: rgba(16, 185, 129, 0.25);
  color: #6ee7b7;
  box-shadow: 0 0 0 1px inset rgba(16, 185, 129, 0.3);
}

.sfnav-badge--lwc {
  background: rgba(168, 85, 247, 0.25);
  color: #d8b4fe;
  box-shadow: 0 0 0 1px inset rgba(168, 85, 247, 0.3);
}

.sfnav-badge--apex {
  background: rgba(245, 158, 11, 0.25);
  color: #fcd34d;
  box-shadow: 0 0 0 1px inset rgba(245, 158, 11, 0.3);
}

.sfnav-empty {
  padding: 16px 10px;
  color: var(--sfnav-muted);
  font-size: 14px;
  text-align: center;
}

@media (max-width: 900px) {
  .sfnav-status {
    max-width: 100%;
    flex: 1 1 100%;
    order: 4;
  }

  .sfnav-bar {
    flex-wrap: wrap;
    justify-content: space-between;
    border-radius: 16px;
    padding: 12px 16px;
  }

  .sfnav-search-wrap {
    order: 3;
    flex: 1 1 100%;
    width: 100%;
    margin-top: 8px;
  }
}
`;

  let shadow;
  let els;
  let components = [];
  let filtered = [];
  let selectedIndex = -1;
  let debounceTimer = null;

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  function loadStylesIntoShadow(shadowRoot) {
    const style = document.createElement('style');
    style.textContent = SFNAV_SHADOW_CSS;
    shadowRoot.appendChild(style);
  }

  function buildFooterHtml() {
    return `
      <div class="sfnav-root" part="root">
        <div class="sfnav-dropdown" id="sfnavDropdown" role="listbox" aria-hidden="true" hidden></div>
        <footer class="sfnav-bar" role="navigation" aria-label="Salesforce Spotlight">
          <div class="sfnav-brand-stack" title="Salesforce Spotlight">
            <div class="sfnav-brand">Salesforce Spotlight</div>
            <div class="sfnav-brand-version" id="sfnavBrandVersion"></div>
          </div>
          <div class="sfnav-search-wrap">
            <input
              type="search"
              class="sfnav-input"
              id="sfnavInput"
              placeholder="Search flows, objects, LWC, Apex…"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search Salesforce components"
              aria-autocomplete="list"
              aria-controls="sfnavDropdown"
              aria-expanded="false"
            />
          </div>
          <div class="sfnav-status" id="sfnavStatus" aria-live="polite">
            <div class="sfnav-status-summary" id="sfnavStatusSummary"></div>
            <div class="sfnav-status-grid" id="sfnavStatusCounts" hidden>
              <div class="sfnav-status-row" id="sfnavStatusRow1"></div>
              <div class="sfnav-status-row" id="sfnavStatusRow2"></div>
            </div>
          </div>
          <div class="sfnav-actions">
            <button type="button" class="sfnav-btn" id="sfnavRefresh" title="Refresh list">Refresh</button>
            <button type="button" class="sfnav-btn sfnav-btn-close" id="sfnavClose" title="Hide footer">Close</button>
          </div>
        </footer>
      </div>
    `;
  }

  function setStatus(text, kind) {
    if (!els || !els.status) return;
    const isError = kind === 'error';
    const isLoading = kind === 'loading';
    if (els.statusSummary) {
      els.statusSummary.hidden = false;
      els.statusSummary.textContent = text || '';
    }
    if (els.statusCounts) els.statusCounts.hidden = true;
    if (els.statusRow1) els.statusRow1.textContent = '';
    if (els.statusRow2) els.statusRow2.textContent = '';
    els.status.classList.toggle('sfnav-status--error', isError);
    els.status.classList.toggle('sfnav-status--loading', isLoading);
  }

  /** Ready: only two rows of counts (flows/objects, LWC/Apex); no Ready/cached line. */
  function setReadyStatus(counts, itemFallback) {
    if (!els || !els.status) return;
    els.status.classList.remove('sfnav-status--error', 'sfnav-status--loading');
    const c = counts;
    if (c && typeof c.flows === 'number') {
      if (els.statusSummary) {
        els.statusSummary.textContent = '';
        els.statusSummary.hidden = true;
      }
      if (els.statusRow1) els.statusRow1.textContent = `${c.flows} flows · ${c.objects} objects`;
      if (els.statusRow2) els.statusRow2.textContent = `${c.lwc} LWC · ${c.apex} Apex`;
      if (els.statusCounts) els.statusCounts.hidden = false;
    } else {
      if (els.statusCounts) els.statusCounts.hidden = true;
      if (els.statusSummary) {
        els.statusSummary.hidden = false;
        els.statusSummary.textContent = itemFallback != null ? `${itemFallback} items` : '';
      }
    }
  }

  function fetchComponents(forceRefresh) {
    const tabUrl = window.location.href;
    dbg('sendMessage fetchComponents', { tabUrl, forceRefresh });
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'fetchComponents',
          tabUrl,
          forceRefresh: Boolean(forceRefresh),
        },
        (response) => {
          if (chrome.runtime.lastError) {
            dbgWarn('sendMessage lastError', chrome.runtime.lastError.message);
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          dbg('sendMessage response', {
            ok: response && response.ok,
            cached: response && response.cached,
            counts: response && response.counts,
            len: response && response.components && response.components.length,
            error: response && response.error,
          });
          resolve(response || { ok: false, error: 'No response' });
        }
      );
    });
  }

  async function loadComponents(forceRefresh) {
    setStatus(forceRefresh ? 'Refreshing…' : 'Loading components…', 'loading');
    if (els && els.input) els.input.disabled = true;

    const result = await fetchComponents(forceRefresh);

    if (els && els.input) els.input.disabled = false;

    if (!result.ok) {
      components = [];
      dbgWarn('loadComponents failed', result.error);
      setStatus(result.error || 'Failed to load.', 'error');
      return;
    }

    components = Array.isArray(result.components) ? result.components : [];
    dbg('loadComponents OK', 'in-memory length', components.length);
    setReadyStatus(result.counts, components.length);
  }

  function normalizeQuery(q) {
    return (q || '').trim().toLowerCase();
  }

  /**
   * Multi-token fuzzy match: split query into words, every word must appear
   * somewhere in the haystack. "send pdf" matches "NOVA Automatic Send Quote PDF".
   * Scoring: exact substring > all-tokens-match; earlier positions rank higher.
   */
  function filterComponents(query) {
    const q = normalizeQuery(query);
    if (!q) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const scored = [];
    for (let i = 0; i < components.length; i += 1) {
      const item = components[i];
      const hay = item.searchText || item.name.toLowerCase();

      const exactIdx = hay.indexOf(q);
      if (exactIdx !== -1) {
        scored.push({ item, score: 0, pos: exactIdx, name: item.name });
        continue;
      }

      let allMatch = true;
      let sumPos = 0;
      for (let t = 0; t < tokens.length; t += 1) {
        const idx = hay.indexOf(tokens[t]);
        if (idx === -1) {
          allMatch = false;
          break;
        }
        sumPos += idx;
      }
      if (allMatch) {
        scored.push({ item, score: 1, pos: sumPos, name: item.name });
      }
    }

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.pos !== b.pos) return a.pos - b.pos;
      return a.name.localeCompare(b.name);
    });

    return scored.slice(0, MAX_RESULTS).map((s) => s.item);
  }

  function badgeClass(type) {
    switch (type) {
      case 'Flow':
        return 'sfnav-badge sfnav-badge--flow';
      case 'Object':
        return 'sfnav-badge sfnav-badge--object';
      case 'LWC':
        return 'sfnav-badge sfnav-badge--lwc';
      case 'Apex':
        return 'sfnav-badge sfnav-badge--apex';
      default:
        return 'sfnav-badge';
    }
  }

  function renderDropdown() {
    if (!els || !els.dropdown || !els.input) return;

    els.dropdown.innerHTML = '';
    selectedIndex = filtered.length ? 0 : -1;

    if (!filtered.length) {
      const q = normalizeQuery(els.input.value);
      if (!q) {
        els.dropdown.hidden = true;
        els.dropdown.setAttribute('aria-hidden', 'true');
        els.input.setAttribute('aria-expanded', 'false');
        return;
      }
      const empty = document.createElement('div');
      empty.className = 'sfnav-empty';
      empty.textContent = 'No matches.';
      els.dropdown.appendChild(empty);
    } else {
      filtered.forEach((item, i) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'sfnav-result' + (i === selectedIndex ? ' sfnav-result--active' : '');
        row.setAttribute('role', 'option');
        row.setAttribute('data-index', String(i));
        row.innerHTML = `<span class="${badgeClass(item.type)}">${escapeHtml(item.type)}</span><span class="sfnav-result-name">${escapeHtml(item.name)}</span>`;
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          openItem(item);
        });
        els.dropdown.appendChild(row);
      });
    }

    els.dropdown.hidden = false;
    els.dropdown.setAttribute('aria-hidden', 'false');
    els.input.setAttribute('aria-expanded', 'true');
    updateActiveRow();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateActiveRow() {
    if (!els || !els.dropdown) return;
    const rows = els.dropdown.querySelectorAll('.sfnav-result');
    rows.forEach((row, i) => {
      row.classList.toggle('sfnav-result--active', i === selectedIndex);
      row.setAttribute('aria-selected', i === selectedIndex ? 'true' : 'false');
    });
  }

  function openItem(item) {
    if (!item || !item.url) return;
    window.open(item.url, '_blank', 'noopener,noreferrer');
    if (els && els.input) {
      els.input.value = '';
    }
    filtered = [];
    if (els && els.dropdown) {
      els.dropdown.hidden = true;
      els.dropdown.setAttribute('aria-hidden', 'true');
      els.input.setAttribute('aria-expanded', 'false');
      els.dropdown.innerHTML = '';
    }
    selectedIndex = -1;
  }

  function onInput() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!els || !els.input) return;
      filtered = filterComponents(els.input.value);
      renderDropdown();
    }, DEBOUNCE_MS);
  }

  function onKeyDown(e) {
    if (!els || !els.dropdown || els.dropdown.hidden) {
      if (e.key === 'Escape') {
        els.input.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length) {
        selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
        updateActiveRow();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length) {
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateActiveRow();
      }
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && filtered[selectedIndex]) {
        e.preventDefault();
        openItem(filtered[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      els.dropdown.hidden = true;
      els.dropdown.setAttribute('aria-hidden', 'true');
      els.input.setAttribute('aria-expanded', 'false');
      els.dropdown.innerHTML = '';
      selectedIndex = -1;
    }
  }

  function hideFooter() {
    const host = document.getElementById(HOST_ID);
    if (host) {
      host.style.display = 'none';
    }
    showReopenButton();
  }

  function showFooter() {
    const host = document.getElementById(HOST_ID);
    if (host) {
      host.style.display = '';
    }
    const reopen = document.getElementById(REOPEN_ID);
    if (reopen) {
      reopen.remove();
    }
  }

  function showReopenButton() {
    if (document.getElementById(REOPEN_ID)) return;
    const btn = document.createElement('button');
    btn.id = REOPEN_ID;
    btn.type = 'button';
    const reopenVer = (chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '';
    btn.setAttribute('title', 'Salesforce Spotlight');
    btn.innerHTML =
      '<span style="display:block;line-height:1.15;font-size:14px;font-weight:600">Spotlight</span>' +
      (reopenVer
        ? `<span style="display:block;font-size:10px;font-weight:600;opacity:0.92;margin-top:2px">v${reopenVer}</span>`
        : '');
    btn.setAttribute(
      'style',
      [
        'position:fixed',
        'right:24px',
        'bottom:24px',
        'z-index:2147483645',
        'padding:10px 18px',
        'text-align:center',
        'font-family:system-ui,sans-serif',
        'background:linear-gradient(135deg, #60a5fa, #c084fc)',
        'color:#fff',
        'border:none',
        'border-radius:24px',
        'cursor:pointer',
        'box-shadow:0 8px 24px rgba(139, 92, 246, 0.3)',
        'transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      ].join(';')
    );
    btn.addEventListener('mouseover', () => {
      btn.style.transform = 'translateY(-2px) scale(1.02)';
      btn.style.boxShadow = '0 12px 32px rgba(139, 92, 246, 0.4)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.3)';
    });
    btn.addEventListener('click', () => showFooter());
    document.body.appendChild(btn);
  }

  function mount() {
    dbg('mount()', 'href', window.location.href);
    if (document.getElementById(HOST_ID)) {
      dbg('mount skipped — host already present');
      return;
    }

    const host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);

    shadow = host.attachShadow({ mode: 'open' });
    loadStylesIntoShadow(shadow);

    const tpl = document.createElement('template');
    tpl.innerHTML = buildFooterHtml().trim();
    const rootNode = tpl.content.firstElementChild;
    if (!rootNode) {
      console.error('Salesforce Spotlight: failed to parse footer markup');
      return;
    }
    shadow.appendChild(rootNode);

    els = {
      root: qs(shadow, '.sfnav-root'),
      bar: qs(shadow, '.sfnav-bar'),
      input: qs(shadow, '#sfnavInput'),
      dropdown: qs(shadow, '#sfnavDropdown'),
      status: qs(shadow, '#sfnavStatus'),
      statusSummary: qs(shadow, '#sfnavStatusSummary'),
      statusCounts: qs(shadow, '#sfnavStatusCounts'),
      statusRow1: qs(shadow, '#sfnavStatusRow1'),
      statusRow2: qs(shadow, '#sfnavStatusRow2'),
      refresh: qs(shadow, '#sfnavRefresh'),
      close: qs(shadow, '#sfnavClose'),
    };

    try {
      const manifest = chrome.runtime.getManifest();
      const brandVer = qs(shadow, '#sfnavBrandVersion');
      if (brandVer && manifest && manifest.version) {
        brandVer.textContent = `v${manifest.version}`;
      }
    } catch {
      /* ignore */
    }

    els.input.addEventListener('input', onInput);
    els.input.addEventListener('keydown', onKeyDown);
    els.input.addEventListener('focus', () => {
      if (normalizeQuery(els.input.value)) {
        filtered = filterComponents(els.input.value);
        renderDropdown();
      }
    });

    els.refresh.addEventListener('click', () => {
      loadComponents(true);
    });

    els.close.addEventListener('click', () => hideFooter());

    document.addEventListener(
      'click',
      (e) => {
        if (!shadow || !els || !els.dropdown || els.dropdown.hidden) return;
        const path = e.composedPath();
        if (path.includes(els.root)) return;
        els.dropdown.hidden = true;
        els.dropdown.setAttribute('aria-hidden', 'true');
        els.input.setAttribute('aria-expanded', 'false');
        els.dropdown.innerHTML = '';
        selectedIndex = -1;
      },
      true
    );

    loadComponents(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
