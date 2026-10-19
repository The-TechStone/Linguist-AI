import './index.css';
import {
  Language,
  Persona,
  Message,
  LANGUAGES,
  PERSONAS,
  LanguageCategory,
  getLocalizedGreeting,
  GrammarCorrectionResult,
  ChatSession,
  DifficultyLevel,
  ToneStyle,
  findPersonaById,
  SentenceBreakdownResult,
  WordToken
} from './types';
import {
  getChatResponse,
  getQuickCorrection,
  getSentenceBreakdown
} from './lib/gemini';
import {
  loadFluencyMetrics,
  saveFluencyMetrics,
  createEmptyFluencyMetrics,
  getTodayDateStr,
  recordMessageActivity,
  recordGrammarAccuracy,
  saveVocabularyWord,
  removeVocabularyWord,
  toggleVocabularyMastered,
  computeCefrEstimate,
  getLast7DaysActivity
} from './lib/fluency';
import {
  tokenizeSentence,
  lookupWordToken,
  cacheTokensFromBreakdown
} from './lib/tokenizer';
import {
  getDynamicSuggestions,
  SuggestionItem
} from './lib/suggestions';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  loadOrInitUserCloudState,
  syncUserProfileToCloud,
  saveCloudSessionWithMessages,
  saveCloudVocabularyItem,
  deleteCloudVocabularyItem,
  saveCloudDailyActivity,
  deleteCloudSession,
  type User,
  type UserSettingsPreferences
} from './lib/firebase';
import {
  loadLocalSettings,
  saveLocalSettings,
  applyThemeToDocument,
  renderHomeScreen,
  renderAppSettingsModal
} from './lib/homeAndSettings';

// --- State Management & Persistence ---
const STORAGE_KEY = 'linguist_chat_sessions_v2';
const ACTIVE_SESSION_KEY = 'linguist_active_session_id_v2';

interface HoverWordState {
  word: string;
  token?: WordToken;
  x: number;
  y: number;
  msgId?: string;
  isLoading: boolean;
}

interface AppState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  userInput: string;
  isTyping: boolean;
  autoSpeak: boolean;
  showHistoryDrawer: boolean;
  showLanguageModal: boolean;
  showPersonaModal: boolean;
  modalSelectedPersonaId: string | null;
  modalSelectedTone: ToneStyle | null;
  modalSelectedDifficulty: DifficultyLevel | null;
  languageSearchQuery: string;
  activeLanguageCategory: LanguageCategory;
  historySearchQuery: string;
  errorMessage: string | null;
  checkingDraftGrammar: boolean;
  draftGrammarFeedback: GrammarCorrectionResult | null;

  // Advanced Feature 1: Deep Sentence Breakdown Drawer
  activeBreakdownMsgId: string | null;
  isLoadingBreakdown: boolean;
  breakdownError: string | null;

  // Advanced Feature 2: Fluency & Vocab Dashboard
  showFluencyModal: boolean;
  activeFluencyTab: 'overview' | 'vocab' | 'quiz';
  vocabSearchQuery: string;
  vocabFilterStatus: 'all' | 'learning' | 'mastered';
  quizCardIndex: number;
  quizShowAnswer: boolean;

  // Advanced Feature 3: Word-by-Word Hover Translation Cards
  hoverWord: HoverWordState | null;

  // Dynamic Suggestions Rotation
  suggestionSeed: number;

  // Feature 4: Brand Icon & PWA Installation
  showIconModal: boolean;
  deferredInstallPrompt: any;
  isAppInstalled: boolean;

  // Feature 5: Home Screen Dashboard, Settings & Firebase Auth
  activeView: 'home' | 'chat';
  showAppSettingsModal: boolean;
  homeLanguageCategory: LanguageCategory;
  user: User | null;
  isSyncingCloud: boolean;
  userSettings: UserSettingsPreferences;
  isChatContextExpanded: boolean;
}

// Helper: create a brand-new initial chat session (Guest mode never loads saved sessions)
function createFreshInitialSession(): ChatSession {
  const defaultLang = LANGUAGES.find(l => l.code === 'hi') || LANGUAGES[0];
  const defaultPersona = PERSONAS.find(p => p.id === 'formal_teacher') || PERSONAS[0];
  const greeting = getLocalizedGreeting(defaultPersona.id, defaultLang);

  return {
    id: 'session-' + Date.now(),
    title: `${defaultLang.name} with ${defaultPersona.name}`,
    language: defaultLang,
    persona: defaultPersona,
    difficulty: defaultPersona.defaultDifficulty || 'intermediate',
    tone: defaultPersona.defaultTone || 'formal',
    messages: [
      {
        id: 'msg-init-' + Date.now(),
        role: 'assistant',
        content: greeting,
        translation: 'Welcome to language class! What topic shall we study with structured precision today? 👨‍🏫',
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function loadSavedSessions(): ChatSession[] {
  try {
    // Clear any legacy local session storage so Guest Mode never loads saved messages
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (_) {}

  return [createFreshInitialSession()];
}

function saveSessions(_sessions: ChatSession[]) {
  // Guest Mode does not save messages or sessions to localStorage.
  // Signed-in users sync their sessions directly to Firebase Cloud.
}

function setStoredActiveSessionId(_id: string) {
  // Active session is only persisted in memory or via cloud sync for signed-in users.
}

const initialSessions = loadSavedSessions();
const defaultActiveId = initialSessions[0]?.id || null;

let fluencyMetrics = loadFluencyMetrics();
const initialUserSettings = loadLocalSettings();
applyThemeToDocument(initialUserSettings.theme);

let state: AppState = {
  sessions: initialSessions,
  activeSessionId: defaultActiveId,
  userInput: '',
  isTyping: false,
  autoSpeak: initialUserSettings.autoSpeak,
  showHistoryDrawer: false,
  showLanguageModal: false,
  showPersonaModal: false,
  modalSelectedPersonaId: null,
  modalSelectedTone: null,
  modalSelectedDifficulty: null,
  languageSearchQuery: '',
  activeLanguageCategory: 'all',
  historySearchQuery: '',
  errorMessage: null,
  checkingDraftGrammar: false,
  draftGrammarFeedback: null,

  // Feature 1: Breakdown
  activeBreakdownMsgId: null,
  isLoadingBreakdown: false,
  breakdownError: null,

  // Feature 2: Fluency
  showFluencyModal: false,
  activeFluencyTab: 'overview',
  vocabSearchQuery: '',
  vocabFilterStatus: 'all',
  quizCardIndex: 0,
  quizShowAnswer: false,

  // Feature 3: Hover Card
  hoverWord: null,

  // Suggestions continuous seed
  suggestionSeed: 0,

  // Feature 4: Brand Icon & PWA Installation
  showIconModal: false,
  deferredInstallPrompt: null,
  isAppInstalled: false,

  // Feature 5: Home Screen Dashboard, Settings & Firebase Auth
  activeView: 'home',
  showAppSettingsModal: false,
  homeLanguageCategory: 'all',
  user: null,
  isSyncingCloud: false,
  userSettings: initialUserSettings,
  isChatContextExpanded: false
};

// Listen for Firebase Google Authentication state changes
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.isSyncingCloud = true;
    renderApp();
    try {
      const freshFallbackSession = createFreshInitialSession();
      const cloudState = await loadOrInitUserCloudState(
        user,
        createEmptyFluencyMetrics(),
        state.userSettings,
        [freshFallbackSession]
      );
      fluencyMetrics = cloudState.metrics;

      state.userSettings = cloudState.settings;
      state.autoSpeak = cloudState.settings.autoSpeak;
      saveLocalSettings(state.userSettings);
      applyThemeToDocument(state.userSettings.theme);

      if (cloudState.sessions.length > 0) {
        state.sessions = cloudState.sessions;
        state.activeSessionId = cloudState.sessions[0].id;
      }
    } catch (err) {
      console.error('Error syncing cloud account data:', err);
    } finally {
      state.isSyncingCloud = false;
      renderApp();
    }
  } else {
    // Guest Mode: always reset streaks to 0 and start a fresh new chat without saving messages
    fluencyMetrics = createEmptyFluencyMetrics();
    const freshGuestSession = createFreshInitialSession();
    state.sessions = [freshGuestSession];
    state.activeSessionId = freshGuestSession.id;
    state.isSyncingCloud = false;
    renderApp();
  }
});

// Listen for OS theme changes when theme is set to 'system'
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.userSettings.theme === 'system') {
      applyThemeToDocument('system');
    }
  });

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    renderApp();
  });

  window.addEventListener('appinstalled', () => {
    state.isAppInstalled = true;
    state.deferredInstallPrompt = null;
    renderApp();
  });

  if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
    state.isAppInstalled = true;
  }
}

const root = document.getElementById('root')!;

function getActiveSession(): ChatSession | null {
  if (!state.activeSessionId) return state.sessions[0] || null;
  return state.sessions.find(s => s.id === state.activeSessionId) || state.sessions[0] || null;
}

function updateActiveSession(mutator: (session: ChatSession) => void) {
  const session = getActiveSession();
  if (!session) return;
  mutator(session);
  session.updatedAt = Date.now();
  saveSessions(state.sessions);
}

// --- Helper Functions ---
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}

function formatDate(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return 'Today';
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

function getDifficultyLabel(diff?: DifficultyLevel): string {
  switch (diff) {
    case 'beginner': return '🟢 Beginner (A1-A2)';
    case 'advanced': return '🟣 Advanced (C1-C2)';
    case 'intermediate':
    default:
      return '🟡 Intermediate (B1-B2)';
  }
}

function getDifficultyBadgeClass(diff?: DifficultyLevel): string {
  switch (diff) {
    case 'beginner': return 'bg-cyan-50 text-cyan-800 border border-cyan-300';
    case 'advanced': return 'bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/35';
    case 'intermediate':
    default:
      return 'bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/35';
  }
}

function getToneLabel(tone?: ToneStyle): string {
  switch (tone) {
    case 'formal': return '🎓 Formal & Polite';
    case 'casual': return '🤙 Casual & Colloquial';
    case 'supportive': return '💛 Supportive Buddy';
    case 'professional': return '💼 Professional & Crisp';
    case 'witty': return '🎭 Playful & Witty';
    default: return '🎓 Formal & Polite';
  }
}

function getToneBadgeClass(tone?: ToneStyle): string {
  switch (tone) {
    case 'formal': return 'bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/35';
    case 'casual': return 'bg-cyan-50 text-cyan-800 border border-cyan-300';
    case 'supportive': return 'bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/35';
    case 'professional': return 'bg-slate-100 text-slate-800 border border-slate-300';
    case 'witty': return 'bg-amber-50 text-amber-800 border border-amber-300';
    default: return 'bg-[#0052FF]/10 text-[#0052FF] border border-[#0052FF]/35';
  }
}

// Tokenizes text for interactive hover-translation cards
function renderTokenizedMessageText(text: string, langCode: string, msgId: string, isUser: boolean): string {
  const tokens = tokenizeSentence(text, langCode);
  return tokens.map(t => {
    if (!t.isWord) {
      return escapeHtml(t.text);
    }
    return `<span class="lexical-word-token ${isUser ? 'hover:bg-white/30 text-white' : 'hover:bg-[#0052FF]/15 hover:text-[#0052FF]'} cursor-pointer" data-word="${escapeHtml(t.cleanWord)}" data-msg-id="${msgId}">${escapeHtml(t.text)}</span>`;
  }).join('');
}

// Renders user message text with grammar corrections highlighted and tooltips attached
function renderUserMessageContent(msg: Message, langCode: string): string {
  const content = msg.content;
  const feedback = msg.grammarFeedback;

  if (!feedback || feedback.isCorrect || !feedback.highlightSegments || feedback.highlightSegments.length === 0) {
    return `<span class="user-text-content select-text">${renderTokenizedMessageText(content, langCode, msg.id, true)}</span>`;
  }

  let resultHtml = escapeHtml(content);

  const sortedSegments = [...feedback.highlightSegments].sort(
    (a, b) => (b.errorText?.length || 0) - (a.errorText?.length || 0)
  );

  for (const seg of sortedSegments) {
    if (!seg.errorText || !seg.errorText.trim()) continue;
    const escapedError = escapeHtml(seg.errorText);
    const escapedCorrection = escapeHtml(seg.correctedText);
    const escapedReason = escapeHtml(seg.reason);

    if (resultHtml.includes(escapedError)) {
      const highlightedMarkup = `
        <span class="grammar-highlight-token group/tip" tabindex="0" role="button" aria-label="Grammar correction: ${escapedCorrection}">
          ${escapedError}
          <span class="grammar-tooltip pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:flex group-focus/tip:flex flex-col z-50 w-56 sm:w-64 p-3 bg-[#050A18]/95 backdrop-blur-xl text-white text-xs rounded-sm shadow-2xl border border-[#FF4D4D]/50 text-left">
            <span class="flex items-center gap-1.5 text-[#FF4D4D] font-mono font-bold text-[10px] uppercase tracking-wider mb-1">
              <span>✏️</span> Suggested Correction
            </span>
            <span class="font-semibold text-cyan-300 bg-[#0B152E] px-2 py-1 rounded-sm border border-cyan-500/30 text-xs">
              ${escapedCorrection}
            </span>
            <span class="text-slate-300 mt-1.5 leading-relaxed text-[11px]">
              ${escapedReason}
            </span>
          </span>
        </span>
      `;
      resultHtml = resultHtml.replace(escapedError, highlightedMarkup);
    }
  }

  return `<span class="user-text-content select-text">${resultHtml}</span>`;
}

// --- Speech Recognition & Synthesis ---
let recognition: any = null;
let isListening = false;

const BCP47_LOOKUP: Record<string, string> = {
  hi: 'hi-IN',
  sa: 'sa-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ur: 'ur-IN',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ar: 'ar-SA',
  tr: 'tr-TR',
};

function setupSpeechRecognition(langCode: string) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    recognition = null;
    return;
  }

  try {
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    const targetLocale = langCode === 'sa' ? 'hi-IN' : (BCP47_LOOKUP[langCode] || 'en-US');
    recognition.lang = targetLocale;

    recognition.onstart = () => {
      isListening = true;
      renderApp();
    };

    recognition.onend = () => {
      isListening = false;
      renderApp();
    };

    recognition.onerror = (e: any) => {
      console.warn('Speech recognition error:', e);
      isListening = false;
      renderApp();
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      state.userInput = transcript;
      const textarea = document.getElementById('user-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = transcript;
      }
    };
  } catch (err) {
    console.warn('Failed to initialize speech recognition:', err);
    recognition = null;
  }
}

function speak(text?: string, langCode?: string, slow: boolean = false) {
  if (!('speechSynthesis' in window) || !text || !langCode) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/☕|🚂|👋|💼|📚|🕉️|🇮🇳|👨‍🏫|😎|🤝|🧐|🪔|🧭|🏛️|✨|🌟|🔍|📊|📖|🔥/g, '').trim();
    if (!cleanText) return;
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();

    const targetLocale = BCP47_LOOKUP[langCode] || langCode;
    const langPrefix = langCode === 'sa' ? 'hi' : langCode.toLowerCase();

    const preferredURI = state.userSettings.preferredVoiceURI;
    const preferredVoice = preferredURI ? voices.find(v => v.voiceURI === preferredURI) : undefined;

    const voice = preferredVoice ||
                  voices.find(v => v.lang.toLowerCase() === targetLocale.toLowerCase()) ||
                  voices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) ||
                  (langCode === 'sa' ? voices.find(v => v.lang.toLowerCase().startsWith('hi')) : null);

    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = targetLocale;
    const baseRate = state.userSettings.speechRate || 0.95;
    utterance.rate = slow ? Math.max(0.5, baseRate * 0.78) : baseRate;
    utterance.pitch = state.userSettings.speechPitch || 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis failed:', e);
  }
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    if (state.showAppSettingsModal) {
      renderApp();
    }
  };
}

// Dynamic Suggestions rotation helper
function shuffleSuggestions() {
  state.suggestionSeed = (state.suggestionSeed + 1) % 1000;
  renderApp();
}

