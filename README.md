# Salesforce Spotlight

Chrome extension (Manifest V3) that adds a **Salesforce Spotlight** bar on Lightning and classic Salesforce domains. It loads metadata from your org (REST and Tooling APIs)—flows, objects, LWC bundles, Apex classes, **profiles**, **permission sets**, **permission set groups**, **Apex triggers**, and **Visualforce pages**—and lets you **search** with fuzzy multi-word matching. You can type a **component kind** as a keyword (for example **profile API access** to find a profile named “API Access”). Results **open** the matching setup page in a new tab.

**Repository:** [github.com/znAaron/SalesforceSpotlight](https://github.com/znAaron/SalesforceSpotlight)

<img width="966" height="473" alt="Screenshot 2026-04-07 at 3 55 09 PM" src="https://github.com/user-attachments/assets/d73ad1cc-1c02-4fc1-9677-7433b09e56bb" />

## Requirements

- Google Chrome (or another Chromium browser that supports Manifest V3 extensions)
- You must be **logged into Salesforce** in the same browser; the extension uses your **My Domain** session cookie for API calls.

## Install from ZIP (release package)

1. Download **`SalesforceSpotlight.zip`** from the [Releases](https://github.com/znAaron/SalesforceSpotlight/releases) page (e.g. release **1.4**).
2. **Unzip** the archive. You should see a folder whose **root** contains `manifest.json` (not an extra nested folder with only the zip name—if everything is inside one subfolder, use **that** folder in the next step).
3. Open Chrome and go to **`chrome://extensions`**.
4. Turn **Developer mode** **ON** (toggle in the top-right).
5. Click **Load unpacked**.
6. Select the **unzipped folder** (the one that contains `manifest.json` at the top level).
7. Optional: click the **puzzle** icon in the toolbar → **pin** **Salesforce Spotlight**.

Chrome does **not** install extensions by opening the ZIP directly—you must **extract** it first, then use **Load unpacked**.

## Install from source (this repository)

1. Clone or download this repo.
2. In Chrome, open **`chrome://extensions`**, enable **Developer mode**, click **Load unpacked**, and choose the repository folder (where `manifest.json` lives).

## Usage

- Open any matching Salesforce URL (production, sandbox, Lightning, or My Domain).
- **Toolbar settings:** click the **Salesforce Spotlight** extension icon to open the popup. **Default on page load** is at the top: choose **expanded** (full search bar) or **collapsed** (small pill). Below that, **search component types** lists every category (flows, objects, LWC, Apex, profiles, permission sets, permission set groups, triggers, VF pages). **All types are enabled by default**; turn off any you want to exclude from results. Settings are saved in the browser and apply to Salesforce tabs (including tabs that are already open).
- By default, new installs start with the bar **collapsed**; click the pill to expand the full spotlight bar.
- **Search:** every word you type must appear somewhere in the match (multi-token filter). You can include a **type keyword** in the query—e.g. **profile** plus part of the name—so results stay easy to narrow down.
- Use the spotlight bar to search; choose a result to open it in a new tab.
- Use **Refresh** on the bar to reload metadata from the org (results are cached for faster loads).
- Use **Close** on the bar to hide it and show only the pill again.

## Privacy & security

- The extension reads Salesforce **`sid`** cookies only for allowed Salesforce domains and uses them only to call Salesforce APIs from the extension’s service worker.
- No third-party servers; data stays between your browser and your Salesforce org.

## Version

**1.4.0** (Apr 2026). The authoritative version is in `manifest.json`. **1.4** adds search for **profiles**, **permission sets**, **permission set groups**, **Apex triggers**, and **Visualforce pages**; **type keywords** in search text (e.g. typing “profile” to filter to profiles); and an updated **settings popup** (default bar mode first; all component types on by default). Earlier releases added the toolbar popup and **collapsed** as the default bar for new installs.

## Publishing (maintainers)

To push this repo to GitHub (after [creating the empty repo](https://github.com/znAaron/SalesforceSpotlight)):

```bash
cd "/path/to/SalesforceSpotlight"
git remote add origin https://github.com/znAaron/SalesforceSpotlight.git   # skip if already added
git branch -M main
git push -u origin main
```

Use **GitHub CLI** (`gh`), a **personal access token** with HTTPS, or **SSH keys** if prompted for credentials.

To publish **release 1.4** with the ZIP attached:

1. On GitHub: **Releases** → **Draft a new release**.
2. Choose tag **`v1.4.0`** (create new tag) or a short tag like **`1.4`** if you prefer; set **Release title** to **1.4** or **Salesforce Spotlight 1.4**.
3. Upload **`SalesforceSpotlight.zip`** under **Attach binaries**.
4. Publish the release.

Or with GitHub CLI (if installed and authenticated):

```bash
gh release create v1.4.0 "/path/to/SalesforceSpotlight.zip" --repo znAaron/SalesforceSpotlight --title "1.4" --notes "Salesforce Spotlight v1.4.0 — profiles, permission sets/groups, triggers, VF pages; type keywords in search; settings layout (default bar first, all types on by default)"
```

## License

MIT
