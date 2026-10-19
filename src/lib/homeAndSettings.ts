import {
  LANGUAGES,
  PERSONAS,
  type Language,
  type Persona,
  type ChatSession,
  type UserFluencyMetrics,
  type LanguageCategory
} from '../types.ts';
import { computeCefrEstimate, getLast7DaysDailyStats } from './fluency.ts';
import type { User, UserSettingsPreferences } from './firebase.ts';

const SETTINGS_STORAGE_KEY = 'linguist_user_settings_v1';

export function loadLocalSettings(): UserSettingsPreferences {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'light',
        speechRate: typeof parsed.speechRate === 'number' ? parsed.speechRate : 0.95,
        speechPitch: typeof parsed.speechPitch === 'number' ? parsed.speechPitch : 1.0,
        preferredVoiceURI: typeof parsed.preferredVoiceURI === 'string' ? parsed.preferredVoiceURI : '',
        autoSpeak: typeof parsed.autoSpeak === 'boolean' ? parsed.autoSpeak : true,
        defaultLanguageCode: typeof parsed.defaultLanguageCode === 'string' ? parsed.defaultLanguageCode : 'hi',
        defaultPersonaId: typeof parsed.defaultPersonaId === 'string' ? parsed.defaultPersonaId : 'language_buddy'
      };
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return {
    theme: 'light',
    speechRate: 0.95,
    speechPitch: 1.0,
    preferredVoiceURI: '',
    autoSpeak: true,
    defaultLanguageCode: 'hi',
    defaultPersonaId: 'language_buddy'
  };
}

export function saveLocalSettings(settings: UserSettingsPreferences): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e);
  }
}

