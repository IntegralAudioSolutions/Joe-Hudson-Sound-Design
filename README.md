# Joe Hudson — Personal Portfolio
### joehudson.co.uk

Personal portfolio website for Joe Hudson, Senior Technical Sound Designer.  
Built with plain HTML, CSS, and vanilla JavaScript. No frameworks, no build tools.

---

## Project Structure

```
Joe-Hudson-Sound-Design/
├── index.html              ← Homepage (landing page)
├── style.css               ← Global stylesheet
├── script.js               ← Global JavaScript (sounds, animations, nav)
├── CNAME                   ← GitHub Pages custom domain config
├── README.md               ← This file
│
├── assets/
│   ├── images/             ← Studio photo, project screenshots
│   └── audio/              ← Optional short audio previews
│
└── pages/
    ├── work.html           ← Past projects deep-dive
    ├── reel.html           ← Demo reel (YouTube embeds)
    ├── disciplines.html    ← Skills, tools, specialisms
    └── contact.html        ← Contact form and social links
```

---

## Design Language

**LCARS-inspired** — based on the Star Trek: The Next Generation console aesthetic.  
Dark backgrounds, gold structural borders, coloured data readouts.

| Token     | Hex       | Usage                                      |
|-----------|-----------|--------------------------------------------|
| Gold      | `#d4ac50` | Structural borders, logo, LCARS elbows     |
| Bright gold | `#f0d060` | Name highlight, large numerals            |
| Cyan      | `#00c8e0` | Active states, data readouts, links        |
| Purple    | `#7060c8` | Role label, secondary accent               |
| Coral     | `#e87040` | Status indicators, alerts                  |
| Background | `#080a0f` | Page background                           |
| Surface   | `#0d1018` | Card and panel backgrounds                 |

**Fonts:**
- `Inter` — body text and headings
- `JetBrains Mono` — all HUD labels, data readouts, navigation, tags

---

## Adding Your Assets

### Studio Photo
Replace the placeholder in the hero section of `index.html`:
```html
<!-- Find this block in index.html and replace with: -->
<img src="assets/images/joe-hudson-studio.jpg"
     alt="Joe Hudson in his studio"
     class="hero-photo" />
```

### Project Images (Ribbon)
Replace placeholder `<div>` elements in the ribbon section:
```html
<div class="ribbon-item ribbon-item--gold">
  <img src="assets/images/fortnite-map.jpg" alt="Fortnite map audio" />
</div>
```

### Demo Reel (YouTube)
In `pages/reel.html`, embed your private YouTube links:
```html
<iframe
  src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
  title="Demo reel — Joe Hudson"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
  allowfullscreen>
</iframe>
```

---

## Deployment (GitHub Pages)

1. Push all files to the `main` branch of your GitHub repository
2. In GitHub → Settings → Pages → Source: set to `main` branch, root `/`
3. The `CNAME` file contains `joehudson.co.uk` — this links your custom domain
4. In your domain registrar (wherever you bought `joehudson.co.uk`), add:
   - A record: `@` → `185.199.108.153`
   - A record: `@` → `185.199.109.153`
   - A record: `@` → `185.199.110.153`
   - A record: `@` → `185.199.111.153`
   - CNAME record: `www` → `your-github-username.github.io`

---

## Assets Still to Add

- [ ] Studio photo of Joe
- [ ] Project screenshots cleared for public use
- [ ] Private YouTube demo reel links
- [ ] Short written bio (~100 words) for About section
- [ ] Full project credits list (titles, roles, studios)
- [ ] LinkedIn URL
- [ ] IMDb URL
- [ ] Favicon (`assets/images/favicon.ico`)

---

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge).  
The Web Audio API (UI sounds) requires user interaction before playing — this is a browser security rule, not a bug.

---

*Integral Audio Solutions Ltd · Registered in England & Wales*
