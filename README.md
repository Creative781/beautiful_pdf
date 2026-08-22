# Beautiful PDF

Export Obsidian Markdown notes to styled PDFs. Map headings, body text, tables, callouts, and more to fonts and spacing in the settings UI, save named **document profiles**, and preview the real PDF before saving.

**Desktop only** (uses Electron `printToPDF`).

## What's new (since v1.1.2 on GitHub)

- **Settings tabs** — Page, Markdown, and **Add-ons** under each document profile
- **Header & footer placeholders** — Three slots per row; mix text with `{{page}}`, `{{title}}`, `{{date}}`, vault/folder paths, and YAML properties
- **Adjust tables** — Drag column/row borders, resize the whole table, equalize selected cells, and align the table block left / center / right on the page. Layouts save per note and carry into PDF export
- **Adjust images** — Size presets (S / M / L / Full), **pixel width** input, and block alignment (left / center / right). No text wrap
- **Horizontal rule styles** — Under Markdown → Horizontal rule: thin, thick, double, dashed, soft fade, or short center bar

## Features

- **Document profiles** — Named style sets (for example Report / Everyday / Proposal). Page, Markdown, and Add-ons all belong to the active profile.
- **Page** — Paper size, margins, header/footer (left · center · right), default line height (%), filename as title, print background
- **Markdown** — Fonts, size, weight, color, and spacing for headings (`#`–`######`), body, quotes, lists, tasks, code, tables, callouts, images, links, footnotes, embeds, and **horizontal rules** (line style presets)
- **Add-ons** — Optional extras beyond ordinary Markdown / Obsidian (see below). Each can be turned on or off per profile.
- **Box presets** — Accent bar, outline card, or soft fill for quotes, callouts, and note embeds
- **True PDF preview** — Same `printToPDF` pipeline as export (page breaks match the saved file)
- **System fonts** — Choose fonts installed on your computer (Font → Choose…), including Korean typefaces

## Add-ons

Add-ons are **PDF-only extras**. They do not change how the note looks in Obsidian. Turn each one on or off under **Settings → Beautiful PDF → Add-ons**. Page break, Adjust tables, Adjust images, and header/footer placeholders default to **on**. Numbered lists as headings default to **off**.

### Numbered lists as headings

Style normal numbered lists (`1. 2. 3.`) like headings **in the PDF only**. Obsidian keeps auto-numbering in the note; `#` headings and body text stay unchanged. Map top / nested / deeper levels to H1–H6 styles.

### Header & footer placeholders

Header and footer are each three slots (left, center, right). Empty slots show as **None**. Mix ordinary text with placeholders, for example `{{title}}` on the left and `{{page}}/{{pages}}` on the right. Each slot can reuse a Markdown element style (Body, Heading, Footnote, …) from the same profile.

| Placeholder | Meaning |
| --- | --- |
| `{{page}}` / `{{pages}}` | Current page / total pages |
| `{{date}}` | Today’s date (print day) |
| `{{title}}` | PDF title (filename or note title) |
| `{{filename}}` / `{{folder}}` / `{{vault}}` | File name, parent folder, vault name |
| `{{ctime}}` / `{{mtime}}` | File created / last edited date |
| `{{name}}` | Any other key from the note’s Properties (YAML). Blank if missing. |

Turn this add-on **off** if you want the `{{braces}}` printed as written.

### Page break

Honor `%%pdf-pagebreak%%` markers when generating the PDF. Insert the marker in a note, or run **Beautiful PDF: Insert page break**. If you turn this add-on off, markers are left as ordinary text and do not start a new page.

### Adjust tables

An optional layout step before preview/export.

- **Columns** — Drag inner vertical borders to redistribute column widths
- **Rows** — Drag inner horizontal borders to change row heights; drag the bottom edge to scale the whole table height
- **Table width** — Drag the right edge to shrink or widen the entire table
- **Selection** — Drag across cells; equalize column widths or row heights for the selection
- **Table alignment** — Align left / center / right on the page (the table block, not cell text)
- **Paper match** — Editor paper uses the active profile’s page size and margins so sizes match the PDF

