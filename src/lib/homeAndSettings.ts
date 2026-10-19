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
  const streakPct = Math.min(100, Math.round((Math.max(1, metrics.currentStreakDays) / streakGoal) * 100));

  const totalVocab = metrics.savedVocabulary.length;
  const masteredVocab = metrics.savedVocabulary.filter(v => v.mastered).length;
  const vocabTarget = Math.max(10, totalVocab);
  const vocabPct = totalVocab === 0
    ? 15
    : Math.min(100, Math.round(((masteredVocab * 1.0 + (totalVocab - masteredVocab) * 0.4) / vocabTarget) * 100));

  const grammarPct = typeof metrics.accuracyRate === 'number' && metrics.grammarChecksCount > 0
    ? Math.min(100, Math.max(10, metrics.accuracyRate))
    : 92;

  // SVG Concentric Ring Geometry (ViewBox 240x240, center 120,120)
  // Outer Ring (Streak): r = 96, C = 603.18
  const r1 = 96;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 - (streakPct / 100) * c1;

  // Middle Ring (Vocab): r = 74, C = 464.95
  const r2 = 74;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 - (vocabPct / 100) * c2;

  // Inner Ring (Grammar): r = 52, C = 326.72
  const r3 = 52;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 - (grammarPct / 100) * c3;

  const filteredLanguages = LANGUAGES.filter(l =>
    homeLanguageCategory === 'all' ? true : l.category === homeLanguageCategory
  );

  const maxDailyMsgs = Math.max(5, ...last7Days.map(d => d.messagesSent));

  return `
    <div class="flex-grow overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 scroll-smooth">
      <div class="max-w-6xl mx-auto space-y-8 pb-12">

        <!-- 1. Hero Welcome & Primary "Go to Learn Language" Banner -->
        <section class="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-950 via-indigo-900 to-purple-950 text-white p-6 sm:p-8 shadow-xl border border-indigo-800/60">
          <div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            
            <div class="space-y-3 max-w-2xl">
              <div class="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-indigo-200">
                <span>${user ? `Signed in as ${escapeHtml(user.displayName || user.email || 'Learner')}` : 'Guest Learner Mode'}</span>
                <span aria-hidden="true">·</span>
                <span>${isSyncingCloud ? 'Syncing with Cloud...' : user ? 'Cloud Backup Active' : 'Sign in with Google to save progress across accounts'}</span>
              </div>

              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                ${user ? `Welcome back, ${escapeHtml((user.displayName || 'Friend').split(' ')[0])}!` : 'Master Real-World Fluency'}
              </h1>

              <p class="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
                Currently practicing <strong>${activeSession.language.flag} ${activeSession.language.name} (${activeSession.language.nativeName})</strong> with <strong>${activeSession.persona.avatar} ${activeSession.persona.name}</strong>. Track your daily streak, vocabulary mastery, and grammar precision in one place.
              </p>

              <!-- Primary Action Buttons -->
              <div class="pt-2 flex flex-wrap items-center gap-3">
                <button
                  id="home-go-learn-btn"
                  class="px-6 py-3.5 rounded-2xl bg-white text-indigo-950 hover:bg-indigo-50 font-extrabold text-sm sm:text-base shadow-lg shadow-black/20 flex items-center gap-2.5 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <span>Go to Learn Language</span>
                  <span class="text-lg">→</span>
                </button>

                <button
                  id="home-new-session-btn"
                  class="px-4 py-3.5 rounded-2xl bg-indigo-800/70 hover:bg-indigo-700/80 text-white border border-indigo-600/50 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>+ Start Fresh Chat</span>
                </button>

                <button
                  id="home-settings-gear-btn"
                  class="px-4 py-3.5 rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-100 border border-indigo-700/50 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                  title="Open Appearance, Dark Mode, and Voice Settings"
                >
                  <span>⚙️</span>
                  <span>Settings</span>
                </button>
              </div>
            </div>

            <!-- Right Hero Card: Active Streak & Account Status -->
            <div class="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 min-w-[240px]">
              <div class="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3.5">
                <div class="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-2xl shrink-0">
                  🔥
                </div>
                <div>
                  <div class="text-2xl font-black tabular-nums leading-none">${metrics.currentStreakDays} Day${metrics.currentStreakDays === 1 ? '' : 's'}</div>
                  <div class="text-xs text-indigo-200 mt-1">Current Learning Streak · Best: ${metrics.longestStreakDays}d</div>
                </div>
              </div>

              ${!user ? `
                <button
                  id="home-google-signin-btn"
                  class="w-full py-3 px-4 rounded-2xl bg-white hover:bg-gray-50 text-gray-900 font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google to Save Progress</span>
                </button>
              ` : `
                <div class="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-2 text-xs">
                  <div class="flex items-center gap-2 min-w-0">
                    ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="Avatar" class="w-7 h-7 rounded-full object-cover" referrerpolicy="no-referrer" />` : `<span class="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center font-bold">${escapeHtml((user.displayName || 'U')[0])}</span>`}
                    <span class="truncate font-semibold text-indigo-100">${escapeHtml(user.email || user.displayName || '')}</span>
                  </div>
                  <button id="home-switch-account-btn" class="text-indigo-200 hover:text-white underline font-semibold shrink-0 cursor-pointer">
                    Switch
                  </button>
                </div>
              `}
            </div>

          </div>
        </section>

        <!-- 2. Radial Multi-Ring Progress Gauge & Fluency Dashboard -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          <!-- Left 5 Cols: Radial Multi-Ring Progress Gauge -->
          <div class="lg:col-span-5 bg-white rounded-3xl border border-gray-200 p-6 shadow-2xs flex flex-col justify-between">
            <div class="flex items-center justify-between mb-2">
              <div>
                <h2 class="text-base sm:text-lg font-extrabold text-gray-900">Fluency Progress Rings</h2>
                <p class="text-xs text-gray-500">Live streak, vocabulary &amp; grammar telemetry</p>
              </div>
              <span class="text-xs font-extrabold text-indigo-600 tabular-nums">${cefr.level} · ${cefr.title}</span>
            </div>

            <!-- Concentric Multi-Ring SVG -->
            <div class="my-4 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div class="relative w-52 h-52 flex items-center justify-center shrink-0">
                <svg class="w-full h-full -rotate-90" viewBox="0 0 240 240">
                  <!-- Background Tracks -->
                  <circle cx="120" cy="120" r="${r1}" fill="none" stroke="currentColor" class="text-emerald-500/15" stroke-width="14" />
                  <circle cx="120" cy="120" r="${r2}" fill="none" stroke="currentColor" class="text-indigo-500/15" stroke-width="14" />
                  <circle cx="120" cy="120" r="${r3}" fill="none" stroke="currentColor" class="text-amber-500/15" stroke-width="14" />

                  <!-- Outer Ring: Daily Streak -->
                  <circle
                    cx="120" cy="120" r="${r1}"
                    fill="none"
                    stroke="#10B981"
                    stroke-width="14"
                    stroke-linecap="round"
                    stroke-dasharray="${c1.toFixed(2)}"
                    stroke-dashoffset="${offset1.toFixed(2)}"
                    class="radial-ring-progress"
                  />

                  <!-- Middle Ring: Vocabulary Mastery -->
                  <circle
                    cx="120" cy="120" r="${r2}"
                    fill="none"
                    stroke="#6366F1"
                    stroke-width="14"
                    stroke-linecap="round"
                    stroke-dasharray="${c2.toFixed(2)}"
                    stroke-dashoffset="${offset2.toFixed(2)}"
                    class="radial-ring-progress"
                  />

                  <!-- Inner Ring: Grammar Accuracy -->
                  <circle
                    cx="120" cy="120" r="${r3}"
                    fill="none"
                    stroke="#F59E0B"
                    stroke-width="14"
                    stroke-linecap="round"
                    stroke-dasharray="${c3.toFixed(2)}"
                    stroke-dashoffset="${offset3.toFixed(2)}"
                    class="radial-ring-progress"
                  />
                </svg>

                <!-- Center Readout -->
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span class="text-2xl font-black text-gray-900 tabular-nums">${cefr.level}</span>
                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">${cefr.progressPercent}% Next</span>
                </div>
              </div>

              <!-- Ring Legend & Values -->
              <div class="space-y-3.5 w-full">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                    <span class="text-xs font-bold text-gray-700">Streak Goal</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-gray-900 tabular-nums">${metrics.currentStreakDays}/${streakGoal}d (${streakPct}%)</span>
                </div>

                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></span>
                    <span class="text-xs font-bold text-gray-700">Vocab Mastery</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-gray-900 tabular-nums">${masteredVocab}/${totalVocab} (${vocabPct}%)</span>
                </div>

                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                    <span class="text-xs font-bold text-gray-700">Grammar Score</span>
                  </div>
                  <span class="text-xs font-mono font-bold text-gray-900 tabular-nums">${grammarPct}%</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span class="text-gray-500">Next milestone: <strong>${cefr.nextMilestone}</strong></span>
              <button id="home-open-vocab-modal-btn" class="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                Open Vocab Bank →
              </button>
            </div>
          </div>

          <!-- Right 7 Cols: 7-Day Activity Graph & Key Performance Metrics -->
          <div class="lg:col-span-7 bg-white rounded-3xl border border-gray-200 p-6 shadow-2xs flex flex-col justify-between space-y-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 class="text-base sm:text-lg font-extrabold text-gray-900">Weekly Practice &amp; Telemetry</h2>
                <p class="text-xs text-gray-500">Messages sent and words collected over the last 7 days</p>
              </div>
              <div class="flex items-center gap-3 text-xs text-gray-500 tabular-nums">
                <span>Messages: <strong class="text-gray-900">${metrics.totalMessagesSent}</strong></span>
                <span>·</span>
                <span>Saved Words: <strong class="text-gray-900">${metrics.savedVocabulary.length}</strong></span>
              </div>
            </div>

            <!-- 7-Day Activity Bar Chart -->
            <div class="grid grid-cols-7 gap-2 sm:gap-3 items-end h-36 pt-4 px-2 bg-gray-50/70 rounded-2xl border border-gray-100 p-3">
              ${last7Days.map(day => {
                const heightPct = day.messagesSent === 0 ? 8 : Math.max(16, Math.round((day.messagesSent / maxDailyMsgs) * 100));
                return `
                  <div class="flex flex-col items-center justify-end h-full gap-1.5 group">
                    <span class="text-[10px] font-mono font-bold text-gray-500 tabular-nums">${day.messagesSent}</span>
                    <div class="w-full max-w-[34px] bg-gray-200/70 rounded-xl h-20 flex items-end overflow-hidden p-0.5">
                      <div
                        class="w-full rounded-lg transition-all duration-500 ${
                          day.messagesSent > 0 ? 'bg-indigo-600' : 'bg-gray-300/60'
                        }"
                        style="height: ${heightPct}%"
                        title="${day.date}: ${day.messagesSent} messages, ${day.wordsLearned} words"
                      ></div>
                    </div>
                    <span class="text-[11px] font-bold text-gray-600">${day.label}</span>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- 4 KPI Stat Strip -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div class="text-[11px] text-gray-500 font-semibold">Current Streak</div>
                <div class="text-xl font-black text-gray-900 tabular-nums mt-0.5">🔥 ${metrics.currentStreakDays}d</div>
              </div>
              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div class="text-[11px] text-gray-500 font-semibold">Total Messages</div>
                <div class="text-xl font-black text-gray-900 tabular-nums mt-0.5">💬 ${metrics.totalMessagesSent}</div>
              </div>
              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div class="text-[11px] text-gray-500 font-semibold">Words Saved</div>
                <div class="text-xl font-black text-gray-900 tabular-nums mt-0.5">📖 ${metrics.savedVocabulary.length}</div>
              </div>
              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div class="text-[11px] text-gray-500 font-semibold">Grammar Score</div>
                <div class="text-xl font-black text-gray-900 tabular-nums mt-0.5">✨ ${grammarPct}%</div>
              </div>
            </div>
          </div>

        </section>

        <!-- 3. Choose Target Language on Home Screen -->
        <section class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-lg sm:text-xl font-extrabold text-gray-900">Select Target Language</h2>
              <p class="text-xs text-gray-500">Click any language to immediately set it for your practice session</p>
            </div>

            <!-- Category Filter Buttons -->
            <div class="flex items-center gap-1 p-1 bg-gray-100 rounded-xl self-start">
              ${(['all', 'indian', 'european', 'asian'] as LanguageCategory[]).map(cat => `
                <button
                  data-home-lang-cat="${cat}"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                    homeLanguageCategory === cat
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }"
                >
                  ${cat}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            ${filteredLanguages.map((langItem: Language) => {
              const isCurrent = langItem.code === activeSession.language.code;
              return `
                <button
                  data-home-select-lang="${langItem.code}"
                  class="p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    isCurrent
                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-2xs'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }"
                >
                  <span class="text-2xl shrink-0">${langItem.flag}</span>
                  <div class="min-w-0">
                    <div class="font-bold text-xs text-gray-900 truncate">${langItem.name}</div>
                    <div class="text-[11px] text-gray-500 truncate">${langItem.nativeName}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </section>

        <!-- 4. AI Persona Partners Showcase -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg sm:text-xl font-extrabold text-gray-900">AI Conversation Personas</h2>
              <p class="text-xs text-gray-500">Choose a partner personality and launch directly into a conversation in ${activeSession.language.name}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${PERSONAS.map((p: Persona) => {
              const isSelected = p.id === activeSession.persona.id;
              return `
                <div
                  class="p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/60 border-indigo-400 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-indigo-200'
                  }"
                >
                  <div>
                    <div class="flex items-start justify-between gap-3 mb-3">
                      <div class="flex items-center gap-3">
                        <span class="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl shadow-2xs">
                          ${p.avatar}
                        </span>
                        <div>
                          <h3 class="font-extrabold text-sm sm:text-base text-gray-900">${p.name}</h3>
                          <p class="text-xs text-indigo-600 font-semibold">${p.tagline || 'Conversational Partner'}</p>
                        </div>
                      </div>
                      <span class="text-[11px] text-gray-400 font-medium capitalize">${p.defaultDifficulty || 'intermediate'}</span>
                    </div>

                    <p class="text-xs text-gray-600 leading-relaxed mb-4">
                      ${p.description}
                    </p>
                  </div>

                  <button
                    data-home-launch-persona="${p.id}"
                    class="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-indigo-600 hover:text-white text-gray-800'
                    }"
                  >
                    <span>Practice ${activeSession.language.name} with ${p.name}</span>
                    <span>→</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <!-- 5. Recent Conversation History -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg sm:text-xl font-extrabold text-gray-900">Recent Practice Sessions</h2>
              <p class="text-xs text-gray-500">Pick up right where you left off</p>
            </div>
            <button id="home-view-all-history-btn" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
              View All (${sessions.length}) →
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${sessions.slice(0, 3).map(s => {
              const lastMsg = s.messages[s.messages.length - 1];
              return `
                <div
                  data-home-resume-session="${s.id}"
                  class="p-4 rounded-2xl bg-white border border-gray-200 hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-lg">${s.language.flag}</span>
                        <span class="font-bold text-xs sm:text-sm text-gray-900 truncate">${escapeHtml(s.title)}</span>
                      </div>
                      <span class="text-[11px] text-gray-400 tabular-nums shrink-0">${s.messages.length} msgs</span>
                    </div>
                    <p class="text-xs text-gray-500 line-clamp-2 italic">
                      "${escapeHtml(lastMsg ? lastMsg.content : 'Start speaking...')}"
                    </p>
                  </div>
                  <div class="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-indigo-600 font-bold">
                    <span>${s.persona.avatar} ${s.persona.name}</span>
                    <span>Resume Chat →</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

      </div>
    </div>
  `;
}

// Render Comprehensive App Settings Modal (Gear Icon)
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
    <div id="app-settings-backdrop" class="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <!-- Modal Header -->
        <div class="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl">
              ⚙️
            </div>
            <div>
              <h3 class="font-extrabold text-base sm:text-lg text-gray-900 leading-tight">App Settings &amp; Preferences</h3>
              <p class="text-xs text-gray-500">Customize appearance, dark mode, voice synthesis, and cloud sync</p>
            </div>
          </div>
          <button id="close-app-settings-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6">

          <!-- 1. Appearance (Light / Dark / System Mode) -->
          <div class="space-y-2.5">
            <label class="text-xs font-extrabold uppercase tracking-wider text-gray-700 block">
              1. Appearance &amp; Theme
            </label>
            <div class="grid grid-cols-3 gap-2.5">
              ${([
                { id: 'light', label: 'Light Mode', icon: '☀️', desc: 'Warm daylight canvas' },
                { id: 'dark', label: 'Dark Mode', icon: '🌙', desc: 'Deep obsidian slate' },
                { id: 'system', label: 'System Auto', icon: '💻', desc: 'Follow OS setting' }
              ] as const).map(item => {
                const isSelected = settings.theme === item.id;
                return `
                  <button
                    data-settings-theme="${item.id}"
                    class="p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border-gray-200'
                    }"
                  >
                    <div class="text-xl mb-1">${item.icon}</div>
                    <div class="font-bold text-xs">${item.label}</div>
                    <div class="text-[10px] ${isSelected ? 'text-indigo-100' : 'text-gray-500'} mt-0.5">${item.desc}</div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 2. Voice & Audio Synthesis Controls -->
          <div class="space-y-4 pt-2 border-t border-gray-100">
            <div class="flex items-center justify-between">
              <label class="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                2. Speech &amp; Voice Output
              </label>
              <button
                id="settings-test-voice-btn"
                class="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs cursor-pointer transition-colors"
              >
                🔊 Test Voice
              </button>
            </div>

            <!-- Voice Selector -->
            <div class="space-y-1.5">
              <span class="text-xs font-semibold text-gray-600 block">Preferred Speech Voice</span>
              <select
                id="settings-voice-select"
                class="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-gray-700">Speaking Speed</span>
                  <span id="settings-rate-label" class="font-mono font-bold text-indigo-600 tabular-nums">${settings.speechRate.toFixed(2)}x</span>
                </div>
                <input
                  id="settings-rate-slider"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value="${settings.speechRate}"
                  class="w-full accent-indigo-600 cursor-pointer"
                />
                <div class="flex justify-between text-[10px] text-gray-400">
                  <span>0.5x Slow</span>
                  <span>1.0x Normal</span>
                  <span>1.5x Fast</span>
                </div>
              </div>

              <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-gray-700">Voice Pitch</span>
                  <span id="settings-pitch-label" class="font-mono font-bold text-indigo-600 tabular-nums">${settings.speechPitch.toFixed(2)}</span>
                </div>
                <input
                  id="settings-pitch-slider"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value="${settings.speechPitch}"
                  class="w-full accent-indigo-600 cursor-pointer"
                />
                <div class="flex justify-between text-[10px] text-gray-400">
                  <span>0.5 Deep</span>
                  <span>1.0 Natural</span>
                  <span>1.5 Bright</span>
                </div>
              </div>
            </div>

            <!-- Auto-Speak Toggle -->
            <div class="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
              <div>
                <div class="font-bold text-xs text-gray-900">Auto-Pronounce AI Replies</div>
                <div class="text-[11px] text-gray-500">Automatically read new partner messages aloud</div>
              </div>
              <button
                id="settings-autospeak-toggle"
                class="px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
                  settings.autoSpeak
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }"
              >
                ${settings.autoSpeak ? 'ON 🔊' : 'OFF 🔇'}
              </button>
            </div>
          </div>

          <!-- 3. Default Language & Persona Preferences -->
          <div class="space-y-3 pt-2 border-t border-gray-100">
            <label class="text-xs font-extrabold uppercase tracking-wider text-gray-700 block">
              3. Default Learning Setup
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span class="text-xs font-semibold text-gray-600 block mb-1">Default Language</span>
                <select
                  id="settings-default-lang"
                  class="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900"
                >
                  ${LANGUAGES.map(l => `
                    <option value="${l.code}" ${settings.defaultLanguageCode === l.code ? 'selected' : ''}>
                      ${l.flag} ${l.name} (${l.nativeName})
                    </option>
                  `).join('')}
                </select>
              </div>
              <div>
                <span class="text-xs font-semibold text-gray-600 block mb-1">Default AI Persona</span>
                <select
                  id="settings-default-persona"
                  class="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-900"
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
          <div class="space-y-3 pt-2 border-t border-gray-100">
            <label class="text-xs font-extrabold uppercase tracking-wider text-gray-700 block">
              4. Account &amp; Cloud Sync
            </label>
            ${user ? `
              <div class="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="Profile" class="w-10 h-10 rounded-full object-cover" referrerpolicy="no-referrer" />` : `<div class="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">${escapeHtml((user.displayName || 'U')[0])}</div>`}
                  <div class="min-w-0">
                    <div class="font-bold text-xs sm:text-sm text-gray-900 truncate">${escapeHtml(user.displayName || 'Signed-In User')}</div>
                    <div class="text-[11px] text-gray-500 truncate">${escapeHtml(user.email || '')}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    id="settings-switch-account-btn"
                    class="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer"
                  >
                    Switch Account
                  </button>
                  <button
                    id="settings-signout-btn"
                    class="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ` : `
              <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="font-bold text-xs text-gray-900">Save Streaks &amp; History to Google Account</div>
                  <div class="text-[11px] text-gray-500">Sign in to keep separate progress and history for each account</div>
                </div>
                <button
                  id="settings-google-signin-btn"
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shrink-0"
                >
                  Sign in with Google
                </button>
              </div>
            `}
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span class="text-xs text-gray-500">Changes are applied and saved automatically</span>
          <button id="done-app-settings-btn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer">
            Done
          </button>
        </div>

      </div>
    </div>
  `;
}
