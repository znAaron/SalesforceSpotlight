/**
 * Salesforce Spotlight — popup settings (toolbar icon).
 * Persists to chrome.storage.local under key sfnav_settings.
 */

const SETTINGS_KEY = 'sfnav_settings';

const DEFAULT_SETTINGS = {
  enabledTypes: {
    Flow: true,
    Object: true,
    LWC: true,
    Apex: true,
    Profile: true,
    PermSet: true,
    PermSetGroup: true,
    Trigger: true,
    VFPage: true,
  },
  defaultDisplay: 'collapsed',
};

function mergeWithDefaults(stored) {
  const enabledTypes = { ...DEFAULT_SETTINGS.enabledTypes };
  if (stored && stored.enabledTypes && typeof stored.enabledTypes === 'object') {
    for (const k of Object.keys(DEFAULT_SETTINGS.enabledTypes)) {
      if (typeof stored.enabledTypes[k] === 'boolean') {
        enabledTypes[k] = stored.enabledTypes[k];
      }
    }
  }
  let defaultDisplay = DEFAULT_SETTINGS.defaultDisplay;
  if (stored && (stored.defaultDisplay === 'expanded' || stored.defaultDisplay === 'collapsed')) {
    defaultDisplay = stored.defaultDisplay;
  }
  return { enabledTypes, defaultDisplay };
}

function getSettingsFromForm() {
  const enabledTypes = {
    Flow: Boolean(document.getElementById('typeFlow')?.checked),
    Object: Boolean(document.getElementById('typeObject')?.checked),
    LWC: Boolean(document.getElementById('typeLwc')?.checked),
    Apex: Boolean(document.getElementById('typeApex')?.checked),
    Profile: Boolean(document.getElementById('typeProfile')?.checked),
    PermSet: Boolean(document.getElementById('typePermSet')?.checked),
    PermSetGroup: Boolean(document.getElementById('typePermSetGroup')?.checked),
    Trigger: Boolean(document.getElementById('typeTrigger')?.checked),
    VFPage: Boolean(document.getElementById('typeVFPage')?.checked),
  };
  const expanded = document.getElementById('displayExpanded');
  const defaultDisplay =
    expanded && expanded.checked ? 'expanded' : 'collapsed';
  return { enabledTypes, defaultDisplay };
}

function applySettingsToForm(settings) {
  const { enabledTypes, defaultDisplay } = settings;
  const flow = document.getElementById('typeFlow');
  const object = document.getElementById('typeObject');
  const lwc = document.getElementById('typeLwc');
  const apex = document.getElementById('typeApex');
  const profile = document.getElementById('typeProfile');
  const permSet = document.getElementById('typePermSet');
  const permSetGroup = document.getElementById('typePermSetGroup');
  const trigger = document.getElementById('typeTrigger');
  const vfPage = document.getElementById('typeVFPage');
  if (flow) flow.checked = enabledTypes.Flow !== false;
  if (object) object.checked = enabledTypes.Object !== false;
  if (lwc) lwc.checked = enabledTypes.LWC !== false;
  if (apex) apex.checked = enabledTypes.Apex !== false;
  if (profile) profile.checked = enabledTypes.Profile !== false;
  if (permSet) permSet.checked = enabledTypes.PermSet !== false;
  if (permSetGroup) permSetGroup.checked = enabledTypes.PermSetGroup !== false;
  if (trigger) trigger.checked = enabledTypes.Trigger !== false;
  if (vfPage) vfPage.checked = enabledTypes.VFPage !== false;

  const expanded = document.getElementById('displayExpanded');
  const collapsed = document.getElementById('displayCollapsed');
  if (defaultDisplay === 'collapsed') {
    if (collapsed) collapsed.checked = true;
  } else {
    if (expanded) expanded.checked = true;
  }
}

function saveSettings(settings) {
  return chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

async function loadAndApply() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = data[SETTINGS_KEY];
  const settings = mergeWithDefaults(raw);
  applySettingsToForm(settings);
}

function wireTypeToggles() {
  const ids = [
    'typeFlow',
    'typeObject',
    'typeLwc',
    'typeApex',
    'typeProfile',
    'typePermSet',
    'typePermSetGroup',
    'typeTrigger',
    'typeVFPage',
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        saveSettings(getSettingsFromForm());
      });
    }
  }
}

function wireDisplayRadios() {
  const expanded = document.getElementById('displayExpanded');
  const collapsed = document.getElementById('displayCollapsed');
  for (const el of [expanded, collapsed]) {
    if (el) {
      el.addEventListener('change', () => {
        saveSettings(getSettingsFromForm());
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAndApply().catch(() => {
    applySettingsToForm(DEFAULT_SETTINGS);
  });
  wireTypeToggles();
  wireDisplayRadios();
});