Layouts are saved per note. If you turn this add-on off, the Adjust tables command, file-menu item, and preview button are hidden, and saved layouts are not applied.

### Adjust images

An optional layout step before preview/export.

- **Size** — S / M / L / Full presets, or type an exact **width in pixels** (converted to the content column)
- **Alignment** — Block left / center / right (no text wrap around images in PDF print)

Layouts are saved per note. If you turn this add-on off, Adjust images entry points are hidden and saved layouts are not applied.

### Horizontal rule styles

Under **Settings → Beautiful PDF → Markdown → Horizontal rule → Line style**, pick how `---` renders in the PDF:

| Style | Look |
| --- | --- |
| Thin solid | Default single line |
| Thick solid | Heavier line |
| Double line | Two parallel rules |
| Dashed | Dotted rule |
| Soft fade | Gradient that fades at the edges |
| Short center bar | Narrow bar centered on the page |

Also set line color and vertical margins there.

## Commands

| Command | Description |
| --- | --- |
| Beautiful PDF: Preview current note as PDF | Open a modal with a real PDF preview |
| Beautiful PDF: Adjust tables for PDF… | Resize tables, then open PDF preview (when the add-on is on) |
| Beautiful PDF: Adjust images for PDF… | Set image size and alignment, then open PDF preview (when the add-on is on) |
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
2. Choose a **Document Profile** at the top (or create / duplicate one). Everything below that belongs to the selected profile.
3. Use the **Page**, **Markdown**, and **Add-ons** tabs to style that profile. Put page numbers in Header or Footer with `{{page}}` / `{{pages}}`.
4. Open a note, then run **Preview** or **Export** from the command palette. Optionally run **Adjust tables…** or **Adjust images…** first if those add-ons are on.

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

---

# Beautiful PDF (한국어)

옵시디안 마크다운 노트를 스타일된 PDF로 내보냅니다. 제목·본문·표·콜아웃 등의 글꼴과 간격을 설정 UI에서 맞추고, 이름 붙인 **문서 프로필**로 저장한 뒤, 저장과 동일한 PDF를 미리 볼 수 있습니다.

**데스크톱 전용**입니다 (Electron `printToPDF` 사용).

## 새 기능 (GitHub v1.1.2 이후)

- **설정 탭** — 문서 프로필마다 Page, Markdown, **Add-ons** 탭으로 정리
- **머리글·바닥글 플레이스홀더** — 각 행을 왼쪽/가운데/오른쪽 세 칸으로; `{{page}}`, `{{title}}`, `{{date}}`, 보관함·폴더 경로, YAML 속성 등
- **표 조정 (Adjust tables)** — 열·행 경계 드래그, 표 전체 너비·높이, 선택 셀 균등화, 표 블록 **왼쪽/가운데/오른쪽 정렬**. 노트별 저장 후 PDF 반영
- **그림 조정 (Adjust images)** — S/M/L/Full, **픽셀 너비** 직접 입력, 블록 정렬 (텍스트 감싸기 없음)
- **가로선 스타일** — Markdown → Horizontal rule에서 실선·굵은선·이중선·점선·페이드·짧은 가운데 막대 선택

## 기능

- **문서 프로필** — Report / Everyday / Proposal처럼 이름 붙인 스타일 묶음입니다. Page, Markdown, Add-ons 설정은 모두 **지금 선택한 프로필**에 저장됩니다.
- **Page** — 용지 크기, 여백, 머리글/바닥글(왼쪽 · 가운데 · 오른쪽), 기본 줄간격(%), 파일명을 제목으로 쓰기, 배경 인쇄
- **Markdown** — `#`–`######`, 본문, 인용, 목록, 할 일, 코드, 표, 콜아웃, 이미지, 링크, 각주, 임베드, **가로선(`---`)** 의 글꼴·크기·굵기·색·간격
- **Add-ons** — 일반 마크다운·옵시디안 기능 위에 얹는 PDF 전용 추가 기능 (아래 참고). 프로필마다 켜고 끌 수 있습니다.
- **박스 프리셋** — 인용·콜아웃·노트 임베드에 액센트 바 / 외곽선 카드 / 연한 배경
- **실제 PDF 미리보기** — 내보내기와 같은 `printToPDF` 경로라 페이지 나눔이 저장 파일과 같습니다.
- **시스템 글꼴** — 컴퓨터에 설치된 글꼴을 고를 수 있습니다 (Font → Choose…). 한글 글꼴도 PDF에 바로 쓸 수 있습니다.

