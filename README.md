# Wardrobe

Your clothes, photographed and cut out, so you can see everything you own, put outfits together, plan what to wear, and notice what you actually wear.

Open it at **<https://domphill.github.io/wardrobe/>**. There is no account and nothing to install: it runs in your browser, and everything you add stays on your own device.

## Putting it on your phone

- **iPhone or iPad:** open the link in Safari, tap *Share*, then *Add to Home Screen*. This also stops Safari from clearing the app's saved data if you don't open it for a while.
- **Android:** open the link in Chrome, tap the menu (three dots), then *Add to Home screen* or *Install app*.

## What it does

- **Closet:** photograph each piece against a plain background and the background is cut out automatically. Tap to tidy the cut-out if it needs it. Each item has a category, type, colours (detected from the photo), brand, size, price, seasons and occasions. Search and filter the lot.
- **Outfits:** put cut-outs together on a canvas, move and resize them, and save the combination.
- **Calendar:** log what you wore each day, or plan an outfit for a day ahead.
- **Stats:** most worn, not worn in 90 days, cost per wear, and the closet by category and colour.
- **Backup:** one file with everything in it, including photos, to move to another phone or keep safe.

## Tips for good cut-outs

- Lay the item flat on a plain, contrasting background: a bed sheet, a wall, a wooden floor.
- Even light and no hard shadows across the item.
- If some background is left, tap it. If part of the item disappeared, switch to *Tap brings back* and tap it. The slider changes how much is removed.
- A white shirt on a white sheet won't work well: use a darker background for pale clothes.

## Where your things are kept

Everything, including the photos, is stored in the browser (or the home-screen app) on the device you are using. Nothing is sent to a server. Each device keeps its own wardrobe: use **More, Download a backup** and **Restore from a backup** to move it. Clearing the browser's site data, or deleting the home-screen app, erases it.

## Notes for making changes

- `src/` holds the app: plain JavaScript and CSS, no build step. `cutout.js` is the background removal, `store.js` the storage, `model.js` the wear counts and filters.
- `sw.js` caches the app so it opens offline. After changing any file, bump `VERSION` in `sw.js`, or phones keep using the old copy.
- Fonts are Alegreya and Alegreya Sans (SIL Open Font License), served from `fonts/`.
