# Multi-Device Responsive Architecture — Mobile, Tablet & Desktop Adaptation

Adapt **Linguist AI** into a multi-device experience that scales across compact smartphones (`320px–430px`), portrait and landscape tablets (`768px–1024px`), and widescreen desktops (`1280px–1440px+`), preserving the **Futuristic Glassmorphic Lounge** aesthetic (`#0052FF` Cobalt Blue & `#FF4D4D` Electric Coral on Crisp Snow and Midnight Navy surfaces).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions incorporate your confirmed preferences from our design interview:

- **Confirmed Decision 1 — Floating Quick-Switch Action Bar Across All Devices**: A frosted glassmorphic floating action dock anchored at the bottom of the viewport across mobile, tablet, and desktop screens provides one-tap switching between **Home**, **Learn**, **Practice**, **Saved**, and **Settings** while keeping top-bar chrome minimal.
- **Confirmed Decision 2 — Responsive Bottom-Sheet Drawers on Mobile/Tablet & Centered Modals on Desktop**: Settings panels, word-lookup inspection cards, custom scenario builders, and icon customization dialogs automatically adapt into touch-friendly slide-up bottom sheets (`rounded-t-2xl` with grab handle and backdrop blur) on mobile and tablet viewports (`< 1024px`), while rendering as sharp studio modals on desktop (`>= 1024px`).
- **Confirmed Decision 3 — Collapsible Compact Language/Persona Bar & Sticky Keyboard-Safe Input Dock**: In the **Learn / Chat** view, active language, voice gender, and AI persona controls condense into an expandable compact studio strip at the top of the conversation, paired with a sticky keyboard-safe bottom input composer (`100dvh` + `env(safe-area-inset-bottom)`).
- **Recommended Default — Installable PWA & Viewport Ergonomics**: Configure dynamic viewport height (`100dvh`), notch/home-indicator safe-area padding, and minimum `44px × 44px` touch hitboxes so the web app behaves like a native application when opened on mobile browsers or installed to a phone/tablet home screen.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms every view of Linguist AI—Home Dashboard, Learn/Chat Studio, Practice Hub (Flashcards, Grammar Quiz, Pronunciation Coach), and Saved Vocabulary Bank—to dynamically reflow and adapt its navigation, overlays, typography, and interactive controls to any screen size or input modality (touch vs. mouse/keyboard).
- **Target Audience / Persona**: Language learners practicing on the go with one-handed smartphone thumb navigation, tablet users studying in split-screen or portrait/landscape modes, and desktop power users.
- **Key Value**: Eliminates horizontal overflow, cramped multi-column grids, clipped popovers, and virtual-keyboard overlap on mobile and tablet devices while maintaining full 1440px studio presence on desktop monitors.

---

## 2. User Experience & Visual Design

### Key User Flows Across Screen Sizes

1. **Universal Floating Quick-Switch Action Bar**:
   - Positioned at the bottom of the screen (`fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40`), this frosted glassmorphic dock houses primary destinations (**Home**, **Learn**, **Practice**, **Saved**) plus quick-access **Settings** and **History** triggers.
   - Respects the **15% Mobile Sticky Cap** by pairing with a streamlined single-row top bar that displays brand identity, streak/account status, and contextual chat controls without multi-row wrapping.
2. **Learn / Chat View with Collapsible Context Strip & Keyboard-Safe Composer**:
   - **Top Collapsible Context Bar**: On mobile and tablet screens, the active target language, persona badge, voice gender toggle, and speed selector collapse into a compact 1-line summary bar (`[Flag] Language · Persona · [Expand ▾]`). Tapping expands a clean dropdown drawer to switch languages, personas, or voice preferences without leaving the chat.
   - **Adaptive Message Bubbles & Inline Word Lookup**: Message frames scale cleanly from `92%` max-width on mobile (`375px`) to `80%` on tablet and `72%` on desktop. Tapping any target-language word on mobile/tablet opens a **Bottom-Sheet Word Lookup Drawer** pinned to the bottom of the screen instead of a floating hover card that could clip off-screen.
   - **Sticky Keyboard-Safe Composer**: Anchored above the floating navigation bar (or docked cleanly with safe-area insets when the virtual keyboard is open), featuring `44px × 44px` touch hitboxes for the microphone button, scenario trigger, and send button.