## Add-ons (추가 기능)

Add-ons는 **PDF에만 적용되는 추가 기능**입니다. 옵시디안에서 노트가 보이는 방식은 바꾸지 않습니다. **설정 → Beautiful PDF → Add-ons**에서 각각 켜고 끌 수 있습니다. 페이지 나누기, 표 조정, 그림 조정, 머리글/바닥글 플레이스홀더는 기본이 **켜짐**이고, 번호 목록을 제목처럼 쓰기만 기본이 꺼짐입니다.

### Numbered lists as headings (번호 목록을 제목처럼)

노트에는 평범한 번호 목록(`1. 2. 3.`)으로 두고, **PDF에서만** 제목 스타일을 입힙니다. 옵시디안의 자동 번호는 그대로이고, `#` 제목과 본문 스타일은 변하지 않습니다. 맨 위 / 한 단계 중첩 / 더 깊은 중첩을 H1–H6 스타일에 각각 연결할 수 있습니다.

### Header & footer placeholders (머리글·바닥글 플레이스홀더)

머리글과 바닥글은 각각 왼쪽 / 가운데 / 오른쪽 세 칸입니다. 비어 있으면 **None**으로 표시됩니다. 일반 글과 플레이스홀더를 섞을 수 있습니다. 예: 왼쪽 `{{title}}`, 오른쪽 `{{page}}/{{pages}}`. 각 칸은 같은 프로필의 마크다운 요소 스타일(본문, 제목, 각주 등)을 골라 쓸 수 있습니다.

| 플레이스홀더 | 의미 |
| --- | --- |
| `{{page}}` / `{{pages}}` | 현재 쪽 / 전체 쪽수 |
| `{{date}}` | 오늘 날짜 (인쇄일) |
| `{{title}}` | PDF 제목 (파일명 또는 노트 제목) |
| `{{filename}}` / `{{folder}}` / `{{vault}}` | 파일 이름, 상위 폴더, 보관함 이름 |
| `{{ctime}}` / `{{mtime}}` | 파일 만든 날 / 마지막 수정일 |
| `{{이름}}` | 노트의 속성(YAML)에 있는 다른 키. 없으면 빈칸 |

이 Add-on을 **끄면** `{{중괄호}}`가 그대로 인쇄됩니다.

### Page break (페이지 나누기)

`%%pdf-pagebreak%%` 표시를 PDF에서 실제 쪽 나눔으로 바꿉니다. 노트에 직접 넣거나 **Beautiful PDF: Insert page break** 명령을 쓰면 됩니다. 이 기능을 끄면 표시는 일반 텍스트로 남고 새 페이지가 시작되지 않습니다.

### Adjust tables (표 조정)

미리보기·내보내기 전에 표 레이아웃을 맞춥니다.

- **열** — 세로 경계를 드래그해 열 너비 재분배
- **행** — 가로 경계를 드래그해 행 높이 조절; 맨 아래 가장자리는 표 전체 높이
- **표 너비** — 오른쪽 가장자리를 드래그해 표 전체 크기 조절
- **선택** — 칸을 드래그해 선택 후 열 너비·행 높이 균등화
- **표 정렬** — 페이지에서 표 블록을 왼쪽 / 가운데 / 오른쪽 (셀 안 글 정렬과 별개)
- **용지 일치** — 편집 화면 종이 크기·여백이 활성 프로필과 같아 PDF와 맞음

레이아웃은 노트마다 저장됩니다. 이 기능을 끄면 명령·파일 메뉴·미리보기의 Adjust tables 버튼이 숨겨지고, 저장된 표 레이아웃도 PDF에 적용되지 않습니다.

### Adjust images (그림 조정)

미리보기·내보내기 전에 그림 크기·정렬을 맞춥니다.

