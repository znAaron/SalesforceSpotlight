# Salesforce Spotlight

Chrome extension (Manifest V3) that adds a **Salesforce Spotlight** bar on Lightning and classic Salesforce domains. It loads flows, custom objects, LWC bundles, and Apex classes from your org (via the REST and Tooling APIs), lets you **search** with fuzzy multi-word matching, and **opens** the matching setup page in a new tab.

**Repository:** [github.com/znAaron/SalesforceSpotlight](https://github.com/znAaron/SalesforceSpotlight)

## Requirements

- Google Chrome (or another Chromium browser that supports Manifest V3 extensions)
- You must be **logged into Salesforce** in the same browser; the extension uses your **My Domain** session cookie for API calls.

## Install from ZIP (release package)

1. Download **`SalesforceSpotlight.zip`** from the [Releases](https://github.com/znAaron/SalesforceSpotlight/releases) page (e.g. release **1.2**).
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
- Use the spotlight bar at the bottom to search; choose a result to open it in a new tab.
- Use **Refresh** to reload metadata from the org (results are cached for faster loads).

## Privacy & security

- The extension reads Salesforce **`sid`** cookies only for allowed Salesforce domains and uses them only to call Salesforce APIs from the extension’s service worker.
- No third-party servers; data stays between your browser and your Salesforce org.

## Version

Current extension version is defined in `manifest.json` (see `version` field).

## License

Specify your license here (e.g. MIT) if you publish this publicly.
