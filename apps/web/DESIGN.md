---
name: Hostly
description: Gestão de reservas para aluguel de temporada, em azul Prussian, com tema claro e escuro.
colors:
  prussian: '#13293d'
  sapphire: '#006494'
  celadon: '#247ba0'
  carolina: '#1b98e0'
  azure: '#e8f1f2'
  background: '#f7fafb'
  foreground: '#13293d'
  card: '#ffffff'
  muted-foreground: '#4a6378'
  border: '#d2e1e5'
  input: '#c4d7dc'
  destructive: '#c53030'
  success: '#1f8a5b'
  background-dark: '#0b1a27'
  foreground-dark: '#e8f1f2'
  card-dark: '#13293d'
  muted-dark: '#18324a'
  muted-foreground-dark: '#9db6c4'
  accent-dark: '#1d3a52'
  border-dark: '#24425a'
  input-dark: '#2b4d68'
  destructive-dark: '#f56565'
  success-dark: '#48bb78'
  sidebar-dark: '#08131d'
  band: '#13293d'
  band-foreground: '#e8f1f2'
  band-accent: '#1d3a52'
  band-border: '#2e5170'
  property-1: '#0369a1'
  property-2: '#047857'
  property-3: '#fbbf24'
  property-4: '#be123c'
  property-5: '#6d28d9'
  property-6: '#0f766e'
  property-7: '#f97316'
  property-8: '#4338ca'
typography:
  display:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '3.75rem'
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: '-0.025em'
  title-sm:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.43
  body-lg:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.33
rounded:
  sm: '6px'
  md: '8px'
  lg: '10px'
  xl: '14px'
  full: '9999px'
spacing:
  xs: '8px'
  sm: '16px'
  md: '24px'
  lg: '32px'
components:
  button-primary:
    backgroundColor: '{colors.sapphire}'
    textColor: '{colors.card}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-primary-dark:
    backgroundColor: '{colors.carolina}'
    textColor: '{colors.background-dark}'
    rounded: '{rounded.md}'
    height: '36px'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-ghost-hover:
    backgroundColor: '{colors.azure}'
    textColor: '{colors.sapphire}'
    rounded: '{rounded.md}'
  button-band-primary:
    backgroundColor: '{colors.carolina}'
    textColor: '{colors.card}'
    rounded: '{rounded.md}'
    padding: '0 24px'
    height: '40px'
  button-band-ghost-hover:
    backgroundColor: '{colors.band-accent}'
    textColor: '{colors.band-foreground}'
    rounded: '{rounded.md}'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    padding: '4px 12px'
    height: '36px'
  badge-secondary:
    backgroundColor: '{colors.azure}'
    textColor: '{colors.prussian}'
    typography: '{typography.label}'
    rounded: '{rounded.full}'
    padding: '2px 8px'
  nav-item-active:
    backgroundColor: '{colors.band-accent}'
    textColor: '{colors.card}'
    rounded: '{rounded.md}'
    padding: '8px'
  stay-bar:
    backgroundColor: '{colors.property-1}'
    textColor: '{colors.card}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0 8px'
    height: '20px'
  table-head:
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    height: '40px'
    padding: '0 8px'
---

# Design System: Hostly

## Overview

**Creative North Star: "The Season Ledger"**

Hostly is a working ledger for a rental season: dates in rows and columns, money in tabular figures, every property told apart by one color. The surface is quiet and blue. A deep Prussian field carries the brand (the app sidebar, the auth panel, the public band) and everything that holds data sits on pale Azure-tinted paper in light mode or deep navy in dark mode, divided by thin lines rather than lifted into boxes.

Density is that of a tool, not a brochure: 14px body text in the app, 36px controls, rows divided by 1px borders. The only saturated color outside the blue family is the eight-step property palette on the bookings calendar, and it exists to answer one question: which property is this stay in. The public landing page is the same world turned outward, opening on the Prussian band and showing the app's real screens instead of describing them.

Both themes are first-class. Every token has a light and a dark value except the band, which is deliberately the same Prussian in both.

**Key Characteristics:**

- One brand blue family (Prussian, Sapphire, Celadon, Carolina, Azure); every other neutral is a tint or shade of it.
- Lists, tables and the calendar; no cards.
- Flat surfaces separated by hairline borders; shadows are small and functional.
- One type family, the system sans stack; hierarchy by weight 600, size and tight tracking.
- Property colors as the single vivid accent, used only to identify a property.

## Colors

A cool, single-hue blue palette, with a separate eight-color property scale held strictly for identification.

### Primary

- **Sapphire** (light theme `--primary`): the action color in light mode. Primary buttons, today's date on the calendar, the selected-range tint (15% alpha), the navigation progress bar, link text, the icons in the landing's job list.
- **Carolina** (dark theme `--primary`, and `--ring` / `--sidebar-primary` in both): the action color in dark mode, the focus ring everywhere, and the action color on any Prussian field (sidebar brand tile, band buttons, active tab outline on the landing).

