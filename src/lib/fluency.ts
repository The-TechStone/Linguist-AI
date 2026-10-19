import { FluencyMetrics, SavedVocabularyItem } from '../types';

const FLUENCY_STORAGE_KEY = 'linguist_fluency_metrics_v3';

export function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_METRICS: FluencyMetrics = {
  currentStreakDays: 1,
  longestStreakDays: 1,
  lastActiveDate: getTodayDateStr(),
  activeDates: [getTodayDateStr()],
  totalMessagesSent: 4,
  totalWordsLearned: 12,
  grammarChecksCount: 3,
  grammarCorrectCount: 3,
  accuracyRate: 100,
  savedVocabulary: [
    {
      id: 'vocab-init-1',
      word: 'नमस्ते',
      lemma: 'नमस्ते',
      transliteration: 'Namaste',
      translation: 'Hello / Greetings / I bow to you',
      languageCode: 'hi',
      languageName: 'Hindi',
      partOfSpeech: 'Interjection / Greeting',
      contextSentence: 'नमस्ते! भाषा कक्षा में आपका स्वागत है।',
      savedAt: Date.now() - 3600000,
      mastered: true
    },
    {
      id: 'vocab-init-2',
      word: 'धन्यवाद',
      lemma: 'धन्यवाद',
      transliteration: 'Dhanyavaad',
      translation: 'Thank you',
      languageCode: 'hi',
      languageName: 'Hindi',
      partOfSpeech: 'Noun / Expression',
      contextSentence: 'बहुत-बहुत धन्यवाद!',
      savedAt: Date.now() - 1800000,
      mastered: false
    }
  ],
  personaUsageCount: {
    formal_teacher: 3,
    casual_friend: 1
  },
  dailyActivity: {
    [getTodayDateStr()]: {
      date: getTodayDateStr(),
      messagesSent: 4,
      wordsLearned: 12
    }
  }
};

