# GitHub Pages design preview

GitHub-only hosting serves the root index.html, pages/ preview styles, and six sanitized reference boards from the user-supplied offline design HTML. It does not run the Preact applications or Node backend. All reference numbers are sample data. Buttons inside boards are deliberately inert, scripts are stripped, local font licenses are preserved, and embedded frames have a restrictive sandbox and CSP. Reference boards preserve their original fixed layouts; the surrounding page reflows and boards scroll horizontally on narrow devices.

Publishing source: feature/luxury-venue-platform, repository root, with .nojekyll. Enable HTTPS and verify the Pages deployment status before reporting the site live. Expected project URL: https://samrickie.github.io/cloud_menu/ (not a completion claim).

Validate locally with Node 24: `node tools/serve-pages.mjs`. Open http://127.0.0.1:4180/cloud_menu/. Browser verification: `pnpm exec playwright test --config playwright.pages.config.ts` (LOCAL_EDGE=1 uses installed Edge on Windows).

No sign-in, live orders, tenant security, signed QR creation, realtime staff screens, real dashboard metrics or payments run on this preview. These require the backend described in the architecture docs. The operational application remains separate from the reference showcase. Do not enter customer information or treat sample QR artwork as ordering credentials.