### Secondary

- **Azure** (`--secondary`, `--muted`, `--accent` in light): soft fills for secondary buttons, ghost-button hover, secondary badges, the empty-state icon disc, and the text color on the Prussian field (`--band-foreground`, `--sidebar-foreground`).

### Tertiary

- **Celadon**: a declared brand color with no live UI role today; it appears only in the chart scale, which no screen uses. Hold it in reserve rather than inventing a role for it.

### Neutral

- **Prussian** (light `--foreground`, light `--sidebar`, `--band`, dark `--card`): body text in light mode, the brand field, and raised surfaces (popover, sheet, card token) in dark mode.
- **Paper** (light `--background`): the light app canvas, a faint Azure-tinted white.
- **White** (light `--card` / `--popover`): sheets, popovers, the landing screenshot frame.
- **Slate Blue** (light `--muted-foreground`): secondary text, descriptions, captions, calendar weekday labels.
- **Mist Line** and **Mist Field** (light `--border`, `--input`): hairline dividers and input strokes.
- **Night** (dark `--background`): the dark canvas. **Deep Night** (dark `--sidebar`) sits one step below it so the sidebar still reads as the darkest field.
- **Harbor** (dark `--accent` / `--secondary`, `--band-accent`, `--sidebar-accent`): the hover and active fill on dark fields.
- **Destructive** and **Success**: red for delete actions and errors, green for confirmations (the post-signup status line, toasts). A `--warning` token exists but nothing uses it yet.

### Property scale

- Eight colors (`--property-1` to `--property-8`: blue, green, amber, rose, violet, teal, orange, indigo), each with its own `-foreground` chosen for readable text and each with a lighter dark-theme value. Assigned by a property's position in the name-sorted list so a property keeps its color.

### Named Rules

**The Prussian Field Rule.** The brand lives in one dark field: the sidebar, the auth panel, the public band. On that field, text is Azure and the action is Carolina. The band (`--band` family) stays Prussian in both themes; it is the one surface that does not flip.

**The Property Color Rule.** Property colors identify a property (stay bars, list dots) and do nothing else. Never use them for status, decoration, or emphasis.

**The Theme Token Rule.** Colors come from theme classes (`bg-primary`, `text-muted-foreground`, `bg-band`), never loose hex values, and every combination must work in light and dark.

## Typography

**Display Font:** system sans stack (`ui-sans-serif, system-ui, sans-serif`)
**Body Font:** the same stack
**Label/Mono Font:** the system mono stack, only for documents (CPF/CNPJ) in the brokers table

**Character:** No web fonts. The type is the platform's own, set firmly: weight 600 with tight tracking for every heading, regular 400 for reading text, 500 for labels and buttons.

### Hierarchy

- **Display** (600, 2.25rem → 3rem → 3.75rem across breakpoints, line-height 1.05, tracking -0.025em, balanced): the landing hero headline only.
- **Headline** (600, 1.875rem, up to 2.25rem on the landing, tracking -0.025em): section headings on public pages and the auth panel statement.
- **Title** (600, 1.5rem, tracking -0.025em): the page title in the app (`PageHeader`) and auth forms.
- **Title small** (600, 1.125rem): calendar month heading, empty-state titles, landing screenshot titles (1.25rem).
- **Body** (400, 0.875rem): the app's working size for tables, forms, descriptions. Public pages read at 1rem, with the lead paragraph at 1.125rem and a `max-w-prose` / `max-w-xl` measure.
- **Label** (500, 0.75rem): stay bars, row metadata, the calendar's uppercase weekday headers, badges.

### Named Rules

**The Tabular Money Rule.** Every money and count column uses tabular figures (`tabular-nums`), right-aligned in tables.

**The Weight-Not-Face Rule.** Hierarchy comes from size, weight 600 and tracking within the one system family; never introduce a display face.

## Layout

The app is a collapsible icon sidebar plus a sticky 56px header (translucent background with backdrop blur, bottom border) and a content column capped at 72rem (`max-w-6xl`), padded 16px on mobile and 32px from `md`, with 24px between page blocks. Pages open with a title row (title and description left, actions right, stacking on mobile). Editing happens in a right-side sheet (75% width, max 24rem from `sm`), not a separate page.

Public pages use the same 72rem container for the header and the screenshot tour, and a narrower 56rem (`max-w-4xl`) column for reading sections. The landing's first band ends with deep bottom padding so the screenshot frame below can pull up into it with a negative margin, straddling Prussian and paper.

Breakpoints are Tailwind's defaults (640, 768, 1024px). Table columns hide progressively (`sm`, `md`) rather than reflowing into stacked boxes. Spacing follows the 4px grid, mostly 8, 12, 16 and 24px inside components and 24 to 32px between sections in the app, 96 to 128px between landing sections.

## Elevation & Depth

Flat by default. Depth comes from tone (canvas vs. white or Prussian surface, a darker sidebar in dark mode) and from 1px borders. Shadows are small and tied to a function.