// --- Session Operations ---
function createNewChatSession(
  targetLanguage?: Language,
  targetPersona?: Persona,
  targetDifficulty?: DifficultyLevel,
  targetTone?: ToneStyle
): ChatSession {
  const current = getActiveSession();
  const lang = targetLanguage || current?.language || LANGUAGES[0];
  const persona = targetPersona || current?.persona || PERSONAS[0];
  const difficulty = targetDifficulty || current?.difficulty || persona.defaultDifficulty || 'intermediate';
  const tone = targetTone || current?.tone || persona.defaultTone || 'formal';
  const initialGreeting = getLocalizedGreeting(persona.id, lang);

  const newSession: ChatSession = {
    id: 'session-' + Date.now(),
    title: `${lang.name} with ${persona.name}`,
    language: lang,
    persona,
    difficulty,
    tone,
    messages: [
      {
        id: 'msg-init-' + Date.now(),
        role: 'assistant',
        content: initialGreeting,
        timestamp: Date.now()
      }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (state.user) {
    state.sessions.unshift(newSession);
  } else {
    // In Guest Mode, never accumulate or save historical chat sessions
    state.sessions = [newSession];
  }
  state.activeSessionId = newSession.id;
  setStoredActiveSessionId(newSession.id);
  saveSessions(state.sessions);

  if (state.user) {
    saveCloudSessionWithMessages(state.user.uid, newSession).catch(err => console.warn(err));
  }

  setupSpeechRecognition(lang.code);
  if (state.autoSpeak && lang.code && state.activeView === 'chat') {
    speak(initialGreeting, lang.code);
  }

  return newSession;
}

function switchActiveSession(sessionId: string) {
  const target = state.sessions.find(s => s.id === sessionId);
  if (target) {
    state.activeSessionId = target.id;
    setStoredActiveSessionId(target.id);
    state.showHistoryDrawer = false;
    state.activeView = 'chat';
    setupSpeechRecognition(target.language.code);
    renderApp();
  }
}

function deleteSession(sessionId: string) {
  if (state.user) {
    deleteCloudSession(state.user.uid, sessionId).catch(err => console.warn(err));
  }
  state.sessions = state.sessions.filter(s => s.id !== sessionId);
  if (state.sessions.length === 0) {
    createNewChatSession();
  } else if (state.activeSessionId === sessionId) {
    state.activeSessionId = state.sessions[0].id;
    setStoredActiveSessionId(state.activeSessionId);
  }
  saveSessions(state.sessions);
  renderApp();
}

function clearAllHistory() {
  if (confirm('Are you sure you want to clear all historical chat sessions?')) {
    state.sessions = [];
    createNewChatSession();
    renderApp();
  }
}

function exportCurrentSession(session: ChatSession) {
  const lines: string[] = [
    `# Linguist AI Chat Session: ${session.title}`,
    `Target Language: ${session.language.name} (${session.language.nativeName})`,
    `Partner Persona: ${session.persona.name}`,
    `Response Tone: ${getToneLabel(session.tone || session.persona.defaultTone)}`,
    `Response Difficulty: ${getDifficultyLabel(session.difficulty || session.persona.defaultDifficulty)}`,
    `Date: ${new Date(session.createdAt).toLocaleString()}`,
    `----------------------------------------\n`
  ];

  for (const m of session.messages) {
    const time = new Date(m.timestamp).toLocaleTimeString();
    if (m.role === 'user') {
      lines.push(`[${time}] User: ${m.content}`);
      if (m.grammarFeedback && !m.grammarFeedback.isCorrect) {
        lines.push(`   💡 Grammar Suggestion: ${m.grammarFeedback.correction}`);
        if (m.grammarFeedback.explanation) {
          lines.push(`   💡 Reason: ${m.grammarFeedback.explanation}`);
        }
      }
    } else {
      lines.push(`[${time}] ${session.persona.name}: ${m.content}`);
      if (m.translation) {
        lines.push(`   Translation: ${m.translation}`);
      }
    }
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `linguist-chat-${session.language.code}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Chat Input & AI API Dispatch ---
async function handleSendMessage(customText?: string) {
  const session = getActiveSession();
  const textToSend = (customText !== undefined ? customText : state.userInput).trim();
  if (!session || !textToSend || state.isTyping) return;

  const currentLang = session.language;
  const currentPersona = session.persona;
  const currentTone = session.tone || currentPersona.defaultTone || 'formal';
  const currentDifficulty = session.difficulty || currentPersona.defaultDifficulty || 'intermediate';

  const userMsg: Message = {
    id: 'user-' + Date.now(),
    role: 'user',
    content: textToSend,
    checkingGrammar: true,
    showFeedbackDetails: false,
    timestamp: Date.now()
  };

  updateActiveSession(s => {
    s.messages.push(userMsg);
    if (s.messages.filter(m => m.role === 'user').length === 1) {
      s.title = `${currentLang.name}: "${textToSend.slice(0, 26)}${textToSend.length > 26 ? '...' : ''}"`;
    }
  });

  // Only record streaks, activity metrics, and save messages when signed in (never in Guest Mode)
  if (state.user) {
    recordMessageActivity(fluencyMetrics, currentPersona.id, textToSend.split(/\s+/).length);
    const todayKey = getTodayDateStr();
    const todayAct = fluencyMetrics.dailyActivity?.[todayKey];
    syncUserProfileToCloud(state.user, fluencyMetrics, state.userSettings).catch(err => console.warn(err));
    if (todayAct) {
      saveCloudDailyActivity(state.user.uid, todayKey, todayAct.messagesSent, todayAct.wordsLearned).catch(err => console.warn(err));
    }
    saveCloudSessionWithMessages(state.user.uid, session).catch(err => console.warn(err));
  }

  // Automatically cycle suggestions on every sent message
  state.suggestionSeed = (state.suggestionSeed + 1) % 1000;
  state.userInput = '';
  state.draftGrammarFeedback = null;
  state.checkingDraftGrammar = false;
  state.isTyping = true;
  state.errorMessage = null;
  renderApp();

  // 1. Concurrently query grammar check endpoint for real-time visual correction feedback
  getQuickCorrection(currentLang, textToSend)
    .then(feedback => {
      userMsg.checkingGrammar = false;
      if (feedback) {
        userMsg.grammarFeedback = feedback;
        if (state.user) {
          recordGrammarAccuracy(fluencyMetrics, feedback.isCorrect);
          updateActiveSession(() => {});
          syncUserProfileToCloud(state.user, fluencyMetrics, state.userSettings).catch(err => console.warn(err));
          saveCloudSessionWithMessages(state.user.uid, session).catch(err => console.warn(err));
        }
        renderApp();
      }
    })
    .catch(err => {
      userMsg.checkingGrammar = false;
      console.warn('Grammar check failed:', err);
    });

  // 2. Query /api/chat with historical messages, persona, tone, and difficulty for Gemini AI response
  try {
    const response = await getChatResponse(
      currentLang,
      currentPersona,
      session.messages.slice(0, -1),
      textToSend,
      {
        tone: currentTone,
        difficulty: currentDifficulty
      }
    );

    const aiMsg: Message = {
      id: 'ai-' + Date.now(),
      role: 'assistant',
      content: response.content || 'Great practice!',
      translation: response.translation || '',
      correction: response.correction || undefined,
      explanation: response.explanation || undefined,
      timestamp: Date.now()
    };

    updateActiveSession(s => {
      s.messages.push(aiMsg);
    });

    if (state.user) {
      saveCloudSessionWithMessages(state.user.uid, session).catch(err => console.warn(err));
    }

    // Automatically cycle suggestions on every AI reply so fresh ideas appear
    state.suggestionSeed = (state.suggestionSeed + 1) % 1000;

    if (state.autoSpeak && currentLang?.code) {
      speak(aiMsg.content, currentLang.code);
    }
  } catch (error: any) {
    console.error('Failed to get response:', error);
    state.errorMessage = error?.message || 'Failed to communicate with Gemini AI. Please try again.';
  } finally {
    state.isTyping = false;
    renderApp();
  }
}

// On-demand grammar check for draft text in input
async function handleCheckDraftGrammar() {
  const session = getActiveSession();
  const draftText = state.userInput.trim();
  if (!session || !draftText || state.checkingDraftGrammar) return;

  state.checkingDraftGrammar = true;
  state.draftGrammarFeedback = null;
  renderApp();

  try {
    const feedback = await getQuickCorrection(session.language, draftText);
    state.draftGrammarFeedback = feedback;
  } catch (err) {
    console.warn('Draft grammar check failed:', err);
  } finally {
    state.checkingDraftGrammar = false;
    renderApp();
  }
}

// Open settings & persona modal
function openPersonaModal() {
  const current = getActiveSession();
  state.modalSelectedPersonaId = current?.persona?.id || PERSONAS[0].id;
  state.modalSelectedTone = current?.tone || current?.persona?.defaultTone || 'formal';
  state.modalSelectedDifficulty = current?.difficulty || current?.persona?.defaultDifficulty || 'intermediate';
  state.showPersonaModal = true;
  state.showLanguageModal = false;
  state.showFluencyModal = false;
  renderApp();
}

// Trigger Deep Sentence Breakdown Drawer
async function openSentenceBreakdown(msgId: string) {
  const session = getActiveSession();
  if (!session) return;
  const msg = session.messages.find(m => m.id === msgId);
  if (!msg) return;

  state.activeBreakdownMsgId = msgId;
  state.breakdownError = null;

  if (msg.breakdown) {
    // Already cached
    state.isLoadingBreakdown = false;
    renderApp();
    return;
  }

  state.isLoadingBreakdown = true;
  renderApp();

  try {
    const breakdown = await getSentenceBreakdown(session.language, msg.content, session.persona);
    if (breakdown) {
      msg.breakdown = breakdown;
      cacheTokensFromBreakdown(session.language.code, breakdown.tokens);
      saveSessions(state.sessions);
    } else {
      state.breakdownError = 'Could not generate sentence breakdown at this time.';
    }
  } catch (e: any) {
    console.warn('Sentence breakdown error:', e);
    state.breakdownError = e?.message || 'Failed to analyze sentence structure.';
  } finally {
    state.isLoadingBreakdown = false;
    renderApp();
  }
}

// Handle Hover Card Popover on a lexical word token
async function handleWordHover(word: string, msgId: string, event: MouseEvent | TouchEvent) {
  const session = getActiveSession();
  if (!session || !word.trim()) return;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = Math.min(window.innerWidth - 240, Math.max(16, rect.left));
  const y = rect.bottom + 8;

  state.hoverWord = {
    word,
    msgId,
    x,
    y,
    isLoading: true
  };
  renderHoverCard();

  const msg = session.messages.find(m => m.id === msgId);
  const token = await lookupWordToken(session.language, word, msg?.content, msg?.breakdown?.tokens);

  if (state.hoverWord && state.hoverWord.word === word) {
    state.hoverWord.token = token;
    state.hoverWord.isLoading = false;
    renderHoverCard();
  }
}

function closeHoverCard() {
  state.hoverWord = null;
  const popover = document.getElementById('word-hover-popover');
  if (popover) {
    popover.remove();
  }
}

// Separate dedicated renderer for the word lookup card (Bottom-Sheet Drawer on Mobile/Tablet <1024px, Popover on Desktop >=1024px)
function renderHoverCard() {
  let popover = document.getElementById('word-hover-popover');
  if (!state.hoverWord) {
    if (popover) popover.remove();
    return;
  }

  const session = getActiveSession();
  if (!session) return;

  const { word, token, x, y, msgId, isLoading } = state.hoverWord;
  const isSaved = fluencyMetrics.savedVocabulary.some(
    v => v.word.toLowerCase() === word.toLowerCase() && v.languageCode === session.language.code
  );
  const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1024;

  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'word-hover-popover';
    document.body.appendChild(popover);
  }

  if (isMobileOrTablet) {
    popover.className = 'fixed inset-0 z-50 bg-[#050A18]/60 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-150';
    popover.style.left = '';
    popover.style.top = '';
    popover.innerHTML = `
      <div id="word-sheet-card" class="w-full max-w-lg bg-[#050A18] text-white rounded-t-2xl border-t border-x border-[#0052FF]/50 shadow-2xl p-4 pb-8 space-y-3 animate-in slide-in-from-bottom duration-200">
        <div id="word-sheet-handle" class="sheet-grab-handle-zone" title="Swipe down or tap to close">
          <div class="w-11 h-1.5 rounded-full bg-slate-600"></div>
        </div>
        <div class="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-lg sm:text-xl text-white tracking-wide truncate">${escapeHtml(word)}</span>
              <button id="popover-speak-btn" class="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-sm bg-slate-800/80 hover:bg-[#0052FF] text-white transition-colors cursor-pointer" title="Listen to pronunciation">
                🔊
              </button>
            </div>
            ${token?.transliteration ? `
              <p class="text-xs font-mono text-cyan-300 tracking-wide mt-0.5">${escapeHtml(token.transliteration)}</p>
            ` : ''}
          </div>
          <button id="close-popover-btn" class="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-sm border border-slate-700 text-slate-300 hover:text-[#FF4D4D] text-sm font-mono font-bold cursor-pointer">✕</button>
        </div>

        ${isLoading ? `
          <div class="py-4 flex items-center justify-center gap-2 text-blue-300 text-xs font-mono animate-pulse">
            <span class="w-2 h-2 rounded-none bg-[#0052FF] animate-ping"></span>
            <span>QUERYING LEXICON...</span>
          </div>
        ` : `
          <div class="space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2.5 py-0.5 bg-[#0052FF]/30 text-blue-200 border border-[#0052FF]/50 rounded-sm text-[11px] font-mono font-semibold uppercase">
                ${escapeHtml(token?.partOfSpeech || 'Word')}
              </span>
              ${token?.grammaticalRole ? `
                <span class="text-slate-400 text-xs font-mono truncate">${escapeHtml(token.grammaticalRole)}</span>
              ` : ''}
            </div>

            <p class="text-slate-100 text-sm leading-relaxed font-medium">
              ${escapeHtml(token?.meaning || `Translation of '${word}'`)}
            </p>
          </div>
        `}

        <div class="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2.5 text-xs">
          <button
            id="popover-bookmark-btn"
            class="min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm transition-all font-mono font-bold uppercase text-xs cursor-pointer ${
              isSaved
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50'
                : 'bg-[#0052FF] hover:bg-[#2563EB] text-white'
            }"
          >
            <span>${isSaved ? '✓ Saved in Bank' : '⭐️ Save Word'}</span>
          </button>

          ${msgId ? `
            <button
              id="popover-deep-breakdown-btn"
              class="min-h-[44px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-sm text-xs font-mono uppercase font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Breakdown 🔍</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
    popover.addEventListener('click', (e) => {
      if (e.target === popover) closeHoverCard();
    });
    popover.querySelector('#word-sheet-handle')?.addEventListener('click', closeHoverCard);
  } else {
    popover.className = 'fixed z-50 animate-in fade-in zoom-in-95 duration-150';
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;

    popover.innerHTML = `
      <div class="w-64 p-3.5 bg-[#050A18]/95 backdrop-blur-xl text-white rounded-sm shadow-2xl border border-[#0052FF]/50 text-left text-xs space-y-2 relative">
        <div class="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="font-extrabold text-base text-white tracking-wide truncate">${escapeHtml(word)}</span>
              <button id="popover-speak-btn" class="p-1 rounded-sm hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer" title="Listen to pronunciation">
                🔊
              </button>
            </div>
            ${token?.transliteration ? `
              <p class="text-[11px] font-mono text-cyan-300 tracking-wide">${escapeHtml(token.transliteration)}</p>
            ` : ''}
          </div>
          <button id="close-popover-btn" class="text-slate-400 hover:text-[#FF4D4D] p-0.5 text-xs font-mono font-bold cursor-pointer">✕</button>
        </div>

        ${isLoading ? `
          <div class="py-2 flex items-center justify-center gap-2 text-blue-300 text-[11px] font-mono animate-pulse">
            <span class="w-1.5 h-1.5 rounded-none bg-[#0052FF] animate-ping"></span>
            <span>QUERYING LEXICON...</span>
          </div>
        ` : `
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="px-2 py-0.5 bg-[#0052FF]/30 text-blue-200 border border-[#0052FF]/50 rounded-sm text-[10px] font-mono font-semibold uppercase">
                ${escapeHtml(token?.partOfSpeech || 'Word')}
              </span>
              ${token?.grammaticalRole ? `
                <span class="text-slate-400 text-[10px] font-mono truncate">${escapeHtml(token.grammaticalRole)}</span>
              ` : ''}
            </div>

            <p class="text-slate-100 text-xs leading-relaxed font-medium">
              ${escapeHtml(token?.meaning || `Translation of '${word}'`)}
            </p>
          </div>
        `}

        <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-[11px]">
          <button
            id="popover-bookmark-btn"
            class="flex items-center gap-1 px-2.5 py-1 rounded-sm transition-all font-mono font-bold uppercase text-[10px] cursor-pointer ${
              isSaved
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50'
                : 'bg-[#0052FF] hover:bg-[#2563EB] text-white'
            }"
          >
            <span>${isSaved ? '✓ Saved' : '⭐️ Save Word'}</span>
          </button>

          ${msgId ? `
            <button
              id="popover-deep-breakdown-btn"
              class="text-cyan-400 hover:text-cyan-300 text-[10px] font-mono uppercase font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Breakdown 🔍</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Attach popover events
  popover.querySelector('#close-popover-btn')?.addEventListener('click', closeHoverCard);
  popover.querySelector('#popover-speak-btn')?.addEventListener('click', () => {
    speak(word, session.language.code);
  });
  popover.querySelector('#popover-bookmark-btn')?.addEventListener('click', () => {
    const saved = saveVocabularyWord(fluencyMetrics, {
      word,
      lemma: token?.lemma || word,
      transliteration: token?.transliteration || word,
      translation: token?.meaning || word,
      languageCode: session.language.code,
      languageName: session.language.name,
      partOfSpeech: token?.partOfSpeech || 'Word',
      contextSentence: session.messages.find(m => m.id === msgId)?.content
    });
    if (state.user && saved.added) {
      saveCloudVocabularyItem(state.user.uid, saved.item).catch(err => console.warn(err));
    }
    renderHoverCard();
    renderApp();
  });
  popover.querySelector('#popover-deep-breakdown-btn')?.addEventListener('click', () => {
    closeHoverCard();
    if (msgId) {
      openSentenceBreakdown(msgId);
    }
  });
}

// --- App Icon Showcase & PWA Modal (Bottom-Sheet Drawer on Mobile/Tablet, Centered Modal on Desktop) ---
function renderIconModal(): string {
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

  return `
    <div id="icon-modal-backdrop" class="responsive-modal-backdrop animate-in fade-in duration-150">
      <div class="studio-glass-panel responsive-sheet-panel bg-white lg:max-w-xl w-full flex flex-col shadow-2xl border border-[#CBD5E1] overflow-hidden">
        
        <!-- Mobile/Tablet Bottom-Sheet Drag Handle -->
        <div class="sheet-grab-handle-zone lg:hidden" data-sheet-close="icon-modal" title="Swipe down or tap to close">
          <div class="sheet-grab-handle-bar"></div>
        </div>

        <!-- Modal Header -->
        <div class="px-4 py-3.5 sm:p-5 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-sm bg-[#050A18] p-1 border border-[#0052FF]/50 shadow-2xs flex items-center justify-center">
              <img src="/icon.svg" alt="Linguist AI Icon" class="w-8 h-8 rounded-none object-contain" referrerpolicy="no-referrer" />
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">Brand Studio</span>
              <h3 class="font-extrabold text-base sm:text-lg text-[#091126] leading-tight">App Icon &amp; Brand Identity</h3>
            </div>
          </div>
          <button id="close-icon-modal-btn" class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold text-sm cursor-pointer">
            ✕
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          <!-- Icon Hero Showcase -->
          <div class="flex flex-col items-center justify-center py-5 px-4 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] text-center">
            <div class="relative group">
              <div class="w-32 h-32 sm:w-40 sm:h-40 rounded-sm p-1 bg-linear-to-br from-[#050A18] via-[#0B152E] to-[#0052FF] shadow-xl transition-all duration-300 group-hover:scale-105 border border-[#0052FF]/50 flex items-center justify-center">
                <img 
                  src="/icon.svg" 
                  alt="Linguist AI 3D Glossy Soundwave Icon" 
                  class="w-full h-full rounded-sm object-cover" 
                  referrerpolicy="no-referrer" 
                />
              </div>
              <span class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#FF4D4D] text-white text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-none shadow-xs uppercase tracking-wider whitespace-nowrap">
                3D Vector &amp; PWA Master
              </span>
            </div>

            <div class="mt-5 space-y-1">
              <h4 class="font-black text-base sm:text-lg text-[#091126]">Geometric Soundwave Lettermark</h4>
              <p class="text-xs text-slate-600 max-w-sm">
                A sculpted 3D letter &lsquo;L&rsquo; integrated with harmonic voice frequency soundwaves, finished in Cobalt Blue and Midnight Navy studio gloss.
              </p>
            </div>
          </div>

          <!-- Generated Assets Grid -->
          <div class="space-y-2.5">
            <h5 class="text-xs font-mono font-black uppercase tracking-wider text-slate-700">Generated App Icon Formats</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              <a 
                href="/icon.svg" 
                target="_blank" 
                download="linguist-ai-icon.svg" 
                class="min-h-[56px] p-3 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF]/8 border border-[#CBD5E1] hover:border-[#0052FF] transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-sm bg-[#050A18] p-1 flex items-center justify-center shrink-0">
                  <img src="/icon.svg" alt="SVG" class="w-8 h-8 rounded-none" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-[#091126] group-hover:text-[#0052FF]">Vector SVG (Master)</p>
                  <p class="text-[10px] text-slate-500">Infinite scaling, browser tab favicon</p>
                </div>
                <span class="text-slate-400 group-hover:text-[#0052FF] text-xs font-mono">↗</span>
              </a>

              <a 
                href="/pwa-512x512.png" 
                target="_blank" 
                download="pwa-512x512.png" 
                class="min-h-[56px] p-3 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF]/8 border border-[#CBD5E1] hover:border-[#0052FF] transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-sm bg-[#050A18] p-1 flex items-center justify-center shrink-0">
                  <img src="/pwa-512x512.png" alt="512px" class="w-8 h-8 rounded-none" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-[#091126] group-hover:text-[#0052FF]">PWA 512x512 PNG</p>
                  <p class="text-[10px] text-slate-500">Splash screen &amp; Desktop/Android launcher</p>
                </div>
                <span class="text-slate-400 group-hover:text-[#0052FF] text-xs font-mono">↗</span>
              </a>

              <a 
                href="/apple-touch-icon.png" 
                target="_blank" 
                download="apple-touch-icon.png" 
                class="min-h-[56px] p-3 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF]/8 border border-[#CBD5E1] hover:border-[#0052FF] transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-sm bg-[#050A18] p-1 flex items-center justify-center shrink-0">
                  <img src="/apple-touch-icon.png" alt="Apple" class="w-8 h-8 rounded-none" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-[#091126] group-hover:text-[#0052FF]">Apple Touch Icon (180px)</p>
                  <p class="text-[10px] text-slate-500">iOS Safari Home Screen compliance</p>
                </div>
                <span class="text-slate-400 group-hover:text-[#0052FF] text-xs font-mono">↗</span>
              </a>

              <a 
                href="/pwa-maskable-512x512.png" 
                target="_blank" 
                download="pwa-maskable-512x512.png" 
                class="min-h-[56px] p-3 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF]/8 border border-[#CBD5E1] hover:border-[#0052FF] transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-sm bg-[#050A18] p-1 flex items-center justify-center shrink-0">
                  <img src="/pwa-maskable-512x512.png" alt="Maskable" class="w-8 h-8 rounded-none" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-[#091126] group-hover:text-[#0052FF]">Maskable Icon (512px)</p>
                  <p class="text-[10px] text-slate-500">Android adaptive circular safe-zone</p>
                </div>
                <span class="text-slate-400 group-hover:text-[#0052FF] text-xs font-mono">↗</span>
              </a>

            </div>
          </div>

          <!-- PWA Installation Info -->
          <div class="p-4 rounded-sm bg-[#0052FF]/8 border border-[#0052FF]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div class="space-y-0.5">
              <span class="font-extrabold text-xs font-mono uppercase text-[#091126] flex items-center gap-1.5">
                <span>📱</span>
                <span>Install on Mobile, Tablet &amp; Desktop</span>
              </span>
              <p class="text-[11px] text-slate-600 leading-relaxed">
                ${isIOS
                  ? 'On iPhone/iPad: Tap the <strong>Share</strong> button in Safari, then tap <strong>Add to Home Screen</strong>.'
                  : state.isAppInstalled
                    ? 'Linguist AI is already installed on your device in standalone mode.'
                    : 'Install as a standalone native app on Android, iOS, iPadOS, macOS, or Windows.'
                }
              </p>
            </div>
            ${!isIOS && !state.isAppInstalled && state.deferredInstallPrompt ? `
              <button
                id="modal-pwa-install-btn"
                class="min-h-[44px] px-4 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white font-mono font-bold uppercase text-xs rounded-sm cursor-pointer whitespace-nowrap"
              >
                Install Now
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 sm:p-5 border-t border-[#CBD5E1] bg-[#F4F7FB] flex items-center justify-between">
          <span class="text-xs font-mono text-slate-500">SERVED FROM /PUBLIC</span>
          <button id="icon-modal-close-action-btn" class="min-h-[44px] px-5 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase cursor-pointer">
            Close
          </button>
        </div>

      </div>
    </div>
  `;
}

// --- Main App Renderer ---
function renderApp() {
  const session = getActiveSession();
  if (!session) {
    createNewChatSession();
    return;
  }

  const lang = session.language;
  const persona = session.persona;
  const currentTone = session.tone || persona.defaultTone || 'formal';
  const currentDifficulty = session.difficulty || persona.defaultDifficulty || 'intermediate';
  const messages = session.messages;
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant') || null;
  const dynamicSuggestions = getDynamicSuggestions(lang, persona, lastAssistantMsg, state.suggestionSeed, 6);

  // Compute CEFR milestone for header badge
  const cefr = computeCefrEstimate(fluencyMetrics);

  root.innerHTML = `
    <div class="theme-app-bg app-viewport-shell bg-[#F4F7FB] flex flex-col font-sans overflow-hidden text-[#091126]">
      
      <!-- Top Studio Command Header -->
      <header class="theme-header studio-glass-header border-b border-[#CBD5E1] px-2.5 sm:px-5 py-2 flex items-center justify-between sticky top-0 z-30 shrink-0">
        <div class="flex items-center gap-1.5 sm:gap-3 min-w-0">
          
          <!-- App Brand Lockup with 3D Soundwave Icon -->
          <button
            id="brand-icon-btn"
            class="min-h-[40px] flex items-center gap-2 shrink-0 pr-2 sm:pr-3 border-r border-[#CBD5E1] cursor-pointer group text-left transition-opacity hover:opacity-90"
            title="Linguist AI — Click to view Icon, Brand, and PWA options"
          >
            <div class="w-8 h-8 rounded-sm bg-[#050A18] p-0.5 transition-transform group-hover:scale-105 flex items-center justify-center border border-[#0052FF]/60">
              <img 
                src="/icon.svg" 
                alt="Linguist AI 3D Soundwave Icon" 
                class="w-full h-full rounded-none object-cover" 
                referrerpolicy="no-referrer" 
              />
            </div>
            <div class="hidden sm:flex flex-col">
              <span class="font-extrabold text-xs sm:text-sm text-[#091126] tracking-tight leading-none uppercase">
                Linguist<span class="text-[#0052FF]">AI</span>
              </span>
              <span class="text-[9px] font-mono text-[#FF4D4D] uppercase tracking-widest mt-0.5 hidden md:inline">STUDIO // LOUNGE</span>
            </div>
          </button>

          <!-- Home / Learn Sharp Geometric Navigation Switcher (Desktop & Tablet quick access) -->
          <div class="hidden md:flex items-center divide-x divide-[#CBD5E1] bg-[#F4F7FB] border border-[#CBD5E1] rounded-sm shrink-0">
            <button
              id="nav-home-btn"
              class="min-h-[38px] px-3 py-1.5 rounded-none font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                state.activeView === 'home'
                  ? 'bg-[#0052FF] text-white'
                  : 'text-slate-600 hover:text-[#091126] hover:bg-white'
              }"
              title="Open Home Dashboard, Progress Graph, Streaks & Personas"
            >
              <span>🏠</span>
              <span>Home</span>
            </button>
            <button
              id="nav-chat-btn"
              class="min-h-[38px] px-3 py-1.5 rounded-none font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                state.activeView === 'chat'
                  ? 'bg-[#0052FF] text-white'
                  : 'text-slate-600 hover:text-[#091126] hover:bg-white'
              }"
              title="Go to Language Practice Conversation"
            >
              <span>💬</span>
              <span>Learn</span>
            </button>
          </div>

          <!-- History Drawer Toggle Button -->
          <button
            id="toggle-history-btn"
            class="hidden lg:flex min-h-[38px] px-2.5 py-1.5 rounded-sm bg-white hover:bg-[#F4F7FB] border border-[#CBD5E1] hover:border-[#0052FF] text-[#091126] transition-all items-center gap-1.5 font-mono font-bold text-xs uppercase tracking-wider cursor-pointer"
            title="Browse Historical Conversations"
          >
            <span>📜</span>
            <span>History</span>
            <span class="px-1.5 py-0.2 bg-[#0052FF]/12 text-[#0052FF] border border-[#0052FF]/30 rounded-none text-[10px] font-mono font-bold tabular-nums">
              ${state.sessions.length}
            </span>
          </button>

          <!-- Active Persona, Tone & Difficulty Controls (Desktop Header) -->
          <div class="hidden xl:flex items-center gap-2.5 min-w-0 pl-2 border-l border-[#CBD5E1]">
            <button
              id="switch-persona-btn"
              class="w-9 h-9 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/30 flex items-center justify-center text-lg hover:border-[#0052FF] transition-colors cursor-pointer flex-shrink-0"
              title="Click to select AI Persona, Tone and Difficulty"
            >
              ${persona.avatar}
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-bold text-xs text-[#091126] truncate leading-tight">
                  ${persona.name}
                </p>
                <button
                  id="switch-persona-text-btn"
                  class="text-[10px] font-mono uppercase text-[#0052FF] bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white border border-[#0052FF]/30 px-1.5 py-0.2 rounded-sm cursor-pointer font-bold transition-colors flex items-center gap-0.5"
                  title="Adjust AI Persona, Tone & Difficulty"
                >
                  <span>Persona</span>
                  <span class="text-[8px]">▾</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1 mt-0.5">
                <button
                  id="switch-lang-btn"
                  class="text-[10px] font-mono font-bold text-[#091126] hover:border-[#0052FF] flex items-center gap-1 bg-white px-2 py-0.2 rounded-sm border border-[#CBD5E1] cursor-pointer transition-colors"
                  title="Switch Target Language"
                >
                  <span>${lang.flag}</span>
                  <span>${lang.name}</span>
                  <span class="text-[9px] text-[#0052FF]">▾</span>
                </button>

                <button
                  id="header-tone-btn"
                  class="text-[10px] font-mono font-bold px-2 py-0.2 rounded-sm cursor-pointer hover:opacity-85 transition-opacity ${getToneBadgeClass(currentTone)}"
                  title="Active Tone: Click to adjust"
                >
                  ${getToneLabel(currentTone)}
                </button>

                <button
                  id="header-diff-btn"
                  class="text-[10px] font-mono font-bold px-2 py-0.2 rounded-sm cursor-pointer hover:opacity-85 transition-opacity ${getDifficultyBadgeClass(currentDifficulty)}"
                  title="Active Difficulty: Click to adjust"
                >
                  ${getDifficultyLabel(currentDifficulty)}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Header Actions (Streak, Vocab, Fluency, Settings Gear, Auth) -->
        <div class="flex items-center gap-1 sm:gap-1.5">
          
          <!-- Daily Streak Button (Electric Coral) -->
          <button
            id="header-streak-btn"
            class="min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-sm bg-[#FF4D4D]/10 hover:bg-[#FF4D4D] hover:text-white border border-[#FF4D4D]/40 text-[#FF4D4D] font-mono font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            title="Active Streak: Click to view Fluency Dashboard"
          >
            <span>🔥</span>
            <span class="tabular-nums">${fluencyMetrics.currentStreakDays}D</span>
          </button>

          <!-- Vocabulary Bank Button -->
          <button
            id="header-vocab-btn"
            class="hidden sm:flex min-h-[38px] px-2.5 py-1.5 rounded-sm bg-white hover:bg-[#F4F7FB] border border-[#CBD5E1] hover:border-[#0052FF] text-[#091126] font-mono font-bold text-xs items-center gap-1 transition-all cursor-pointer"
            title="Saved Vocabulary Bank"
          >
            <span>📖</span>
            <span class="hidden lg:inline uppercase">Vocab</span>
            <span class="px-1.5 py-0.2 bg-[#0052FF]/12 text-[#0052FF] rounded-none text-[10px] tabular-nums">
              ${fluencyMetrics.savedVocabulary.length}
            </span>
          </button>

          <!-- Fluency Dashboard Link -->
          <button
            id="header-fluency-btn"
            class="min-h-[38px] px-2 sm:px-2.5 py-1.5 rounded-sm bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white border border-[#0052FF]/35 text-[#0052FF] font-mono font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            title="Open Fluency Analytics & Mastery Dashboard"
          >
            <span>📊</span>
            <span class="hidden xl:inline uppercase">Fluency</span>
            <span class="px-1.5 py-0.2 bg-[#0052FF] text-white rounded-none text-[10px]">
              ${cefr.level}
            </span>
          </button>

          <!-- Settings Gear Icon (Appearance: Dark/Light Mode, Voices, Account) -->
          <button
            id="header-app-settings-btn"
            class="hidden md:flex min-h-[38px] px-2.5 py-1.5 rounded-sm bg-white hover:bg-[#F4F7FB] border border-[#CBD5E1] hover:border-[#0052FF] text-[#091126] transition-all cursor-pointer items-center gap-1 text-xs font-mono font-bold uppercase"
            title="Settings — Change Dark/Light Mode, Voices, and Preferences"
          >
            <span>⚙️</span>
            <span class="hidden xl:inline">Settings</span>
          </button>

          <!-- Google Account / Profile Button -->
          ${state.user ? `
            <button
              id="header-auth-btn"
              class="min-h-[38px] p-1 pr-2 rounded-sm bg-[#0052FF]/10 hover:bg-[#0052FF]/20 border border-[#0052FF]/40 text-[#091126] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Signed in as ${escapeHtml(state.user.email || state.user.displayName || 'User')} — Click to manage account"
            >
              ${state.user.photoURL ? `<img src="${escapeHtml(state.user.photoURL)}" alt="Profile" class="w-6 h-6 rounded-sm object-cover" referrerpolicy="no-referrer" />` : `<span class="w-6 h-6 rounded-sm bg-[#0052FF] text-white flex items-center justify-center text-[10px] font-bold">${escapeHtml((state.user.displayName || 'U')[0])}</span>`}
              <span class="hidden md:inline max-w-[85px] truncate">${escapeHtml((state.user.displayName || state.user.email || 'Account').split(' ')[0])}</span>
            </button>
          ` : `
            <button
              id="header-google-signin-btn"
              class="min-h-[38px] px-2.5 py-1.5 rounded-sm bg-white hover:bg-[#F4F7FB] border border-[#CBD5E1] hover:border-[#0052FF] text-[#091126] text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-all"
              title="Sign in with Google to save progress and streaks"
            >
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span class="hidden sm:inline">Sign In</span>
            </button>
          `}

          <!-- New Chat Button -->
          <button
            id="new-chat-btn"
            class="min-h-[38px] px-2.5 sm:px-3 py-1.5 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
            title="Start a new chat session"
          >
            <span class="text-[#FF4D4D] font-black">+</span>
            <span class="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </header>

      <!-- Main Layout Body (History Sidebar + Home Dashboard OR Chat Area) -->
      <div class="flex-grow flex flex-col overflow-hidden relative min-h-0">

        <!-- Historical Sessions Drawer (Bottom-Sheet on Mobile/Tablet <1024px, Left Slide-Over on Desktop >=1024px) -->
        ${state.showHistoryDrawer ? `
          <div id="history-backdrop" class="responsive-modal-backdrop lg:!block">
            <aside class="studio-glass-panel responsive-sheet-panel lg:!fixed lg:!left-0 lg:!top-0 lg:!bottom-0 lg:!w-96 lg:!max-h-none lg:!rounded-none bg-white border-r border-[#CBD5E1] z-50 flex flex-col shadow-2xl">
              <div class="sheet-grab-handle lg:hidden" id="history-sheet-grab-handle"></div>
              <!-- Drawer Header -->
              <div class="p-4 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
                <div>
                  <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">SESSION ARCHIVE</span>
                  <h3 class="font-extrabold text-base text-[#091126]">Historical Conversations</h3>
                </div>
                <button id="close-history-drawer-btn" class="min-w-[44px] min-h-[44px] px-2.5 py-1 rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold flex items-center justify-center cursor-pointer">
                  ✕
                </button>
              </div>

              <!-- Drawer Search Bar -->
              <div class="p-3 border-b border-[#CBD5E1] bg-[#F4F7FB]">
                <div class="relative">
                  <input
                    id="history-search-input"
                    type="text"
                    value="${state.historySearchQuery}"
                    placeholder="Search in past conversations..."
                    class="w-full min-h-[44px] pl-9 pr-8 py-2 bg-white border border-[#CBD5E1] rounded-sm text-sm text-[#091126] placeholder-slate-400 focus:outline-none focus:border-[#0052FF]"
                  />
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  ${state.historySearchQuery ? `
                    <button id="clear-history-search" class="min-w-[36px] min-h-[36px] absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs flex items-center justify-center cursor-pointer">✕</button>
                  ` : ''}
                </div>
              </div>

              <!-- History List -->
              <div class="flex-grow overflow-y-auto p-3 space-y-2">
                ${state.sessions
                  .filter(s => {
                    const q = state.historySearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      s.title.toLowerCase().includes(q) ||
                      s.language.name.toLowerCase().includes(q) ||
                      s.persona.name.toLowerCase().includes(q) ||
                      s.messages.some(m => m.content.toLowerCase().includes(q))
                    );
                  })
                  .map(s => {
                    const isActive = s.id === session.id;
                    const lastMsg = s.messages[s.messages.length - 1];
                    return `
                      <div
                        data-session-id="${s.id}"
                        class="history-session-item group relative p-3.5 rounded-sm border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#0052FF]/10 border-[#0052FF] border-l-4'
                            : 'bg-white hover:bg-[#F4F7FB] border-[#CBD5E1]'
                        }"
                      >
                        <div class="flex items-start justify-between gap-2 mb-1">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-base">${s.language.flag}</span>
                            <span class="font-bold text-xs text-[#091126] truncate">${s.title}</span>
                          </div>
                          <span class="text-[10px] font-mono text-slate-400 whitespace-nowrap">${formatDate(s.updatedAt)}</span>
                        </div>

                        <p class="text-[11px] text-slate-500 line-clamp-1 italic mb-2">
                          "${escapeHtml(lastMsg ? lastMsg.content : 'No messages yet')}"
                        </p>

                        <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1.5 border-t border-[#CBD5E1]/60">
                          <span class="flex items-center gap-1.5">
                            <span>${s.persona.avatar} ${s.persona.name}</span>
                            <span>//</span>
                            <span class="font-bold text-[#0052FF] uppercase">${s.tone || s.persona.defaultTone || 'formal'}</span>
                          </span>
                          <div class="flex items-center gap-1.5">
                            <span class="bg-[#F4F7FB] border border-[#CBD5E1] px-1.5 py-0.5 rounded-none text-[10px] font-mono text-slate-600">
                              ${s.messages.length}
                            </span>
                            <button
                              data-delete-session-id="${s.id}"
                              class="delete-session-btn p-1.5 hover:text-[#FF4D4D] text-slate-400 rounded-none transition-opacity cursor-pointer"
                              title="Delete this conversation"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
              </div>

              <!-- Drawer Footer -->
              <div class="p-3.5 border-t border-[#CBD5E1] flex items-center justify-between text-xs bg-[#F4F7FB]">
                <button id="clear-all-history-btn" class="min-h-[44px] px-2 text-[#FF4D4D] hover:underline font-mono font-bold uppercase text-[11px] cursor-pointer">
                  Clear All
                </button>
                <button id="drawer-new-chat-btn" class="min-h-[44px] px-4 py-2 bg-[#0052FF] text-white rounded-sm font-mono font-bold uppercase text-xs cursor-pointer hover:bg-[#2563EB]">
                  + New Chat
                </button>
              </div>
            </aside>
          </div>
        ` : ''}

        ${state.activeView === 'home' ? renderHomeScreen({
          user: state.user,
          isSyncingCloud: state.isSyncingCloud,
          metrics: fluencyMetrics,
          settings: state.userSettings,
          activeSession: session,
          sessions: state.sessions,
          homeLanguageCategory: state.homeLanguageCategory
        }) : `
        <!-- Collapsible Compact Language & Persona Bar at Top of Chat -->
        <div class="studio-glass-header border-b border-[#CBD5E1] px-3 sm:px-6 py-2 shrink-0 z-20">
          <div class="max-w-3xl mx-auto">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  id="chat-back-home-btn"
                  class="min-h-[38px] px-2.5 py-1 rounded-sm bg-white hover:bg-[#0052FF] hover:text-white border border-[#CBD5E1] text-[#091126] font-mono font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shrink-0"
                  title="Return to Home Lounge"
                >
                  <span>←</span>
                  <span class="hidden sm:inline">Home</span>
                </button>

                <!-- Quick Language Pill -->
                <button
                  id="context-bar-lang-btn"
                  class="min-h-[38px] px-2.5 py-1 rounded-sm bg-white hover:border-[#0052FF] border border-[#CBD5E1] text-[#091126] font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                  title="Switch Practice Language"
                >
                  <span class="text-sm">${lang.flag}</span>
                  <span class="truncate max-w-[90px] sm:max-w-[140px]">${lang.name}</span>
                  <span class="text-[9px] text-[#0052FF]">▾</span>
                </button>

                <!-- Quick Persona Pill -->
                <button
                  id="context-bar-persona-btn"
                  class="min-h-[38px] px-2.5 py-1 rounded-sm bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white border border-[#0052FF]/35 text-[#091126] font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all min-w-0"
                  title="Switch AI Persona, Tone & Difficulty"
                >
                  <span class="text-sm shrink-0">${persona.avatar}</span>
                  <span class="truncate max-w-[100px] sm:max-w-[150px]">${persona.name}</span>
                  <span class="text-[9px] opacity-80">▾</span>
                </button>
              </div>

              <!-- Right Expand/Collapse Context Controls Toggle -->
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="hidden md:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-none ${getToneBadgeClass(currentTone)}">
                  ${getToneLabel(currentTone)}
                </span>
                <span class="hidden lg:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-none ${getDifficultyBadgeClass(currentDifficulty)}">
                  ${getDifficultyLabel(currentDifficulty)}
                </span>
                <button
                  id="toggle-chat-context-bar-btn"
                  class="min-h-[38px] px-2.5 py-1 rounded-sm border font-mono font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all ${
                    state.isChatContextExpanded
                      ? 'bg-[#0052FF] text-white border-[#0052FF]'
                      : 'bg-white text-slate-600 border-[#CBD5E1] hover:border-[#0052FF]'
                  }"
                  title="Expand or Collapse Conversation Controls"
                >
                  <span>⚙️</span>
                  <span class="hidden sm:inline">${state.isChatContextExpanded ? 'Hide' : 'Controls'}</span>
                  <span class="text-[9px]">${state.isChatContextExpanded ? '▴' : '▾'}</span>
                </button>
              </div>
            </div>

            <!-- Collapsible Expanded Tray for Mobile/Tablet/Desktop Quick Calibration -->
            ${state.isChatContextExpanded ? `
              <div class="mt-2.5 pt-2.5 border-t border-[#CBD5E1] grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in duration-150">
                <button
                  id="expanded-switch-lang-btn"
                  class="min-h-[42px] p-2 rounded-sm bg-white hover:border-[#0052FF] border border-[#CBD5E1] text-left flex items-center justify-between cursor-pointer"
                >
                  <div class="min-w-0">
                    <span class="text-[9px] font-mono uppercase text-slate-400 block">Language</span>
                    <span class="font-bold text-xs text-[#091126] truncate block">${lang.flag} ${lang.name}</span>
                  </div>
                  <span class="text-xs text-[#0052FF] font-mono">▾</span>
                </button>

                <button
                  id="expanded-switch-persona-btn"
                  class="min-h-[42px] p-2 rounded-sm bg-white hover:border-[#0052FF] border border-[#CBD5E1] text-left flex items-center justify-between cursor-pointer"
                >
                  <div class="min-w-0">
                    <span class="text-[9px] font-mono uppercase text-slate-400 block">Persona &amp; Tone</span>
                    <span class="font-bold text-xs text-[#091126] truncate block">${persona.avatar} ${getToneLabel(currentTone)}</span>
                  </div>
                  <span class="text-xs text-[#0052FF] font-mono">▾</span>
                </button>

                <button
                  id="toggle-speak-btn"
                  class="min-h-[42px] p-2 rounded-sm border text-left flex items-center justify-between cursor-pointer ${
                    state.autoSpeak
                      ? 'bg-[#0052FF]/10 border-[#0052FF] text-[#0052FF]'
                      : 'bg-white border-[#CBD5E1] text-slate-600'
                  }"
                >
                  <div>
                    <span class="text-[9px] font-mono uppercase opacity-75 block">Auto-Speak TTS</span>
                    <span class="font-bold text-xs block">${state.autoSpeak ? '🔊 Enabled' : '🔇 Muted'}</span>
                  </div>
                  <span class="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-none ${state.autoSpeak ? 'bg-[#0052FF] text-white' : 'bg-slate-200 text-slate-600'}">
                    ${state.autoSpeak ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  id="expanded-open-vocab-btn"
                  class="min-h-[42px] p-2 rounded-sm bg-white hover:border-[#0052FF] border border-[#CBD5E1] text-left flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span class="text-[9px] font-mono uppercase text-slate-400 block">Lexicon Bank</span>
                    <span class="font-bold text-xs text-[#091126] block">📖 ${fluencyMetrics.savedVocabulary.length} Saved</span>
                  </div>
                  <span class="text-xs text-[#0052FF] font-mono">→</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Chat Messages Historical Scroll Area -->
        <main id="chat-container" class="flex-grow overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 scroll-smooth min-h-0">
          <div class="max-w-3xl mx-auto w-full space-y-4 pb-2">

            <!-- Historical Messages Sequence -->
            ${messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const showDateHeader = index === 0 || formatDate(msg.timestamp) !== formatDate(messages[index - 1].timestamp);

              return `
                ${showDateHeader ? `
                  <div class="flex items-center justify-center my-2">
                    <span class="px-3 py-0.5 rounded-none bg-white border border-[#CBD5E1] text-slate-500 text-[10px] font-mono font-bold tracking-widest uppercase">
                      ${formatDate(msg.timestamp)}
                    </span>
                  </div>
                ` : ''}

                <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
                  <div class="max-w-[95%] sm:max-w-[85%] group">
                    
                    <!-- Sharp Geometric Message Frame -->
                    <div class="p-3.5 sm:p-5 rounded-sm ${
                      isUser
                        ? 'bg-[#0052FF] text-white border border-blue-400/50 border-r-4 border-r-[#FF4D4D] shadow-lg shadow-[#0052FF]/20'
                        : 'studio-glass-panel bg-white border border-[#CBD5E1] border-l-4 border-l-[#0052FF] text-[#091126]'
                    }">
                      
                      <!-- Message Header / Role / Time -->
                      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b ${
                        isUser ? 'border-white/20 text-blue-100' : 'border-[#CBD5E1]/70 text-slate-500'
                      } text-[11px] font-mono">
                        <span class="font-bold uppercase tracking-wider flex items-center gap-1.5">
                          ${isUser ? '<span>YOU // LEARNER</span>' : `<span>${persona.avatar} ${persona.name}</span>`}
                        </span>
                        <span class="tabular-nums">${formatTime(msg.timestamp)}</span>
                      </div>

                      <!-- Message Text Content (With Tokenized Hover/Tap Segment Support) -->
                      <div class="text-base sm:text-lg leading-relaxed font-medium break-words">
                        ${isUser
                          ? renderUserMessageContent(msg, lang.code)
                          : `<span class="select-text">${renderTokenizedMessageText(msg.content, lang.code, msg.id, false)}</span>`
                        }
                      </div>

                      <!-- Optional English Translation / Romanized Pronunciation -->
                      ${msg.translation ? `
                        <div class="mt-2.5 pt-2 border-t ${
                          isUser ? 'border-white/20 text-blue-100' : 'border-[#CBD5E1]/70 text-slate-500'
                        } text-xs sm:text-sm italic">
                          ${escapeHtml(msg.translation)}
                        </div>
                      ` : ''}

                      <!-- Message Actions Bar (Listen / Copy / Deep Breakdown) -->
                      <div class="mt-3 pt-2.5 border-t ${
                        isUser ? 'border-white/20 text-blue-100' : 'border-[#CBD5E1]/70 text-slate-500'
                      } flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div class="flex items-center gap-1.5">
                          <button
                            data-speak-text="${encodeURIComponent(msg.content)}"
                            class="play-msg-btn min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-sm border ${
                              isUser
                                ? 'bg-white/15 hover:bg-white/25 text-white border-white/25'
                                : 'bg-[#F4F7FB] hover:bg-[#0052FF] hover:text-white text-[#091126] border-[#CBD5E1]'
                            } transition-colors font-bold text-[10px] uppercase tracking-wider cursor-pointer"
                            title="Listen to native audio"
                          >
                            <span>🔊</span> Listen
                          </button>
                          
                          <button
                            data-copy-text="${encodeURIComponent(msg.content)}"
                            class="copy-msg-btn min-h-[38px] flex items-center gap-1 px-2.5 py-1.5 rounded-sm border ${
                              isUser
                                ? 'border-transparent hover:bg-white/15 text-blue-100'
                                : 'border-transparent hover:bg-[#F4F7FB] text-slate-500'
                            } transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
                            title="Copy text"
                          >
                            <span>📋</span> Copy
                          </button>
                        </div>

                        <!-- Deep Sentence Breakdown & Grammar Analysis Tool Button -->
                        <button
                          data-breakdown-msg-id="${msg.id}"
                          class="breakdown-msg-btn min-h-[38px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer border ${
                            isUser
                              ? 'bg-[#050A18]/40 hover:bg-[#050A18]/70 text-white border-white/30'
                              : 'bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white text-[#0052FF] border-[#0052FF]/35'
                          }"
                          title="Deep Sentence Breakdown & Grammar Analysis"
                        >
                          <span>🔍</span>
                          <span>Breakdown &amp; Grammar</span>
                          ${msg.breakdown ? '<span class="text-[9px] px-1 bg-[#FF4D4D] text-white rounded-none">READY</span>' : ''}
                        </button>
                      </div>
                    </div>

                    <!-- Grammar Feedback Indicator & Expandable Breakdown for User Messages -->
                    ${isUser ? `
                      <div class="mt-1.5 flex flex-col items-end">
                        ${msg.checkingGrammar ? `
                          <div class="flex items-center gap-1.5 text-xs font-mono text-[#0052FF] animate-pulse px-2">
                            <span class="w-2 h-2 rounded-none bg-[#0052FF]"></span>
                            <span>ANALYZING SYNTAX...</span>
                          </div>
                        ` : ''}

                        ${msg.grammarFeedback ? `
                          <div class="w-full">
                            <!-- Toggle Button / Summary Badge -->
                            <div class="flex justify-end mt-1">
                              <button
                                data-toggle-feedback="${msg.id}"
                                class="toggle-feedback-btn min-h-[38px] text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  msg.grammarFeedback.isCorrect
                                    ? 'bg-cyan-50 text-cyan-800 border-cyan-300'
                                    : 'bg-[#FF4D4D]/12 text-[#FF4D4D] border-[#FF4D4D]/45'
                                }"
                              >
                                <span>${msg.grammarFeedback.isCorrect ? '✓ Accurate Phrasing' : '💡 Grammar Feedback'}</span>
                                <span class="text-[10px]">${msg.showFeedbackDetails ? '▲' : '▼'}</span>
                              </button>
                            </div>

                            <!-- Expandable Feedback Breakdown Card -->
                            ${msg.showFeedbackDetails ? `
                              <div class="mt-2 p-4 studio-glass-panel bg-white border border-[#FF4D4D]/50 rounded-sm text-xs text-[#091126] space-y-2.5 animate-in fade-in duration-150">
                                <div class="flex items-center justify-between font-mono font-bold text-[#FF4D4D] border-b border-[#CBD5E1] pb-1.5 uppercase tracking-wider">
                                  <span class="flex items-center gap-1.5">
                                    <span>🔍</span> Syntax &amp; Phrasing Breakdown
                                  </span>
                                  <span class="text-[10px] text-slate-500">${lang.name}</span>
                                </div>

                                <div>
                                  <span class="font-mono font-bold text-slate-500 block text-[10px] uppercase">Recommended Form:</span>
                                  <p class="font-bold text-sm text-[#0052FF] bg-[#F4F7FB] p-2.5 rounded-sm border border-[#CBD5E1] mt-1 select-text">
                                    ${escapeHtml(msg.grammarFeedback.correction)}
                                  </p>
                                </div>

                                ${msg.grammarFeedback.explanation ? `
                                  <div>
                                    <span class="font-mono font-bold text-slate-500 block text-[10px] uppercase">Why:</span>
                                    <p class="text-slate-700 leading-relaxed mt-0.5 select-text">
                                      ${escapeHtml(msg.grammarFeedback.explanation)}
                                    </p>
                                  </div>
                                ` : ''}

                                ${msg.grammarFeedback.highlightSegments && msg.grammarFeedback.highlightSegments.length > 0 ? `
                                  <div class="pt-2 border-t border-[#CBD5E1] space-y-1.5">
                                    <span class="font-mono font-bold text-slate-500 block text-[10px] uppercase">Specific Edits:</span>
                                    ${msg.grammarFeedback.highlightSegments.map(seg => `
                                      <div class="p-2 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] flex flex-wrap items-start gap-2 text-[11px]">
                                        <span class="text-[#FF4D4D] line-through font-medium flex-shrink-0">${escapeHtml(seg.errorText)}</span>
                                        <span class="text-slate-400 font-mono">→</span>
                                        <span class="text-[#0052FF] font-bold flex-shrink-0">${escapeHtml(seg.correctedText)}</span>
                                        <span class="text-slate-500 italic ml-auto text-right">${escapeHtml(seg.reason)}</span>
                                      </div>
                                    `).join('')}
                                  </div>
                                ` : ''}
                              </div>
                            ` : ''}
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}

            <!-- Gemini AI Typing Indicator Frame -->
            ${state.isTyping ? `
              <div class="flex justify-start">
                <div class="p-4 rounded-sm studio-glass-panel bg-white border border-[#CBD5E1] border-l-4 border-l-[#0052FF] flex items-center gap-2.5">
                  <span class="text-base">${persona.avatar}</span>
                  <span class="text-xs font-mono text-slate-600 uppercase tracking-wider">${persona.name} IS FORMULATING RESPONSE IN ${lang.name}...</span>
                  <div class="flex items-center gap-1 ml-1">
                    <span class="w-2 h-2 rounded-none bg-[#0052FF] animate-bounce"></span>
                    <span class="w-2 h-2 rounded-none bg-[#FF4D4D] animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 rounded-none bg-[#0052FF] animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Server Error Notification -->
            ${state.errorMessage ? `
              <div class="p-4 rounded-sm bg-[#FF4D4D]/10 border border-[#FF4D4D] text-[#FF4D4D] text-xs font-mono flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>${escapeHtml(state.errorMessage)}</span>
                </div>
                <div class="flex items-center gap-3">
                  <button id="retry-send-btn" class="min-h-[38px] px-2 font-bold underline cursor-pointer uppercase">Retry</button>
                  <button id="dismiss-err-btn" class="min-h-[38px] px-2 font-bold cursor-pointer">✕</button>
                </div>
              </div>
            ` : ''}

          </div>
        </main>

        <!-- Sentence Breakdown & Deep Grammar Drawer (Bottom-Sheet on Mobile/Tablet <1024px, Right Slide-Over on Desktop >=1024px) -->
        ${state.activeBreakdownMsgId ? (() => {
          const targetMsg = session.messages.find(m => m.id === state.activeBreakdownMsgId);
          if (!targetMsg) return '';
          const b = targetMsg.breakdown;

          return `
            <div id="breakdown-backdrop" class="responsive-modal-backdrop lg:!block">
              <aside class="studio-glass-panel responsive-sheet-panel lg:!fixed lg:!right-0 lg:!top-0 lg:!bottom-0 lg:!w-[580px] lg:!max-h-none lg:!rounded-none bg-white border-l border-[#CBD5E1] z-50 flex flex-col shadow-2xl overflow-hidden">
                <div class="sheet-grab-handle lg:hidden" id="breakdown-sheet-grab-handle"></div>
                <!-- Drawer Header -->
                <div class="p-4 sm:p-5 border-b border-[#CBD5E1] bg-white sticky top-0 flex items-center justify-between z-10">
                  <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/35 flex items-center justify-center text-[#0052FF] text-lg">
                      🔍
                    </div>
                    <div>
                      <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">MORPHOLOGY // SYNTAX</span>
                      <h3 class="font-extrabold text-sm sm:text-base text-[#091126] leading-tight">Deep Sentence Breakdown</h3>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-1.5">
                    <button
                      id="breakdown-full-speak-btn"
                      class="min-h-[40px] px-2.5 py-1.5 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF] hover:text-white text-slate-700 text-xs font-mono font-bold border border-[#CBD5E1] flex items-center gap-1 cursor-pointer"
                      title="Listen to sentence (Normal speed)"
                    >
                      <span>🔊 1.0x</span>
                    </button>
                    <button
                      id="breakdown-slow-speak-btn"
                      class="min-h-[40px] px-2.5 py-1.5 rounded-sm bg-[#F4F7FB] hover:bg-[#0052FF] hover:text-white text-slate-700 text-xs font-mono font-bold border border-[#CBD5E1] flex items-center gap-1 cursor-pointer"
                      title="Listen in Slow Practice Mode (0.75x)"
                    >
                      <span>🐢 Slow</span>
                    </button>
                    <button id="close-breakdown-drawer-btn" class="min-w-[40px] min-h-[40px] px-2.5 py-1.5 rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold text-sm flex items-center justify-center cursor-pointer">
                      ✕
                    </button>
                  </div>
                </div>

                <!-- Drawer Content Area -->
                <div class="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5 text-[#091126]">

                  ${state.isLoadingBreakdown ? `
                    <div class="py-16 text-center space-y-3">
                      <div class="inline-flex p-4 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/30 text-[#0052FF] text-3xl animate-bounce">
                        🔍
                      </div>
                      <h4 class="font-extrabold text-[#091126] text-base">Dissecting Grammatical Syntax...</h4>
                      <p class="text-xs text-slate-500 max-w-sm mx-auto">
                        Analyzing parts of speech, clause hierarchy, case endings, and registers in ${lang.name}.
                      </p>
                    </div>
                  ` : b ? `
                    
                    <!-- 1. Primary Sentence & Dual Translations -->
                    <div class="p-4 bg-[#0052FF]/8 rounded-sm border border-[#0052FF]/30 space-y-2">
                      <span class="text-[10px] font-mono font-bold text-[#0052FF] uppercase tracking-widest block">Target Sentence (${lang.name})</span>
                      <p class="text-lg sm:text-xl font-bold text-[#091126] select-text leading-snug">
                        ${escapeHtml(b.sentence)}
                      </p>
                      <div class="pt-2 border-t border-[#CBD5E1] space-y-1 text-xs">
                        <div>
                          <span class="font-mono font-bold text-slate-500 uppercase">Natural:</span>
                          <span class="text-[#091126] font-medium ml-1">${escapeHtml(b.naturalTranslation)}</span>
                        </div>
                        ${b.literalTranslation ? `
                          <div>
                            <span class="font-mono font-bold text-slate-400 uppercase">Literal:</span>
                            <span class="text-slate-600 italic ml-1">${escapeHtml(b.literalTranslation)}</span>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <!-- 2. Syntactic Clause Decomposition -->
                    ${b.clauseStructure && b.clauseStructure.length > 0 ? `
                      <div class="space-y-2">
                        <h4 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>🧩</span> Syntactic Clause Structure
                        </h4>
                        <div class="grid grid-cols-1 gap-2">
                          ${b.clauseStructure.map(clause => `
                            <div class="p-3 bg-white rounded-sm border border-[#CBD5E1] space-y-1">
                              <div class="flex items-center justify-between gap-2">
                                <span class="font-bold text-sm text-[#091126] select-text">${escapeHtml(clause.clause)}</span>
                                <span class="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  clause.type === 'main'
                                    ? 'bg-[#0052FF]/12 text-[#0052FF] border border-[#0052FF]/30'
                                    : 'bg-[#FF4D4D]/12 text-[#FF4D4D] border border-[#FF4D4D]/30'
                                }">
                                  ${clause.type} clause
                                </span>
                              </div>
                              <p class="text-xs text-slate-500">${escapeHtml(clause.function)}</p>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}

                    <!-- 3. Morphological Matrix Table -->
                    ${b.tokens && b.tokens.length > 0 ? `
                      <div class="space-y-2">
                        <div class="flex items-center justify-between">
                          <h4 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <span>📊</span> Word Morphology Matrix (${b.tokens.length} tokens)
                          </h4>
                          <span class="text-[11px] font-mono text-slate-400">Tap ⭐️ to save</span>
                        </div>

                        <div class="overflow-x-auto rounded-sm border border-[#CBD5E1]">
                          <table class="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr class="bg-[#F4F7FB] border-b border-[#CBD5E1] text-slate-600 font-mono font-bold text-[10px] uppercase tracking-wider">
                                <th class="p-2.5">Token / Word</th>
                                <th class="p-2.5">POS</th>
                                <th class="p-2.5">Role / Case</th>
                                <th class="p-2.5">Meaning</th>
                                <th class="p-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-[#CBD5E1] bg-white">
                              ${b.tokens.map(token => {
                                const isTokenSaved = fluencyMetrics.savedVocabulary.some(
                                  v => v.word.toLowerCase() === token.surface.toLowerCase() && v.languageCode === lang.code
                                );
                                return `
                                  <tr class="hover:bg-[#F4F7FB] transition-colors">
                                    <td class="p-2.5">
                                      <div class="font-bold text-sm text-[#091126] select-text">${escapeHtml(token.surface)}</div>
                                      ${token.transliteration ? `
                                        <div class="text-[10px] font-mono text-[#0052FF]">${escapeHtml(token.transliteration)}</div>
                                      ` : ''}
                                    </td>
                                    <td class="p-2.5">
                                      <span class="px-2 py-0.5 rounded-none bg-[#F4F7FB] border border-[#CBD5E1] text-slate-700 font-mono font-semibold text-[10px]">
                                        ${escapeHtml(token.partOfSpeech)}
                                      </span>
                                    </td>
                                    <td class="p-2.5 text-slate-600 text-[11px]">
                                      ${escapeHtml(token.grammaticalRole || '—')}
                                    </td>
                                    <td class="p-2.5 text-[#091126] font-medium">
                                      ${escapeHtml(token.meaning)}
                                    </td>
                                    <td class="p-2.5 text-right whitespace-nowrap space-x-1">
                                      <button
                                        data-token-speak="${encodeURIComponent(token.surface)}"
                                        class="token-speak-btn min-w-[36px] min-h-[36px] p-1.5 rounded-sm hover:bg-[#F4F7FB] text-slate-500 hover:text-[#0052FF] cursor-pointer"
                                        title="Listen"
                                      >
                                        🔊
                                      </button>
                                      <button
                                        data-token-save="${encodeURIComponent(JSON.stringify(token))}"
                                        class="token-save-btn min-w-[36px] min-h-[36px] p-1.5 rounded-sm hover:bg-[#F4F7FB] ${
                                          isTokenSaved ? 'text-[#FF4D4D] font-bold' : 'text-slate-400 hover:text-[#FF4D4D]'
                                        } cursor-pointer"
                                        title="${isTokenSaved ? 'Saved in Vocabulary Bank' : 'Save to Vocab Bank'}"
                                      >
                                        ${isTokenSaved ? '⭐️' : '☆'}
                                      </button>
                                    </td>
                                  </tr>
                                `;
                              }).join('')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ` : ''}

                    <!-- 4. Key Grammar & Linguistic Insights -->
                    ${b.grammarNotes && b.grammarNotes.length > 0 ? `
                      <div class="space-y-2">
                        <h4 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>💡</span> Linguistic Insights &amp; Grammar Rules
                        </h4>
                        <div class="p-3.5 bg-[#FF4D4D]/8 rounded-sm border border-[#FF4D4D]/35 space-y-2 text-xs text-[#091126]">
                          <ul class="list-disc list-inside space-y-1.5 leading-relaxed">
                            ${b.grammarNotes.map(note => `
                              <li>${escapeHtml(note)}</li>
                            `).join('')}
                          </ul>
                        </div>
                      </div>
                    ` : ''}

                    <!-- 5. Register & Pragmatics Analysis -->
                    ${b.registerAnalysis ? `
                      <div class="space-y-2">
                        <h4 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>🎭</span> Register &amp; Pragmatic Tone
                        </h4>
                        <div class="p-3.5 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] text-xs space-y-1.5">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="font-mono font-bold text-slate-600">Politeness:</span>
                            <span class="px-2 py-0.5 rounded-none bg-[#0052FF]/12 text-[#0052FF] font-mono font-semibold text-[10px]">
                              ${escapeHtml(b.registerAnalysis.politenessLevel)}
                            </span>
                            <span class="font-mono font-bold text-slate-600 ml-2">Tone:</span>
                            <span class="px-2 py-0.5 rounded-none bg-[#FF4D4D]/12 text-[#FF4D4D] font-mono font-semibold text-[10px]">
                              ${escapeHtml(b.registerAnalysis.tone)}
                            </span>
                          </div>
                          <p class="text-slate-600 leading-relaxed pt-1 border-t border-[#CBD5E1]">
                            ${escapeHtml(b.registerAnalysis.appropriateness)}
                          </p>
                        </div>
                      </div>
                    ` : ''}

                    <!-- 6. Alternative Register Formulations -->
                    ${b.alternativeExpressions && b.alternativeExpressions.length > 0 ? `
                      <div class="space-y-2">
                        <h4 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <span>🔄</span> Alternative Formulations
                        </h4>
                        <div class="space-y-2">
                          ${b.alternativeExpressions.map(alt => `
                            <div class="p-3 bg-white rounded-sm border border-[#CBD5E1] space-y-1">
                              <div class="flex items-center justify-between gap-2">
                                <span class="font-bold text-sm text-[#091126] select-text">${escapeHtml(alt.expression)}</span>
                                <span class="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F4F7FB] border border-[#CBD5E1] text-slate-700">
                                  ${alt.register}
                                </span>
                              </div>
                              <p class="text-xs text-slate-500">${escapeHtml(alt.explanation)}</p>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}

                  ` : `
                    <div class="py-12 text-center text-slate-500 text-xs">
                      <p>No breakdown available. Tap Retry to generate.</p>
                      <button id="retry-breakdown-btn" class="mt-3 min-h-[44px] px-4 py-2 bg-[#0052FF] text-white rounded-sm font-mono font-bold uppercase cursor-pointer">
                        Retry Analysis
                      </button>
                    </div>
                  `}

                </div>
              </aside>
            </div>
          `;
        })() : ''}
        `}

      </div>

      ${state.activeView === 'chat' ? `
      <!-- Sticky Keyboard-Safe Input Dock + Prompts Strip -->
      <div class="shrink-0 z-20 pb-[68px] sm:pb-[74px]">
        <!-- Dynamic Conversation Suggestions -->
        <div class="studio-glass-header border-t border-[#CBD5E1] px-2.5 sm:px-6 py-1.5">
          <div class="max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
            
            <!-- Suggestions Header with Shuffle button -->
            <div class="flex items-center gap-1 shrink-0 pr-2 border-r border-[#CBD5E1]">
              <span class="text-[10px] font-mono font-bold text-[#0052FF] flex items-center gap-1 uppercase tracking-widest">
                <span>✨</span>
                <span class="hidden sm:inline">Prompts</span>
              </span>
              <button
                id="shuffle-suggestions-btn"
                class="min-w-[34px] min-h-[34px] p-1 rounded-sm hover:bg-[#0052FF]/12 text-[#0052FF] transition-all cursor-pointer flex items-center justify-center group"
                title="Shuffle suggestions"
                aria-label="Shuffle suggestions"
              >
                <svg class="w-3.5 h-3.5 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
            </div>

            <!-- Dynamic Suggestion Chips (Sharp Geometric Frames) -->
            ${dynamicSuggestions.map(st => `
              <div class="inline-flex items-center rounded-sm bg-white hover:bg-[#0052FF]/8 border border-[#CBD5E1] hover:border-[#0052FF] text-[#091126] transition-all group shrink-0">
                <button
                  data-suggestion="${encodeURIComponent(st.text)}"
                  class="quick-suggestion-btn min-h-[36px] px-2.5 py-1 text-xs font-medium text-left cursor-pointer flex items-center gap-1.5"
                  title="${st.translation ? escapeHtml(st.translation) : 'Tap to send this suggestion'}"
                >
                  ${st.tag ? `<span class="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase rounded-none bg-[#0052FF]/12 text-[#0052FF]">${escapeHtml(st.tag)}</span>` : ''}
                  <span class="truncate max-w-[200px] sm:max-w-[300px]">${escapeHtml(st.text)}</span>
                  ${st.translation ? `<span class="text-[10px] text-slate-400 font-normal hidden md:inline truncate max-w-[140px]">(${escapeHtml(st.translation)})</span>` : ''}
                </button>
                
                <!-- Quick Insert-Only Button -->
                <button
                  data-insert-suggestion="${encodeURIComponent(st.text)}"
                  class="quick-insert-btn min-h-[36px] px-2 py-1 border-l border-[#CBD5E1] text-slate-400 hover:text-[#0052FF] text-xs transition-colors cursor-pointer"
                  title="Edit in input field before sending"
                >
                  ✏️
                </button>
              </div>
            `).join('')}

            <!-- Extra Shuffle Button -->
            <button
              id="more-suggestions-btn"
              class="min-h-[36px] px-2.5 py-1 rounded-sm bg-[#0052FF]/10 hover:bg-[#0052FF] hover:text-white text-[#0052FF] border border-[#0052FF]/35 text-xs font-mono font-bold uppercase whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              title="Cycle to next set of suggestions"
            >
              <span>🔄 More</span>
            </button>
          </div>
        </div>

        <!-- Draft Grammar Analysis Banner -->
        ${state.checkingDraftGrammar ? `
          <div class="bg-[#0052FF]/10 border-t border-[#0052FF]/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-mono text-[#0052FF] animate-pulse">
            <span>🔍</span>
            <span>ANALYZING DRAFT SYNTAX WITH GEMINI AI...</span>
          </div>
        ` : ''}

        ${state.draftGrammarFeedback ? `
          <div class="bg-[#FF4D4D]/10 border-t border-[#FF4D4D]/40 px-3 sm:px-4 py-2 text-xs text-[#091126]">
            <div class="max-w-3xl mx-auto flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-base">${state.draftGrammarFeedback.isCorrect ? '✓' : '✏️'}</span>
                <div class="truncate">
                  <span class="font-mono font-bold uppercase text-[#FF4D4D]">
                    ${state.draftGrammarFeedback.isCorrect ? 'Accurate:' : 'Correction:'}
                  </span>
                  <span class="font-bold text-[#0052FF] ml-1">
                    ${escapeHtml(state.draftGrammarFeedback.correction)}
                  </span>
                  ${state.draftGrammarFeedback.explanation ? `
                    <span class="text-slate-600 text-[11px] ml-2 hidden sm:inline">
                      (${escapeHtml(state.draftGrammarFeedback.explanation)})
                    </span>
                  ` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                ${!state.draftGrammarFeedback.isCorrect ? `
                  <button
                    id="apply-draft-correction-btn"
                    class="min-h-[36px] px-2.5 py-1 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm font-mono font-bold text-xs uppercase cursor-pointer"
                  >
                    Apply
                  </button>
                ` : ''}
                <button id="dismiss-draft-feedback" class="min-w-[36px] min-h-[36px] text-slate-400 hover:text-[#FF4D4D] font-mono font-bold p-1 cursor-pointer">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Sticky Keyboard-Safe Chat Input Composer -->
        <footer class="studio-glass-header border-t border-[#CBD5E1] px-2.5 sm:px-4 py-2 sm:py-3">
          <div class="max-w-3xl mx-auto">
            
            ${isListening ? `
              <div class="mb-2 p-2.5 rounded-sm bg-[#FF4D4D]/15 border border-[#FF4D4D] text-[#FF4D4D] text-xs font-mono flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-none bg-[#FF4D4D] animate-ping"></span>
                  <span class="font-bold uppercase">RECORDING AUDIO IN ${lang.name}... SPEAK NOW</span>
                </div>
                <button id="stop-listening-btn" class="min-h-[36px] px-3 py-1 bg-[#FF4D4D] text-white rounded-sm text-xs font-mono font-bold uppercase cursor-pointer">
                  Stop
                </button>
              </div>
            ` : ''}

            <div class="flex items-end gap-1.5 sm:gap-2 bg-white p-1.5 sm:p-2 rounded-sm border border-[#CBD5E1] focus-within:border-[#0052FF] transition-all">
              
              <!-- Voice Input Mic Button (>=44px touch target) -->
              <button
                id="mic-action-btn"
                class="min-w-[44px] min-h-[44px] p-2.5 rounded-sm transition-colors flex-shrink-0 cursor-pointer border flex items-center justify-center ${
                  isListening
                    ? 'bg-[#FF4D4D] text-white border-[#FF4D4D] shadow-md shadow-[#FF4D4D]/30 animate-pulse'
                    : 'bg-[#F4F7FB] hover:bg-[#FF4D4D] hover:text-white text-slate-700 border-[#CBD5E1]'
                }"
                title="Voice Input (Speech-to-Text in ${lang.name})"
              >
                🎙️
              </button>

              <!-- Expanding Message Textarea (text-base prevents iOS Safari auto-zoom) -->
              <textarea
                id="user-input"
                rows="1"
                placeholder="Message in ${lang.name} (${lang.nativeName})..."
                class="flex-grow bg-transparent border-0 px-2 py-2 text-base text-[#091126] placeholder-slate-400 focus:outline-none resize-none max-h-28 min-h-[44px]"
              >${escapeHtml(state.userInput)}</textarea>

              <!-- Pre-check Draft Grammar Button (>=44px touch target) -->
              <button
                id="check-draft-grammar-btn"
                class="min-w-[44px] min-h-[44px] p-2.5 rounded-sm transition-all flex-shrink-0 border flex items-center justify-center ${
                  state.userInput.trim()
                    ? 'cursor-pointer bg-[#FF4D4D]/12 hover:bg-[#FF4D4D] hover:text-white text-[#FF4D4D] border-[#FF4D4D]/40'
                    : 'bg-[#F4F7FB] text-slate-300 cursor-not-allowed border-[#CBD5E1]'
                }"
                title="Pre-check Grammar & Spelling of this draft sentence"
              >
                ✏️
              </button>

              <!-- Send Message Button (Cobalt Blue, >=44px touch target) -->
              <button
                id="send-message-btn"
                class="min-w-[44px] min-h-[44px] p-2.5 rounded-sm transition-all flex-shrink-0 border flex items-center justify-center ${
                  state.userInput.trim() && !state.isTyping
                    ? 'bg-[#0052FF] text-white border-[#0052FF] shadow-md shadow-[#0052FF]/30 hover:bg-[#2563EB] cursor-pointer'
                    : 'bg-[#F4F7FB] text-slate-400 border-[#CBD5E1] cursor-not-allowed'
                }"
                title="Send to Gemini AI"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>

            </div>

            <div class="hidden sm:flex mt-1.5 items-center justify-between text-[11px] font-mono text-slate-500 px-1">
              <span><kbd class="px-1.5 py-0.5 bg-white border border-[#CBD5E1] rounded-none text-[#091126]">ENTER</kbd> SEND · <kbd class="px-1.5 py-0.5 bg-white border border-[#CBD5E1] rounded-none text-[#091126]">SHIFT+ENTER</kbd> NEW LINE</span>
              <span class="flex items-center gap-1.5">
                <span>PARTNER: <strong class="text-[#091126]">${persona.name}</strong></span>
                <span class="text-[#FF4D4D]">//</span>
                <button id="footer-settings-link" class="text-[#0052FF] hover:underline font-bold uppercase cursor-pointer">Calibrate Persona</button>
              </span>
            </div>

          </div>
        </footer>
      </div>
      ` : ''}

      <!-- Language Switcher Modal (Bottom-Sheet Drawer on Mobile/Tablet, Centered Modal on Desktop) -->
      ${state.showLanguageModal ? `
        <div id="lang-modal-backdrop" class="responsive-modal-backdrop animate-in fade-in duration-150">
          <div class="studio-glass-panel responsive-sheet-panel bg-white max-w-xl w-full flex flex-col shadow-2xl border border-[#CBD5E1] overflow-hidden">
            <div class="sheet-grab-handle" id="lang-sheet-grab-handle"></div>
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
              <div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">LANGUAGE MATRIX</span>
                <h3 class="font-extrabold text-base sm:text-lg text-[#091126]">Select Practice Language</h3>
              </div>
              <button id="close-lang-modal-btn" class="min-w-[44px] min-h-[44px] px-2.5 py-1 rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold flex items-center justify-center cursor-pointer">
                ✕
              </button>
            </div>

            <!-- Search & Category Filters -->
            <div class="p-3.5 sm:p-4 border-b border-[#CBD5E1] bg-[#F4F7FB] space-y-3">
              <div class="relative">
                <input
                  id="modal-lang-search"
                  type="text"
                  value="${state.languageSearchQuery}"
                  placeholder="Search language by name, script or code..."
                  class="w-full min-h-[44px] pl-10 pr-4 py-2 bg-white border border-[#CBD5E1] rounded-sm text-base focus:outline-none focus:border-[#0052FF] text-[#091126]"
                />
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              </div>

              <div class="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none pb-0.5">
                ${[
                  { id: 'all', label: `All (${LANGUAGES.length})` },
                  { id: 'indian', label: `🇮🇳 Indian (${LANGUAGES.filter(l => l.category === 'indian').length})` },
                  { id: 'european', label: `🇪🇺 European (${LANGUAGES.filter(l => l.category === 'european').length})` },
                  { id: 'asian', label: `🌏 Asian & Middle East (${LANGUAGES.filter(l => l.category === 'asian').length})` }
                ].map(tab => `
                  <button
                    data-modal-category="${tab.id}"
                    class="modal-cat-btn min-h-[38px] px-3 py-1.5 rounded-sm font-mono font-bold uppercase transition-colors whitespace-nowrap cursor-pointer border ${
                      state.activeLanguageCategory === tab.id
                        ? 'bg-[#0052FF] text-white border-[#0052FF]'
                        : 'bg-white text-slate-600 border-[#CBD5E1] hover:border-[#0052FF]'
                    }"
                  >
                    ${tab.label}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Languages Grid -->
            <div class="p-3.5 sm:p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-grow">
              ${LANGUAGES.filter(l => {
                const matchesCat = state.activeLanguageCategory === 'all' || l.category === state.activeLanguageCategory;
                const q = state.languageSearchQuery.trim().toLowerCase();
                const matchesSearch = !q ||
                  l.name.toLowerCase().includes(q) ||
                  l.nativeName.toLowerCase().includes(q) ||
                  l.code.toLowerCase().includes(q) ||
                  (l.script && l.script.toLowerCase().includes(q));
                return matchesCat && matchesSearch;
              }).map(l => {
                const isSelected = l.code === lang.code;
                return `
                  <button
                    data-select-lang="${l.code}"
                    class="min-h-[56px] p-3 rounded-sm border transition-all text-left flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#0052FF]/10 border-[#0052FF] border-l-4'
                        : 'bg-white hover:bg-[#F4F7FB] border-[#CBD5E1] hover:border-[#0052FF]'
                    }"
                  >
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">${l.flag}</span>
                      <div>
                        <p class="font-bold text-sm text-[#091126]">${l.name}</p>
                        <p class="text-xs text-slate-500 font-medium">${l.nativeName}</p>
                      </div>
                    </div>
                    <span class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-none ${
                      isSelected ? 'bg-[#0052FF] text-white' : 'bg-[#F4F7FB] border border-[#CBD5E1] text-slate-600'
                    }">
                      ${l.script || l.code.toUpperCase()}
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- AI Persona & Response Settings Modal (Bottom-Sheet Drawer on Mobile/Tablet, Centered Modal on Desktop) -->
      ${state.showPersonaModal ? `
        <div id="persona-modal-backdrop" class="responsive-modal-backdrop animate-in fade-in duration-150">
          <div class="studio-glass-panel responsive-sheet-panel bg-white max-w-2xl w-full flex flex-col shadow-2xl border border-[#CBD5E1] overflow-hidden">
            <div class="sheet-grab-handle" id="persona-sheet-grab-handle"></div>
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/35 flex items-center justify-center text-xl">
                  ⚙️
                </div>
                <div>
                  <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">PARTNER CALIBRATION</span>
                  <h3 class="font-extrabold text-base sm:text-lg text-[#091126] leading-tight">AI Persona &amp; Response Settings</h3>
                </div>
              </div>
              <button id="close-persona-modal-btn" class="min-w-[44px] min-h-[44px] px-2.5 py-1 rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold text-sm flex items-center justify-center cursor-pointer">
                ✕
              </button>
            </div>

            <!-- Scrollable Modal Body -->
            <div class="p-4 sm:p-5 overflow-y-auto space-y-5 flex-grow">

              ${(() => {
                const selP = PERSONAS.find(p => p.id === (state.modalSelectedPersonaId || persona.id)) || persona;
                const selTone = state.modalSelectedTone || session.tone || selP.defaultTone || 'formal';
                const selDiff = state.modalSelectedDifficulty || session.difficulty || selP.defaultDifficulty || 'intermediate';
                const previewGreeting = getLocalizedGreeting(selP.id, lang);

                return `
                  <!-- Current Selection Summary Banner -->
                  <div class="p-3.5 bg-[#0052FF]/8 rounded-sm border border-[#0052FF]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="text-3xl p-2 bg-white rounded-sm border border-[#CBD5E1] shrink-0">${selP.avatar}</span>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="font-extrabold text-sm text-[#091126]">${selP.name}</span>
                          <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-none ${getToneBadgeClass(selTone)}">${getToneLabel(selTone)}</span>
                          <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-none ${getDifficultyBadgeClass(selDiff)}">${getDifficultyLabel(selDiff)}</span>
                        </div>
                        <p class="text-xs text-slate-600 line-clamp-1 mt-0.5">${selP.tagline || selP.description}</p>
                      </div>
                    </div>
                    <button
                      id="reset-persona-defaults-btn"
                      class="min-h-[40px] text-[10px] font-mono font-bold uppercase text-[#0052FF] bg-white px-3 py-1.5 rounded-sm border border-[#0052FF]/40 cursor-pointer whitespace-nowrap hover:bg-[#0052FF] hover:text-white transition-colors"
                      title="Reset Tone and Difficulty to this persona's defaults"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <!-- 1. Select AI Persona -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <span>01 // Choose AI Persona</span>
                        <span class="text-[#0052FF] text-xs font-normal">(${PERSONAS.length})</span>
                      </label>
                      <span class="text-[11px] font-mono text-slate-400">Select archetype</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      ${PERSONAS.map(p => {
                        const isSelected = p.id === selP.id;
                        return `
                          <button
                            data-modal-select-persona="${p.id}"
                            class="modal-persona-card p-3 rounded-sm border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#0052FF]/10 border-[#0052FF] border-t-4'
                                : 'bg-white hover:bg-[#F4F7FB] border-[#CBD5E1] hover:border-[#0052FF]'
                            }"
                          >
                            <div class="flex items-start gap-2.5 mb-2">
                              <span class="text-2xl p-1.5 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] flex-shrink-0">${p.avatar}</span>
                              <div class="min-w-0 flex-grow">
                                <p class="font-bold text-xs text-[#091126] truncate">${p.name}</p>
                                <span class="text-[10px] font-mono text-[#0052FF] font-semibold block">${p.tagline || ''}</span>
                              </div>
                            </div>
                            <p class="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">${p.description}</p>
                            <div class="pt-1.5 border-t border-[#CBD5E1] flex items-center justify-between text-[10px] font-mono text-slate-500">
                              <span>${getToneLabel(p.defaultTone)}</span>
                              <span class="uppercase">${p.defaultDifficulty}</span>
                            </div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 2. Calibrate Tone -->
                  <div>
                    <label class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 block mb-2">
                      02 // Adjust Tone &amp; Register
                    </label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      ${(['formal', 'casual', 'supportive', 'professional', 'witty'] as ToneStyle[]).map(t => {
                        const isSelected = selTone === t;
                        return `
                          <button
                            data-modal-select-tone="${t}"
                            class="min-h-[44px] p-2.5 rounded-sm border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#0052FF] text-white border-[#0052FF]'
                                : 'bg-[#F4F7FB] hover:bg-white text-[#091126] border-[#CBD5E1]'
                            }"
                          >
                            <div class="font-bold text-xs">${getToneLabel(t)}</div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 3. Calibrate Difficulty -->
                  <div>
                    <label class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700 block mb-2">
                      03 // Adjust Difficulty Level
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                      ${(['beginner', 'intermediate', 'advanced'] as DifficultyLevel[]).map(d => {
                        const isSelected = selDiff === d;
                        return `
                          <button
                            data-modal-select-diff="${d}"
                            class="min-h-[44px] p-2.5 rounded-sm border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#0052FF] text-white border-[#0052FF]'
                                : 'bg-[#F4F7FB] hover:bg-white text-[#091126] border-[#CBD5E1]'
                            }"
                          >
                            <div class="font-bold text-xs">${getDifficultyLabel(d)}</div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 4. Persona Greeting Preview -->
                  <div class="p-3.5 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] space-y-1.5">
                    <div class="flex items-center justify-between text-xs text-slate-500">
                      <span class="font-mono font-bold uppercase text-slate-700">Preview Greeting (${lang.name}):</span>
                      <button data-preview-speak="${encodeURIComponent(previewGreeting)}" id="preview-speak-btn" class="min-h-[36px] px-2 text-[#0052FF] hover:underline font-mono font-bold uppercase cursor-pointer">
                        🔊 Listen
                      </button>
                    </div>
                    <p class="font-medium text-xs sm:text-sm text-[#091126] bg-white p-2.5 rounded-sm border border-[#CBD5E1] select-text">
                      ${escapeHtml(previewGreeting)}
                    </p>
                  </div>
                `;
              })()}

            </div>

            <!-- Modal Footer -->
            <div class="p-4 sm:p-5 border-t border-[#CBD5E1] bg-[#F4F7FB] flex flex-wrap items-center justify-between gap-2">
              <button id="modal-start-new-session-btn" class="min-h-[44px] px-3.5 py-2 rounded-sm bg-white hover:bg-[#0052FF]/10 border border-[#CBD5E1] text-[#091126] text-xs font-mono font-bold uppercase transition-all cursor-pointer">
                + New Chat
              </button>
              <div class="flex items-center gap-2 ml-auto">
                <button id="modal-cancel-btn" class="min-h-[44px] px-3.5 py-2 rounded-sm text-slate-500 hover:text-[#091126] font-mono font-bold uppercase text-xs cursor-pointer">
                  Cancel
                </button>
                <button id="modal-apply-settings-btn" class="min-h-[44px] px-4 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase cursor-pointer">
                  Apply
                </button>
              </div>
            </div>

          </div>
        </div>
      ` : ''}

      <!-- Fluency Analytics & Vocabulary Bank Dashboard Modal (Bottom-Sheet Drawer on Mobile/Tablet, Centered Modal on Desktop) -->
      ${state.showFluencyModal ? (() => {
        const last7 = getLast7DaysActivity(fluencyMetrics.activeDates);
        const filteredVocab = fluencyMetrics.savedVocabulary.filter(item => {
          if (state.vocabFilterStatus === 'learning' && item.mastered) return false;
          if (state.vocabFilterStatus === 'mastered' && !item.mastered) return false;
          const q = state.vocabSearchQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            item.word.toLowerCase().includes(q) ||
            item.translation.toLowerCase().includes(q) ||
            item.lemma.toLowerCase().includes(q) ||
            item.languageName.toLowerCase().includes(q)
          );
        });

        const quizItems = fluencyMetrics.savedVocabulary;
        const currentQuizItem = quizItems[state.quizCardIndex % Math.max(1, quizItems.length)];

        return `
          <div id="fluency-modal-backdrop" class="responsive-modal-backdrop animate-in fade-in duration-150">
            <div class="studio-glass-panel responsive-sheet-panel bg-white max-w-3xl w-full flex flex-col shadow-2xl border border-[#CBD5E1] overflow-hidden">
              <div class="sheet-grab-handle" id="fluency-sheet-grab-handle"></div>
              <!-- Modal Top Bar -->
              <div class="p-4 sm:p-5 border-b border-[#CBD5E1] flex items-center justify-between bg-white">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-sm bg-[#0052FF]/10 border border-[#0052FF]/35 flex items-center justify-center text-xl text-[#0052FF]">
                    📊
                  </div>
                  <div>
                    <span class="text-[10px] font-mono uppercase tracking-widest text-[#0052FF] block">ANALYTICS // LEXICON</span>
                    <h3 class="font-extrabold text-base sm:text-lg text-[#091126] leading-tight">Fluency &amp; Vocabulary Dashboard</h3>
                  </div>
                </div>
                <button id="close-fluency-modal-btn" class="min-w-[44px] min-h-[44px] px-2.5 py-1 rounded-sm border border-[#CBD5E1] hover:border-[#FF4D4D] hover:text-[#FF4D4D] text-slate-500 font-mono font-bold text-sm flex items-center justify-center cursor-pointer">
                  ✕
                </button>
              </div>

              <!-- Dashboard Tabs Navigation -->
              <div class="px-3 sm:px-5 border-b border-[#CBD5E1] bg-[#F4F7FB] flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
                <button
                  data-fluency-tab="overview"
                  class="fluency-tab-btn min-h-[44px] py-2.5 px-3 border-b-2 font-mono font-bold uppercase text-xs whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    state.activeFluencyTab === 'overview'
                      ? 'border-[#0052FF] text-[#0052FF] bg-white'
                      : 'border-transparent text-slate-500 hover:text-[#091126]'
                  }"
                >
                  <span>🔥 Streaks &amp; Progress</span>
                </button>

                <button
                  data-fluency-tab="vocab"
                  class="fluency-tab-btn min-h-[44px] py-2.5 px-3 border-b-2 font-mono font-bold uppercase text-xs whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    state.activeFluencyTab === 'vocab'
                      ? 'border-[#0052FF] text-[#0052FF] bg-white'
                      : 'border-transparent text-slate-500 hover:text-[#091126]'
                  }"
                >
                  <span>📖 Vocabulary Bank</span>
                  <span class="px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold ${
                    state.activeFluencyTab === 'vocab' ? 'bg-[#0052FF] text-white' : 'bg-slate-200 text-slate-700'
                  }">
                    ${fluencyMetrics.savedVocabulary.length}
                  </span>
                </button>

                <button
                  data-fluency-tab="quiz"
                  class="fluency-tab-btn min-h-[44px] py-2.5 px-3 border-b-2 font-mono font-bold uppercase text-xs whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    state.activeFluencyTab === 'quiz'
                      ? 'border-[#0052FF] text-[#0052FF] bg-white'
                      : 'border-transparent text-slate-500 hover:text-[#091126]'
                  }"
                >
                  <span>🃏 Flashcards</span>
                </button>
              </div>

              <!-- Tab Body Content -->
              <div class="p-4 sm:p-6 overflow-y-auto flex-grow space-y-6">

                ${state.activeFluencyTab === 'overview' ? `
                  
                  <!-- 7-Day Consistency Heat Strip & Streak Banner -->
                  <div class="p-4 sm:p-5 bg-[#FF4D4D]/10 rounded-sm border border-[#FF4D4D]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5">
                      <div class="w-14 h-14 rounded-sm bg-[#FF4D4D] text-white flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                        🔥
                      </div>
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <h4 class="text-lg sm:text-xl font-extrabold font-mono text-[#091126]">${fluencyMetrics.currentStreakDays} DAY STREAK</h4>
                          <span class="px-2 py-0.5 rounded-none bg-[#0052FF] text-white text-[10px] font-mono font-bold uppercase">Active Today</span>
                        </div>
                        <p class="text-xs text-slate-600 mt-0.5">Consistent daily studio sessions reinforce conversational retention.</p>
                      </div>
                    </div>

                    <!-- 7 Days Grid Strip -->
                    <div class="flex items-center gap-1.5 sm:gap-2">
                      ${last7.map(d => `
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-[10px] font-mono font-semibold text-slate-500 uppercase">${d.dayLabel}</span>
                          <div class="w-8 h-8 rounded-sm flex items-center justify-center text-xs font-mono font-bold transition-all ${
                            d.isActive
                              ? 'bg-[#FF4D4D] text-white'
                              : 'bg-white text-slate-400 border border-[#CBD5E1]'
                          } ${d.isToday ? 'ring-2 ring-[#0052FF]' : ''}">
                            ${d.isActive ? '✓' : '·'}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Key Metric Cards Structured Grid -->
                  <div class="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#CBD5E1] border border-[#CBD5E1] rounded-sm bg-[#F4F7FB]">
                    <div class="p-4 space-y-1">
                      <span class="text-slate-500 text-[10px] font-mono uppercase block">Total Sent</span>
                      <p class="text-2xl font-black font-mono text-[#0052FF] tabular-nums">${fluencyMetrics.totalMessagesSent}</p>
                      <span class="text-[10px] font-mono text-slate-600 block">Messages</span>
                    </div>

                    <div class="p-4 space-y-1">
                      <span class="text-slate-500 text-[10px] font-mono uppercase block">Vocabulary</span>
                      <p class="text-2xl font-black font-mono text-[#091126] tabular-nums">${fluencyMetrics.savedVocabulary.length}</p>
                      <span class="text-[10px] font-mono text-slate-600 block">Saved Words</span>
                    </div>

                    <div class="p-4 space-y-1">
                      <span class="text-slate-500 text-[10px] font-mono uppercase block">Syntax Score</span>
                      <p class="text-2xl font-black font-mono text-[#00B8D9] tabular-nums">${fluencyMetrics.accuracyRate}%</p>
                      <span class="text-[10px] font-mono text-slate-600 block">Accuracy Rate</span>
                    </div>

                    <div class="p-4 space-y-1">
                      <span class="text-slate-500 text-[10px] font-mono uppercase block">CEFR Tier</span>
                      <p class="text-2xl font-black font-mono text-[#FF4D4D] tabular-nums">${cefr.level}</p>
                      <span class="text-[10px] font-mono text-slate-600 block">${cefr.title}</span>
                    </div>
                  </div>

                  <!-- CEFR Progression Milestone Bar -->
                  <div class="p-4 bg-white rounded-sm border border-[#CBD5E1] space-y-2">
                    <div class="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <div>
                        <span class="font-extrabold text-[#091126]">${cefr.title}</span>
                        <span class="text-slate-500 ml-1.5">— ${cefr.description}</span>
                      </div>
                      <span class="font-mono font-bold text-[#0052FF] tabular-nums">${cefr.progressPercent}% TO NEXT TIER</span>
                    </div>
                    <div class="w-full h-2.5 bg-[#F4F7FB] border border-[#CBD5E1] rounded-none overflow-hidden">
                      <div class="h-full bg-linear-to-r from-[#0052FF] to-[#FF4D4D] transition-all duration-500" style="width: ${cefr.progressPercent}%"></div>
                    </div>
                  </div>

                  <!-- Persona Practice Distribution -->
                  <div class="p-4 bg-[#F4F7FB] rounded-sm border border-[#CBD5E1] space-y-3">
                    <h5 class="font-mono font-extrabold text-xs uppercase tracking-wider text-slate-700">
                      Practice Distribution Across Personas
                    </h5>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      ${PERSONAS.map(p => {
                        const count = (fluencyMetrics.personaUsageCount && fluencyMetrics.personaUsageCount[p.id]) || 0;
                        return `
                          <div class="p-2.5 bg-white rounded-sm border border-[#CBD5E1] flex items-center gap-2">
                            <span class="text-xl">${p.avatar}</span>
                            <div class="min-w-0 flex-grow">
                              <p class="font-bold text-xs text-[#091126] truncate">${p.name}</p>
                              <p class="text-[10px] font-mono text-slate-500 tabular-nums">${count} msgs</p>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>

                ` : state.activeFluencyTab === 'vocab' ? `
                  
                  <!-- Vocab Search & Filter Controls -->
                  <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div class="relative w-full sm:w-72">
                      <input
                        id="vocab-search-input"
                        type="text"
                        value="${escapeHtml(state.vocabSearchQuery)}"
                        placeholder="Search saved words or translations..."
                        class="w-full min-h-[44px] pl-9 pr-3 py-2 bg-[#F4F7FB] border border-[#CBD5E1] rounded-sm text-sm text-[#091126] placeholder-slate-400 focus:outline-none focus:border-[#0052FF]"
                      />
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>

                    <div class="flex items-center gap-1.5 w-full sm:w-auto text-xs overflow-x-auto scrollbar-none">
                      ${[
                        { id: 'all', label: `All (${fluencyMetrics.savedVocabulary.length})` },
                        { id: 'learning', label: `Learning (${fluencyMetrics.savedVocabulary.filter(v => !v.mastered).length})` },
                        { id: 'mastered', label: `Mastered (${fluencyMetrics.savedVocabulary.filter(v => v.mastered).length})` }
                      ].map(filter => `
                        <button
                          data-vocab-filter="${filter.id}"
                          class="vocab-filter-btn min-h-[38px] px-3 py-1.5 rounded-sm font-mono font-bold uppercase whitespace-nowrap transition-colors cursor-pointer border ${
                            state.vocabFilterStatus === filter.id
                              ? 'bg-[#0052FF] text-white border-[#0052FF]'
                              : 'bg-[#F4F7FB] text-slate-600 border-[#CBD5E1] hover:border-[#0052FF]'
                          }"
                        >
                          ${filter.label}
                        </button>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Vocab List -->
                  ${filteredVocab.length === 0 ? `
                    <div class="py-16 text-center text-slate-400 space-y-2">
                      <span class="text-3xl block">📖</span>
                      <p class="font-bold text-sm text-slate-700">No words found in this view.</p>
                      <p class="text-xs">Tap or hover over foreign words in chat or open the breakdown tool to bookmark words!</p>
                    </div>
                  ` : `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      ${filteredVocab.map(item => `
                        <div class="p-3.5 bg-white rounded-sm border border-[#CBD5E1] hover:border-[#0052FF] transition-all flex flex-col justify-between space-y-2">
                          <div>
                            <div class="flex items-start justify-between gap-2">
                              <div>
                                <span class="font-black text-lg text-[#091126] select-text">${escapeHtml(item.word)}</span>
                                ${item.transliteration ? `
                                  <span class="text-xs font-mono text-[#0052FF] block">${escapeHtml(item.transliteration)}</span>
                                ` : ''}
                              </div>
                              <span class="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase ${
                                item.mastered
                                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                                  : 'bg-[#FF4D4D]/12 text-[#FF4D4D] border border-[#FF4D4D]/35'
                              }">
                                ${item.mastered ? '✓ Mastered' : 'Learning'}
                              </span>
                            </div>

                            <p class="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                              ${escapeHtml(item.translation)}
                            </p>

                            ${item.contextSentence ? `
                              <p class="text-[11px] text-slate-400 italic line-clamp-1 mt-1">
                                "${escapeHtml(item.contextSentence)}"
                              </p>
                            ` : ''}
                          </div>

                          <div class="pt-2 border-t border-[#CBD5E1] flex items-center justify-between text-xs text-slate-500">
                            <span class="px-1.5 py-0.5 rounded-none bg-[#F4F7FB] border border-[#CBD5E1] text-[10px] font-mono font-semibold text-slate-600">
                              ${item.partOfSpeech || 'Word'} · ${item.languageName}
                            </span>
                            <div class="flex items-center gap-1.5">
                              <button
                                data-vocab-speak="${encodeURIComponent(item.word)}"
                                data-vocab-lang="${item.languageCode}"
                                class="vocab-speak-btn min-w-[38px] min-h-[38px] p-1.5 rounded-sm hover:bg-[#F4F7FB] text-slate-500 hover:text-[#0052FF] cursor-pointer"
                                title="Listen"
                              >
                                🔊
                              </button>
                              <button
                                data-vocab-toggle-mastered="${item.id}"
                                class="vocab-toggle-btn min-w-[38px] min-h-[38px] p-1.5 rounded-sm hover:bg-[#F4F7FB] text-slate-500 hover:text-[#0052FF] cursor-pointer"
                                title="Toggle Mastered"
                              >
                                ${item.mastered ? '⭐️' : '☆'}
                              </button>
                              <button
                                data-vocab-delete="${item.id}"
                                class="vocab-delete-btn min-w-[38px] min-h-[38px] p-1.5 rounded-sm hover:bg-[#FF4D4D]/10 text-slate-400 hover:text-[#FF4D4D] cursor-pointer"
                                title="Delete from bank"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}

                ` : `
                  
                  <!-- Flashcard Quiz Tab -->
                  ${quizItems.length === 0 ? `
                    <div class="py-16 text-center text-slate-400 space-y-2">
                      <span class="text-3xl block">🃏</span>
                      <p class="font-bold text-sm text-slate-700">No vocabulary saved yet.</p>
                      <p class="text-xs">Save words during your chat to practice them here!</p>
                    </div>
                  ` : currentQuizItem ? `
                    <div class="max-w-md mx-auto space-y-4 text-center">
                      <div class="flex items-center justify-between text-xs font-mono text-slate-500 px-2">
                        <span>CARD ${(state.quizCardIndex % quizItems.length) + 1} / ${quizItems.length}</span>
                        <span class="font-bold text-[#0052FF] uppercase">${currentQuizItem.languageName}</span>
                      </div>

                      <!-- Interactive Flip Card (Sharp Geometric Frame) -->
                      <div
                        id="flashcard-card"
                        class="p-6 sm:p-8 bg-[#F4F7FB] rounded-sm border-2 border-[#0052FF] shadow-lg cursor-pointer min-h-[220px] flex flex-col items-center justify-center space-y-3 transition-transform hover:scale-[1.01]"
                        title="Tap to flip card"
                      >
                        <span class="px-2.5 py-0.5 rounded-none bg-[#0052FF] text-white text-[10px] font-mono font-bold uppercase tracking-wider">
                          ${currentQuizItem.partOfSpeech || 'Word'}
                        </span>

                        <h3 class="text-2xl sm:text-3xl font-black text-[#091126] select-text">
                          ${escapeHtml(currentQuizItem.word)}
                        </h3>

                        ${currentQuizItem.transliteration ? `
                          <p class="text-sm font-mono text-[#0052FF]">${escapeHtml(currentQuizItem.transliteration)}</p>
                        ` : ''}

                        ${state.quizShowAnswer ? `
                          <div class="pt-4 border-t border-[#CBD5E1] w-full animate-in fade-in duration-200 space-y-1">
                            <p class="text-base font-bold text-[#FF4D4D]">${escapeHtml(currentQuizItem.translation)}</p>
                            ${currentQuizItem.contextSentence ? `
                              <p class="text-xs text-slate-500 italic">"${escapeHtml(currentQuizItem.contextSentence)}"</p>
                            ` : ''}
                          </div>
                        ` : `
                          <p class="text-xs font-mono text-slate-400 pt-3 uppercase">Tap card to reveal meaning</p>
                        `}
                      </div>

                      <!-- Card Controls -->
                      <div class="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                        <button
                          id="quiz-speak-btn"
                          class="min-h-[44px] px-4 py-2 bg-white hover:bg-[#F4F7FB] border border-[#CBD5E1] text-[#091126] rounded-sm text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>🔊 Pronounce</span>
                        </button>
                        <button
                          id="quiz-toggle-mastered-btn"
                          class="min-h-[44px] px-4 py-2 ${
                            currentQuizItem.mastered
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-300'
                              : 'bg-[#FF4D4D]/12 text-[#FF4D4D] border border-[#FF4D4D]/35'
                          } rounded-sm text-xs font-mono font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>${currentQuizItem.mastered ? '✓ Mastered' : 'Mark Mastered'}</span>
                        </button>
                        <button
                          id="quiz-next-btn"
                          class="min-h-[44px] px-5 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase cursor-pointer"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  ` : ''}

                `}

              </div>

              <!-- Modal Footer -->
              <div class="p-4 sm:p-5 border-t border-[#CBD5E1] bg-[#F4F7FB] flex items-center justify-between">
                <span class="text-xs font-mono text-slate-500">TELEMETRY SYNCED</span>
                <button id="fluency-modal-done-btn" class="min-h-[44px] px-5 py-2 bg-[#0052FF] hover:bg-[#2563EB] text-white rounded-sm text-xs font-mono font-bold uppercase cursor-pointer">
                  Done
                </button>
              </div>

            </div>
          </div>
        `;
      })() : ''}

      <!-- App Icon & Brand Identity Modal -->
      ${state.showIconModal ? renderIconModal() : ''}

      <!-- App Settings Modal (Gear Icon: Dark/Light Mode, Voices, Account) -->
      ${state.showAppSettingsModal ? renderAppSettingsModal(
        state.userSettings,
        state.user,
        typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [],
        lang.code
      ) : ''}

      <!-- Universal Floating Quick-Switch Bottom Action Bar Across All Devices -->
      <nav
        id="floating-quick-switch-dock"
        aria-label="Quick Navigation Action Bar"
        class="floating-quick-dock fixed left-1/2 -translate-x-1/2 bottom-2 sm:bottom-3 z-30 w-[calc(100%-1rem)] max-w-lg rounded-sm p-1 flex items-center justify-around gap-1"
      >
        <button
          id="dock-nav-home-btn"
          class="flex-1 min-h-[46px] py-1.5 px-2 rounded-sm font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer ${
            state.activeView === 'home' && !state.showFluencyModal && !state.showHistoryDrawer && !state.showAppSettingsModal
              ? 'bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25'
              : 'text-slate-600 hover:text-[#091126] hover:bg-[#0052FF]/8'
          }"
          title="Home Lounge Dashboard"
        >
          <span class="text-sm sm:text-base leading-none">🏠</span>
          <span>Home</span>
        </button>

        <button
          id="dock-nav-chat-btn"
          class="flex-1 min-h-[46px] py-1.5 px-2 rounded-sm font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer ${
            state.activeView === 'chat' && !state.showFluencyModal && !state.showHistoryDrawer && !state.showAppSettingsModal
              ? 'bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25'
              : 'text-slate-600 hover:text-[#091126] hover:bg-[#0052FF]/8'
          }"
          title="Learn & Practice Chat"
        >
          <span class="text-sm sm:text-base leading-none">💬</span>
          <span>Learn</span>
        </button>

        <button
          id="dock-nav-vocab-btn"
          class="flex-1 min-h-[46px] py-1.5 px-2 rounded-sm font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer ${
            state.showFluencyModal
              ? 'bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25'
              : 'text-slate-600 hover:text-[#091126] hover:bg-[#0052FF]/8'
          }"
          title="Vocabulary Bank & Fluency Analytics"
        >
          <span class="text-sm sm:text-base leading-none">📖</span>
          <span>Vocab</span>
        </button>

        <button
          id="dock-nav-history-btn"
          class="flex-1 min-h-[46px] py-1.5 px-2 rounded-sm font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer ${
            state.showHistoryDrawer
              ? 'bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25'
              : 'text-slate-600 hover:text-[#091126] hover:bg-[#0052FF]/8'
          }"
          title="Session Archive & History"
        >
          <span class="text-sm sm:text-base leading-none">📜</span>
          <span>History</span>
        </button>

        <button
          id="dock-nav-settings-btn"
          class="flex-1 min-h-[46px] py-1.5 px-2 rounded-sm font-mono font-bold text-[10px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer ${
            state.showAppSettingsModal
              ? 'bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25'
              : 'text-slate-600 hover:text-[#091126] hover:bg-[#0052FF]/8'
          }"
          title="Studio Settings & Theme"
        >
          <span class="text-sm sm:text-base leading-none">⚙️</span>
          <span>Settings</span>
        </button>
      </nav>

    </div>
  `;

  // Attach all DOM Event Handlers
  attachAppEventListeners();

  // Auto-scroll chat container to bottom
  const container = document.getElementById('chat-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// --- Attach Event Listeners ---
function attachAppEventListeners() {
  const session = getActiveSession();
  if (!session) return;

  // Helper to close all overlays when switching primary dock destinations
  const closeAllSheetsAndModals = () => {
    state.showHistoryDrawer = false;
    state.showFluencyModal = false;
    state.showAppSettingsModal = false;
    state.showLanguageModal = false;
    state.showPersonaModal = false;
    state.showIconModal = false;
    state.activeBreakdownMsgId = null;
    closeHoverCard();
  };

  const navigateToHome = () => {
    closeAllSheetsAndModals();
    if (!state.user) {
      // Guest Mode does not save messages when leaving chat; reset to a fresh chat
      createNewChatSession(session.language, session.persona, session.difficulty, session.tone);
    }
    state.activeView = 'home';
    renderApp();
  };

  const navigateToLearn = () => {
    const wasChat = state.activeView === 'chat';
    closeAllSheetsAndModals();
    if (!state.user && !wasChat) {
      // Always start a new chat when entering chat in Guest Mode
      createNewChatSession(session.language, session.persona, session.difficulty, session.tone);
    }
    state.activeView = 'chat';
    renderApp();
  };

  // Header & Floating Quick-Switch Dock Navigation (Home vs Learn)
  document.getElementById('nav-home-btn')?.addEventListener('click', navigateToHome);
  document.getElementById('dock-nav-home-btn')?.addEventListener('click', navigateToHome);
  document.getElementById('chat-back-home-btn')?.addEventListener('click', navigateToHome);

  document.getElementById('nav-chat-btn')?.addEventListener('click', navigateToLearn);
  document.getElementById('dock-nav-chat-btn')?.addEventListener('click', navigateToLearn);

  // Floating Quick-Switch Dock: Vocab, History, Settings
  document.getElementById('dock-nav-vocab-btn')?.addEventListener('click', () => {
    const nextState = !state.showFluencyModal;
    closeAllSheetsAndModals();
    state.showFluencyModal = nextState;
    if (nextState) state.activeFluencyTab = 'vocab';
    renderApp();
  });

  document.getElementById('dock-nav-history-btn')?.addEventListener('click', () => {
    const nextState = !state.showHistoryDrawer;
    closeAllSheetsAndModals();
    state.showHistoryDrawer = nextState;
    renderApp();
  });

  document.getElementById('dock-nav-settings-btn')?.addEventListener('click', () => {
    const nextState = !state.showAppSettingsModal;
    closeAllSheetsAndModals();
    state.showAppSettingsModal = nextState;
    renderApp();
  });

  // Collapsible Compact Language & Persona Bar in Chat View
  document.getElementById('toggle-chat-context-bar-btn')?.addEventListener('click', () => {
    state.isChatContextExpanded = !state.isChatContextExpanded;
    renderApp();
  });

  document.getElementById('context-bar-lang-btn')?.addEventListener('click', () => {
    state.showLanguageModal = true;
    renderApp();
  });

  document.getElementById('expanded-switch-lang-btn')?.addEventListener('click', () => {
    state.showLanguageModal = true;
    renderApp();
  });

  document.getElementById('context-bar-persona-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('expanded-switch-persona-btn')?.addEventListener('click', openPersonaModal);

  document.getElementById('expanded-open-vocab-btn')?.addEventListener('click', () => {
    state.showFluencyModal = true;
    state.activeFluencyTab = 'vocab';
    renderApp();
  });

  // Header & Home Settings Gear Modal Triggers
  const openAppSettings = () => {
    closeAllSheetsAndModals();
    state.showAppSettingsModal = true;
    renderApp();
  };

  document.getElementById('header-app-settings-btn')?.addEventListener('click', openAppSettings);
  document.getElementById('home-settings-gear-btn')?.addEventListener('click', openAppSettings);
  document.getElementById('header-auth-btn')?.addEventListener('click', openAppSettings);

  // Google Sign-In & Account Switch Handlers
  const triggerGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.warn('Google sign-in cancelled or failed:', err);
    }
  };

  document.getElementById('header-google-signin-btn')?.addEventListener('click', triggerGoogleLogin);
  document.getElementById('home-google-signin-btn')?.addEventListener('click', triggerGoogleLogin);
  document.getElementById('home-switch-account-btn')?.addEventListener('click', triggerGoogleLogin);
  document.getElementById('settings-google-signin-btn')?.addEventListener('click', triggerGoogleLogin);
  document.getElementById('settings-switch-account-btn')?.addEventListener('click', triggerGoogleLogin);

  document.getElementById('settings-signout-btn')?.addEventListener('click', async () => {
    try {
      await signOutUser();
      state.showAppSettingsModal = false;
      renderApp();
    } catch (err) {
      console.warn('Sign out failed:', err);
    }
  });

  // Home Screen Action Handlers
  document.getElementById('home-go-learn-btn')?.addEventListener('click', () => {
    if (!state.user) {
      // Always start a new chat in Guest Mode
      createNewChatSession(session.language, session.persona, session.difficulty, session.tone);
    }
    state.activeView = 'chat';
    renderApp();
  });

  document.getElementById('home-new-session-btn')?.addEventListener('click', () => {
    state.activeView = 'chat';
    createNewChatSession();
    renderApp();
  });

  document.getElementById('home-open-vocab-modal-btn')?.addEventListener('click', () => {
    state.showFluencyModal = true;
    state.activeFluencyTab = 'vocab';
    renderApp();
  });

  document.getElementById('home-view-all-history-btn')?.addEventListener('click', () => {
    if (!state.user) {
      // In Guest Mode, start a fresh new chat instead of opening saved history
      state.activeView = 'chat';
      createNewChatSession(session.language, session.persona, session.difficulty, session.tone);
      renderApp();
      return;
    }
    state.showHistoryDrawer = true;
    renderApp();
  });

  document.querySelectorAll('[data-home-lang-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-home-lang-cat') as LanguageCategory;
      if (cat) {
        state.homeLanguageCategory = cat;
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-home-select-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-home-select-lang');
      const targetLang = LANGUAGES.find(l => l.code === code);
      if (targetLang) {
        createNewChatSession(targetLang, session.persona, session.difficulty, session.tone);
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-home-launch-persona]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-home-launch-persona');
      if (pId) {
        const targetPersona = findPersonaById(pId);
        state.activeView = 'chat';
        createNewChatSession(
          session.language,
          targetPersona,
          targetPersona.defaultDifficulty || 'intermediate',
          targetPersona.defaultTone || 'formal'
        );
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-home-resume-session]').forEach(card => {
    card.addEventListener('click', () => {
      const sId = card.getAttribute('data-home-resume-session');
      if (sId) {
        switchActiveSession(sId);
      }
    });
  });

  // App Settings Modal Controls (Dark/Light Mode, Voices, Rate, Pitch, Defaults)
  const closeAppSettings = () => {
    state.showAppSettingsModal = false;
    renderApp();
  };

  document.getElementById('close-app-settings-btn')?.addEventListener('click', closeAppSettings);
  document.getElementById('done-app-settings-btn')?.addEventListener('click', closeAppSettings);
  document.getElementById('app-settings-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeAppSettings();
    }
  });

  const persistUserSettings = () => {
    saveLocalSettings(state.userSettings);
    if (state.user) {
      syncUserProfileToCloud(state.user, fluencyMetrics, state.userSettings).catch(err => console.warn(err));
    }
  };

  document.querySelectorAll('[data-settings-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-settings-theme') as 'light' | 'dark' | 'system';
      if (theme) {
        state.userSettings.theme = theme;
        applyThemeToDocument(theme);
        persistUserSettings();
        renderApp();
      }
    });
  });

  document.getElementById('settings-test-voice-btn')?.addEventListener('click', () => {
    const sampleGreeting = getLocalizedGreeting(session.persona.id, session.language);
    speak(sampleGreeting, session.language.code);
  });

  const voiceSelect = document.getElementById('settings-voice-select') as HTMLSelectElement | null;
  if (voiceSelect) {
    voiceSelect.addEventListener('change', (e) => {
      state.userSettings.preferredVoiceURI = (e.target as HTMLSelectElement).value;
      persistUserSettings();
    });
  }

  const rateSlider = document.getElementById('settings-rate-slider') as HTMLInputElement | null;
  if (rateSlider) {
    rateSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!Number.isNaN(val)) {
        state.userSettings.speechRate = val;
        const label = document.getElementById('settings-rate-label');
        if (label) label.textContent = `${val.toFixed(2)}x`;
        persistUserSettings();
      }
    });
  }

  const pitchSlider = document.getElementById('settings-pitch-slider') as HTMLInputElement | null;
  if (pitchSlider) {
    pitchSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!Number.isNaN(val)) {
        state.userSettings.speechPitch = val;
        const label = document.getElementById('settings-pitch-label');
        if (label) label.textContent = val.toFixed(2);
        persistUserSettings();
      }
    });
  }

  document.getElementById('settings-autospeak-toggle')?.addEventListener('click', () => {
    state.userSettings.autoSpeak = !state.userSettings.autoSpeak;
    state.autoSpeak = state.userSettings.autoSpeak;
    persistUserSettings();
    renderApp();
  });

  const defaultLangSelect = document.getElementById('settings-default-lang') as HTMLSelectElement | null;
  if (defaultLangSelect) {
    defaultLangSelect.addEventListener('change', (e) => {
      const code = (e.target as HTMLSelectElement).value;
      state.userSettings.defaultLanguageCode = code;
      persistUserSettings();
      const targetLang = LANGUAGES.find(l => l.code === code);
      if (targetLang) {
        createNewChatSession(targetLang, session.persona, session.difficulty, session.tone);
        renderApp();
      }
    });
  }

  const defaultPersonaSelect = document.getElementById('settings-default-persona') as HTMLSelectElement | null;
  if (defaultPersonaSelect) {
    defaultPersonaSelect.addEventListener('change', (e) => {
      const pId = (e.target as HTMLSelectElement).value;
      state.userSettings.defaultPersonaId = pId;
      persistUserSettings();
      const targetPersona = findPersonaById(pId);
      if (targetPersona) {
        createNewChatSession(session.language, targetPersona, targetPersona.defaultDifficulty, targetPersona.defaultTone);
        renderApp();
      }
    });
  }

  // Brand Icon & PWA Modal Handlers
  document.getElementById('brand-icon-btn')?.addEventListener('click', () => {
    state.showIconModal = true;
    renderApp();
  });

  document.getElementById('close-icon-modal-btn')?.addEventListener('click', () => {
    state.showIconModal = false;
    renderApp();
  });

  document.getElementById('icon-modal-close-action-btn')?.addEventListener('click', () => {
    state.showIconModal = false;
    renderApp();
  });

  document.getElementById('icon-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.showIconModal = false;
      renderApp();
    }
  });

  const triggerPWAInstall = async () => {
    if (!state.deferredInstallPrompt) return;
    try {
      await state.deferredInstallPrompt.prompt();
      const choice = await state.deferredInstallPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        state.isAppInstalled = true;
      }
      state.deferredInstallPrompt = null;
      renderApp();
    } catch (err) {
      console.warn('PWA prompt failed:', err);
    }
  };

  document.getElementById('header-pwa-install-btn')?.addEventListener('click', triggerPWAInstall);
  document.getElementById('modal-pwa-install-btn')?.addEventListener('click', triggerPWAInstall);

  document.getElementById('toggle-history-btn')?.addEventListener('click', () => {
    state.showHistoryDrawer = !state.showHistoryDrawer;
    renderApp();
  });

  document.getElementById('close-history-drawer-btn')?.addEventListener('click', () => {
    state.showHistoryDrawer = false;
    renderApp();
  });

  document.getElementById('history-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.showHistoryDrawer = false;
      renderApp();
    }
  });

  document.getElementById('switch-persona-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('switch-persona-text-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('open-settings-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('header-tone-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('header-diff-btn')?.addEventListener('click', openPersonaModal);
  document.getElementById('footer-settings-link')?.addEventListener('click', openPersonaModal);

  document.getElementById('switch-lang-btn')?.addEventListener('click', () => {
    state.showLanguageModal = true;
    renderApp();
  });

  document.getElementById('close-lang-modal-btn')?.addEventListener('click', () => {
    state.showLanguageModal = false;
    renderApp();
  });

  document.getElementById('lang-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.showLanguageModal = false;
      renderApp();
    }
  });

  document.getElementById('toggle-speak-btn')?.addEventListener('click', () => {
    state.autoSpeak = !state.autoSpeak;
    state.userSettings.autoSpeak = state.autoSpeak;
    persistUserSettings();
    renderApp();
  });

  document.getElementById('new-chat-btn')?.addEventListener('click', () => {
    closeAllSheetsAndModals();
    state.activeView = 'chat';
    createNewChatSession();
    renderApp();
  });

  document.getElementById('drawer-new-chat-btn')?.addEventListener('click', () => {
    state.showHistoryDrawer = false;
    state.activeView = 'chat';
    createNewChatSession();
    renderApp();
  });

  // Fluency Dashboard Triggers
  const openFluency = (tab: 'overview' | 'vocab' | 'quiz') => {
    closeAllSheetsAndModals();
    state.showFluencyModal = true;
    state.activeFluencyTab = tab;
    renderApp();
  };

  document.getElementById('header-streak-btn')?.addEventListener('click', () => openFluency('overview'));
  document.getElementById('header-vocab-btn')?.addEventListener('click', () => openFluency('vocab'));
  document.getElementById('header-fluency-btn')?.addEventListener('click', () => openFluency('overview'));

  document.getElementById('close-fluency-modal-btn')?.addEventListener('click', () => {
    state.showFluencyModal = false;
    renderApp();
  });

  document.getElementById('fluency-modal-done-btn')?.addEventListener('click', () => {
    state.showFluencyModal = false;
    renderApp();
  });

  document.getElementById('fluency-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.showFluencyModal = false;
      renderApp();
    }
  });

  document.querySelectorAll('[data-fluency-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-fluency-tab') as 'overview' | 'vocab' | 'quiz';
      if (tab) {
        state.activeFluencyTab = tab;
        renderApp();
      }
    });
  });

  // Vocab Filter Buttons
  document.querySelectorAll('.vocab-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-vocab-filter') as 'all' | 'learning' | 'mastered';
      if (filter) {
        state.vocabFilterStatus = filter;
        renderApp();
      }
    });
  });

  // Vocab Search Input
  const vocabSearch = document.getElementById('vocab-search-input') as HTMLInputElement;
  if (vocabSearch) {
    vocabSearch.addEventListener('input', (e) => {
      state.vocabSearchQuery = (e.target as HTMLInputElement).value;
      renderApp();
      const nextInput = document.getElementById('vocab-search-input') as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
      }
    });
  }

  // Vocab Item Actions
  document.querySelectorAll('.vocab-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = decodeURIComponent(btn.getAttribute('data-vocab-speak') || '');
      const code = btn.getAttribute('data-vocab-lang') || session.language.code;
      speak(word, code);
    });
  });

  document.querySelectorAll('.vocab-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-vocab-toggle-mastered');
      if (id) {
        toggleVocabularyMastered(fluencyMetrics, id);
        const updatedItem = fluencyMetrics.savedVocabulary.find(v => v.id === id);
        if (state.user && updatedItem) {
          saveCloudVocabularyItem(state.user.uid, updatedItem).catch(err => console.warn(err));
        }
        renderApp();
      }
    });
  });

  document.querySelectorAll('.vocab-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-vocab-delete');
      if (id) {
        removeVocabularyWord(fluencyMetrics, id);
        if (state.user) {
          deleteCloudVocabularyItem(state.user.uid, id).catch(err => console.warn(err));
        }
        renderApp();
      }
    });
  });

  // Flashcard Actions
  document.getElementById('flashcard-card')?.addEventListener('click', () => {
    state.quizShowAnswer = !state.quizShowAnswer;
    renderApp();
  });

  document.getElementById('quiz-speak-btn')?.addEventListener('click', () => {
    const item = fluencyMetrics.savedVocabulary[state.quizCardIndex % Math.max(1, fluencyMetrics.savedVocabulary.length)];
    if (item) {
      speak(item.word, item.languageCode);
    }
  });

  document.getElementById('quiz-toggle-mastered-btn')?.addEventListener('click', () => {
    const item = fluencyMetrics.savedVocabulary[state.quizCardIndex % Math.max(1, fluencyMetrics.savedVocabulary.length)];
    if (item) {
      toggleVocabularyMastered(fluencyMetrics, item.id);
      if (state.user) {
        saveCloudVocabularyItem(state.user.uid, item).catch(err => console.warn(err));
      }
      renderApp();
    }
  });

  document.getElementById('quiz-next-btn')?.addEventListener('click', () => {
    state.quizCardIndex += 1;
    state.quizShowAnswer = false;
    renderApp();
  });

  // Sentence Breakdown Drawer Handlers
  document.querySelectorAll('.breakdown-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgId = btn.getAttribute('data-breakdown-msg-id');
      if (msgId) {
        openSentenceBreakdown(msgId);
      }
    });
  });

  document.getElementById('close-breakdown-drawer-btn')?.addEventListener('click', () => {
    state.activeBreakdownMsgId = null;
    renderApp();
  });

  document.getElementById('breakdown-backdrop')?.addEventListener('click', () => {
    state.activeBreakdownMsgId = null;
    renderApp();
  });

  document.getElementById('breakdown-full-speak-btn')?.addEventListener('click', () => {
    const targetMsg = session.messages.find(m => m.id === state.activeBreakdownMsgId);
    if (targetMsg) {
      speak(targetMsg.content, session.language.code, false);
    }
  });

  document.getElementById('breakdown-slow-speak-btn')?.addEventListener('click', () => {
    const targetMsg = session.messages.find(m => m.id === state.activeBreakdownMsgId);
    if (targetMsg) {
      speak(targetMsg.content, session.language.code, true);
    }
  });

  document.querySelectorAll('.token-speak-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const surface = decodeURIComponent(btn.getAttribute('data-token-speak') || '');
      speak(surface, session.language.code);
    });
  });

  document.querySelectorAll('.token-save-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tokenJson = decodeURIComponent(btn.getAttribute('data-token-save') || '');
      try {
        const token: WordToken = JSON.parse(tokenJson);
        const targetMsg = session.messages.find(m => m.id === state.activeBreakdownMsgId);
        const saved = saveVocabularyWord(fluencyMetrics, {
          word: token.surface,
          lemma: token.lemma,
          transliteration: token.transliteration,
          translation: token.meaning,
          languageCode: session.language.code,
          languageName: session.language.name,
          partOfSpeech: token.partOfSpeech,
          contextSentence: targetMsg?.content
        });
        if (state.user && saved.added) {
          saveCloudVocabularyItem(state.user.uid, saved.item).catch(err => console.warn(err));
        }
        renderApp();
      } catch (e) {
        console.warn('Failed to save token:', e);
      }
    });
  });

  // Word-by-Word Hover Translation Cards
  document.querySelectorAll('.lexical-word-token').forEach(tokenElem => {
    tokenElem.addEventListener('mouseenter', (e) => {
      const word = tokenElem.getAttribute('data-word');
      const msgId = tokenElem.getAttribute('data-msg-id') || '';
      if (word) {
        handleWordHover(word, msgId, e as MouseEvent);
      }
    });

    tokenElem.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = tokenElem.getAttribute('data-word');
      const msgId = tokenElem.getAttribute('data-msg-id') || '';
      if (word) {
        handleWordHover(word, msgId, e as MouseEvent);
      }
    });
  });

  // Click outside hover card closes it
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#word-hover-popover') && !target.closest('.lexical-word-token')) {
      closeHoverCard();
    }
  });

  // Persona Modal Handlers
  document.getElementById('close-persona-modal-btn')?.addEventListener('click', () => {
    state.showPersonaModal = false;
    renderApp();
  });

  document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
    state.showPersonaModal = false;
    renderApp();
  });

  document.getElementById('persona-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      state.showPersonaModal = false;
      renderApp();
    }
  });

  document.querySelectorAll('[data-modal-select-persona]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = btn.getAttribute('data-modal-select-persona');
      if (pId) {
        state.modalSelectedPersonaId = pId;
        const targetP = findPersonaById(pId);
        state.modalSelectedTone = targetP.defaultTone || 'formal';
        state.modalSelectedDifficulty = targetP.defaultDifficulty || 'intermediate';
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-modal-select-tone]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-modal-select-tone') as ToneStyle;
      if (t) {
        state.modalSelectedTone = t;
        renderApp();
      }
    });
  });

  document.querySelectorAll('[data-modal-select-diff]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.getAttribute('data-modal-select-diff') as DifficultyLevel;
      if (d) {
        state.modalSelectedDifficulty = d;
        renderApp();
      }
    });
  });

  document.getElementById('reset-persona-defaults-btn')?.addEventListener('click', () => {
    const selPId = state.modalSelectedPersonaId || session.persona.id;
    const targetP = findPersonaById(selPId);
    state.modalSelectedTone = targetP.defaultTone || 'formal';
    state.modalSelectedDifficulty = targetP.defaultDifficulty || 'intermediate';
    renderApp();
  });

  document.getElementById('preview-speak-btn')?.addEventListener('click', (e) => {
    const text = decodeURIComponent((e.currentTarget as HTMLElement).getAttribute('data-preview-speak') || '');
    speak(text, session.language.code);
  });

  document.getElementById('modal-apply-settings-btn')?.addEventListener('click', () => {
    const selPId = state.modalSelectedPersonaId || session.persona.id;
    const targetPersona = findPersonaById(selPId);
    const targetTone = state.modalSelectedTone || targetPersona.defaultTone || 'formal';
    const targetDifficulty = state.modalSelectedDifficulty || targetPersona.defaultDifficulty || 'intermediate';

    state.showPersonaModal = false;

    updateActiveSession(s => {
      s.persona = targetPersona;
      s.tone = targetTone;
      s.difficulty = targetDifficulty;

      if (s.messages.filter(m => m.role === 'user').length === 0) {
        s.title = `${s.language.name} with ${targetPersona.name}`;
        const initialGreeting = getLocalizedGreeting(targetPersona.id, s.language);
        s.messages = [{
          id: 'init-' + Date.now(),
          role: 'assistant',
          content: initialGreeting,
          timestamp: Date.now()
        }];
        if (state.autoSpeak && s.language.code) {
          speak(initialGreeting, s.language.code);
        }
      }
    });

    renderApp();
  });

  document.getElementById('modal-start-new-session-btn')?.addEventListener('click', () => {
    const selPId = state.modalSelectedPersonaId || session.persona.id;
    const targetPersona = findPersonaById(selPId);
    const targetTone = state.modalSelectedTone || targetPersona.defaultTone || 'formal';
    const targetDifficulty = state.modalSelectedDifficulty || targetPersona.defaultDifficulty || 'intermediate';

    state.showPersonaModal = false;
    createNewChatSession(session.language, targetPersona, targetDifficulty, targetTone);
    renderApp();
  });

  // Language Selection
  document.querySelectorAll('[data-select-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-select-lang');
      const selected = LANGUAGES.find(l => l.code === code);
      if (selected) {
        state.showLanguageModal = false;
        createNewChatSession(selected, session.persona, session.difficulty, session.tone);
        renderApp();
      }
    });
  });

  document.querySelectorAll('.modal-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-modal-category') as LanguageCategory;
      if (cat) {
        state.activeLanguageCategory = cat;
        renderApp();
      }
    });
  });

  const modalLangSearch = document.getElementById('modal-lang-search') as HTMLInputElement;
  if (modalLangSearch) {
    modalLangSearch.addEventListener('input', (e) => {
      state.languageSearchQuery = (e.target as HTMLInputElement).value;
      renderApp();
      const nextInput = document.getElementById('modal-lang-search') as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
      }
    });
  }

  // History Drawer Search & Session Items
  const historySearch = document.getElementById('history-search-input') as HTMLInputElement;
  if (historySearch) {
    historySearch.addEventListener('input', (e) => {
      state.historySearchQuery = (e.target as HTMLInputElement).value;
      renderApp();
      const nextInput = document.getElementById('history-search-input') as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.selectionStart = nextInput.selectionEnd = nextInput.value.length;
      }
    });
  }

  document.getElementById('clear-history-search')?.addEventListener('click', () => {
    state.historySearchQuery = '';
    renderApp();
  });

  document.querySelectorAll('.history-session-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.delete-session-btn')) return;
      const sId = item.getAttribute('data-session-id');
      if (sId) {
        switchActiveSession(sId);
      }
    });
  });

  document.querySelectorAll('.delete-session-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sId = btn.getAttribute('data-delete-session-id');
      if (sId) {
        deleteSession(sId);
      }
    });
  });

  document.getElementById('clear-all-history-btn')?.addEventListener('click', clearAllHistory);

  // Speech Recognition & Microphone
  document.getElementById('stop-listening-btn')?.addEventListener('click', () => {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
    }
  });

  document.getElementById('mic-action-btn')?.addEventListener('click', () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(`Voice recognition is not supported in this browser. You can type directly in ${session.language.name}!`);
      return;
    }

    if (isListening) {
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
    } else {
      state.userInput = '';
      setupSpeechRecognition(session.language.code);
      if (recognition) {
        try { recognition.start(); } catch (err) { console.warn(err); }
      }
    }
  });

  // Toggle feedback details breakdown card for a user message
  document.querySelectorAll('.toggle-feedback-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msgId = btn.getAttribute('data-toggle-feedback');
      const targetMsg = session.messages.find(m => m.id === msgId);
      if (targetMsg) {
        targetMsg.showFeedbackDetails = !targetMsg.showFeedbackDetails;
        saveSessions(state.sessions);
        renderApp();
      }
    });
  });

  // Audio Playback Listen Buttons
  document.querySelectorAll('.play-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.getAttribute('data-speak-text') || '');
      speak(text, session.language.code);
    });
  });

  // Copy Buttons
  document.querySelectorAll('.copy-msg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.getAttribute('data-copy-text') || '');
      navigator.clipboard?.writeText(text);
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> Copied';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 1500);
    });
  });

  // Dynamic Suggestion Chips (Sends and cycles)
  document.querySelectorAll('.quick-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const phrase = decodeURIComponent(btn.getAttribute('data-suggestion') || '');
      if (phrase) {
        state.suggestionSeed = (state.suggestionSeed + 1) % 1000;
        handleSendMessage(phrase);
      }
    });
  });

  // Edit / Insert Suggestion Into Draft Input
  document.querySelectorAll('.quick-insert-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const phrase = decodeURIComponent(btn.getAttribute('data-insert-suggestion') || '');
      if (phrase) {
        state.userInput = phrase;
        state.suggestionSeed = (state.suggestionSeed + 1) % 1000;
        renderApp();
        const ta = document.getElementById('user-input') as HTMLTextAreaElement | null;
        if (ta) {
          ta.focus();
          ta.selectionStart = ta.selectionEnd = ta.value.length;
        }
      }
    });
  });

  // Shuffle Suggestions Actions
  document.getElementById('shuffle-suggestions-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    shuffleSuggestions();
  });

  document.getElementById('more-suggestions-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    shuffleSuggestions();
  });

  // Check Draft Grammar Action
  document.getElementById('check-draft-grammar-btn')?.addEventListener('click', () => {
    handleCheckDraftGrammar();
  });

  document.getElementById('dismiss-draft-feedback')?.addEventListener('click', () => {
    state.draftGrammarFeedback = null;
    renderApp();
  });

  document.getElementById('apply-draft-correction-btn')?.addEventListener('click', () => {
    if (state.draftGrammarFeedback?.correction) {
      state.userInput = state.draftGrammarFeedback.correction;
      state.draftGrammarFeedback = null;
      renderApp();
      const ta = document.getElementById('user-input') as HTMLTextAreaElement;
      if (ta) {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;
      }
    }
  });

  document.getElementById('retry-send-btn')?.addEventListener('click', () => {
    state.errorMessage = null;
    const session = getActiveSession();
    if (session && session.messages.length > 0) {
      const lastUserMsg = [...session.messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        handleSendMessage(lastUserMsg.content);
        return;
      }
    }
    renderApp();
  });

  document.getElementById('dismiss-err-btn')?.addEventListener('click', () => {
    state.errorMessage = null;
    renderApp();
  });

  // Helper to attach touch swipe-down and tap dismissal to mobile/tablet bottom-sheet drawers
  const closeSheetByTarget = (targetKey: string) => {
    if (targetKey === 'history-drawer') state.showHistoryDrawer = false;
    else if (targetKey === 'breakdown-drawer') state.activeBreakdownMsgId = null;
    else if (targetKey === 'lang-modal') state.showLanguageModal = false;
    else if (targetKey === 'persona-modal') state.showPersonaModal = false;
    else if (targetKey === 'fluency-modal') state.showFluencyModal = false;
    else if (targetKey === 'app-settings') state.showAppSettingsModal = false;
    else if (targetKey === 'icon-modal') state.showIconModal = false;
    renderApp();
  };

  document.querySelectorAll<HTMLElement>('[data-sheet-close]').forEach((handleEl) => {
    const targetKey = handleEl.getAttribute('data-sheet-close') || '';
    const sheetPanel = handleEl.closest('.responsive-sheet-panel, .responsive-drawer-panel') as HTMLElement | null;

    handleEl.addEventListener('click', () => {
      if (targetKey) closeSheetByTarget(targetKey);
    });

    let touchStartY = 0;
    let touchDeltaY = 0;

    handleEl.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        touchDeltaY = 0;
        if (sheetPanel) {
          sheetPanel.style.transition = 'none';
        }
      }
    }, { passive: true });

    handleEl.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 1 && touchStartY > 0) {
        touchDeltaY = Math.max(0, e.touches[0].clientY - touchStartY);
        if (sheetPanel && touchDeltaY > 0) {
          sheetPanel.style.transform = `translateY(${touchDeltaY}px)`;
        }
      }
    }, { passive: true });

    handleEl.addEventListener('touchend', () => {
      if (sheetPanel) {
        sheetPanel.style.transition = 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)';
        sheetPanel.style.transform = '';
      }
      if (touchDeltaY > 56 && targetKey) {
        closeSheetByTarget(targetKey);
      }
      touchStartY = 0;
      touchDeltaY = 0;
    });
  });

  // User Input Textarea Handlers
  const textarea = document.getElementById('user-input') as HTMLTextAreaElement;
  if (textarea) {
    // Only auto-focus on desktop when no modal/sheet is open so mobile virtual keyboard doesn't pop up unexpectedly
    const anyOverlayOpen = state.showHistoryDrawer || state.showLanguageModal || state.showPersonaModal || state.showFluencyModal || state.showAppSettingsModal || state.showIconModal || Boolean(state.activeBreakdownMsgId);
    if (window.innerWidth >= 768 && !anyOverlayOpen) {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }

    textarea.addEventListener('input', (e) => {
      state.userInput = (e.target as HTMLTextAreaElement).value;
      const sendBtn = document.getElementById('send-message-btn');
      const checkBtn = document.getElementById('check-draft-grammar-btn');

      if (sendBtn) {
        if (state.userInput.trim() && !state.isTyping) {
          sendBtn.className = 'min-w-[44px] min-h-[44px] p-2.5 sm:p-3.5 rounded-md transition-all flex-shrink-0 flex items-center justify-center bg-[#0052FF] text-white shadow-md shadow-[#0052FF]/25 hover:bg-[#0040CC] cursor-pointer';
        } else {
          sendBtn.className = 'min-w-[44px] min-h-[44px] p-2.5 sm:p-3.5 rounded-md transition-all flex-shrink-0 flex items-center justify-center bg-[#EBF1F8] text-[#8496B0] cursor-not-allowed';
        }
      }

      if (checkBtn) {
        if (state.userInput.trim()) {
          checkBtn.className = 'min-w-[44px] min-h-[44px] p-2.5 sm:p-3.5 rounded-md transition-all flex-shrink-0 flex items-center justify-center cursor-pointer bg-[#FFF5EB] hover:bg-[#FFEDD5] text-[#D97706] border border-[#FDE68A] shadow-xs';
        } else {
          checkBtn.className = 'min-w-[44px] min-h-[44px] p-2.5 sm:p-3.5 rounded-md transition-all flex-shrink-0 flex items-center justify-center bg-[#EBF1F8] text-[#8496B0] cursor-not-allowed border border-[#CBD5E1]';
        }
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }

  document.getElementById('send-message-btn')?.addEventListener('click', () => handleSendMessage());
}

// Initial Boot
if (getActiveSession()) {
  setupSpeechRecognition(getActiveSession()!.language.code);
}
renderApp();
