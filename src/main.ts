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
}

// Helper: load stored sessions or bootstrap initial sample session
function loadSavedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((s: any) => {
          const resolvedPersona = findPersonaById(s.persona?.id || 'formal_teacher');
          return {
            ...s,
            persona: resolvedPersona,
            difficulty: (s.difficulty as DifficultyLevel) || resolvedPersona.defaultDifficulty || 'intermediate',
            tone: (s.tone as ToneStyle) || resolvedPersona.defaultTone || 'formal'
          };
        });
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved sessions from localStorage:', e);
  }

  // Create initial welcoming session with Formal Teacher in Hindi
  const defaultLang = LANGUAGES.find(l => l.code === 'hi') || LANGUAGES[0];
  const defaultPersona = PERSONAS.find(p => p.id === 'formal_teacher') || PERSONAS[0];
  const greeting = getLocalizedGreeting(defaultPersona.id, defaultLang);

  const initialSession: ChatSession = {
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
        timestamp: Date.now() - 60000
      }
    ],
    createdAt: Date.now() - 60000,
    updatedAt: Date.now() - 60000
  };

  saveSessions([initialSession]);
  return [initialSession];
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('Failed to save sessions to localStorage:', e);
  }
}

function getStoredActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch (_) {
    return null;
  }
}

function setStoredActiveSessionId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch (_) {}
}

const initialSessions = loadSavedSessions();
const storedActiveId = getStoredActiveSessionId();
const defaultActiveId = initialSessions.some(s => s.id === storedActiveId)
  ? storedActiveId
  : initialSessions[0]?.id || null;

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
  userSettings: initialUserSettings
};

// Listen for Firebase Google Authentication state changes
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    state.isSyncingCloud = true;
    renderApp();
    try {
      const cloudState = await loadOrInitUserCloudState(
        user,
        fluencyMetrics,
        state.userSettings,
        state.sessions
      );
      fluencyMetrics = cloudState.metrics;
      saveFluencyMetrics(fluencyMetrics);

      state.userSettings = cloudState.settings;
      state.autoSpeak = cloudState.settings.autoSpeak;
      saveLocalSettings(state.userSettings);
      applyThemeToDocument(state.userSettings.theme);

      if (cloudState.sessions.length > 0) {
        state.sessions = cloudState.sessions;
        state.activeSessionId = cloudState.sessions[0].id;
        setStoredActiveSessionId(state.activeSessionId);
        saveSessions(state.sessions);
      }
    } catch (err) {
      console.error('Error syncing cloud account data:', err);
    } finally {
      state.isSyncingCloud = false;
      renderApp();
    }
  } else {
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
    case 'beginner': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'advanced': return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'intermediate':
    default:
      return 'bg-amber-50 text-amber-700 border border-amber-200';
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
    case 'formal': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    case 'casual': return 'bg-sky-50 text-sky-700 border border-sky-200';
    case 'supportive': return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'professional': return 'bg-slate-100 text-slate-700 border border-slate-300';
    case 'witty': return 'bg-amber-50 text-amber-700 border border-amber-200';
    default: return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
  }
}