3. **Responsive Home Dashboard & Radial Progress Gauge**:
   - **Mobile (`< 640px`)**: Single-column vertical flow with a responsive SVG Radial Multi-Ring Progress Gauge, 2×2 compact KPI grid, horizontal swipeable language category pills, and full-width touch-friendly persona cards.
   - **Tablet (`640px – 1023px`)**: Balanced 2-column grid pairing the Radial Multi-Ring Gauge with the 7-Day Activity Matrix, and 2-column Language & Persona selection grids.
   - **Desktop (`>= 1024px`)**: Full 12-column bento studio layout (`max-w-7xl`).
4. **Practice Hub & Saved Vocabulary Bank on Touchscreens**:
   - Flashcard 3D flip cards scale height fluidly (`min-h-[240px] sm:min-h-[300px]`) with large thumb-zone assessment buttons (**Still Learning** / **Mastered**).
   - Grammar Quiz options and Pronunciation Coach microphone controls feature full-width tap rows (`min-h-[48px]`) on phones and structured grid cards on tablets/desktops.

### Visual Identity & Theme

- **Aesthetic Direction**: **Futuristic Glassmorphic Lounge** with responsive spatial ergonomics—combining crisp architectural hairlines (`1px solid`), deep atmospheric lighting, and tactile touch affordances.
- **Color Palette & Mood**:
  - **Light Mode (Crisp Snow)**: `--bg-canvas: #F4F7FB`, `--bg-glass: rgba(255, 255, 255, 0.84)`, `--primary: #0052FF` (Cobalt Blue), `--accent: #FF4D4D` (Electric Coral), `--secondary: #00B8D9` (Electric Cyan).
  - **Dark Mode (Midnight Navy)**: `--bg-canvas: #050A18`, `--bg-glass: rgba(11, 21, 40, 0.84)`, `--primary: #0052FF` / `#3B82F6`, `--accent: #FF4D4D`.
- **Typography & Fluid Scaling**:
  - **Display (`Space Grotesk`)**: Fluid hero and section headings using `clamp(1.5rem, 3.5vw, 2.5rem)` and `text-wrap: balance`.
  - **Body (`Plus Jakarta Sans` + Multi-Script Noto Fonts)**: `15px–16px` base size on mobile inputs (`text-base` to prevent iOS Safari auto-zoom on focus) and comfortable reading measure across all viewports.
  - **Telemetry (`JetBrains Mono`)**: `tabular-nums` for streak counters, CEFR estimates, and radial percentages.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Universal Floating Quick-Switch Action Bar**
  - *Chosen Approach*: A centered floating glassmorphic bottom dock across mobile, tablet, and desktop that provides instant view switching and reserves generous bottom padding (`pb-28` / `pb-32`) in scrollable views so content is never obscured.
  - *Why*: Gives mobile and tablet users effortless one-handed thumb navigation while giving desktop users a cohesive, futuristic command dock.
  - *Alternatives Considered*: Hiding navigation behind a mobile hamburger drawer, which adds extra taps to switch between Chat, Practice, and Saved words.
- **Decision 2: Hybrid Bottom-Sheet Drawers (`< 1024px`) vs. Centered Studio Modals (`>= 1024px`)**
  - *Chosen Approach*: Use CSS media queries and touch-friendly sheet anatomy (top grab handle, `max-h-[85dvh]` internal scroll, backdrop tap-to-dismiss, and swipe-down gesture support) for Settings, Word Lookup, Custom Scenario, and Icon Customization on mobile/tablet, transitioning to centered modals on desktop.
  - *Why*: Hover-based popovers and centered modals are hard to reach and can clip when virtual keyboards appear on mobile/tablet screens; bottom sheets keep actions in the natural thumb zone.
