# Owner social sign-in

Google and GitHub use server-side authorization-code flows with S256 PKCE, random state, encrypted HttpOnly SameSite=Lax cookies, a five-minute authorization lifetime, and a one-minute single-use completion ticket. Application bearer tokens and provider access tokens never appear in redirect URLs or browser storage. Google ID tokens require signature/issuer/audience/expiry/issued-at/nonce and verified email. GitHub identity is re-read from its API and requires a verified primary email. Provider tokens are discarded after login.

Identities are keyed by provider, canonical issuer and immutable subject, never display names. Existing email accounts are not silently linked. Sign in using the existing method instead; explicit authenticated linking is future work. Disabled owner accounts cannot sign in. OWNER_REGISTRATION_ENABLED controls new social accounts as well as password registrations. Only fully configured providers are enabled in the owner UI. An unavailable provider is not a simulated login.

Configure these secrets in Render Environment, never Git or chat:

- PUBLIC_ORIGIN: the deployed HTTPS origin, without /owner/.
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: create a Web application OAuth client in Google Cloud, configure the consent screen/test users as appropriate, and register exactly `https://YOUR-HOST/v1/owner/oauth/google/callback`.
- GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET: create an OAuth App under GitHub Developer Settings. Set the homepage to the deployed origin and callback to `https://YOUR-HOST/v1/owner/oauth/github/callback`. Requested scopes are read:user and user:email, not repository access.

The local fixture intentionally has no provider credentials; its buttons explain that sign-in is unconfigured. Do not enter a personal password into a fake provider page. Credentials for Google/GitHub developer applications cannot be inferred from the connected Codex plugins.

References: https://developers.google.com/identity/openid-connect/openid-connect and https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps . Local protocol tests use a test identity adapter and locally signed JWTs; these are not claims of successful live Google/GitHub sign-in. Live provider-console setup and sign-in remain deployment acceptance checks.
