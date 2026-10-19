# Home Screen Dashboard, Radial Progress Gauge, Settings & Google Sign-In

Create an immersive, default Home Screen for Linguist AI featuring a live Fluency Dashboard, an interactive radial multi-ring progress gauge (streaks, vocabulary, and grammar accuracy), Persona quick-launch cards, a full Appearance and Voice Settings panel (Dark/Light mode, voice engine), and Firebase Google Sign-in to sync and isolate progress across different user accounts.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed through interactive clarification and define the core user experience:

- **Home Navigation**: A dedicated "Start Learning" / "Continue Practice" hero CTA on the Home screen that launches directly into interactive practice, paired with clean top-bar navigation tabs (`Home` and `Practice`) for zero-friction movement between dashboard overview and active conversation.
- **Progress Graph**: Radial multi-ring progress gauge with 3 concentric arcs measuring:
  1. *Streak Progress* (days active toward weekly streak goal)
  2. *Vocabulary Mastery* (words mastered in the user's personal bank)
  3. *Grammar Accuracy* (percentage of error-free phrasings)
- **Authentication & Accounts**: Google Sign-in with Firebase Auth + Firestore. Each account receives isolated cloud storage for history, streaks, fluency analytics, and custom settings (`users/{userId}/...`), with guest mode supported for zero-barrier trial.

---

## 1. Overview & Core Concept

- **What It Delivers**: 
  - **Comprehensive Home Screen**: The default landing experience displaying streak milestones, radial progress metrics, recently active chat sessions, and AI Persona quick-launch cards.
  - **Radial Multi-Ring Progress Gauge**: A high-impact, animated SVG dashboard visualizer displaying concentric rings for Streaks, Vocabulary, and Grammar, accompanied by tabular milestone breakdowns.
  - **Comprehensive Settings Hub (Gear Icon)**: Accessible from the Home screen and top bar, allowing users to toggle Dark/Light mode, configure speech synthesis voices and speech rates, and select default learning difficulties.
  - **Google Account Authentication**: One-click Google Sign-In powered by Firebase Authentication and Firestore to save history, streaks, and progress metrics securely across devices and account switches.
- **Target Audience**: Dedicated language learners who require persistent progress tracking, customizable app ergonomics (dark mode & TTS voice tuning), and seamless access across multiple accounts.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Initial Arrival & Home Screen Experience**:
   - The user opens the app and immediately lands on the **Home Dashboard**.
   - Top Header shows the brand lockup (3D soundwave icon), quick navigation tabs (`Home`, `Practice`), a Settings Gear icon, and the User Profile / Google Sign-in button.
   - The Hero section displays a personalized greeting (`Welcome back!` or `Start your linguistic journey`), active streak count with flame glow, and a prominent **"Start Learning Now →"** CTA button.
2. **Radial Multi-Ring Gauge & Fluency Metrics**:
   - Positioned prominently on the Home screen, the radial gauge features 3 smooth glowing arcs:
     - Outer Emerald Arc: Active Streak (e.g. 5/7 Days)
     - Middle Indigo Arc: Vocabulary Mastered (e.g. 18/25 Words)
     - Inner Amber Arc: Grammar Accuracy (e.g. 92% Accurate)
   - Center displays overall CEFR Fluency level (e.g., `A2 Elementary` or `B1 Intermediate`) with animated fill on load.
3. **Persona Quick-Launch Showcase**:
   - A curated grid of AI Personas (*Language Buddy*, *Formal Teacher*, *Street Smart Local*, *Cultural Polyglot*, etc.) with quick-action chips to launch practice immediately in any chosen language.
4. **Appearance & Voice Settings (Gear Icon)**:
   - Opens a dedicated Settings modal or view:
     - **Appearance**: Light Mode, Dark Mode, or System Auto (applies `.dark` class with tailored Tailwind neutral palettes).
     - **Audio & Voices**: Target language voice selector (lists available Web Speech API voices matching target locale), speech rate slider (0.5x to 1.5x), pitch adjustment, and auto-speak toggle.
     - **Account Status**: Displays Google account email, sync status, and Sign-out button.
5. **Google Sign-In & Multi-Account Cloud Sync**:
   - Clicking "Sign in with Google" triggers a secure popup.
   - Upon authentication, existing local guest progress and sessions are merged with the user's cloud record, and real-time Firestore listeners keep history and streaks synchronized.
   - Switching accounts immediately reloads the corresponding user's isolated records.

### Visual Identity & Theme (Light & Dark Mode)
- **Light Theme**: Dominant warm clean canvas (`#FDFCFB`), structural white cards with hairline borders (`#E5E7EB`), royal indigo primary accents (`#4F46E5`), and emerald streak badges (`#059669`).
- **Dark Theme**: Deep obsidian slate canvas (`#0B0F19`), structural dark navy cards (`#111827`), glowing violet/cyan accents (`#6366F1`, `#38BDF8`), and high-contrast WCAG AA text hierarchy.
- **Spatial Math**: Clean 1440px desktop baseline with responsive 1-column mobile stack, generous container padding ($\ge 24\text{px}$), and nested radius coherence ($r_{\text{inner}} = r_{\text{outer}} - \text{padding}$).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: View State Navigation Model (`view: 'home' | 'chat'`)**
  - *Chosen Approach*: Maintain a top-level view router in app state (`state.activeView = 'home' | 'chat'`). The Home screen serves as the launchpad with a prominent "Start Learning" CTA, while the chat view retains all real-time features with a "Back to Home" button and header tab.
  - *Why*: Provides immediate access to overview metrics without burying the conversational learning environment.
  - *Alternatives Considered*: A modal overlay for the dashboard (too cramped for full metrics) or completely separate URL routes (unnecessary overhead for an instant-response SPA).

- **Decision 2: Dual Persistence Strategy (Firestore + LocalStorage)**
  - *Chosen Approach*: When unauthenticated (Guest), all sessions and metrics persist in `localStorage`. Once signed in with Google, data syncs to Firestore under `users/{uid}`, ensuring persistent multi-account cloud backup while preserving instant offline usability.
  - *Why*: Eliminates mandatory login friction for first-time visitors while fully honoring the user's requirement to save progress and streaks across distinct Google accounts.

- **Decision 3: Custom SVG Radial Multi-Ring Gauge**
  - *Chosen Approach*: Lightweight, dependency-free SVG concentric circle rendering with stroke-dashoffset math and CSS transitions.
  - *Why*: Guarantees zero bundle bloat, responsive crispness at all DPIs, and seamless light/dark mode color transitions.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   App State Store                      │
│   (activeView, user, theme, sessions, fluencyMetrics)  │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│     Home Screen       │        │   Chat Practice View  │
│  - Hero "Start Learn" │        │  - Gemini AI Partner  │
│  - Radial Multi-Ring  │        │  - Tokenized Words    │
│  - Streak Analytics   │        │  - Grammar Breakdown  │
│  - Persona Grid       │        │  - Audio Pronounce    │
│  - Settings Modal     │        │  - Dynamic Suggestion │
└───────────┬───────────┘        └───────────┬───────────┘
            │                                │
            └────────────────┬───────────────┘
                             ▼
┌────────────────────────────────────────────────────────┐
│         Authentication & Persistence Layer             │
├────────────────────────────┬───────────────────────────┤
│  Firebase Auth (Google)    │  Firestore Database       │
│  - signInWithPopup()       │  - users/{uid}/profile    │
│  - onAuthStateChanged()    │  - users/{uid}/sessions   │
│  - Multi-account switch    │  - users/{uid}/vocabulary │
└────────────────────────────┴───────────────────────────┘
```

### Database Schema (Firestore)
- **`users/{userId}`**:
  - `displayName`: string
  - `email`: string
  - `photoURL`: string
  - `currentStreak`: number
  - `lastActiveDate`: string
  - `theme`: 'light' | 'dark' | 'system'
  - `preferredVoice`: string
  - `speechRate`: number
- **`users/{userId}/sessions/{sessionId}`**:
  - `language`: object (code, name, nativeName, flag)
  - `persona`: object (id, name, avatar)
  - `messages`: array of message objects with feedback
  - `updatedAt`: timestamp
- **`users/{userId}/vocabulary/{wordId}`**:
  - `word`: string, `translation`: string, `mastered`: boolean, `createdAt`: timestamp

### Implementation Steps
1. **Firebase Provisioning**: Initialize Firebase Auth and Firestore via AI Studio setup tools.
2. **Theme & Settings Module**: Implement dark/light theme switching with CSS variables and Web Speech voice enumeration.
3. **Home Screen & Radial Gauge Component**: Build the animated radial multi-ring gauge and dashboard cards.
4. **View State Integration**: Seamlessly switch between Home and Chat with dedicated action buttons.
5. **Auth & Cloud Sync**: Wire Google Sign-in, user profile rendering, and multi-account cloud sync.