- **Decision 3: Collapsible Language/Persona Header in Chat View**
  - *Chosen Approach*: Condense the language picker, persona selector, and voice controls into a single compact expandable bar at the top of the chat view on mobile and tablet devices.
  - *Why*: Preserves maximum vertical screen real estate (over 85% of the viewport) for conversation messages and the sticky input composer.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Responsive Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                  Viewport & Device Adaptation Layer                        │
│   • 100dvh Dynamic Viewport Height + Safe-Area Insets (top/bottom/sides)   │
│   • Breakpoints: Mobile (<640px) │ Tablet (640-1023px) │ Desktop (>=1024px)│
└───────────────────┬────────────────────────────────────┬───────────────────┘
                    │                                    │
                    ▼                                    ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│     Top Studio Header (Compact)       │  │  Floating Quick-Switch Dock     │
│ • Brand Identity & Custom Icon        │  │ • Fixed Bottom Glassmorphic Bar │
│ • Guest / Google Account & Streak     │  │ • Home │ Learn │ Practice │Saved│
│ • History Drawer & Quick Settings     │  │ • Touch Hitboxes >= 44x44px     │
└───────────────────┬───────────────────┘  └─────────────────┬───────────────┘
                    │                                        │
                    ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     Adaptive View Containers                               │
├────────────────────────┬─────────────────────────┬─────────────────────────┤
│   Home Dashboard       │   Learn / Chat Studio   │  Practice & Vocab Views │
│ • Fluid Hero & Radial  │ • Collapsible Compact   │ • Responsive 3D Flip    │
│   Multi-Ring Gauge     │   Language/Persona Bar  │   Flashcards            │
│ • 1-col -> 2-col ->    │ • Adaptive Chat Frames  │ • Touch-Friendly Quiz & │
│   12-col Bento Grid    │ • Sticky Keyboard-Safe  │   Pronunciation Cards   │
│ • Touch Scroll Filters │   Composer Dock         │ • Responsive Filter Bar │
└────────────────────────┴───────────┬─────────────┴─────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│            Responsive Overlay & Sheet Engine (<1024px vs >=1024px)         │
│ • Word Lookup Card: Floating Popover (Desktop) <-> Bottom Sheet (Mobile)   │
│ • App Settings, Custom Scenario & Icon Studio: Centered <-> Bottom Sheet   │
│ • Touch Swipe-Down Dismissal & Keyboard-Safe Scrollable Sheet Bodies       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Responsive UI State

- **`isMobileChatConfigExpanded: boolean`**: Controls whether the compact language, persona, and voice control bar at the top of the Learn/Chat view is expanded or collapsed on mobile and tablet screens.
- **Touch & Viewport Ergonomics**:
  - Inputs and textareas enforce `font-size: 16px` (`text-base`) on mobile screens to prevent involuntary browser zoom on iOS/Android focus.
  - Interactive word tokens support both desktop hover/click and mobile tap-to-open bottom sheet without clipping at viewport edges.

### Interactive Component & State Mapping

- **Floating Quick-Switch Dock**: Clicking/tapping **Home**, **Learn**, **Practice**, or **Saved** switches `state.activeTab` (and initializes a fresh ephemeral chat if entering **Learn** in Guest Mode), while automatically collapsing any open mobile drawers.
- **Collapsible Chat Context Bar**: Tapping the compact summary pill in the chat header toggles `isMobileChatConfigExpanded`, revealing full-width touch selectors for Target Language, AI Persona, Voice Gender, Speaking Rate, and Auto-Speak.
- **Bottom-Sheet Drawers (Settings / Word Lookup / Scenario / Icon)**: Support backdrop click/tap dismissal, dedicated `44px × 44px` close buttons, and touch swipe-down on the top drag handle bar to close cleanly.
