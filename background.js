/**
 * Salesforce Spotlight — background service worker.
 *
 * Key: Lightning (*.lightning.force.com) and My Domain (*.my.salesforce.com)
 * have DIFFERENT session IDs. REST API only works with the My Domain sid.
 * We read the sid cookie from the My Domain origin and use Bearer auth.
 */

const SFNAV_DEBUG = true;

function dbg(...args) {
  if (SFNAV_DEBUG) console.log('[Spotlight BG]', ...args);
}
function dbgWarn(...args) {
  if (SFNAV_DEBUG) console.warn('[Spotlight BG]', ...args);
}
function sidHint(sid) {
  if (!sid) return '(none)';
  return `${String(sid).slice(0, 8)}…(len ${String(sid).length})`;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = 'sfnav_v5_';
const API_VERSIONS = ['v66.0', 'v65.0', 'v64.0', 'v63.0', 'v62.0', 'v61.0', 'v60.0'];

function resolveMyDomainOrigin(tabUrl) {
  try {
    const host = new URL(tabUrl).hostname;
    if (host.endsWith('.sandbox.lightning.force.com')) {
      const prefix = host.slice(0, -'.sandbox.lightning.force.com'.length);
      return `https://${prefix}.sandbox.my.salesforce.com`;
    }
    if (host.endsWith('.lightning.force.com')) {
      const prefix = host.slice(0, -'.lightning.force.com'.length);
      return `https://${prefix}.my.salesforce.com`;
    }
    return new URL(tabUrl).origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function resolveUiOrigin(tabUrl) {
  try {
    return new URL(tabUrl).origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function firstDefined(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== '') return v;
  }
  return '';
}

function cacheKey(host) {
  return `${CACHE_PREFIX}${host}`;
}

/**
 * Read the sid cookie from My Domain (the one that works for REST API).
 * Lightning sid does NOT work — it's a different session.
 */
async function getMyDomainSession(tabUrl) {
  const myDomainOrigin = resolveMyDomainOrigin(tabUrl);
  const uiOrigin = resolveUiOrigin(tabUrl);

  dbg('resolving session', { uiOrigin, myDomainOrigin });

  if (myDomainOrigin) {
    try {
      const c = await chrome.cookies.get({ url: `${myDomainOrigin}/`, name: 'sid' });
      if (c && c.value) {
        dbg('sid from My Domain ✓', { origin: myDomainOrigin, sid: sidHint(c.value) });
        return { sid: c.value.trim(), apiBase: myDomainOrigin, uiOrigin };
      }
      dbg('no sid cookie on My Domain', myDomainOrigin);
    } catch (e) {
      dbgWarn('cookies.get My Domain error', e);
    }
  }

  dbg('scanning all sid cookies...');
  try {
    const all = await chrome.cookies.getAll({ name: 'sid' });
    dbg('total sid cookies:', all.length);
    for (const c of all) {
      const d = (c.domain || '').toLowerCase();
      dbg('  cookie domain:', d, 'sid:', sidHint(c.value));
    }
    for (const c of all) {
      const d = (c.domain || '').toLowerCase();
      if (d.includes('.my.salesforce.com') || d.includes('.sandbox.my.salesforce.com')) {
        const host = d.startsWith('.') ? d.slice(1) : d;
        const origin = `https://${host}`;
        dbg('sid from cookie scan (My Domain) ✓', { domain: d, sid: sidHint(c.value) });
        return { sid: c.value.trim(), apiBase: origin, uiOrigin };
      }
    }
    for (const c of all) {
      const d = (c.domain || '').toLowerCase();
      if (d.includes('salesforce.com') && !d.includes('lightning')) {
        const host = d.startsWith('.') ? d.slice(1) : d;
        const origin = `https://${host}`;
        dbg('sid from cookie scan (salesforce.com fallback) ✓', { domain: d, sid: sidHint(c.value) });
        return { sid: c.value.trim(), apiBase: origin, uiOrigin };
      }
    }
  } catch (e) {
    dbgWarn('cookies.getAll error', e);
  }

  dbgWarn('no usable sid cookie found');
  return null;
}

async function sfdcFetch(url, sid) {
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sid}`,
      Accept: 'application/json',
    },
  });
}

async function findApiVersion(apiBase, sid) {
  for (const ver of API_VERSIONS) {
    const url = `${apiBase}/services/data/${ver}/limits`;
    const res = await sfdcFetch(url, sid);
    if (res.ok) {
      dbg('API version OK:', ver, 'on', apiBase);
      return ver;
    }
    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => '');
      dbgWarn('Bearer rejected on', apiBase, res.status, text.slice(0, 120));
      return null;
    }
  }
  return null;
}

async function soqlQuery(apiBase, sid, apiVersion, soql, label, tooling) {
  const records = [];
  const endpoint = tooling ? 'tooling/query' : 'query';
  let path = `/services/data/${apiVersion}/${endpoint}?q=${encodeURIComponent(soql)}`;
  while (path) {
    const url = path.startsWith('http') ? path : `${apiBase}${path}`;
    const res = await sfdcFetch(url, sid);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      dbgWarn(`${label} HTTP ${res.status}`, text.slice(0, 160));
      throw new Error(`${label} ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = await res.json();
    if (Array.isArray(body.records)) records.push(...body.records);
    path = body.nextRecordsUrl
      ? (body.nextRecordsUrl.startsWith('http') ? body.nextRecordsUrl : `${apiBase}${body.nextRecordsUrl}`)
      : null;
  }
  dbg(`${label}:`, records.length, 'records');
  return records;
}

async function fetchSobjects(apiBase, sid, apiVersion) {
  const url = `${apiBase}/services/data/${apiVersion}/sobjects/`;
  const res = await sfdcFetch(url, sid);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sobjects ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  const list = Array.isArray(body.sobjects) ? body.sobjects : [];
  dbg('sobjects:', list.length);
  return list;
}

function buildComponentList(uiOrigin, flows, sobjects, lwcs, apexes) {
  const items = [];
  const o = uiOrigin.replace(/\/$/, '');

  for (const f of flows) {
    const label = firstDefined(f, ['Label', 'label']) || firstDefined(f, ['ApiName', 'apiName']) || 'Flow';
    const apiName = firstDefined(f, ['ApiName', 'apiName']);
    const id = firstDefined(f, ['Id', 'id']);
    if (!id) continue;
    const avId = firstDefined(f, ['ActiveVersionId', 'activeVersionId']);
    const pt = firstDefined(f, ['ProcessType', 'processType']);
    const name = apiName ? `${label} (${apiName})` : label;
    items.push({
      type: 'Flow', name,
      searchText: `${label} ${apiName} ${pt}`.toLowerCase(),
      url: avId
        ? `${o}/builder_platform_interaction/flowBuilder.app?flowId=${encodeURIComponent(avId)}`
        : `${o}/lightning/setup/Flows/page?address=%2F${encodeURIComponent(id)}`,
    });
  }
  for (const s of sobjects) {
    const apiName = s.name || s.Name;
    if (!apiName || !s.retrieveable || apiName.endsWith('__ChangeEvent')) continue;
    const label = s.label || s.Label || apiName;
    items.push({
      type: 'Object',
      name: `${label} (${apiName})`,
      searchText: `${label} ${apiName}`.toLowerCase(),
      url: `${o}/lightning/setup/ObjectManager/${encodeURIComponent(apiName)}/Details/view`,
    });
  }
  for (const b of lwcs) {
    const dev = firstDefined(b, ['DeveloperName', 'developerName']) || firstDefined(b, ['MasterLabel', 'masterLabel']) || 'LWC';
    const label = firstDefined(b, ['MasterLabel', 'masterLabel']) || dev;
    const id = firstDefined(b, ['Id', 'id']);
    if (!id) continue;
    const name = label !== dev ? `${label} (${dev})` : dev;
    items.push({
      type: 'LWC', name,
      searchText: `${label} ${dev}`.toLowerCase(),
      url: `${o}/lightning/setup/LightningComponentBundles/page?address=%2F${id}`,
    });
  }
  for (const a of apexes) {
    const n = firstDefined(a, ['Name', 'name']);
    const id = firstDefined(a, ['Id', 'id']);
    if (!n || !id) continue;
    items.push({
      type: 'Apex', name: n,
      searchText: n.toLowerCase(),
      url: `${o}/lightning/setup/ApexClasses/page?address=%2F${id}`,
    });
  }
  return items;
}

async function loadFromNetwork(tabUrl) {
  const session = await getMyDomainSession(tabUrl);
  if (!session) {
    throw new Error('No My Domain sid cookie. Make sure you are logged in.');
  }
  const { sid, apiBase, uiOrigin } = session;
  dbg('loadFromNetwork', { apiBase, sid: sidHint(sid) });

  const apiVersion = await findApiVersion(apiBase, sid);
  if (!apiVersion) {
    throw new Error(
      `Bearer sid from My Domain (${apiBase}) was rejected. ` +
      'Try logging out and back in to Salesforce, then click Refresh.'
    );
  }

  const [flows, sobjects, lwcs, apexes] = await Promise.all([
    soqlQuery(apiBase, sid, apiVersion,
      'SELECT Id,Label,ApiName,ProcessType,ActiveVersionId FROM FlowDefinitionView', 'flows', false
    ).catch(e => { dbgWarn('flows', e); return []; }),
    fetchSobjects(apiBase, sid, apiVersion).catch(e => { dbgWarn('sobjects', e); return []; }),
    soqlQuery(apiBase, sid, apiVersion,
      'SELECT Id,DeveloperName,MasterLabel FROM LightningComponentBundle', 'lwc', true
    ).catch(e => { dbgWarn('lwc', e); return []; }),
    soqlQuery(apiBase, sid, apiVersion,
      "SELECT Id,Name,NamespacePrefix FROM ApexClass WHERE NamespacePrefix = null", 'apex', true
    ).catch(e => { dbgWarn('apex', e); return []; }),
  ]);

  const components = buildComponentList(uiOrigin, flows, sobjects, lwcs, apexes);
  const counts = { flows: flows.length, objects: sobjects.length, lwc: lwcs.length, apex: apexes.length };
  dbg('built', components.length, 'components', counts);
  return { components, counts, uiOrigin, apiBase, apiVersion };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.action !== 'fetchComponents') return false;

  const tabUrl = message.tabUrl || '';
  const forceRefresh = Boolean(message.forceRefresh);
  let host;
  try { host = new URL(tabUrl).host; } catch { sendResponse({ ok: false, error: 'Bad URL' }); return false; }

  dbg('fetchComponents', { host, forceRefresh });

  (async () => {
    try {
      const key = cacheKey(host);
      if (!forceRefresh) {
        const stored = await chrome.storage.local.get(key);
        const entry = stored[key];
        if (entry && Array.isArray(entry.components) && entry.components.length > 0 && entry.updatedAt) {
          const age = Date.now() - entry.updatedAt;
          if (age < CACHE_TTL_MS) {
            dbg('cache HIT', key, entry.components.length, 'items, age', age);
            sendResponse({ ok: true, components: entry.components, cached: true, counts: entry.counts });
            return;
          }
        }
      }
      const fresh = await loadFromNetwork(tabUrl);
      await chrome.storage.local.set({
        [key]: { updatedAt: Date.now(), components: fresh.components, counts: fresh.counts },
      });
      dbg('stored', fresh.components.length, 'components');
      sendResponse({ ok: true, components: fresh.components, cached: false, counts: fresh.counts });
    } catch (err) {
      dbgWarn('error', err);
      sendResponse({ ok: false, error: err && err.message ? err.message : String(err) });
    }
  })();
  return true;
});