export function loadFluencyMetrics(): FluencyMetrics {
  try {
    const raw = localStorage.getItem(FLUENCY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.currentStreakDays === 'number') {
        return {
          ...DEFAULT_METRICS,
          ...parsed,
          longestStreakDays: typeof parsed.longestStreakDays === 'number'
            ? Math.max(parsed.longestStreakDays, parsed.currentStreakDays)
            : Math.max(1, parsed.currentStreakDays),
          activeDates: Array.isArray(parsed.activeDates) ? parsed.activeDates : [getTodayDateStr()],
          savedVocabulary: Array.isArray(parsed.savedVocabulary) ? parsed.savedVocabulary : [],
          personaUsageCount: parsed.personaUsageCount || {},
          dailyActivity: parsed.dailyActivity && typeof parsed.dailyActivity === 'object' ? parsed.dailyActivity : {}
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse fluency metrics from localStorage:', e);
  }

  saveFluencyMetrics(DEFAULT_METRICS);
  return { ...DEFAULT_METRICS };
}

export function saveFluencyMetrics(metrics: FluencyMetrics) {
  try {
    localStorage.setItem(FLUENCY_STORAGE_KEY, JSON.stringify(metrics));
  } catch (e) {
    console.warn('Failed to save fluency metrics:', e);
  }
}

export function recordMessageActivity(metrics: FluencyMetrics, personaId: string, wordCount: number) {
  const today = getTodayDateStr();
  const yesterday = getYesterdayDateStr();

  // Streak logic
  if (metrics.lastActiveDate === today) {
    // Already active today
  } else if (metrics.lastActiveDate === yesterday) {
    metrics.currentStreakDays += 1;
    metrics.lastActiveDate = today;
  } else {
    // Break in streak
    metrics.currentStreakDays = 1;
    metrics.lastActiveDate = today;
  }

  metrics.longestStreakDays = Math.max(metrics.longestStreakDays || 1, metrics.currentStreakDays);

  if (!metrics.activeDates.includes(today)) {
    metrics.activeDates.push(today);
  }

  const words = Math.max(1, wordCount);
  metrics.totalMessagesSent += 1;
  metrics.totalWordsLearned += words;

  metrics.dailyActivity = metrics.dailyActivity || {};
  const todayEntry = metrics.dailyActivity[today] || { date: today, messagesSent: 0, wordsLearned: 0 };
  todayEntry.messagesSent += 1;
  todayEntry.wordsLearned += words;
  metrics.dailyActivity[today] = todayEntry;

  // Persona usage
  metrics.personaUsageCount = metrics.personaUsageCount || {};
  metrics.personaUsageCount[personaId] = (metrics.personaUsageCount[personaId] || 0) + 1;

  saveFluencyMetrics(metrics);
}

export function recordGrammarAccuracy(metrics: FluencyMetrics, isCorrect: boolean) {
  metrics.grammarChecksCount = (metrics.grammarChecksCount || 0) + 1;
  if (isCorrect) {
    metrics.grammarCorrectCount = (metrics.grammarCorrectCount || 0) + 1;
  }
  metrics.accuracyRate = Math.round((metrics.grammarCorrectCount / metrics.grammarChecksCount) * 100);
  saveFluencyMetrics(metrics);
}

export function saveVocabularyWord(
  metrics: FluencyMetrics,
  item: {
    word: string;
    lemma?: string;
    transliteration?: string;
    translation: string;
    languageCode: string;
    languageName: string;
    partOfSpeech?: string;
    contextSentence?: string;
  }
): { added: boolean; item: SavedVocabularyItem } {
  const existing = metrics.savedVocabulary.find(
    v => v.word.trim().toLowerCase() === item.word.trim().toLowerCase() && v.languageCode === item.languageCode
  );

  if (existing) {
    return { added: false, item: existing };
  }

  const newItem: SavedVocabularyItem = {
    id: 'vocab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    word: item.word.trim(),
    lemma: item.lemma || item.word.trim(),
    transliteration: item.transliteration || item.word.trim(),
    translation: item.translation.trim(),
    languageCode: item.languageCode,
    languageName: item.languageName,
    partOfSpeech: item.partOfSpeech || 'Word',
    contextSentence: item.contextSentence,
    savedAt: Date.now(),
    mastered: false
  };

  metrics.savedVocabulary.unshift(newItem);
  saveFluencyMetrics(metrics);
  return { added: true, item: newItem };
}

export function removeVocabularyWord(metrics: FluencyMetrics, id: string) {
  metrics.savedVocabulary = metrics.savedVocabulary.filter(v => v.id !== id);
  saveFluencyMetrics(metrics);
}

export function toggleVocabularyMastered(metrics: FluencyMetrics, id: string) {
  const item = metrics.savedVocabulary.find(v => v.id === id);
  if (item) {
    item.mastered = !item.mastered;
    saveFluencyMetrics(metrics);
  }
}

export function computeCefrEstimate(metrics: FluencyMetrics): {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  title: string;
  description: string;
  progressPercent: number;
  nextMilestone: string;
} {
  const msgs = metrics.totalMessagesSent;
  const vocab = metrics.savedVocabulary.length;
  const score = msgs * 2 + vocab * 3;

  if (score < 25) {
    return {
      level: 'A1',
      title: 'Beginner (A1)',
      description: 'Understanding basic greetings, simple phrases, and foundational vocabulary.',
      progressPercent: Math.min(100, Math.round((score / 25) * 100)),
      nextMilestone: 'A2 Elementary'
    };
  } else if (score < 60) {
    return {
      level: 'A2',
      title: 'Elementary (A2)',
      description: 'Handling routine communication and everyday conversational exchanges.',
      progressPercent: Math.min(100, Math.round(((score - 25) / 35) * 100)),
      nextMilestone: 'B1 Intermediate'
    };
  } else if (score < 130) {
    return {
      level: 'B1',
      title: 'Intermediate (B1)',
      description: 'Expressing opinions, understanding travel and cultural dialogues naturally.',
      progressPercent: Math.min(100, Math.round(((score - 60) / 70) * 100)),
      nextMilestone: 'B2 Upper-Intermediate'
    };
  } else if (score < 240) {
    return {
      level: 'B2',
      title: 'Upper-Intermediate (B2)',
      description: 'Fluid dialogue with distinct AI personas and accurate grammar structures.',
      progressPercent: Math.min(100, Math.round(((score - 130) / 110) * 100)),
      nextMilestone: 'C1 Advanced'
    };
  } else if (score < 400) {
    return {
      level: 'C1',
      title: 'Advanced (C1)',
      description: 'Nuanced idioms, complex sentence clauses, and specialized registers.',
      progressPercent: Math.min(100, Math.round(((score - 240) / 160) * 100)),
      nextMilestone: 'C2 Mastery'
    };
  } else {
    return {
      level: 'C2',
      title: 'Mastery (C2)',
      description: 'Fluent, spontaneous expression matching native proficiency across all tones.',
      progressPercent: 100,
      nextMilestone: 'Native Mastery'
    };
  }
}

export function getLast7DaysActivity(activeDates: string[]): {
  dayLabel: string;
  dateStr: string;
  isActive: boolean;
  isToday: boolean;
}[] {
  const result: { dayLabel: string; dateStr: string; isActive: boolean; isToday: boolean }[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayLabel = d.toLocaleDateString([], { weekday: 'narrow' });
    const isToday = i === 0;
    const isActive = (activeDates || []).includes(dateStr);

    result.push({
      dayLabel,
      dateStr,
      isActive,
      isToday
    });
  }

  return result;
}

export function getLast7DaysDailyStats(metrics: FluencyMetrics): {
  date: string;
  label: string;
  messagesSent: number;
  wordsLearned: number;
}[] {
  const result: { date: string; label: string; messagesSent: number; wordsLearned: number }[] = [];
  const now = new Date();
  const dailyMap = metrics.dailyActivity || {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString([], { weekday: 'short' });
    const entry = dailyMap[dateStr];
    const isActiveInDates = (metrics.activeDates || []).includes(dateStr);

    result.push({
      date: dateStr,
      label,
      messagesSent: entry ? entry.messagesSent : (isActiveInDates ? 1 : 0),
      wordsLearned: entry ? entry.wordsLearned : (isActiveInDates ? 3 : 0)
    });
  }

  return result;
}
