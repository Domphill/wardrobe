# Wardrobe

Your clothes, photographed and cut out, so you can see everything you own, put outfits together, plan what to wear, and notice what you actually wear.

Open it at **<https://domphill.github.io/wardrobe/>**. There is no account and nothing to install: it runs in your browser, and everything you add stays on your own device.

## Putting it on your phone

- **iPhone or iPad:** open the link in Safari, tap *Share*, then *Add to Home Screen*. This also stops Safari from clearing the app's saved data if you don't open it for a while.
- **Android:** open the link in Chrome, tap the menu (three dots), then *Add to Home screen* or *Install app*.

## What it does

- **Closet:** photograph each piece against a plain background and the background is cut out automatically. Tap to tidy the cut-out if it needs it. The colours are read from the photo (the lighting is corrected using the background, so navy doesn't become black under a warm bulb) and the type is guessed from the outline: two legs are trousers, shoulders mean a top, and so on. Each item has a category, type, colours, brand, size, price, seasons and occasions. Search and filter the lot.
- **Outfits:** put cut-outs together on a canvas, move, resize, tilt and mirror them, and save the combination. **Mix and match** flicks through each kind of piece like a flip book, or shuffles a whole outfit, so you can try combinations quickly.
- **Calendar:** log what you wore each day, or plan an outfit for a day ahead. With a town set, the next ten days show their forecast, and each day offers outfit ideas for that weather that you can plan with a tap, or pick your own.
- **Today:** the Closet page suggests outfits for the day. Add your town under **More, Weather** and it uses the local forecast; without one it goes by the season. Ideas favour pieces that haven't been worn lately, and you can wear the idea, shuffle it, or save it as an outfit.
- **Stats:** most worn, not worn in 90 days, cost per wear, and the closet by category and colour.
- **Backup:** one file with everything in it, including photos, to move to another phone or keep safe.

## Tips for good cut-outs

- Lay the item flat on a plain, contrasting background: a bed sheet, a wall, a wooden floor.
- Even light and no hard shadows across the item.
- If some background is left, tap it. If part of the item disappeared, switch to *Tap restores* and tap it. The slider changes how much a tap takes.
- The tools work like a paint program: **Wand** (tap to remove or restore similar colours), **Select** (a brush that snaps to the item's edges, then *Keep only this* or *Remove this*), **Paint** (colour the item with a brush; *Keep shading* works like dye, *Solid* paints flat), **Eraser**, **Restore**, **Crop** and a **Dropper** for colours. *Remove skin* takes out arms, legs and faces in one go. Undo covers everything.
- For a photo of someone wearing the item: crop to it, or select it and keep only that.
- A white shirt on a white sheet won't work well: use a darker background for pale clothes.

## Where your things are kept

Everything, including the photos, is stored in the browser (or the home-screen app) on the device you are using. Nothing is sent to a server. The one exception is optional: if you add a town for the weather, that town's map position is sent to Open-Meteo (a free weather service) to fetch the forecast, and nothing else. Each device keeps its own wardrobe: use **More, Download a backup** and **Restore from a backup** to move it. Clearing the browser's site data, or deleting the home-screen app, erases it.

## Notes for making changes

- `src/` holds the app: plain JavaScript and CSS, no build step. `cutout.js` is the background removal, `store.js` the storage, `model.js` the wear counts and filters.
- `sw.js` caches the app so it opens offline. After changing any file, bump `VERSION` in `sw.js`, or phones keep using the old copy.
- Fonts are Alegreya and Alegreya Sans (SIL Open Font License), served from `fonts/`.
