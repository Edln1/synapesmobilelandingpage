# Synapses Landing (GitHub Pages)

## What’s in this folder

```
github-pages/
  index.html          ← the whole site (one HTML file)
  videos/
    hero.mp4          ← slide 1 background
    slide2.mp4        ← slide 2 background
    ava.mp4           ← Ava talk demo (has audio)
    ava-poster.png    ← poster before Ava video plays
  README.md
```

**Note:** Video files cannot live *inside* the HTML (they’re megabytes each).  
They must sit in `videos/` next to `index.html`. The HTML only **links** to them.

## Upload to GitHub Pages

1. Create a repo (e.g. `synapses-landing`)
2. Upload **everything in this folder** (keep the `videos` folder)
3. Settings → Pages → Deploy from branch `main` / root
4. Site URL will be like:  
   `https://YOURUSER.github.io/synapses-landing/`

## Local test

Open a terminal in this folder:

```bash
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/`

## Customize

In `index.html`, search for:

```js
const APP = {
  open: '#companion',  // ← put your app URL here
  avaPhone: 'tel:+18105250269',
};
```
