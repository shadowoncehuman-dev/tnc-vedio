# Design — TNC Nursing Classes Web Platform
> Colour system · Typography · Component tokens · Motion

---

## 1. Design Concept

**"Focused Depth"** — A learning platform that feels serious and trustworthy, not playful. Deep navy grounds the UI; a single warm red accent marks all primary actions. Generous whitespace lets content breathe. Every interactive element has a clear, immediate response.

---

## 2. Colour Palette

### Brand Colours
```css
/* Primary — Deep Navy */
--color-brand-950: #0b1120;
--color-brand-900: #0e1a35;
--color-brand-800: #132248;
--color-brand-700: #1a2f62;
--color-brand-600: #1e3a8a;   /* navbar, hero gradient start */
--color-brand-500: #1d4ed8;

/* Accent — Crimson Red */
--color-accent-700: #b91c1c;
--color-accent-600: #dc2626;   /* primary buttons, badges */
--color-accent-500: #ef4444;
--color-accent-400: #f87171;
--color-accent-50:  #fef2f2;   /* subtle tint backgrounds */

/* Gold — XP / Streak / Leaderboard */
--color-xp-500: #f59e0b;
--color-xp-400: #fbbf24;
--color-xp-100: #fef3c7;

/* Neutral */
--color-gray-950: #030712;
--color-gray-900: #111827;
--color-gray-800: #1f2937;
--color-gray-600: #4b5563;
--color-gray-400: #9ca3af;
--color-gray-200: #e5e7eb;
--color-gray-100: #f3f4f6;
--color-gray-50:  #f9fafb;

/* Status */
--color-success: #16a34a;
--color-warning: #d97706;
--color-error:   #dc2626;
--color-info:    #2563eb;

/* Background */
--color-bg: #f9fafb;          /* page background (off-white) */
--color-surface: #ffffff;     /* cards, modals */
```

### Tailwind config additions
```js
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        950: '#0b1120', 900: '#0e1a35', 800: '#132248',
        700: '#1a2f62', 600: '#1e3a8a', 500: '#1d4ed8',
      },
      accent: {
        700: '#b91c1c', 600: '#dc2626', 500: '#ef4444',
        400: '#f87171', 50: '#fef2f2',
      },
      xp: { 500: '#f59e0b', 400: '#fbbf24', 100: '#fef3c7' },
    },
    backgroundImage: {
      'brand-gradient': 'linear-gradient(135deg, #1e3a8a 0%, #0e1a35 100%)',
      'accent-gradient': 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      'xp-gradient':     'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
  },
}
```

---

## 3. Typography

