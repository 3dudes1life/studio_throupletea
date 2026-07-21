# Upload Instructions

## Safest first upload

Do not replace any live Throuple Tea website files.

Upload this complete folder as:

`studio-prototype/`

inside the `3dudes1life/ThroupleTea` repository, ideally on a prototype branch first.

The preview URL would normally become:

`https://throupletea.com/studio-prototype/`

or the equivalent GitHub Pages URL.

## Important privacy note

A public GitHub Pages folder is not truly private just because it is absent from navigation. Before using real guest information, protect the route with Cloudflare Access or move it behind the planned production authentication layer.

The included pages use `noindex,nofollow,noarchive`, but that is not access control.

## Files that must stay together

- All `.html` files
- `styles.css`
- All `.js` files
- The complete `assets/` folder

Do not upload only `index.html`; the screens depend on the shared files.

## Camera and microphone testing

Camera/microphone permission requires HTTPS or localhost. It may not work when the HTML is opened directly as a `file://` URL.

## No live-site integration yet

Do not add a public website navigation link until:

- the workflow is approved,
- access is protected,
- real guest data is stored securely,
- and the remote synchronization/backend phase is complete.
