# Beautiful PDF

Export Obsidian Markdown notes to styled PDFs. Map headings, body text, tables, callouts, and more to fonts and spacing in the settings UI, save named profiles, and preview the real PDF before saving.

**Desktop only** (uses Electron `printToPDF`).

## Features

- **Element styles** — Configure headings (`#`–`######`), body, quotes, lists, tasks, code, tables, callouts, images, links, footnotes, and embeds
- **Page setup** — Paper size, margins, line height (%), page numbers, header/footer alignment, filename as title
- **Profiles** — Named style sets (e.g. Report / Everyday / Proposal) you can switch between
- **Box presets** — Accent bar, outline card, or soft fill for quotes, callouts, and note embeds
- **True PDF preview** — Same `printToPDF` pipeline as export (page breaks match the saved file)
- **Page breaks** — Insert `%%pdf-pagebreak%%` or run **Beautiful PDF: Insert page break**

## Commands

| Command | Description |
| --- | --- |
| Beautiful PDF: Preview current note as PDF | Open a modal with a real PDF preview |
| Beautiful PDF: Export current note to PDF | Export using the active profile |
| Beautiful PDF: Export current note with profile… | Pick a profile, then export |
| Beautiful PDF: Insert page break | Insert a page-break marker at the cursor |

## Installation

### Community plugins (after approval)

Search for **Beautiful PDF** in Obsidian Settings → Community plugins.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Creative781/beautiful_pdf/releases).
2. Create a folder named `beautiful-pdf` inside your vault's `.obsidian/plugins/` directory.
3. Place the downloaded files in that folder.
4. Enable the plugin in Obsidian settings (desktop).

### BRAT (beta)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. Add beta plugin: `https://github.com/Creative781/beautiful_pdf`

## Usage

1. Open **Settings → Beautiful PDF**.
2. Pick a profile (or create one) and adjust page / Markdown element styles.
3. Open a note, then run **Preview** or **Export** from the command palette.

Korean system fonts (for example KoPubWorldDotum) must be installed on the computer to appear in the PDF.

## Develop

```bash
npm install
npm run build
```

Copy or symlink this folder to `.obsidian/plugins/beautiful-pdf/` (needs `manifest.json`, `main.js`, `styles.css`).

## License

MIT

## Connect

- **YouTube**: [Creative781](https://www.youtube.com/@creative781)
- **Blog**: [Creative781 Blog](https://creative781.cafe24.com/)

## Support

- **Buy me a coffee**: [Support the developer](https://www.buymeacoffee.com/creative781)