### Font Stack
```css
/* Headings — geometric, authoritative */
font-family: 'Geist', 'Inter', system-ui, sans-serif;

/* Body — neutral, readable on mobile */
font-family: 'Inter', 'Geist', system-ui, sans-serif;

/* Monospace — IDs, code, timestamps */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

Load via:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### Type Scale
| Token | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `display` | 2.25rem (36px) | 900 | 1.1 | Hero headline |
| `h1` | 1.75rem (28px) | 800 | 1.2 | Page titles |
| `h2` | 1.25rem (20px) | 700 | 1.3 | Section headings |
| `h3` | 1rem (16px) | 700 | 1.4 | Card titles |
| `body-lg` | 1rem (16px) | 400 | 1.6 | Main body text |
| `body` | 0.875rem (14px) | 400 | 1.5 | Default text |
| `body-sm` | 0.8125rem (13px) | 400 | 1.4 | Secondary text |
| `caption` | 0.75rem (12px) | 500 | 1.4 | Labels, badges |
| `micro` | 0.6875rem (11px) | 600 | 1.3 | Tiny tags, hints |

---

## 4. Spacing & Layout

- Base unit: `4px` (Tailwind default)
- Page max-width: `1024px` (`max-w-5xl`), centered
- Page horizontal padding: `px-4` (mobile) → `px-6` (md+)
- Section vertical gap: `py-8` (mobile) → `py-12` (md+)
- Card padding: `p-4` (mobile) → `p-5` (md+)
- Card border-radius: `rounded-2xl` (16px) for cards, `rounded-xl` (12px) for items
- Border: `border border-gray-100` on white-on-white surfaces

---

## 5. Component Tokens

### Primary Button
```
bg: accent-gradient (135deg #dc2626→#b91c1c)
text: white, font-semibold, text-sm
padding: px-5 py-2.5
radius: rounded-xl
hover: opacity-90 + scale(1.01)
active: scale(0.98)
disabled: opacity-40, cursor-not-allowed
```

### Secondary Button
```
bg: white
border: border-gray-200
text: gray-700, font-medium, text-sm
hover: bg-gray-50
```

### Ghost Button
```
bg: transparent
text: gray-500
hover: bg-gray-100, text-gray-700
```

### Input Field
```
bg: white
border: border-gray-200
focus: ring-2 ring-accent-400 border-transparent
radius: rounded-xl
padding: px-4 py-2.5 text-sm
```

### Card
```
bg: white
border: border-gray-100
shadow: shadow-sm
hover: shadow-md, border-gray-200
radius: rounded-2xl
transition: all 200ms ease
```

### Badge
```
Unlocked:  bg-green-100 text-green-700
Locked:    bg-gray-100 text-gray-500
FREE:      bg-green-50 text-green-600 font-bold
PAID:      bg-amber-50 text-amber-600
XP:        bg-xp-100 text-xp-500 font-bold
```

### XP Bar
```
track: bg-gray-100 rounded-full h-1.5
fill:  bg-xp-gradient rounded-full
transition: width 600ms ease-out
```

### Skeleton
```css
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 6. Navbar

```
Height: h-16 (64px)
Background: bg-brand-gradient (white text)
Sticky: top-0, z-50, backdrop-blur on scroll
Logo: TNC wordmark in white + small red dot
Links: Home · Courses · E-Notes · Quizzes · Favourites
Right: XP badge + visitor name initial avatar
Mobile: hamburger → bottom sheet menu
```

---

## 7. Motion Principles

- Page transitions: `opacity 0→1`, `y 12px→0`, `duration 200ms ease-out`
- Card entrance: `opacity 0→1`, `y 8px→0`, stagger `delay i * 0.03s`, cap at 0.4s
- Expandable panels: `height: 0→auto` via Framer Motion `AnimatePresence`
- XP gain: `+10 XP` toast from bottom, `scale 0.6→1.2→1`, yellow glow, 1.5s, then fade
- Leaderboard rows: slide-in from left, stagger 0.02s per row
- Button press: `scale(0.97)` on `active`
- Route changes: `opacity 0→1` on mount only, no exit animation (feels faster)

---

## 8. Iconography

Use **Lucide React** exclusively. Size convention:
- Navigation: `size={20}`
- Card actions: `size={16}`
- Inline text: `size={14}` or `size={12}`
- Hero/empty state: `size={48}` with `text-gray-200`

Key icon map:
| Concept | Icon |
|---|---|
| Course / Study | `BookOpen` |
| Video | `PlayCircle` |
| PDF / Notes | `FileText` |
| Quiz / Exam | `ClipboardList` |
| Favourite | `Heart` |
| XP / Trophy | `Trophy` |
| Leaderboard | `BarChart2` |
| Streak / Fire | `Flame` |
| Lock | `Lock` |
| User | `User` |
| Admin | `Shield` |

---

## 9. Dark Mode

Not in scope for v1. The brand gradient already reads well in both environments. Add `dark:` variants in v2 if analytics show demand.

---

## 10. Mobile-Specific Notes

- Minimum tap target: `44 × 44 px`
- Bottom navigation bar on mobile: Home / Courses / Quiz / Favourites / Profile (5 tabs)
- Avoid horizontal scroll — all cards full-width on mobile
- Video player: `aspect-ratio: 16/9`, fullscreen button always visible (Telegram WebView needs it)
- PDF viewer: fallback "Open in new tab" button when `<iframe>` is blocked in-app browser