// Tokenizes text for interactive hover-translation cards
function renderTokenizedMessageText(text: string, langCode: string, msgId: string, isUser: boolean): string {
  const tokens = tokenizeSentence(text, langCode);
  return tokens.map(t => {
    if (!t.isWord) {
      return escapeHtml(t.text);
    }
    return `<span class="lexical-word-token ${isUser ? 'hover:bg-white/30 text-white' : 'hover:bg-indigo-100 hover:text-indigo-900'} cursor-pointer" data-word="${escapeHtml(t.cleanWord)}" data-msg-id="${msgId}">${escapeHtml(t.text)}</span>`;
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
          <span class="grammar-tooltip pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tip:flex group-focus/tip:flex flex-col z-50 w-56 sm:w-64 p-3 bg-gray-950/95 backdrop-blur-md text-white text-xs rounded-2xl shadow-2xl border border-gray-800 text-left">
            <span class="flex items-center gap-1.5 text-amber-300 font-bold text-[11px] mb-1">
              <span>✏️</span> Suggested Correction
            </span>
            <span class="font-semibold text-emerald-300 bg-gray-900 px-2 py-1 rounded-lg border border-gray-800 text-xs">
              ${escapedCorrection}
            </span>
            <span class="text-gray-300 mt-1.5 leading-relaxed text-[11px]">
              ${escapedReason}
            </span>
            <span class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-950"></span>
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

  state.sessions.unshift(newSession);
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

  // Track fluency activity (streak & message count)
  recordMessageActivity(fluencyMetrics, currentPersona.id, textToSend.split(/\s+/).length);
  if (state.user) {
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
        recordGrammarAccuracy(fluencyMetrics, feedback.isCorrect);
        updateActiveSession(() => {});
        if (state.user) {
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

// Separate dedicated renderer for the hover card element to prevent full app re-renders on hover
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

  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'word-hover-popover';
    document.body.appendChild(popover);
  }

  popover.className = 'fixed z-50 animate-in fade-in zoom-in-95 duration-150';
  popover.style.left = `${x}px`;
  popover.style.top = `${y}px`;

  popover.innerHTML = `
    <div class="w-64 p-3.5 bg-gray-950/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-gray-800 text-left text-xs space-y-2 relative">
      <div class="flex items-start justify-between gap-2 border-b border-gray-800/80 pb-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-extrabold text-base text-white tracking-wide truncate">${escapeHtml(word)}</span>
            <button id="popover-speak-btn" class="p-1 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer" title="Listen to pronunciation">
              🔊
            </button>
          </div>
          ${token?.transliteration ? `
            <p class="text-[11px] font-mono text-indigo-300 tracking-wide">${escapeHtml(token.transliteration)}</p>
          ` : ''}
        </div>
        <button id="close-popover-btn" class="text-gray-400 hover:text-white p-0.5 text-xs font-bold cursor-pointer">✕</button>
      </div>

      ${isLoading ? `
        <div class="py-2 flex items-center justify-center gap-2 text-indigo-300 text-[11px] animate-pulse">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
          <span>Looking up definition...</span>
        </div>
      ` : `
        <div class="space-y-1.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2 py-0.5 bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 rounded-md text-[10px] font-semibold uppercase">
              ${escapeHtml(token?.partOfSpeech || 'Word')}
            </span>
            ${token?.grammaticalRole ? `
              <span class="text-gray-400 text-[10px] truncate">${escapeHtml(token.grammaticalRole)}</span>
            ` : ''}
          </div>

          <p class="text-gray-200 text-xs leading-relaxed font-medium">
            ${escapeHtml(token?.meaning || `Translation of '${word}'`)}
          </p>
        </div>
      `}

      <div class="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2 text-[11px]">
        <button
          id="popover-bookmark-btn"
          class="flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all font-semibold cursor-pointer ${
            isSaved
              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
          }"
        >
          <span>${isSaved ? '✓ Saved' : '⭐️ Save Word'}</span>
        </button>

        ${msgId ? `
          <button
            id="popover-deep-breakdown-btn"
            class="text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Breakdown 🔍</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

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

// --- App Icon Showcase & PWA Modal ---
function renderIconModal(): string {
  const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());

  return `
    <div id="icon-modal-backdrop" class="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div class="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        <!-- Modal Header -->
        <div class="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-950 p-1 border border-indigo-800 shadow-2xs flex items-center justify-center">
              <img src="/icon.svg" alt="Linguist AI Icon" class="w-8 h-8 rounded-lg object-contain" referrerpolicy="no-referrer" />
            </div>
            <div>
              <h3 class="font-extrabold text-base sm:text-lg text-gray-900 leading-tight">App Icon &amp; Brand Identity</h3>
              <p class="text-xs text-gray-500">Modern 3D glossy lettermark with acoustic soundwaves</p>
            </div>
          </div>
          <button id="close-icon-modal-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer">
            ✕
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          <!-- Icon Hero Showcase -->
          <div class="flex flex-col items-center justify-center py-6 px-4 bg-linear-to-b from-indigo-50/70 via-purple-50/40 to-white rounded-3xl border border-indigo-100 text-center">
            <div class="relative group">
              <div class="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl p-1 bg-gradient-to-br from-indigo-900 via-indigo-950 to-purple-950 shadow-xl shadow-indigo-950/20 transition-all duration-300 group-hover:scale-105 group-hover:rotate-1 border border-indigo-700/50 flex items-center justify-center">
                <img 
                  src="/icon.svg" 
                  alt="Linguist AI 3D Glossy Soundwave Icon" 
                  class="w-full h-full rounded-[20px] object-cover" 
                  referrerpolicy="no-referrer" 
                />
              </div>
              <span class="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider whitespace-nowrap">
                3D Vector &amp; PWA Master
              </span>
            </div>

            <div class="mt-5 space-y-1">
              <h4 class="font-black text-lg text-gray-900">Geometric Soundwave Lettermark</h4>
              <p class="text-xs text-gray-600 max-w-sm">
                A sculpted 3D letter &lsquo;L&rsquo; integrated with harmonic voice frequency soundwaves, finished in deep sapphire and radiant violet acrylic gloss.
              </p>
            </div>

            <!-- Features Pills -->
            <div class="flex flex-wrap items-center justify-center gap-1.5 mt-3 text-[10px] font-semibold text-indigo-700">
              <span class="px-2.5 py-1 bg-white rounded-lg border border-indigo-100 shadow-2xs">3D Gloss &amp; Refraction</span>
              <span class="px-2.5 py-1 bg-white rounded-lg border border-indigo-100 shadow-2xs">Minimalist Lettermark</span>
              <span class="px-2.5 py-1 bg-white rounded-lg border border-indigo-100 shadow-2xs">Acoustic Frequencies</span>
              <span class="px-2.5 py-1 bg-white rounded-lg border border-indigo-100 shadow-2xs">Android Maskable Ready</span>
            </div>
          </div>

          <!-- Generated Assets Grid -->
          <div class="space-y-2.5">
            <h5 class="text-xs font-black uppercase tracking-wider text-gray-700">Generated App Icon Formats</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              <a 
                href="/icon.svg" 
                target="_blank" 
                download="linguist-ai-icon.svg" 
                class="p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50/80 border border-gray-200 hover:border-indigo-200 transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-xl bg-indigo-950 p-1 flex items-center justify-center shrink-0">
                  <img src="/icon.svg" alt="SVG" class="w-8 h-8 rounded-lg" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-gray-900 group-hover:text-indigo-700">Vector SVG (Master)</p>
                  <p class="text-[10px] text-gray-500">Infinite scaling, browser tab favicon</p>
                </div>
                <span class="text-gray-400 group-hover:text-indigo-600 text-xs">↗</span>
              </a>

              <a 
                href="/pwa-512x512.png" 
                target="_blank" 
                download="pwa-512x512.png" 
                class="p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50/80 border border-gray-200 hover:border-indigo-200 transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-xl bg-indigo-950 p-1 flex items-center justify-center shrink-0">
                  <img src="/pwa-512x512.png" alt="512px" class="w-8 h-8 rounded-lg" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-gray-900 group-hover:text-indigo-700">PWA 512x512 PNG</p>
                  <p class="text-[10px] text-gray-500">Splash screen &amp; Desktop/Android launcher</p>
                </div>
                <span class="text-gray-400 group-hover:text-indigo-600 text-xs">↗</span>
              </a>

              <a 
                href="/apple-touch-icon.png" 
                target="_blank" 
                download="apple-touch-icon.png" 
                class="p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50/80 border border-gray-200 hover:border-indigo-200 transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-xl bg-indigo-950 p-1 flex items-center justify-center shrink-0">
                  <img src="/apple-touch-icon.png" alt="Apple" class="w-8 h-8 rounded-lg" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-gray-900 group-hover:text-indigo-700">Apple Touch Icon (180px)</p>
                  <p class="text-[10px] text-gray-500">iOS Safari Home Screen compliance</p>
                </div>
                <span class="text-gray-400 group-hover:text-indigo-600 text-xs">↗</span>
              </a>

              <a 
                href="/pwa-maskable-512x512.png" 
                target="_blank" 
                download="pwa-maskable-512x512.png" 
                class="p-3 rounded-2xl bg-gray-50 hover:bg-indigo-50/80 border border-gray-200 hover:border-indigo-200 transition-all flex items-center gap-3 group"
              >
                <div class="w-10 h-10 rounded-xl bg-indigo-950 p-1 flex items-center justify-center shrink-0">
                  <img src="/pwa-maskable-512x512.png" alt="Maskable" class="w-8 h-8 rounded-lg" referrerpolicy="no-referrer" />
                </div>
                <div class="min-w-0 flex-grow text-left">
                  <p class="font-bold text-xs text-gray-900 group-hover:text-indigo-700">Maskable Icon (512px)</p>
                  <p class="text-[10px] text-gray-500">Android adaptive circular safe-zone</p>
                </div>
                <span class="text-gray-400 group-hover:text-indigo-600 text-xs">↗</span>
              </a>

            </div>
          </div>

          <!-- PWA Installation Info -->
          <div class="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div class="space-y-0.5">
              <span class="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                <span>📱</span>
                <span>Install on Device</span>
              </span>
              <p class="text-[11px] text-indigo-800 leading-relaxed">
                ${isIOS
                  ? 'On iPhone/iPad: Tap the <strong>Share</strong> button in Safari, then tap <strong>Add to Home Screen</strong>.'
                  : state.isAppInstalled
                    ? 'Linguist AI is already installed on your device in standalone mode.'
                    : 'Install as a standalone native app on Android, macOS, Windows, or ChromeOS.'
                }
              </p>
            </div>
            ${!isIOS && !state.isAppInstalled && state.deferredInstallPrompt ? `
              <button
                id="modal-pwa-install-btn"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer whitespace-nowrap"
              >
                Install Now
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span class="text-xs text-gray-500">Icons are served live from <code>/public</code></span>
          <button id="icon-modal-close-action-btn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer">
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
    <div class="theme-app-bg h-screen bg-[#FDFCFB] flex flex-col font-sans overflow-hidden text-[#2D2D2D]">
      
      <!-- Top Navigation Header -->
      <header class="theme-header border-b border-gray-100 bg-white/80 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          
          <!-- App Brand Lockup with 3D Soundwave Icon -->
          <button
            id="brand-icon-btn"
            class="flex items-center gap-2 shrink-0 pr-2 sm:pr-3 border-r border-gray-200 cursor-pointer group text-left transition-opacity hover:opacity-90"
            title="Linguist AI — Click to view Icon, Brand, and PWA options"
          >
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 p-0.5 shadow-2xs transition-transform group-hover:scale-105 flex items-center justify-center border border-indigo-700/40">
              <img 
                src="/icon.svg" 
                alt="Linguist AI 3D Soundwave Icon" 
                class="w-full h-full rounded-[10px] object-cover" 
                referrerpolicy="no-referrer" 
              />
            </div>
            <div class="hidden xl:flex flex-col">
              <span class="font-extrabold text-sm text-gray-900 tracking-tight leading-none">
                Linguist<span class="text-indigo-600">AI</span>
              </span>
              <span class="text-[9px] text-gray-400 font-medium">3D Soundwave</span>
            </div>
          </button>

          <!-- Home / Practice Navigation Switcher -->
          <div class="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-200/80 shrink-0">
            <button
              id="nav-home-btn"
              class="px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                state.activeView === 'home'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }"
              title="Open Home Dashboard, Progress Graph, Streaks & Personas"
            >
              <span>🏠</span>
              <span>Home</span>
            </button>
            <button
              id="nav-chat-btn"
              class="px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                state.activeView === 'chat'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
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
            class="p-2 sm:px-3 sm:py-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 transition-all flex items-center gap-1.5 font-semibold text-xs sm:text-sm cursor-pointer shadow-2xs"
            title="Browse Historical Conversations"
          >
            <span>📜</span>
            <span class="hidden md:inline">History</span>
            <span class="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
              ${state.sessions.length}
            </span>
          </button>

          <!-- Active Persona, Tone & Difficulty Controls -->
          <div class="hidden md:flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              id="switch-persona-btn"
              class="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-lg shadow-2xs hover:scale-105 transition-transform cursor-pointer flex-shrink-0"
              title="Click to select AI Persona, Tone and Difficulty"
            >
              ${persona.avatar}
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="font-bold text-xs sm:text-sm text-gray-900 truncate leading-tight">
                  ${persona.name}
                </p>
                <button
                  id="switch-persona-text-btn"
                  class="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-lg cursor-pointer font-semibold transition-colors flex items-center gap-0.5"
                  title="Adjust AI Persona, Tone & Difficulty"
                >
                  <span>Persona</span>
                  <span class="text-[8px]">▾</span>
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-1 mt-0.5">
                <!-- Clickable Language Switcher Button -->
                <button
                  id="switch-lang-btn"
                  class="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-100 cursor-pointer transition-colors"
                  title="Switch Target Language"
                >
                  <span>${lang.flag}</span>
                  <span class="font-bold">${lang.name}</span>
                  <span class="text-[9px] ml-0.5">▾</span>
                </button>

                <!-- Tone Pill Button -->
                <button
                  id="header-tone-btn"
                  class="hidden lg:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-85 transition-opacity ${getToneBadgeClass(currentTone)}"
                  title="Active Tone: Click to adjust"
                >
                  ${getToneLabel(currentTone)}
                </button>

                <!-- Difficulty Pill Button -->
                <button
                  id="header-diff-btn"
                  class="hidden xl:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-85 transition-opacity ${getDifficultyBadgeClass(currentDifficulty)}"
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
          
          <!-- Daily Streak Button -->
          <button
            id="header-streak-btn"
            class="px-2.5 py-1.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="Active Streak: Click to view Fluency Dashboard"
          >
            <span>🔥</span>
            <span class="tabular-nums">${fluencyMetrics.currentStreakDays}d</span>
          </button>

          <!-- Vocabulary Bank Button -->
          <button
            id="header-vocab-btn"
            class="px-2.5 py-1.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="Saved Vocabulary Bank"
          >
            <span>📖</span>
            <span class="hidden lg:inline">Vocab</span>
            <span class="px-1.5 py-0.2 bg-emerald-200/70 text-emerald-900 rounded-full text-[10px] tabular-nums">
              ${fluencyMetrics.savedVocabulary.length}
            </span>
          </button>

          <!-- Fluency Dashboard Link -->
          <button
            id="header-fluency-btn"
            class="hidden sm:flex px-2.5 py-1.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="Open Fluency Analytics & Mastery Dashboard"
          >
            <span>📊</span>
            <span class="hidden xl:inline">Fluency</span>
            <span class="px-1.5 py-0.2 bg-indigo-200/70 text-indigo-900 rounded-full text-[10px]">
              ${cefr.level}
            </span>
          </button>

          <!-- Settings Gear Icon (Appearance: Dark/Light Mode, Voices, Account) -->
          <button
            id="header-app-settings-btn"
            class="p-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 transition-all cursor-pointer shadow-2xs flex items-center gap-1 text-xs font-bold"
            title="Settings — Change Dark/Light Mode, Voices, and Preferences"
          >
            <span>⚙️</span>
            <span class="hidden xl:inline">Settings</span>
          </button>

          <!-- Google Account / Profile Button -->
          ${state.user ? `
            <button
              id="header-auth-btn"
              class="p-1 pr-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Signed in as ${escapeHtml(state.user.email || state.user.displayName || 'User')} — Click to manage account"
            >
              ${state.user.photoURL ? `<img src="${escapeHtml(state.user.photoURL)}" alt="Profile" class="w-6 h-6 rounded-full object-cover" referrerpolicy="no-referrer" />` : `<span class="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">${escapeHtml((state.user.displayName || 'U')[0])}</span>`}
              <span class="hidden md:inline max-w-[90px] truncate">${escapeHtml((state.user.displayName || state.user.email || 'Account').split(' ')[0])}</span>
            </button>
          ` : `
            <button
              id="header-google-signin-btn"
              class="px-2.5 py-1.5 rounded-2xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
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
            class="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-semibold shadow-sm shadow-indigo-500/20 flex items-center gap-1 transition-all cursor-pointer"
            title="Start a new chat session"
          >
            <span>+</span>
            <span class="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </header>

      <!-- Main Layout Body (History Sidebar + Home Dashboard OR Chat Area) -->
      <div class="flex-grow flex overflow-hidden relative">

        <!-- Historical Sessions Drawer -->
        ${state.showHistoryDrawer ? `
          <div id="history-backdrop" class="fixed inset-0 bg-black/20 backdrop-blur-2xs z-40 transition-opacity"></div>
          <aside class="absolute left-0 top-0 bottom-0 w-80 sm:w-96 bg-white border-r border-gray-200 z-50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <!-- Drawer Header -->
            <div class="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 class="font-extrabold text-base text-gray-900">Historical Conversations</h3>
                <p class="text-xs text-gray-500">Persistent chats across languages & personas</p>
              </div>
              <button id="close-history-drawer-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <!-- Drawer Search Bar -->
            <div class="p-3 border-b border-gray-100">
              <div class="relative">
                <input
                  id="history-search-input"
                  type="text"
                  value="${state.historySearchQuery}"
                  placeholder="Search in past conversations..."
                  class="w-full pl-9 pr-8 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                ${state.historySearchQuery ? `
                  <button id="clear-history-search" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs cursor-pointer">✕</button>
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
                      class="history-session-item group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs'
                          : 'bg-white hover:bg-gray-50 border-gray-100'
                      }"
                    >
                      <div class="flex items-start justify-between gap-2 mb-1">
                        <div class="flex items-center gap-1.5 min-w-0">
                          <span class="text-base">${s.language.flag}</span>
                          <span class="font-bold text-xs text-gray-900 truncate">${s.title}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 whitespace-nowrap">${formatDate(s.updatedAt)}</span>
                      </div>

                      <p class="text-[11px] text-gray-500 line-clamp-1 italic mb-2">
                        "${escapeHtml(lastMsg ? lastMsg.content : 'No messages yet')}"
                      </p>

                      <div class="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 border-t border-gray-100/60">
                        <span class="flex items-center gap-1.5">
                          <span>${s.persona.avatar} ${s.persona.name}</span>
                          <span class="text-gray-300">•</span>
                          <span class="font-semibold text-indigo-600">${s.tone || s.persona.defaultTone || 'formal'}</span>
                        </span>
                        <div class="flex items-center gap-1">
                          <span class="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-600">
                            ${s.messages.length} msgs
                          </span>
                          <button
                            data-delete-session-id="${s.id}"
                            class="delete-session-btn opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 text-gray-400 rounded transition-opacity"
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
            <div class="p-3 border-t border-gray-100 flex items-center justify-between text-xs bg-gray-50/80">
              <button id="clear-all-history-btn" class="text-red-600 hover:text-red-700 font-semibold cursor-pointer">
                Clear All History
              </button>
              <button id="drawer-new-chat-btn" class="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-bold cursor-pointer hover:bg-indigo-700">
                + New Chat
              </button>
            </div>
          </aside>
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
        <!-- Chat Messages Historical Scroll Area -->
        <main id="chat-container" class="flex-grow overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 scroll-smooth">
          <div class="max-w-3xl mx-auto w-full space-y-4">
            <!-- Quick Back to Home Dashboard Bar -->
            <div class="flex items-center justify-between pb-1">
              <button
                id="chat-back-home-btn"
                class="px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                <span>←</span>
                <span>Back to Home Dashboard</span>
              </button>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>${lang.flag} <strong>${lang.name}</strong></span>
                <span>·</span>
                <span>${persona.avatar} <strong>${persona.name}</strong></span>
              </div>
            </div>
            


            <!-- Historical Messages Sequence -->
            ${messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const showDateHeader = index === 0 || formatDate(msg.timestamp) !== formatDate(messages[index - 1].timestamp);

              return `
                ${showDateHeader ? `
                  <div class="flex items-center justify-center my-3">
                    <span class="px-3 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[11px] font-semibold tracking-wider uppercase">
                      ${formatDate(msg.timestamp)}
                    </span>
                  </div>
                ` : ''}

                <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
                  <div class="max-w-[94%] sm:max-w-[85%] group">
                    
                    <!-- Message Bubble -->
                    <div class="p-4 sm:p-5 rounded-3xl ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-500/20'
                        : 'bg-white border border-gray-100 shadow-sm rounded-tl-none text-gray-900'
                    }">
                      
                      <!-- Message Header / Role / Time -->
                      <div class="flex items-center justify-between gap-2 mb-2 text-[11px] ${
                        isUser ? 'text-indigo-200' : 'text-gray-400'
                      }">
                        <span class="font-semibold flex items-center gap-1">
                          ${isUser ? '<span>You</span>' : `<span>${persona.avatar} ${persona.name}</span>`}
                        </span>
                        <span>${formatTime(msg.timestamp)}</span>
                      </div>

                      <!-- Message Text Content (With Tokenized Hover Segment Support) -->
                      <div class="text-base sm:text-lg leading-relaxed font-medium">
                        ${isUser
                          ? renderUserMessageContent(msg, lang.code)
                          : `<span class="select-text">${renderTokenizedMessageText(msg.content, lang.code, msg.id, false)}</span>`
                        }
                      </div>

                      <!-- Optional English Translation / Romanized Pronunciation -->
                      ${msg.translation ? `
                        <div class="mt-2.5 pt-2 border-t ${
                          isUser ? 'border-indigo-500/40 text-indigo-100' : 'border-gray-100 text-gray-500'
                        } text-xs sm:text-sm italic">
                          ${escapeHtml(msg.translation)}
                        </div>
                      ` : ''}

                      <!-- Message Actions Bar (Listen / Copy / Deep Breakdown) -->
                      <div class="mt-3 pt-2.5 border-t ${
                        isUser ? 'border-indigo-500/40 text-indigo-200' : 'border-gray-100 text-gray-400'
                      } flex items-center justify-between text-xs">
                        <div class="flex items-center gap-1.5">
                          <button
                            data-speak-text="${encodeURIComponent(msg.content)}"
                            class="play-msg-btn flex items-center gap-1 px-2 py-1 rounded-xl ${
                              isUser ? 'bg-indigo-700/60 hover:bg-indigo-700 text-white' : 'bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600'
                            } transition-colors font-medium text-[11px] cursor-pointer"
                            title="Listen to native audio"
                          >
                            <span>🔊</span> Listen
                          </button>
                          
                          <button
                            data-copy-text="${encodeURIComponent(msg.content)}"
                            class="copy-msg-btn flex items-center gap-1 px-2 py-1 rounded-xl ${
                              isUser ? 'hover:bg-indigo-700/60 text-indigo-200' : 'hover:bg-gray-100 text-gray-500'
                            } transition-colors text-[11px] cursor-pointer"
                            title="Copy text"
                          >
                            <span>📋</span> Copy
                          </button>
                        </div>

                        <!-- Deep Sentence Breakdown & Grammar Analysis Tool Button -->
                        <button
                          data-breakdown-msg-id="${msg.id}"
                          class="breakdown-msg-btn flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-2xs ${
                            isUser
                              ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                          }"
                          title="Deep Sentence Breakdown & Grammar Analysis"
                        >
                          <span>🔍</span>
                          <span>Breakdown & Grammar</span>
                          ${msg.breakdown ? '<span class="text-[9px] px-1 bg-indigo-600 text-white rounded">ready</span>' : ''}
                        </button>
                      </div>
                    </div>

                    <!-- Grammar Feedback Indicator & Expandable Breakdown for User Messages -->
                    ${isUser ? `
                      <div class="mt-1.5 flex flex-col items-end">
                        ${msg.checkingGrammar ? `
                          <div class="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse px-2">
                            <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
                            <span>Analyzing grammar...</span>
                          </div>
                        ` : ''}

                        ${msg.grammarFeedback ? `
                          <div class="w-full">
                            <!-- Toggle Button / Summary Badge -->
                            <div class="flex justify-end mt-1">
                              <button
                                data-toggle-feedback="${msg.id}"
                                class="toggle-feedback-btn text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                  msg.grammarFeedback.isCorrect
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }"
                              >
                                <span>${msg.grammarFeedback.isCorrect ? '✓ Accurate Phrasing' : '💡 Grammar Feedback'}</span>
                                <span class="text-[10px]">${msg.showFeedbackDetails ? '▲' : '▼'}</span>
                              </button>
                            </div>

                            <!-- Expandable Feedback Breakdown Card -->
                            ${msg.showFeedbackDetails ? `
                              <div class="mt-2 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl shadow-sm text-xs text-amber-900 space-y-2 animate-in fade-in duration-150">
                                <div class="flex items-center justify-between font-bold text-amber-800 border-b border-amber-200/60 pb-1.5">
                                  <span class="flex items-center gap-1.5">
                                    <span>🔍</span> Grammar & Phrasing Breakdown
                                  </span>
                                  <span class="text-[10px] font-normal text-amber-700">${lang.name}</span>
                                </div>

                                <div>
                                  <span class="font-semibold text-gray-500 block text-[10px] uppercase">Recommended Form:</span>
                                  <p class="font-bold text-sm text-emerald-800 bg-white/80 p-2 rounded-xl border border-emerald-100 mt-0.5 select-text">
                                    ${escapeHtml(msg.grammarFeedback.correction)}
                                  </p>
                                </div>

                                ${msg.grammarFeedback.explanation ? `
                                  <div>
                                    <span class="font-semibold text-gray-500 block text-[10px] uppercase">Why:</span>
                                    <p class="text-amber-900 leading-relaxed mt-0.5 select-text">
                                      ${escapeHtml(msg.grammarFeedback.explanation)}
                                    </p>
                                  </div>
                                ` : ''}

                                ${msg.grammarFeedback.highlightSegments && msg.grammarFeedback.highlightSegments.length > 0 ? `
                                  <div class="pt-1.5 border-t border-amber-200/60 space-y-1.5">
                                    <span class="font-semibold text-gray-500 block text-[10px] uppercase">Specific Edits:</span>
                                    ${msg.grammarFeedback.highlightSegments.map(seg => `
                                      <div class="p-2 bg-white/70 rounded-xl border border-amber-100 flex items-start gap-2 text-[11px]">
                                        <span class="text-red-500 line-through font-medium flex-shrink-0">${escapeHtml(seg.errorText)}</span>
                                        <span class="text-gray-400">→</span>
                                        <span class="text-emerald-700 font-bold flex-shrink-0">${escapeHtml(seg.correctedText)}</span>
                                        <span class="text-gray-500 italic ml-auto text-right">${escapeHtml(seg.reason)}</span>
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

            <!-- Gemini AI Typing Indicator Bubble -->
            ${state.isTyping ? `
              <div class="flex justify-start">
                <div class="p-4 rounded-3xl bg-white border border-gray-100 shadow-xs rounded-tl-none flex items-center gap-2">
                  <span class="text-base">${persona.avatar}</span>
                  <span class="text-xs text-gray-500 font-medium">${persona.name} is formulating a response in ${lang.name}...</span>
                  <div class="flex items-center gap-1 ml-1">
                    <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
                    <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Server Error Notification -->
            ${state.errorMessage ? `
              <div class="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-3 shadow-xs">
                <div class="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>${escapeHtml(state.errorMessage)}</span>
                </div>
                <div class="flex items-center gap-3">
                  <button id="retry-send-btn" class="font-bold underline hover:text-red-900 cursor-pointer">Retry</button>
                  <button id="dismiss-err-btn" class="font-bold hover:text-red-900 cursor-pointer">✕</button>
                </div>
              </div>
            ` : ''}

          </div>
        </main>

        <!-- Slide-Over Sentence Breakdown & Deep Grammar Drawer -->
        ${state.activeBreakdownMsgId ? (() => {
          const targetMsg = session.messages.find(m => m.id === state.activeBreakdownMsgId);
          if (!targetMsg) return '';
          const b = targetMsg.breakdown;

          return `
            <div id="breakdown-backdrop" class="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 transition-opacity"></div>
            <aside class="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] md:w-[540px] lg:w-[600px] bg-white border-l border-gray-200 z-50 flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">
              
              <!-- Drawer Header -->
              <div class="p-4 sm:p-5 border-b border-gray-100 bg-white sticky top-0 flex items-center justify-between z-10">
                <div class="flex items-center gap-2.5">
                  <div class="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 text-lg">
                    🔍
                  </div>
                  <div>
                    <h3 class="font-extrabold text-sm sm:text-base text-gray-900 leading-tight">Deep Sentence Breakdown</h3>
                    <p class="text-xs text-gray-500">Morphology, syntax tree, and linguistic register</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <button
                    id="breakdown-full-speak-btn"
                    class="p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 text-xs font-semibold border border-gray-200 flex items-center gap-1 cursor-pointer"
                    title="Listen to sentence (Normal speed)"
                  >
                    <span>🔊 1.0x</span>
                  </button>
                  <button
                    id="breakdown-slow-speak-btn"
                    class="p-2 rounded-xl bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 text-xs font-semibold border border-gray-200 flex items-center gap-1 cursor-pointer"
                    title="Listen in Slow Practice Mode (0.75x)"
                  >
                    <span>🐢 Slow</span>
                  </button>
                  <button id="close-breakdown-drawer-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold text-base cursor-pointer">
                    ✕
                  </button>
                </div>
              </div>

              <!-- Drawer Content Area -->
              <div class="flex-grow overflow-y-auto p-4 sm:p-5 space-y-5 text-gray-800">

                ${state.isLoadingBreakdown ? `
                  <div class="py-16 text-center space-y-3">
                    <div class="inline-flex p-4 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-3xl animate-bounce">
                      🔍
                    </div>
                    <h4 class="font-extrabold text-gray-900 text-base">Dissecting Grammatical Syntax...</h4>
                    <p class="text-xs text-gray-500 max-w-sm mx-auto">
                      Gemini is analyzing parts of speech, clause hierarchy, case endings, and registers in ${lang.name}.
                    </p>
                    <div class="flex items-center justify-center gap-1 pt-2">
                      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse [animation-delay:0.2s]"></span>
                      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                ` : b ? `
                  
                  <!-- 1. Primary Sentence & Dual Translations -->
                  <div class="p-4 bg-linear-to-r from-indigo-50/60 to-purple-50/40 rounded-2xl border border-indigo-100 space-y-2">
                    <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Target Sentence (${lang.name})</span>
                    <p class="text-lg sm:text-xl font-bold text-gray-900 select-text leading-snug">
                      ${escapeHtml(b.sentence)}
                    </p>
                    <div class="pt-2 border-t border-indigo-100/80 space-y-1 text-xs">
                      <div>
                        <span class="font-bold text-gray-500">Natural Meaning:</span>
                        <span class="text-gray-800 font-medium ml-1">${escapeHtml(b.naturalTranslation)}</span>
                      </div>
                      ${b.literalTranslation ? `
                        <div>
                          <span class="font-bold text-gray-400">Literal Structure:</span>
                          <span class="text-gray-600 italic ml-1">${escapeHtml(b.literalTranslation)}</span>
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- 2. Syntactic Clause Decomposition -->
                  ${b.clauseStructure && b.clauseStructure.length > 0 ? `
                    <div class="space-y-2">
                      <h4 class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>🧩</span> Syntactic Clause Structure
                      </h4>
                      <div class="grid grid-cols-1 gap-2">
                        ${b.clauseStructure.map(clause => `
                          <div class="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                            <div class="flex items-center justify-between gap-2">
                              <span class="font-bold text-sm text-gray-900 select-text">${escapeHtml(clause.clause)}</span>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                clause.type === 'main'
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }">
                                ${clause.type} clause
                              </span>
                            </div>
                            <p class="text-xs text-gray-500">${escapeHtml(clause.function)}</p>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                  <!-- 3. Morphological Matrix Table -->
                  ${b.tokens && b.tokens.length > 0 ? `
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <h4 class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                          <span>📊</span> Word Morphology Matrix (${b.tokens.length} tokens)
                        </h4>
                        <span class="text-[11px] text-gray-400">Click ⭐️ to save word</span>
                      </div>

                      <div class="overflow-x-auto rounded-2xl border border-gray-200 shadow-2xs">
                        <table class="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr class="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold text-[11px] uppercase tracking-wider">
                              <th class="p-2.5">Token / Word</th>
                              <th class="p-2.5">Part of Speech</th>
                              <th class="p-2.5">Role / Case</th>
                              <th class="p-2.5">Contextual Meaning</th>
                              <th class="p-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100 bg-white">
                            ${b.tokens.map(token => {
                              const isTokenSaved = fluencyMetrics.savedVocabulary.some(
                                v => v.word.toLowerCase() === token.surface.toLowerCase() && v.languageCode === lang.code
                              );
                              return `
                                <tr class="hover:bg-indigo-50/40 transition-colors">
                                  <td class="p-2.5">
                                    <div class="font-bold text-sm text-gray-900 select-text">${escapeHtml(token.surface)}</div>
                                    ${token.transliteration ? `
                                      <div class="text-[10px] font-mono text-indigo-600">${escapeHtml(token.transliteration)}</div>
                                    ` : ''}
                                  </td>
                                  <td class="p-2.5">
                                    <span class="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[10px]">
                                      ${escapeHtml(token.partOfSpeech)}
                                    </span>
                                  </td>
                                  <td class="p-2.5 text-gray-600 text-[11px]">
                                    ${escapeHtml(token.grammaticalRole || '—')}
                                  </td>
                                  <td class="p-2.5 text-gray-800 font-medium">
                                    ${escapeHtml(token.meaning)}
                                  </td>
                                  <td class="p-2.5 text-right whitespace-nowrap space-x-1">
                                    <button
                                      data-token-speak="${encodeURIComponent(token.surface)}"
                                      class="token-speak-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-indigo-600 cursor-pointer"
                                      title="Listen"
                                    >
                                      🔊
                                    </button>
                                    <button
                                      data-token-save="${encodeURIComponent(JSON.stringify(token))}"
                                      class="token-save-btn p-1.5 rounded-lg hover:bg-gray-100 ${
                                        isTokenSaved ? 'text-amber-500 font-bold' : 'text-gray-400 hover:text-amber-500'
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
                      <h4 class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>💡</span> Linguistic Insights & Grammar Rules
                      </h4>
                      <div class="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-2 text-xs text-amber-950">
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
                      <h4 class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>🎭</span> Register & Pragmatic Tone
                      </h4>
                      <div class="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-1.5">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-gray-600">Politeness:</span>
                          <span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-semibold text-[10px]">
                            ${escapeHtml(b.registerAnalysis.politenessLevel)}
                          </span>
                          <span class="font-bold text-gray-600 ml-2">Tone:</span>
                          <span class="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-semibold text-[10px]">
                            ${escapeHtml(b.registerAnalysis.tone)}
                          </span>
                        </div>
                        <p class="text-gray-600 leading-relaxed pt-1 border-t border-gray-200/60">
                          ${escapeHtml(b.registerAnalysis.appropriateness)}
                        </p>
                      </div>
                    </div>
                  ` : ''}

                  <!-- 6. Alternative Register Formulations -->
                  ${b.alternativeExpressions && b.alternativeExpressions.length > 0 ? `
                    <div class="space-y-2">
                      <h4 class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>🔄</span> Alternative Formulations
                      </h4>
                      <div class="space-y-2">
                        ${b.alternativeExpressions.map(alt => `
                          <div class="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs space-y-1">
                            <div class="flex items-center justify-between gap-2">
                              <span class="font-bold text-sm text-gray-900 select-text">${escapeHtml(alt.expression)}</span>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                                ${alt.register}
                              </span>
                            </div>
                            <p class="text-xs text-gray-500">${escapeHtml(alt.explanation)}</p>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}

                ` : `
                  <div class="py-12 text-center text-gray-500 text-xs">
                    <p>No breakdown available. Click Retry to generate.</p>
                    <button id="retry-breakdown-btn" class="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                      Retry Analysis
                    </button>
                  </div>
                `}

              </div>
            </aside>
          `;
        })() : ''}
        `}

      </div>

      ${state.activeView === 'chat' ? `
      <!-- Dynamic Conversation Suggestions -->
      <div class="border-t border-gray-100 bg-white/95 backdrop-blur-md px-3 sm:px-6 py-2 shadow-2xs">
        <div class="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
          
          <!-- Suggestions Header with Shuffle button -->
          <div class="flex items-center gap-1.5 shrink-0 pr-1.5 border-r border-gray-200">
            <span class="text-[11px] font-bold text-indigo-700 flex items-center gap-1 uppercase tracking-wider">
              <span>✨</span>
              <span>Suggestions:</span>
            </span>
            <button
              id="shuffle-suggestions-btn"
              class="p-1 rounded-full hover:bg-indigo-100 text-indigo-600 hover:text-indigo-900 transition-all cursor-pointer group"
              title="Shuffle suggestions (keeps changing to fresh ideas)"
              aria-label="Shuffle suggestions"
            >
              <svg class="w-3.5 h-3.5 transform group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          </div>

          <!-- Dynamic Suggestion Chips -->
          ${dynamicSuggestions.map(st => `
            <div class="inline-flex items-center rounded-full bg-gray-50 hover:bg-indigo-50/90 border border-gray-200 hover:border-indigo-300 text-gray-700 hover:text-indigo-900 transition-all group shrink-0 shadow-2xs">
              <button
                data-suggestion="${encodeURIComponent(st.text)}"
                class="quick-suggestion-btn px-3 py-1 text-xs font-medium text-left cursor-pointer flex items-center gap-1.5"
                title="${st.translation ? escapeHtml(st.translation) : 'Click to send this suggestion'}"
              >
                ${st.tag ? `<span class="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded-sm bg-indigo-100/70 text-indigo-700 group-hover:bg-indigo-200">${escapeHtml(st.tag)}</span>` : ''}
                <span class="truncate max-w-[220px] sm:max-w-[320px]">${escapeHtml(st.text)}</span>
                ${st.translation ? `<span class="text-[10px] text-gray-400 group-hover:text-indigo-500 font-normal hidden md:inline truncate max-w-[150px]">(${escapeHtml(st.translation)})</span>` : ''}
              </button>
              
              <!-- Quick Insert-Only Button to insert into input draft without immediate sending -->
              <button
                data-insert-suggestion="${encodeURIComponent(st.text)}"
                class="quick-insert-btn pr-2 pl-0.5 py-1 text-gray-400 hover:text-indigo-700 text-xs transition-colors cursor-pointer"
                title="Edit in input field before sending"
              >
                ✏️
              </button>
            </div>
          `).join('')}

          <!-- Extra Shuffle Pill at the end for effortless continuous cycling -->
          <button
            id="more-suggestions-btn"
            class="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            title="Cycle to next set of suggestions"
          >
            <span>🔄 More...</span>
          </button>
        </div>
      </div>

      <!-- Draft Grammar Analysis Banner -->
      ${state.checkingDraftGrammar ? `
        <div class="bg-indigo-50 border-t border-indigo-100 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-indigo-700 animate-pulse">
          <span>🔍</span>
          <span>Analyzing draft grammar with Gemini AI...</span>
        </div>
      ` : ''}

      ${state.draftGrammarFeedback ? `
        <div class="bg-amber-50/95 border-t border-amber-200 px-4 py-2 text-xs text-amber-900">
          <div class="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base">${state.draftGrammarFeedback.isCorrect ? '✓' : '✏️'}</span>
              <div class="truncate">
                <span class="font-bold">
                  ${state.draftGrammarFeedback.isCorrect ? 'Looks accurate!' : 'Suggested Correction:'}
                </span>
                <span class="font-medium text-emerald-800 ml-1">
                  ${escapeHtml(state.draftGrammarFeedback.correction)}
                </span>
                ${state.draftGrammarFeedback.explanation ? `
                  <span class="text-amber-700 text-[11px] ml-2 hidden sm:inline">
                    (${escapeHtml(state.draftGrammarFeedback.explanation)})
                  </span>
                ` : ''}
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              ${!state.draftGrammarFeedback.isCorrect ? `
                <button
                  id="apply-draft-correction-btn"
                  class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-2xs"
                >
                  Use Correction
                </button>
              ` : ''}
              <button id="dismiss-draft-feedback" class="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Bottom Chat Input Bar -->
      <footer class="border-t border-gray-100 bg-white p-3 sm:p-4 shadow-lg">
        <div class="max-w-3xl mx-auto">
          
          ${isListening ? `
            <div class="mb-2 p-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span class="font-bold">Listening in ${lang.name}... Speak naturally now!</span>
              </div>
              <button id="stop-listening-btn" class="px-2 py-0.5 bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer">
                Stop
              </button>
            </div>
          ` : ''}

          <div class="flex items-end gap-2 bg-gray-50 p-2 rounded-3xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            
            <!-- Voice Input Mic Button -->
            <button
              id="mic-action-btn"
              class="p-3.5 rounded-2xl transition-colors flex-shrink-0 cursor-pointer ${
                isListening
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                  : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
              }"
              title="Voice Input (Speech-to-Text in ${lang.name})"
            >
              🎙️
            </button>

            <!-- Expanding Message Textarea -->
            <textarea
              id="user-input"
              rows="1"
              placeholder="Type your message in ${lang.name} (${lang.nativeName})... Press Enter to send"
              class="flex-grow bg-transparent border-0 px-2 py-2 text-sm sm:text-base text-gray-900 placeholder-gray-400 focus:outline-none resize-none max-h-32 min-h-[44px]"
            >${escapeHtml(state.userInput)}</textarea>

            <!-- Pre-check Draft Grammar Button -->
            <button
              id="check-draft-grammar-btn"
              class="p-3.5 rounded-2xl transition-all flex-shrink-0 ${
                state.userInput.trim()
                  ? 'cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-xs'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200'
              }"
              title="Pre-check Grammar & Spelling of this draft sentence"
            >
              ✏️
            </button>

            <!-- Send Message Button -->
            <button
              id="send-message-btn"
              class="p-3.5 rounded-2xl transition-all flex-shrink-0 ${
                state.userInput.trim() && !state.isTyping
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-700 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }"
              title="Send to Gemini AI"
            >
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>

          </div>

          <div class="mt-2 flex items-center justify-between text-[11px] text-gray-400 px-2">
            <span>Press <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono">Enter</kbd> to send, <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600 font-mono">Shift+Enter</kbd> for new line</span>
            <span class="flex items-center gap-1.5">
              <span>Persona: <strong class="text-gray-600">${persona.name}</strong></span>
              <span>•</span>
              <button id="footer-settings-link" class="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">Adjust Tone & Difficulty</button>
            </span>
          </div>

        </div>
      </footer>
      ` : ''}

      <!-- Language Switcher Modal -->
      ${state.showLanguageModal ? `
        <div id="lang-modal-backdrop" class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <!-- Modal Header -->
            <div class="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 class="font-extrabold text-lg text-gray-900">Select Practice Language</h3>
                <p class="text-xs text-gray-500">Includes Indian Classical, Major regional, and Global languages</p>
              </div>
              <button id="close-lang-modal-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-500 font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <!-- Search & Category Filters -->
            <div class="p-4 border-b border-gray-100 space-y-3">
              <div class="relative">
                <input
                  id="modal-lang-search"
                  type="text"
                  value="${state.languageSearchQuery}"
                  placeholder="Search language by name, script or code (e.g. Hindi, Sanskrit, Tamil, Japanese)..."
                  class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>

              <div class="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                ${[
                  { id: 'all', label: `All (${LANGUAGES.length})` },
                  { id: 'indian', label: `🇮🇳 Indian (${LANGUAGES.filter(l => l.category === 'indian').length})` },
                  { id: 'european', label: `🇪🇺 European (${LANGUAGES.filter(l => l.category === 'european').length})` },
                  { id: 'asian', label: `🌏 Asian & Middle East (${LANGUAGES.filter(l => l.category === 'asian').length})` }
                ].map(tab => `
                  <button
                    data-modal-category="${tab.id}"
                    class="modal-cat-btn px-3 py-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      state.activeLanguageCategory === tab.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }"
                  >
                    ${tab.label}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Languages Grid -->
            <div class="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh]">
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
                    class="p-3 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 shadow-2xs'
                        : 'bg-white hover:bg-gray-50 border-gray-100 hover:border-indigo-200'
                    }"
                  >
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">${l.flag}</span>
                      <div>
                        <p class="font-bold text-sm text-gray-900">${l.name}</p>
                        <p class="text-xs text-gray-500 font-medium">${l.nativeName}</p>
                      </div>
                    </div>
                    <span class="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
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

      <!-- AI Persona & Response Settings Modal -->
      ${state.showPersonaModal ? `
        <div id="persona-modal-backdrop" class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div class="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl">
                  ⚙️
                </div>
                <div>
                  <h3 class="font-extrabold text-base sm:text-lg text-gray-900 leading-tight">AI Persona & Response Settings</h3>
                  <p class="text-xs text-gray-500">Select an AI persona to adjust tone and difficulty of AI responses</p>
                </div>
              </div>
              <button id="close-persona-modal-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <!-- Scrollable Modal Body -->
            <div class="p-4 sm:p-5 overflow-y-auto space-y-5 max-h-[70vh]">

              ${(() => {
                const selP = PERSONAS.find(p => p.id === (state.modalSelectedPersonaId || persona.id)) || persona;
                const selTone = state.modalSelectedTone || session.tone || selP.defaultTone || 'formal';
                const selDiff = state.modalSelectedDifficulty || session.difficulty || selP.defaultDifficulty || 'intermediate';
                const previewGreeting = getLocalizedGreeting(selP.id, lang);

                return `
                  <!-- Current Selection Summary Banner -->
                  <div class="p-3.5 bg-linear-to-r from-indigo-50/70 via-purple-50/40 to-pink-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="text-3xl p-2 bg-white rounded-xl shadow-2xs border border-indigo-100/60">${selP.avatar}</span>
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="font-extrabold text-sm text-gray-900">${selP.name}</span>
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getToneBadgeClass(selTone)}">${getToneLabel(selTone)}</span>
                          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getDifficultyBadgeClass(selDiff)}">${getDifficultyLabel(selDiff)}</span>
                        </div>
                        <p class="text-xs text-gray-500 line-clamp-1 mt-0.5">${selP.tagline || selP.description}</p>
                      </div>
                    </div>
                    <button
                      id="reset-persona-defaults-btn"
                      class="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-xl border border-indigo-100 shadow-2xs cursor-pointer whitespace-nowrap hover:bg-indigo-50 transition-colors"
                      title="Reset Tone and Difficulty to this persona's defaults"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <!-- 1. Select AI Persona -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>1. Choose AI Persona</span>
                        <span class="text-indigo-600 text-xs font-normal">(${PERSONAS.length} personas)</span>
                      </label>
                      <span class="text-[11px] text-gray-400">Click card to select</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      ${PERSONAS.map(p => {
                        const isSelected = p.id === selP.id;
                        return `
                          <button
                            data-modal-select-persona="${p.id}"
                            class="modal-persona-card p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                              isSelected
                                ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-indigo-200'
                            }"
                          >
                            <div class="flex items-start gap-2.5 mb-2">
                              <span class="text-2xl p-1.5 bg-white rounded-xl border border-gray-100 shadow-2xs flex-shrink-0">${p.avatar}</span>
                              <div class="min-w-0 flex-grow">
                                <p class="font-bold text-xs text-gray-900 truncate">${p.name}</p>
                                <span class="text-[10px] text-indigo-600 font-semibold block">${p.tagline || ''}</span>
                              </div>
                            </div>
                            <p class="text-[11px] text-gray-500 line-clamp-2 leading-relaxed mb-2">${p.description}</p>
                            <div class="pt-1.5 border-t border-gray-100/80 flex items-center justify-between text-[10px] text-gray-400">
                              <span>${getToneLabel(p.defaultTone)}</span>
                              <span>${p.defaultDifficulty}</span>
                            </div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 2. Calibrate Tone -->
                  <div>
                    <label class="font-extrabold text-xs uppercase tracking-wider text-gray-700 block mb-2">
                      2. Adjust Tone & Register
                    </label>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      ${(['formal', 'casual', 'supportive', 'professional', 'witty'] as ToneStyle[]).map(t => {
                        const isSelected = selTone === t;
                        return `
                          <button
                            data-modal-select-tone="${t}"
                            class="p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
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
                    <label class="font-extrabold text-xs uppercase tracking-wider text-gray-700 block mb-2">
                      3. Adjust Difficulty Level
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                      ${(['beginner', 'intermediate', 'advanced'] as DifficultyLevel[]).map(d => {
                        const isSelected = selDiff === d;
                        return `
                          <button
                            data-modal-select-diff="${d}"
                            class="p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                            }"
                          >
                            <div class="font-bold text-xs">${getDifficultyLabel(d)}</div>
                          </button>
                        `;
                      }).join('')}
                    </div>
                  </div>

                  <!-- 4. Persona Greeting Preview -->
                  <div class="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1.5">
                    <div class="flex items-center justify-between text-xs text-gray-500">
                      <span class="font-bold text-gray-700">Preview Greeting (${lang.name}):</span>
                      <button data-preview-speak="${encodeURIComponent(previewGreeting)}" id="preview-speak-btn" class="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">
                        🔊 Listen
                      </button>
                    </div>
                    <p class="font-medium text-xs sm:text-sm text-gray-900 bg-white p-2.5 rounded-xl border border-gray-200/70 select-text">
                      ${escapeHtml(previewGreeting)}
                    </p>
                  </div>
                `;
              })()}

            </div>

            <!-- Modal Footer -->
            <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
              <button id="modal-start-new-session-btn" class="px-4 py-2.5 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer">
                + New Chat with Persona
              </button>
              <div class="flex items-center gap-2">
                <button id="modal-cancel-btn" class="px-4 py-2.5 rounded-2xl text-gray-500 hover:text-gray-700 font-semibold text-xs sm:text-sm cursor-pointer">
                  Cancel
                </button>
                <button id="modal-apply-settings-btn" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-sm shadow-indigo-500/30 cursor-pointer">
                  Apply to Current Chat
                </button>
              </div>
            </div>

          </div>
        </div>
      ` : ''}

      <!-- Fluency Analytics & Vocabulary Bank Dashboard Modal -->
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
          <div id="fluency-modal-backdrop" class="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div class="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 overflow-hidden">
              
              <!-- Modal Top Bar -->
              <div class="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl text-indigo-700">
                    📊
                  </div>
                  <div>
                    <h3 class="font-extrabold text-base sm:text-lg text-gray-900 leading-tight">Fluency & Vocabulary Dashboard</h3>
                    <p class="text-xs text-gray-500">Track streaks, accuracy rate, vocabulary deck, and CEFR milestones</p>
                  </div>
                </div>
                <button id="close-fluency-modal-btn" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 font-bold text-lg cursor-pointer">
                  ✕
                </button>
              </div>

              <!-- Dashboard Tabs Navigation -->
              <div class="px-4 sm:px-5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-2 overflow-x-auto">
                <button
                  data-fluency-tab="overview"
                  class="fluency-tab-btn py-3 px-3.5 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                    state.activeFluencyTab === 'overview'
                      ? 'border-indigo-600 text-indigo-600 bg-white/70'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }"
                >
                  <span>🔥 Streaks & Progress</span>
                </button>

                <button
                  data-fluency-tab="vocab"
                  class="fluency-tab-btn py-3 px-3.5 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                    state.activeFluencyTab === 'vocab'
                      ? 'border-indigo-600 text-indigo-600 bg-white/70'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }"
                >
                  <span>📖 Vocabulary Bank</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    state.activeFluencyTab === 'vocab' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                  }">
                    ${fluencyMetrics.savedVocabulary.length}
                  </span>
                </button>

                <button
                  data-fluency-tab="quiz"
                  class="fluency-tab-btn py-3 px-3.5 border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
                    state.activeFluencyTab === 'quiz'
                      ? 'border-indigo-600 text-indigo-600 bg-white/70'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }"
                >
                  <span>🃏 Practice Flashcards</span>
                </button>
              </div>

              <!-- Tab Body Content -->
              <div class="p-4 sm:p-6 overflow-y-auto max-h-[70vh] space-y-6">

                ${state.activeFluencyTab === 'overview' ? `
                  
                  <!-- 7-Day Consistency Heat Strip & Streak Banner -->
                  <div class="p-4 sm:p-5 bg-linear-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 rounded-3xl border border-amber-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5">
                      <div class="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-3xl shadow-lg shadow-amber-500/30 flex-shrink-0">
                        🔥
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <h4 class="text-xl font-extrabold text-gray-900">${fluencyMetrics.currentStreakDays} Day Streak!</h4>
                          <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Active Today</span>
                        </div>
                        <p class="text-xs text-gray-600 mt-0.5">Practice every day to maintain conversational retention and fluency rhythm.</p>
                      </div>
                    </div>

                    <!-- 7 Days Dot Strip -->
                    <div class="flex items-center gap-2">
                      ${last7.map(d => `
                        <div class="flex flex-col items-center gap-1">
                          <span class="text-[10px] font-semibold text-gray-500">${d.dayLabel}</span>
                          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                            d.isActive
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          } ${d.isToday ? 'ring-2 ring-amber-400 ring-offset-2' : ''}">
                            ${d.isActive ? '✓' : '·'}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Key Metric Cards Grid -->
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
                      <span class="text-gray-500 text-xs font-medium block">Total Sent</span>
                      <p class="text-2xl font-black text-gray-900">${fluencyMetrics.totalMessagesSent}</p>
                      <span class="text-[10px] text-indigo-600 font-semibold block">Messages</span>
                    </div>

                    <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
                      <span class="text-gray-500 text-xs font-medium block">Vocabulary</span>
                      <p class="text-2xl font-black text-gray-900">${fluencyMetrics.savedVocabulary.length}</p>
                      <span class="text-[10px] text-emerald-600 font-semibold block">Saved Words</span>
                    </div>

                    <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
                      <span class="text-gray-500 text-xs font-medium block">Grammar Score</span>
                      <p class="text-2xl font-black text-gray-900">${fluencyMetrics.accuracyRate}%</p>
                      <span class="text-[10px] text-amber-600 font-semibold block">Accuracy Rate</span>
                    </div>

                    <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-1">
                      <span class="text-gray-500 text-xs font-medium block">CEFR Level</span>
                      <p class="text-2xl font-black text-gray-900">${cefr.level}</p>
                      <span class="text-[10px] text-purple-600 font-semibold block">${cefr.title}</span>
                    </div>
                  </div>

                  <!-- CEFR Progression Milestone Bar -->
                  <div class="p-4 bg-white rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <div>
                        <span class="font-extrabold text-gray-900">${cefr.title}</span>
                        <span class="text-gray-500 ml-1.5">— ${cefr.description}</span>
                      </div>
                      <span class="font-bold text-indigo-600">${cefr.progressPercent}% to next tier</span>
                    </div>
                    <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full bg-linear-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500" style="width: ${cefr.progressPercent}%"></div>
                    </div>
                  </div>

                  <!-- Persona Practice Distribution -->
                  <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <h5 class="font-extrabold text-xs uppercase tracking-wider text-gray-700">
                      Practice Distribution Across Personas
                    </h5>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      ${PERSONAS.map(p => {
                        const count = (fluencyMetrics.personaUsageCount && fluencyMetrics.personaUsageCount[p.id]) || 0;
                        return `
                          <div class="p-2.5 bg-white rounded-xl border border-gray-200/80 flex items-center gap-2">
                            <span class="text-xl">${p.avatar}</span>
                            <div class="min-w-0 flex-grow">
                              <p class="font-bold text-xs text-gray-900 truncate">${p.name}</p>
                              <p class="text-[10px] text-gray-500">${count} sessions</p>
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
                        class="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    </div>

                    <div class="flex items-center gap-1.5 w-full sm:w-auto text-xs">
                      ${[
                        { id: 'all', label: `All (${fluencyMetrics.savedVocabulary.length})` },
                        { id: 'learning', label: `Learning (${fluencyMetrics.savedVocabulary.filter(v => !v.mastered).length})` },
                        { id: 'mastered', label: `Mastered (${fluencyMetrics.savedVocabulary.filter(v => v.mastered).length})` }
                      ].map(filter => `
                        <button
                          data-vocab-filter="${filter.id}"
                          class="vocab-filter-btn px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                            state.vocabFilterStatus === filter.id
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }"
                        >
                          ${filter.label}
                        </button>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Vocab List -->
                  ${filteredVocab.length === 0 ? `
                    <div class="py-16 text-center text-gray-400 space-y-2">
                      <span class="text-3xl block">📖</span>
                      <p class="font-bold text-sm text-gray-700">No words found in this view.</p>
                      <p class="text-xs">Hover over foreign words in chat or check the breakdown tool to bookmark words!</p>
                    </div>
                  ` : `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      ${filteredVocab.map(item => `
                        <div class="p-3.5 bg-white rounded-2xl border border-gray-200 hover:border-indigo-200 transition-all shadow-2xs flex flex-col justify-between space-y-2">
                          <div>
                            <div class="flex items-start justify-between gap-2">
                              <div>
                                <span class="font-black text-lg text-gray-900 select-text">${escapeHtml(item.word)}</span>
                                ${item.transliteration ? `
                                  <span class="text-xs font-mono text-indigo-600 block">${escapeHtml(item.transliteration)}</span>
                                ` : ''}
                              </div>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.mastered
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }">
                                ${item.mastered ? '✓ Mastered' : 'Learning'}
                              </span>
                            </div>

                            <p class="text-xs text-gray-700 font-medium mt-1 leading-relaxed">
                              ${escapeHtml(item.translation)}
                            </p>

                            ${item.contextSentence ? `
                              <p class="text-[11px] text-gray-400 italic line-clamp-1 mt-1">
                                "${escapeHtml(item.contextSentence)}"
                              </p>
                            ` : ''}
                          </div>

                          <div class="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                            <span class="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-gray-600">
                              ${item.partOfSpeech || 'Word'} · ${item.languageName}
                            </span>
                            <div class="flex items-center gap-1.5">
                              <button
                                data-vocab-speak="${encodeURIComponent(item.word)}"
                                data-vocab-lang="${item.languageCode}"
                                class="vocab-speak-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-indigo-600 cursor-pointer"
                                title="Listen"
                              >
                                🔊
                              </button>
                              <button
                                data-vocab-toggle-mastered="${item.id}"
                                class="vocab-toggle-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-emerald-600 cursor-pointer"
                                title="Toggle Mastered"
                              >
                                ${item.mastered ? '⭐️' : '☆'}
                              </button>
                              <button
                                data-vocab-delete="${item.id}"
                                class="vocab-delete-btn p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer"
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
                    <div class="py-16 text-center text-gray-400 space-y-2">
                      <span class="text-3xl block">🃏</span>
                      <p class="font-bold text-sm text-gray-700">No vocabulary saved yet.</p>
                      <p class="text-xs">Save words during your chat to practice them here!</p>
                    </div>
                  ` : currentQuizItem ? `
                    <div class="max-w-md mx-auto space-y-4 text-center">
                      <div class="flex items-center justify-between text-xs text-gray-500 px-2">
                        <span>Card ${(state.quizCardIndex % quizItems.length) + 1} of ${quizItems.length}</span>
                        <span class="font-bold text-indigo-600">${currentQuizItem.languageName}</span>
                      </div>

                      <!-- Interactive Flip Card -->
                      <div
                        id="flashcard-card"
                        class="p-8 bg-linear-to-b from-white to-indigo-50/40 rounded-3xl border-2 border-indigo-100 shadow-xl cursor-pointer min-h-[220px] flex flex-col items-center justify-center space-y-3 transition-transform hover:scale-[1.01]"
                        title="Click to flip card"
                      >
                        <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                          ${currentQuizItem.partOfSpeech || 'Word'}
                        </span>

                        <h3 class="text-3xl font-black text-gray-900 select-text">
                          ${escapeHtml(currentQuizItem.word)}
                        </h3>

                        ${currentQuizItem.transliteration ? `
                          <p class="text-sm font-mono text-indigo-600">${escapeHtml(currentQuizItem.transliteration)}</p>
                        ` : ''}

                        ${state.quizShowAnswer ? `
                          <div class="pt-4 border-t border-indigo-200/60 w-full animate-in fade-in duration-200 space-y-1">
                            <p class="text-base font-bold text-emerald-800">${escapeHtml(currentQuizItem.translation)}</p>
                            ${currentQuizItem.contextSentence ? `
                              <p class="text-xs text-gray-500 italic">"${escapeHtml(currentQuizItem.contextSentence)}"</p>
                            ` : ''}
                          </div>
                        ` : `
                          <p class="text-xs text-gray-400 pt-3">Click anywhere on card to reveal meaning</p>
                        `}
                      </div>

                      <!-- Card Controls -->
                      <div class="flex items-center justify-center gap-3 pt-2">
                        <button
                          id="quiz-speak-btn"
                          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>🔊 Pronounce</span>
                        </button>
                        <button
                          id="quiz-toggle-mastered-btn"
                          class="px-4 py-2 ${
                            currentQuizItem.mastered
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          } rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>${currentQuizItem.mastered ? '✓ Mastered' : 'Mark as Mastered'}</span>
                        </button>
                        <button
                          id="quiz-next-btn"
                          class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Next Card →
                        </button>
                      </div>
                    </div>
                  ` : ''}

                `}

              </div>

              <!-- Modal Footer -->
              <div class="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span class="text-xs text-gray-500 font-medium">Daily practice is stored securely in your browser.</span>
                <button id="fluency-modal-done-btn" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer">
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

  // Header Navigation Switcher (Home vs Learn)
  document.getElementById('nav-home-btn')?.addEventListener('click', () => {
    state.activeView = 'home';
    renderApp();
  });

  document.getElementById('nav-chat-btn')?.addEventListener('click', () => {
    state.activeView = 'chat';
    renderApp();
  });

  document.getElementById('chat-back-home-btn')?.addEventListener('click', () => {
    state.activeView = 'home';
    renderApp();
  });

  // Header & Home Settings Gear Modal Triggers
  const openAppSettings = () => {
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

  document.getElementById('history-backdrop')?.addEventListener('click', () => {
    state.showHistoryDrawer = false;
    renderApp();
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

  // User Input Textarea Handlers
  const textarea = document.getElementById('user-input') as HTMLTextAreaElement;
  if (textarea) {
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

    textarea.addEventListener('input', (e) => {
      state.userInput = (e.target as HTMLTextAreaElement).value;
      const sendBtn = document.getElementById('send-message-btn');
      const checkBtn = document.getElementById('check-draft-grammar-btn');

      if (sendBtn) {
        if (state.userInput.trim() && !state.isTyping) {
          sendBtn.className = 'p-3.5 rounded-2xl transition-all flex-shrink-0 bg-indigo-600 text-white shadow-md shadow-indigo-500/30 hover:bg-indigo-700 cursor-pointer';
        } else {
          sendBtn.className = 'p-3.5 rounded-2xl transition-all flex-shrink-0 bg-gray-100 text-gray-400 cursor-not-allowed';
        }
      }

      if (checkBtn) {
        if (state.userInput.trim()) {
          checkBtn.className = 'p-3.5 rounded-2xl transition-all flex-shrink-0 cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-xs';
        } else {
          checkBtn.className = 'p-3.5 rounded-2xl transition-all flex-shrink-0 bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200';
        }
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
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
