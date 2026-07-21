# Podcast Brain Studio 3.1

This corrects the architecture from v3.0.

## Studio responsibilities
1. Prepare
2. Record
3. Wrap
4. Send one completed episode packet to the main dashboard

The Studio no longer owns editing, publishing, promotion, archives, or the long-term content vault.

## Included

### `studio/`
Upload these files to `studio_throupletea`:
- `index.html`
- `studio.css`
- `studio.js`
- `assets/podcast-artwork.jpg`

### `dashboard-bridge/`
- `dashboard-bridge.js`: receiver/import layer for the main dashboard
- `inbox-demo.html`: a working proof-of-concept dashboard inbox

## Handoff behavior
The Send button creates a structured `podcast-brain-episode-packet` containing:
- episode plan
- run of show
- recording duration
- questions
- must-mentions
- timestamped markers
- wrap notes
- generated editing/content tasks
- clip candidates
- cuts and sensitive markers
- future topics
- running jokes

It writes to a dashboard inbox in localStorage, broadcasts to another open same-origin tab, and allows a JSON download as a fallback.

## Production note
Because the Studio and Dashboard currently live in separate GitHub repositories/domains, browser localStorage cannot automatically cross domains. The provided JSON import works now. A true one-click cross-domain handoff will need a shared data layer such as Cloudflare Workers/KV, Supabase, or Firebase. The packet schema is already designed for that future connection.