### Shadow Vocabulary

- **Hairline lift** (`shadow-xs`): outline buttons and inputs, so a control reads as pressable.
- **Stay lift** (`shadow-sm`): calendar stay bars, separating a stay from the day grid beneath it.
- **Product frame** (`0 30px 60px -24px var(--frame-shadow)`, a Prussian-tinted `rgb(8 19 29 / 0.5)` in light and `rgb(0 0 0 / 0.6)` in dark): the landing's screenshot frame only, as it overlaps the Prussian band.

### Named Rules

**The Line-Before-Shadow Rule.** Group with a border or a divider first. A shadow appears only where an element floats over another (stay bars over the grid, the product frame over the band, popovers and sheets).

## Shapes

One radius base (`--radius`, 10px) with derived steps: 6px small, 8px for controls (buttons, inputs, stay bars, nav items), 10px for bordered regions (list and table containers, the calendar grid, the financial summary, the brand tile), 14px for the landing's screenshot frame. Fully round only for badges, the calendar's day numbers and the empty-state icon disc. A stay bar that continues past a week row loses its rounded edge on that side, so a long stay reads as one bar across rows. Empty states use a dashed border; error states a destructive-tinted border.

## Components

### Buttons

- **Shape:** gently rounded (8px).
- **Primary:** Sapphire with white text in light, Carolina with Night text in dark; 36px tall, 16px side padding, 14px weight 500. Sizes: 32px (`sm`), 40px (`lg`), square icon buttons.
- **Hover / Focus:** 90% opacity fill on hover; focus shows a 3px Carolina ring at 50% alpha.
- **Outline:** canvas fill, hairline border, `shadow-xs`; Azure fill on hover. Used for secondary actions ("Ver a tela", "Tentar de novo").
- **Ghost:** no fill; Azure (light) or Harbor (dark) on hover. Icon actions in table rows.
- **On the Prussian field:** primary is Carolina (`sidebar-primary`), ghost uses Azure text with Harbor hover, outline uses the `band-border` stroke on a transparent fill.

### Chips

- **Style:** secondary badge, Azure fill, Prussian text, 12px weight 500, fully round. Used for type labels (casa/apartamento, PF/PJ) and the "Quitado" state.

### Cards / Containers

- No cards. Data lives in **bordered regions**: a single 10px-radius border around a table, a `divide-y` list, the calendar grid, or the financial summary (muted 50% fill, 16px padding). The landing's job list is an open `divide-y` list with top and bottom borders and 24px row padding.

### Inputs / Fields

- **Style:** transparent fill (Mist Field stroke in light, 30% input fill in dark), 8px radius, 36px tall, 12px side padding, `shadow-xs`.
- **Focus:** border turns Carolina with a 3px Carolina ring at 50%.
- **Error / Disabled:** destructive border and ring on `aria-invalid`; 50% opacity when disabled.

### Navigation

- **App sidebar:** Prussian field (Deep Night in dark), Azure text, 8px-radius items with Harbor fill and weight 500 when active, collapsing to icons; the brand is a Carolina tile with a calendar icon beside "Hostly".
- **Public header:** a 64px Prussian band with the brand, theme toggle, ghost "Entrar" and Carolina "Criar conta".

### Tables

- 40px header row in weight 500, 8px cell padding, hairline row dividers, a 50% muted fill on row hover. Secondary row data sits below the primary text in 12px muted.

### Bookings Calendar (signature)

- A seven-column grid in a 10px bordered region, weekday header on a 50% muted strip in uppercase 12px labels, hairline cell borders, days outside the month at 30% muted. Today is a Sapphire/Carolina disc. Stays are 20px bars in the property's color with its own foreground text, 8px radius, `shadow-sm`, 85% fill on hover. Dragging across days tints the range with the primary at 15%.

### Screenshot Tour (landing)

- A row of five identical channels (thumbnail plus label) on the band; inactive thumbnails sit at 60% opacity (75% in dark) with a `band-border` ring, the active one at full opacity with a 2px Carolina ring. The selected capture sits in the product frame and fades and scales in (from 0.985, 500ms, ease-out) only when motion is allowed. Captures follow the page theme.

## Do's and Don'ts

### Do:

- **Do** take every color from a theme token and check it in both light and dark.
- **Do** put the brand on the Prussian field and use Carolina as the action on it.
- **Do** group data with a single bordered region and hairline dividers.
- **Do** use tabular figures for money, right-aligned in tables.
- **Do** keep property colors for identifying properties, with their paired foreground for text.
- **Do** gate motion behind `prefers-reduced-motion`.

### Don't:

- **Don't** use cards: no grids of boxed tiles for features, records or stats; use lists, tables and the calendar.
- **Don't** write loose hex or rgb values in components.
- **Don't** load a web font or introduce a second family.
- **Don't** let the band change with the theme; it stays Prussian in both.
- **Don't** reach for a shadow where a border would separate the content.