- **크기** — S / M / L / Full, 또는 **픽셀 너비** 직접 입력 (콘텐츠 열 기준으로 변환)
- **정렬** — 블록 왼쪽 / 가운데 / 오른쪽 (PDF 인쇄에서는 글 감싸기 미지원)

레이아웃은 노트마다 저장됩니다. 이 기능을 끄면 Adjust images 진입점이 숨겨지고 저장된 그림 레이아웃도 PDF에 적용되지 않습니다.

### Horizontal rule (가로선 스타일)

**설정 → Beautiful PDF → Markdown → Horizontal rule → Line style**에서 `---`가 PDF에 어떻게 나올지 고릅니다.

| 스타일 | 모양 |
| --- | --- |
| Thin solid | 기본 가는 실선 |
| Thick solid | 굵은 실선 |
| Double line | 이중선 |
| Dashed | 점선 |
| Soft fade | 양끝으로 사라지는 그라데이션 |
| Short center bar | 가운데 짧은 막대 |

선 색과 위·아래 여백도 같이 조절할 수 있습니다.

## 명령

| 명령 | 설명 |
| --- | --- |
| Beautiful PDF: Preview current note as PDF | 실제 PDF 미리보기 열기 |
| Beautiful PDF: Adjust tables for PDF… | 표를 맞춘 뒤 PDF 미리보기 (해당 Add-on이 켜져 있을 때) |
| Beautiful PDF: Adjust images for PDF… | 그림 크기·정렬을 맞춘 뒤 PDF 미리보기 (해당 Add-on이 켜져 있을 때) |
| Beautiful PDF: Export current note to PDF | 활성 프로필로 내보내기 |
| Beautiful PDF: Export current note with profile… | 프로필을 고른 뒤 내보내기 |
| Beautiful PDF: Insert page break | 커서 위치에 페이지 나누기 표시 넣기 |

## 설치

### 커뮤니티 플러그인 (승인 후)

옵시디안 설정 → 커뮤니티 플러그인에서 **Beautiful PDF**를 검색하세요.

### 수동 설치

1. [최신 릴리스](https://github.com/Creative781/beautiful_pdf/releases)에서 `main.js`, `manifest.json`, `styles.css`를 받습니다.
2. 보관함의 `.obsidian/plugins/` 안에 `beautiful-pdf` 폴더를 만듭니다.
3. 받은 파일을 그 폴더에 넣습니다.
4. 옵시디안 설정에서 플러그인을 켭니다 (데스크톱).

### BRAT (베타)

1. [BRAT 플러그인](https://github.com/TfTHacker/obsidian42-brat)을 설치합니다.
2. 베타 플러그인으로 `https://github.com/Creative781/beautiful_pdf` 를 추가합니다.

## 사용

1. **설정 → Beautiful PDF**를 엽니다.
2. 맨 위에서 **Document Profile**을 고릅니다 (새로 만들거나 복제할 수도 있습니다). 그 아래 설정은 모두 선택한 프로필에 속합니다.
3. **Page**, **Markdown**, **Add-ons** 탭에서 그 프로필을 다듬습니다. 쪽 번호는 머리글/바닥글에 `{{page}}` / `{{pages}}`로 넣습니다.
4. 노트를 연 뒤 명령 팔레트에서 **Preview** 또는 **Export**를 실행합니다. Add-on이 켜져 있으면 먼저 **Adjust tables…** 또는 **Adjust images…**로 레이아웃을 맞출 수 있습니다.

한글 시스템 글꼴(예: KoPubWorldDotum)은 컴퓨터에 설치되어 있어야 PDF에 나타납니다.

## 개발

```bash
npm install
npm run build
```

이 폴더를 `.obsidian/plugins/beautiful-pdf/`에 복사하거나 심볼릭 링크로 연결하세요 (`manifest.json`, `main.js`, `styles.css` 필요).

## 라이선스

MIT

## 연결

- **YouTube**: [Creative781](https://www.youtube.com/@creative781)
- **Blog**: [Creative781 Blog](https://creative781.cafe24.com/)

## 후원

- **Buy me a coffee**: [Support the developer](https://www.buymeacoffee.com/creative781)
