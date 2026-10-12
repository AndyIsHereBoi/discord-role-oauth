# wikijs-discord-role-auth
Wikijs redirects over to my server for discord verification, then allows you to login if you pass

## Configuration

All runtime values live in `config.json`. Nothing is hardcoded in `index.js` or `index.html`.

| Key | Description |
| --- | --- |
| `host` | Public base URL of this server (used to derive default URLs). |
| `port` | Port the Express server listens on. |
| `clientId` | Discord application client ID. |
| `clientSecret` | Discord application client secret. |
| `redirect_uri` | OAuth redirect URI registered in the Discord app (must match exactly). Falls back to `${host}/authorize`. |
| `discordApiBaseUrl` | Base URL for the Discord API (e.g. `https://discord.com/api/v10`). |
| `discordOauthUrl` | Full Discord authorize URL used by `/redirectdiscord`. |
| `wikiJsRedirectUrl` | URL Wiki.js gave you as the provider callback. The auth `code` is appended. Falls back to `${host}/callback`. |
| `checkInGuildId` | Guild ID to check membership in. |
| `checkForRoleId` | Role ID the member must have to be allowed in. |

`index.js` resolves `redirect_uri`, `wikiJsRedirectUrl`, the Discord API base and the authorize
URL from `config.json` when the server starts, so the redirect target is always driven by
configuration (nothing is hardcoded).

### Wiki.js provider settings

- Auth URL: `{host}/redirectdiscord`
- Token URL: `{host}/codetotoken`
- Info URL: `{host}/getuserinfo`
- Identifier Path: `$.userId`
- Email Path: `$.email`
- Username Path: `$.displayName`