export function applyThemeToDocument(theme: 'light' | 'dark' | 'system'): void {
  if (typeof document === 'undefined') return;
  const rootEl = document.documentElement;
  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  if (isDark) {
    rootEl.classList.add('dark');
  } else {
    rootEl.classList.remove('dark');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#050A18' : '#0052FF');
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface HomeRenderContext {
  user: User | null;
  isSyncingCloud: boolean;
  metrics: UserFluencyMetrics;
  settings: UserSettingsPreferences;
  activeSession: ChatSession;
  sessions: ChatSession[];
  homeLanguageCategory: LanguageCategory;
}

export function renderHomeScreen(ctx: HomeRenderContext): string {
  const { user, isSyncingCloud, metrics, activeSession, sessions, homeLanguageCategory } = ctx;
  const cefr = computeCefrEstimate(metrics);
  const last7Days = getLast7DaysDailyStats(metrics);

  // Compute Radial Multi-Ring Metrics (0 to 100%)
  const streakGoal = 7;
  const streakPct = Math.min(100, Math.round((Math.max(0, metrics.currentStreakDays) / streakGoal) * 100));

  const totalVocab = metrics.savedVocabulary.length;
  const masteredVocab = metrics.savedVocabulary.filter(v => v.mastered).length;
  const vocabTarget = Math.max(10, totalVocab);
  const vocabPct = totalVocab === 0
    ? 0
    : Math.min(100, Math.round(((masteredVocab * 1.0 + (totalVocab - masteredVocab) * 0.4) / vocabTarget) * 100));

  const grammarPct = typeof metrics.accuracyRate === 'number' && metrics.grammarChecksCount > 0
    ? Math.min(100, Math.max(0, metrics.accuracyRate))
    : 0;

  // SVG Concentric Ring Geometry (ViewBox 240x240, center 120,120)
  // Outer Ring (Streak - Electric Coral): r = 96, C = 603.18
  const r1 = 96;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 - (streakPct / 100) * c1;

  // Middle Ring (Vocab - Cobalt Blue): r = 74, C = 464.95
  const r2 = 74;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 - (vocabPct / 100) * c2;

  // Inner Ring (Grammar - Electric Cyan): r = 52, C = 326.72
  const r3 = 52;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 - (grammarPct / 100) * c3;

  const filteredLanguages = LANGUAGES.filter(l =>
    homeLanguageCategory === 'all' ? true : l.category === homeLanguageCategory
  );

  const maxDailyMsgs = Math.max(5, ...last7Days.map(d => d.messagesSent));

  return `
    <div class="flex-grow overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7 scroll-smooth">
      <div class="max-w-6xl mx-auto space-y-5 sm:space-y-7 pb-28 sm:pb-32">

        <!-- 1. Hero Welcome & Primary "Go to Learn Language" Glassmorphic Lounge Banner -->
        <section class="studio-hero-lounge relative overflow-hidden rounded-sm text-white p-4 sm:p-6 lg:p-8">
          <!-- Architectural Grid Overlay & Specular Corner Marks -->
          <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px]"></div>
          <div class="pointer-events-none absolute top-0 left-0 w-16 h-0.5 bg-[#0052FF]"></div>
          <div class="pointer-events-none absolute top-0 right-0 w-16 h-0.5 bg-[#FF4D4D]"></div>

          <div class="relative z-10 flex flex-col lg:flex-row lg:items-stretch lg:justify-between gap-5 lg:gap-6">
            
            <div class="space-y-4 max-w-2xl flex flex-col justify-between">
              <div class="space-y-2.5 sm:space-y-3">
                <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-blue-200">
                  <span class="px-2 py-0.5 bg-[#0052FF]/40 border border-blue-400/40 text-white font-bold rounded-none">
                    ${user ? `ACCOUNT: ${escapeHtml(user.displayName || user.email || 'LEARNER')}` : 'GUEST STUDIO MODE'}
                  </span>
                  <span aria-hidden="true" class="text-[#FF4D4D]">·</span>
                  <span class="text-slate-300">${isSyncingCloud ? 'SYNCING CLOUD...' : user ? 'CLOUD SYNC ACTIVE' : 'SIGN IN TO SAVE STREAKS'}</span>
                </div>

                <h1 class="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
                  ${user ? `Welcome back, ${escapeHtml((user.displayName || 'Friend').split(' ')[0])}.` : 'Master Real-World Fluency.'}
                </h1>

                <p class="text-xs sm:text-sm lg:text-base text-slate-200/90 leading-relaxed">
                  Active Studio: <strong class="text-white border-b border-[#0052FF] pb-0.5">${activeSession.language.flag} ${activeSession.language.name} (${activeSession.language.nativeName})</strong> paired with <strong class="text-white border-b border-[#FF4D4D] pb-0.5">${activeSession.persona.avatar} ${activeSession.persona.name}</strong>. Monitor your daily streak, lexical bank, and syntactic accuracy across all devices.
                </p>
              </div>

              <!-- Primary Action Buttons (Touch-Friendly Hitboxes >= 44px) -->
              <div class="pt-1 sm:pt-2 grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  id="home-go-learn-btn"
                  class="w-full sm:w-auto min-h-[46px] px-5 sm:px-6 py-3 rounded-sm bg-[#0052FF] hover:bg-[#2563EB] text-white border border-blue-400/50 font-extrabold text-xs sm:text-sm lg:text-base shadow-lg shadow-[#0052FF]/35 flex items-center justify-center gap-3 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <span>Go to Learn Language</span>
                  <span class="font-mono text-sm sm:text-base text-[#FF4D4D] bg-white/10 px-1.5 py-0.5">→</span>
                </button>

                <div class="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                  <button
                    id="home-new-session-btn"
                    class="min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-sm bg-white/10 hover:bg-white/20 text-white border border-white/25 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer backdrop-blur-md uppercase tracking-wider"
                  >
                    <span class="text-[#FF4D4D] font-mono font-black">+</span>
                    <span>Fresh Chat</span>
                  </button>

                  <button
                    id="home-settings-gear-btn"
                    class="min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-sm bg-[#050A18]/70 hover:bg-[#050A18] text-slate-100 border border-white/20 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer backdrop-blur-md uppercase tracking-wider"
                    title="Open Appearance, Dark Mode, and Voice Settings"
                  >
                    <span>⚙️</span>
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Hero Card: Structured Grid Streak & Account Telemetry -->
            <div class="flex flex-col sm:flex-row lg:flex-col justify-between gap-2.5 sm:gap-3 shrink-0 lg:min-w-[260px] pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-white/15 lg:pl-6">
              <div class="p-3.5 sm:p-4 rounded-sm bg-[#050A18]/65 backdrop-blur-xl border border-[#FF4D4D]/45 flex items-center gap-3 flex-1">
                <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-sm bg-[#FF4D4D]/20 border border-[#FF4D4D]/50 flex items-center justify-center text-xl sm:text-2xl shrink-0">
                  🔥
                </div>
                <div>
                  <div class="text-xl sm:text-2xl font-black font-mono tabular-nums leading-none text-white">
                    ${metrics.currentStreakDays} DAY${metrics.currentStreakDays === 1 ? '' : 'S'}
                  </div>
                  <div class="text-[10px] sm:text-[11px] font-mono text-slate-300 mt-1 uppercase tracking-wider">
                    STREAK · BEST: <span class="text-[#FF4D4D] font-bold">${metrics.longestStreakDays}D</span>
                  </div>
                </div>
              </div>

              ${!user ? `
                <button
                  id="home-google-signin-btn"
                  class="w-full sm:w-auto lg:w-full min-h-[44px] py-2.5 px-4 rounded-sm bg-white hover:bg-slate-100 text-[#091126] border border-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer uppercase tracking-wider shrink-0"
                >
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              ` : `
                <div class="p-3 rounded-sm bg-[#050A18]/65 backdrop-blur-xl border border-white/20 flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2.5 min-w-0">
                    ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="Avatar" class="w-7 h-7 rounded-sm object-cover border border-white/30" referrerpolicy="no-referrer" />` : `<span class="w-7 h-7 rounded-sm bg-[#0052FF] flex items-center justify-center font-bold font-mono">${escapeHtml((user.displayName || 'U')[0])}</span>`}
                    <span class="truncate font-mono text-[11px] text-slate-200">${escapeHtml(user.email || user.displayName || '')}</span>
                  </div>
                  <button id="home-switch-account-btn" class="min-h-[36px] px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-mono text-[10px] uppercase tracking-wider shrink-0 cursor-pointer">
                    Switch
                  </button>
                </div>
              `}
            </div>

          </div>
        </section>

        <!-- 2. Radial Multi-Ring Progress Gauge & Fluency Dashboard (Responsive Mobile -> Tablet 2-Col -> Desktop 12-Col Grid) -->
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
          
          <!-- Left 5 Cols: Radial Multi-Ring Progress Gauge -->
          <div class="md:col-span-1 lg:col-span-5 studio-glass-panel rounded-sm p-4 sm:p-6 flex flex-col justify-between">
            <div class="flex items-center justify-between gap-2 pb-3 border-b border-[#CBD5E1]">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">01. Progress Rings</span>
                <h2 class="text-sm sm:text-lg font-extrabold text-[#091126]">Fluency Progress Rings</h2>
              </div>
              <span class="px-2.5 py-1 bg-[#0052FF]/10 border border-[#0052FF]/30 text-xs font-mono font-bold text-[#0052FF] tabular-nums rounded-sm shrink-0">
                ${cefr.level} · ${cefr.title}
              </span>
            </div>

            <!-- Concentric Multi-Ring SVG (Electric Coral, Cobalt Blue, Electric Cyan) -->
            <div class="my-4 sm:my-5 flex flex-col sm:flex-row md:flex-col xl:flex-row items-center justify-center gap-4 sm:gap-6">
              <div class="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center shrink-0">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 240 240">
                  <!-- Background Tracks -->
                  <circle cx="120" cy="120" r="${r1}" fill="none" stroke="rgba(255, 77, 77, 0.16)" stroke-width="14" />
                  <circle cx="120" cy="120" r="${r2}" fill="none" stroke="rgba(0, 82, 255, 0.16)" stroke-width="14" />
                  <circle cx="120" cy="120" r="${r3}" fill="none" stroke="rgba(0, 184, 217, 0.16)" stroke-width="14" />

                  <!-- Outer Ring: Daily Streak (Electric Coral) -->
                  <circle
                    cx="120" cy="120" r="${r1}"
                    fill="none"
                    stroke="#FF4D4D"
                    stroke-width="14"
                    stroke-linecap="butt"
                    stroke-dasharray="${c1.toFixed(2)}"
                    stroke-dashoffset="${offset1.toFixed(2)}"
                    class="radial-ring-progress"
                  />

                  <!-- Middle Ring: Vocabulary Mastery (Cobalt Blue) -->
                  <circle
                    cx="120" cy="120" r="${r2}"
                    fill="none"
                    stroke="#0052FF"
                    stroke-width="14"
                    stroke-linecap="butt"
                    stroke-dasharray="${c2.toFixed(2)}"
                    stroke-dashoffset="${offset2.toFixed(2)}"
                    class="radial-ring-progress"
                  />

                  <!-- Inner Ring: Grammar Accuracy (Electric Cyan) -->
                  <circle
                    cx="120" cy="120" r="${r3}"
                    fill="none"
                    stroke="#00B8D9"
                    stroke-width="14"
                    stroke-linecap="butt"
                    stroke-dasharray="${c3.toFixed(2)}"
                    stroke-dashoffset="${offset3.toFixed(2)}"
                    class="radial-ring-progress"
                  />
                </svg>

                <!-- Center Readout -->
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span class="text-xl sm:text-2xl font-black font-mono text-[#091126] tabular-nums">${cefr.level}</span>
                  <span class="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">${cefr.progressPercent}% NEXT</span>
                </div>
              </div>

              <!-- Ring Legend & Values with Structured Hairline Dividers -->
              <div class="divide-y divide-[#CBD5E1] border border-[#CBD5E1] rounded-sm w-full bg-white/60">
                <div class="p-2.5 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-none bg-[#FF4D4D] shrink-0"></span>
                    <span class="text-xs font-bold text-slate-700">Streak Goal</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-[#091126] tabular-nums">${metrics.currentStreakDays}/${streakGoal}d (${streakPct}%)</span>
                </div>

                <div class="p-2.5 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-none bg-[#0052FF] shrink-0"></span>
                    <span class="text-xs font-bold text-slate-700">Vocab Mastery</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-[#091126] tabular-nums">${masteredVocab}/${totalVocab} (${vocabPct}%)</span>
                </div>

                <div class="p-2.5 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-none bg-[#00B8D9] shrink-0"></span>
                    <span class="text-xs font-bold text-slate-700">Grammar Score</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-[#091126] tabular-nums">${grammarPct}%</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-[#CBD5E1] flex items-center justify-between gap-2 text-xs">
              <span class="text-slate-500 font-mono text-[11px] truncate">MILESTONE: <strong class="text-[#091126]">${cefr.nextMilestone}</strong></span>
              <button id="home-open-vocab-modal-btn" class="min-h-[36px] px-2 font-mono font-bold text-[#0052FF] hover:underline uppercase tracking-wider text-[11px] cursor-pointer shrink-0">
                Vocab Bank →
              </button>
            </div>
          </div>

          <!-- Right 7 Cols: 7-Day Activity Graph & Key Performance Metrics -->
          <div class="md:col-span-1 lg:col-span-7 studio-glass-panel rounded-sm p-4 sm:p-6 flex flex-col justify-between space-y-4 sm:space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#CBD5E1]">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-[#FF4D4D] block">02. Weekly Activity</span>
                <h2 class="text-sm sm:text-lg font-extrabold text-[#091126]">Weekly Practice &amp; Metrics</h2>
              </div>
              <div class="flex items-center gap-3 text-xs font-mono text-slate-500 tabular-nums">
                <span>MSGS: <strong class="text-[#091126]">${metrics.totalMessagesSent}</strong></span>
                <span class="text-[#CBD5E1]">·</span>
                <span>WORDS: <strong class="text-[#091126]">${metrics.savedVocabulary.length}</strong></span>
              </div>
            </div>

            <!-- 7-Day Activity Bar Chart with Exposed Grid Cells -->
            <div class="grid grid-cols-7 divide-x divide-[#CBD5E1] items-end h-32 sm:h-36 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1]">
              ${last7Days.map(day => {
                const heightPct = day.messagesSent === 0 ? 8 : Math.max(16, Math.round((day.messagesSent / maxDailyMsgs) * 100));
                return `
                  <div class="flex flex-col items-center justify-end h-full gap-1 sm:gap-1.5 p-1.5 sm:p-2 group">
                    <span class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 tabular-nums">${day.messagesSent}</span>
                    <div class="w-full max-w-[26px] sm:max-w-[30px] bg-slate-200/70 rounded-none h-16 sm:h-20 flex items-end overflow-hidden p-0.5 border border-[#CBD5E1]/60">
                      <div
                        class="w-full rounded-none transition-all duration-500 ${
                          day.messagesSent > 0 ? 'bg-linear-to-t from-[#0052FF] to-[#FF4D4D]' : 'bg-slate-300/60'
                        }"
                        style="height: ${heightPct}%"
                        title="${day.date}: ${day.messagesSent} messages, ${day.wordsLearned} words"
                      ></div>
                    </div>
                    <span class="text-[9px] sm:text-[10px] font-mono font-bold uppercase text-slate-600">${day.label}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- 4 KPI Stat Strip (Structured Hairline Grid) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#CBD5E1] border border-[#CBD5E1] rounded-sm bg-white/70">
              <div class="p-3 sm:p-3.5">
                <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Active Streak</div>
                <div class="text-lg sm:text-xl font-black font-mono text-[#FF4D4D] tabular-nums mt-0.5">🔥 ${metrics.currentStreakDays}D</div>
              </div>
              <div class="p-3 sm:p-3.5">
                <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Total Sent</div>
                <div class="text-lg sm:text-xl font-black font-mono text-[#0052FF] tabular-nums mt-0.5">💬 ${metrics.totalMessagesSent}</div>
              </div>
              <div class="p-3 sm:p-3.5">
                <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Lexical Bank</div>
                <div class="text-lg sm:text-xl font-black font-mono text-[#091126] tabular-nums mt-0.5">📖 ${metrics.savedVocabulary.length}</div>
              </div>
              <div class="p-3 sm:p-3.5">
                <div class="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Syntax Score</div>
                <div class="text-lg sm:text-xl font-black font-mono text-[#00B8D9] tabular-nums mt-0.5">✨ ${grammarPct}%</div>
              </div>
            </div>
          </div>

        </section>

        <!-- 3. Choose Target Language on Home Screen -->
        <section class="studio-glass-panel rounded-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#CBD5E1]">
            <div>
              <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">03. Language Matrix</span>
              <h2 class="text-base sm:text-xl font-extrabold text-[#091126]">Select Target Language</h2>
              <p class="text-xs text-slate-500">Tap any language module to configure your active studio session</p>
            </div>

            <!-- Category Filter Buttons (Touch Scrollable on Mobile) -->
            <div class="flex items-center divide-x divide-[#CBD5E1] border border-[#CBD5E1] bg-[#F4F7FB] rounded-sm self-start max-w-full overflow-x-auto scrollbar-none">
              ${(['all', 'indian', 'european', 'asian'] as LanguageCategory[]).map(cat => `
                <button
                  data-home-lang-cat="${cat}"
                  class="min-h-[40px] px-3.5 py-2 rounded-none text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    homeLanguageCategory === cat
                      ? 'bg-[#0052FF] text-white'
                      : 'text-slate-600 hover:text-[#091126] hover:bg-white'
                  }"
                >
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
            ${filteredLanguages.map((langItem: Language) => {
              const isCurrent = langItem.code === activeSession.language.code;
              return `
                <button
                  data-home-select-lang="${langItem.code}"
                  class="min-h-[56px] p-2.5 sm:p-3 rounded-sm border text-left transition-all cursor-pointer flex items-center gap-2.5 relative ${
                    isCurrent
                      ? 'bg-[#0052FF]/10 border-[#0052FF] ring-1 ring-[#0052FF] shadow-xs'
                      : 'bg-white hover:bg-[#F4F7FB] border-[#CBD5E1] hover:border-[#0052FF]/60'
                  }"
                >
                  <span class="text-2xl shrink-0">${langItem.flag}</span>
                  <div class="min-w-0">
                    <div class="font-bold text-xs text-[#091126] truncate">${langItem.name}</div>
                    <div class="text-[11px] text-slate-500 truncate">${langItem.nativeName}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </section>

        <!-- 4. AI Persona Partners Showcase -->
        <section class="studio-glass-panel rounded-sm p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-[#CBD5E1]">
            <div>
              <span class="text-[10px] font-mono uppercase tracking-widest text-[#FF4D4D] block">04. Conversation Partners</span>
              <h2 class="text-base sm:text-xl font-extrabold text-[#091126]">AI Conversation Personas</h2>
              <p class="text-xs text-slate-500">Select a partner archetype and launch directly into ${activeSession.language.name} practice</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            ${PERSONAS.map((p: Persona) => {
              const isSelected = p.id === activeSession.persona.id;
              return `
                <div
                  class="p-4 sm:p-5 rounded-sm border transition-all flex flex-col justify-between relative ${
                    isSelected
                      ? 'bg-[#0052FF]/8 border-[#0052FF] ring-1 ring-[#0052FF] shadow-sm'
                      : 'bg-white border-[#CBD5E1] hover:border-[#0052FF]/60'
                  }"
                >
                  <div>
                    <div class="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-[#CBD5E1]/70">
                      <div class="flex items-center gap-3 min-w-0">
                        <span class="w-11 h-11 sm:w-12 sm:h-12 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] flex items-center justify-center text-2xl shrink-0">
                          ${p.avatar}
                        </span>
                        <div class="min-w-0">
                          <h3 class="font-extrabold text-sm sm:text-base text-[#091126] truncate">${p.name}</h3>
                          <p class="text-xs font-mono text-[#0052FF] font-semibold truncate">${p.tagline || 'Conversational Partner'}</p>
                        </div>
                      </div>
                      <span class="text-[10px] font-mono text-slate-500 uppercase shrink-0">${p.defaultDifficulty || 'intermediate'}</span>
                    </div>

                    <p class="text-xs text-slate-600 leading-relaxed mb-4">
                      ${p.description}
                    </p>
                  </div>

                  <button
                    data-home-launch-persona="${p.id}"
                    class="w-full min-h-[44px] py-2.5 px-4 rounded-sm font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#0052FF] hover:bg-[#2563EB] text-white border-[#0052FF]'
                        : 'bg-[#F4F7FB] hover:bg-[#0052FF] hover:text-white text-[#091126] border-[#CBD5E1] hover:border-[#0052FF]'
                    }"
                  >
                    <span>Practice with ${p.name}</span>
                    <span>→</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <!-- 5. Recent Conversation History -->
        <section class="studio-glass-panel rounded-sm p-4 sm:p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#CBD5E1]">
            <div>
              <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">05. Session Archive</span>
              <h2 class="text-base sm:text-xl font-extrabold text-[#091126]">Recent Practice Sessions</h2>
            </div>
            ${user ? `
              <button id="home-view-all-history-btn" class="min-h-[40px] px-3.5 py-2 bg-[#F4F7FB] hover:bg-[#0052FF] hover:text-white border border-[#CBD5E1] rounded-sm text-xs font-mono font-bold text-[#0052FF] uppercase tracking-wider transition-colors cursor-pointer">
                View All (${sessions.length}) →
              </button>
            ` : `
              <span class="text-[11px] font-mono font-bold text-[#FF4D4D] uppercase">
                Guest Mode · Ephemeral Chat
              </span>
            `}
          </div>

          ${!user ? `
            <div class="p-4 sm:p-5 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="space-y-1">
                <p class="font-bold text-xs sm:text-sm text-[#091126]">Guest Mode Always Starts a Fresh Chat</p>
                <p class="text-xs text-slate-600">Streaks and messages are not saved in Guest Mode. Sign in with Google to save your conversation history and daily streaks across sessions.</p>
              </div>
              <button id="home-view-all-history-btn" class="min-h-[44px] px-4 py-2.5 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase tracking-wider shrink-0 cursor-pointer">
                Start Fresh Chat →
              </button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              ${sessions.slice(0, 3).map(s => {
                const lastMsg = s.messages[s.messages.length - 1];
                return `
                  <div
                    data-home-resume-session="${s.id}"
                    class="p-4 rounded-sm bg-white border border-[#CBD5E1] hover:border-[#0052FF] transition-all cursor-pointer flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#CBD5E1]/60">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-lg">${s.language.flag}</span>
                          <span class="font-bold text-xs sm:text-sm text-[#091126] truncate">${escapeHtml(s.title)}</span>
                        </div>
                        <span class="text-[10px] font-mono text-slate-500 tabular-nums shrink-0">${s.messages.length} msgs</span>
                      </div>
                      <p class="text-xs text-slate-600 line-clamp-2 italic">
                        "${escapeHtml(lastMsg ? lastMsg.content : 'Start speaking...')}"
                      </p>
                    </div>
                    <div class="pt-2 border-t border-[#CBD5E1]/60 flex items-center justify-between text-[11px] font-mono text-[#0052FF] font-bold uppercase tracking-wider">
                      <span>${s.persona.avatar} ${s.persona.name}</span>
                      <span>Resume →</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </section>

      </div>
    </div>
  `;
}

// Render Comprehensive App Settings Modal (Bottom-Sheet Drawer on Mobile/Tablet, Centered Modal on Desktop)
export function renderAppSettingsModal(
  settings: UserSettingsPreferences,
  user: User | null,
  availableVoices: SpeechSynthesisVoice[],
  activeLanguageCode: string
): string {
  const matchingVoices = availableVoices.filter(v =>
    v.lang.toLowerCase().startsWith(activeLanguageCode.toLowerCase())
  );
  const voiceList = matchingVoices.length > 0 ? matchingVoices : availableVoices.slice(0, 30);

  return `
    <div id="app-settings-backdrop" class="responsive-modal-backdrop animate-in fade-in duration-150">
      <div class="studio-glass-panel responsive-sheet-panel bg-white lg:max-w-xl w-full flex flex-col shadow-2xl border border-[#CBD5E1] overflow-hidden">
        
        <!-- Mobile/Tablet Bottom-Sheet Drag Handle -->
        <div class="sheet-grab-handle-zone lg:hidden" data-sheet-close="app-settings" title="Swipe down or tap to close">
          <div class="sheet-grab-handle-bar"></div>
        </div>

        <!-- Modal Header -->
        <div class="px-4 py-3.5 sm:p-5 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/30 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">Studio Configuration</span>
              <h3 class="font-extrabold text-base sm:text-lg text-[#091126] leading-tight">App Settings &amp; Preferences</h3>
            </div>
          </div>
          <button id="close-app-settings-btn" class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold text-sm cursor-pointer">
            ✕
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6">

          <!-- 1. Appearance (Light / Dark / System Mode) -->
          <div class="space-y-2.5">
            <label class="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-700 block">
              01. Appearance &amp; Surface Posture
            </label>
            <div class="grid grid-cols-3 gap-2 sm:gap-2.5">
              ${([
                { id: 'light', label: 'Crisp Snow', icon: '☀️', desc: 'Light studio' },
                { id: 'dark', label: 'Midnight Navy', icon: '🌙', desc: 'Dark lounge' },
                { id: 'system', label: 'System Auto', icon: '💻', desc: 'Sync with OS' }
              ] as const).map(item => {
                const isSelected = settings.theme === item.id;
                return `
                  <button
                    data-settings-theme="${item.id}"
                    class="min-h-[72px] p-3 rounded-sm border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0052FF] text-white border-[#0052FF] shadow-sm'
                        : 'bg-[#F4F7FB] hover:bg-white text-[#091126] border-[#CBD5E1]'
                    }"
                  >
                    <div class="text-lg sm:text-xl mb-1">${item.icon}</div>
                    <div class="font-bold text-[11px] sm:text-xs font-mono uppercase leading-tight">${item.label}</div>
                    <div class="text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'} mt-0.5">${item.desc}</div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. Voice & Audio Synthesis Controls -->
          <div class="space-y-4 pt-4 border-t border-[#CBD5E1]">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-700">
                02. Speech &amp; Voice Output
              </label>
              <button
                id="settings-test-voice-btn"
                class="min-h-[40px] px-3.5 py-1.5 rounded-sm bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white border border-[#0052FF]/30 text-[#0052FF] font-mono font-bold text-xs uppercase cursor-pointer transition-colors"
              >
                🔊 Test Voice
              </button>
            </div>

            <!-- Voice Selector -->
            <div class="space-y-1.5">
              <span class="text-xs font-semibold text-slate-600 block">Preferred Speech Voice</span>
              <select
                id="settings-voice-select"
                class="w-full min-h-[44px] px-3.5 py-2.5 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] text-xs sm:text-sm text-[#091126] font-medium focus:outline-none focus:border-[#0052FF]"
              >
                <option value="">Auto-Select Best Voice for Language</option>
                ${voiceList.map(v => `
                  <option value="${escapeHtml(v.voiceURI)}" ${settings.preferredVoiceURI === v.voiceURI ? 'selected' : ''}>
                    ${escapeHtml(v.name)} (${escapeHtml(v.lang)})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Speech Rate & Pitch Sliders -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div class="p-3.5 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-slate-700">Speaking Speed</span>
                  <span id="settings-rate-label" class="font-mono font-bold text-[#0052FF] tabular-nums">${settings.speechRate.toFixed(2)}x</span>
                </div>
                <input
                  id="settings-rate-slider"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value="${settings.speechRate}"
                  class="w-full h-6 accent-[#0052FF] cursor-pointer"
                />
                <div class="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0.5x SLOW</span>
                  <span>1.0x NORM</span>
                  <span>1.5x FAST</span>
                </div>
              </div>

              <div class="p-3.5 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-slate-700">Voice Pitch</span>
                  <span id="settings-pitch-label" class="font-mono font-bold text-[#0052FF] tabular-nums">${settings.speechPitch.toFixed(2)}</span>
                </div>
                <input
                  id="settings-pitch-slider"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value="${settings.speechPitch}"
                  class="w-full h-6 accent-[#0052FF] cursor-pointer"
                />
                <div class="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0.5 DEEP</span>
                  <span>1.0 NAT</span>
                  <span>1.5 HIGH</span>
                </div>
              </div>
            </div>

            <!-- Auto-Speak Toggle -->
            <div class="flex items-center justify-between gap-3 p-3.5 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1]">
              <div>
                <div class="font-bold text-xs text-[#091126]">Auto-Pronounce AI Replies</div>
                <div class="text-[11px] text-slate-500">Automatically read new partner messages aloud</div>
              </div>
              <button
                id="settings-autospeak-toggle"
                class="min-h-[40px] px-4 py-1.5 rounded-sm font-mono font-bold text-xs cursor-pointer transition-colors border shrink-0 ${
                  settings.autoSpeak
                    ? 'bg-[#0052FF] text-white border-[#0052FF]'
                    : 'bg-white text-slate-700 border-[#CBD5E1]'
                }"
              >
                ${settings.autoSpeak ? 'ON 🔊' : 'OFF 🔇'}
              </button>
            </div>
          </div>

          <!-- 3. Default Language & Persona Preferences -->
          <div class="space-y-3 pt-4 border-t border-[#CBD5E1]">
            <label class="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-700 block">
              03. Default Learning Setup
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span class="text-xs font-semibold text-slate-600 block mb-1">Default Language</span>
                <select
                  id="settings-default-lang"
                  class="w-full min-h-[44px] px-3 py-2 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] text-xs font-medium text-[#091126]"
                >
                  ${LANGUAGES.map(l => `
                    <option value="${l.code}" ${settings.defaultLanguageCode === l.code ? 'selected' : ''}>
                      ${l.flag} ${l.name} (${l.nativeName})
                    </option>
                  `).join('')}
                </select>
              </div>
              <div>
                <span class="text-xs font-semibold text-slate-600 block mb-1">Default AI Persona</span>
                <select
                  id="settings-default-persona"
                  class="w-full min-h-[44px] px-3 py-2 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] text-xs font-medium text-[#091126]"
                >
                  ${PERSONAS.map(p => `
                    <option value="${p.id}" ${settings.defaultPersonaId === p.id ? 'selected' : ''}>
                      ${p.avatar} ${p.name}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- 4. Google Account & Cloud Persistence -->
          <div class="space-y-3 pt-4 border-t border-[#CBD5E1]">
            <label class="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-700 block">
              04. Account &amp; Cloud Sync
            </label>
            ${user ? `
              <div class="p-4 rounded-sm bg-[#0052FF]/8 border border-[#0052FF]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="Profile" class="w-10 h-10 rounded-sm object-cover border border-[#0052FF]/40" referrerpolicy="no-referrer" />` : `<div class="w-10 h-10 rounded-sm bg-[#0052FF] text-white flex items-center justify-center font-mono font-bold">${escapeHtml((user.displayName || 'U')[0])}</div>`}
                  <div class="min-w-0">
                    <div class="font-bold text-xs sm:text-sm text-[#091126] truncate">${escapeHtml(user.displayName || 'Signed-In User')}</div>
                    <div class="text-[11px] font-mono text-slate-500 truncate">${escapeHtml(user.email || '')}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    id="settings-switch-account-btn"
                    class="min-h-[40px] px-3.5 py-1.5 rounded-sm bg-white hover:bg-[#F4F7FB] text-[#0052FF] border border-[#0052FF]/40 text-xs font-mono font-bold uppercase cursor-pointer"
                  >
                    Switch
                  </button>
                  <button
                    id="settings-signout-btn"
                    class="min-h-[40px] px-3.5 py-1.5 rounded-sm bg-[#FF4D4D]/10 hover:bg-[#FF4D4D] hover:text-white text-[#FF4D4D] border border-[#FF4D4D]/40 text-xs font-mono font-bold uppercase cursor-pointer transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ` : `
              <div class="p-4 rounded-sm bg-[#F4F7FB] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="font-bold text-xs text-[#091126]">Save Streaks &amp; History to Google Account</div>
                  <div class="text-[11px] text-slate-500">Isolate and sync progress across separate Google accounts</div>
                </div>
                <button
                  id="settings-google-signin-btn"
                  class="min-h-[44px] px-4 py-2 rounded-sm bg-[#0052FF] hover:bg-[#2563EB] text-white font-mono font-bold text-xs uppercase tracking-wider cursor-pointer shrink-0"
                >
                  Sign in with Google
                </button>
              </div>
            `}
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 sm:p-5 border-t border-[#CBD5E1] bg-[#F4F7FB] flex items-center justify-between">
          <span class="text-xs font-mono text-slate-500">AUTO-SYNC ENABLED</span>
          <button id="done-app-settings-btn" class="min-h-[44px] px-6 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase tracking-wider cursor-pointer">
            Done
          </button>
        </div>

      </div>
    </div>
  `;
}
