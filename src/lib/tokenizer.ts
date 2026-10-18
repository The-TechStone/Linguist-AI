import { Language, WordToken } from '../types';
import { getWordLookup } from './gemini';

// In-memory lexical lookup cache for snappy, instantaneous hover cards
const wordCache = new Map<string, WordToken>();

// Common transliterations / definitions for popular greeting/common words across languages
const COMMON_LEXICON: Record<string, { transliteration?: string; partOfSpeech?: string; meaning?: string }> = {
  // Hindi & Sanskrit
  'नमस्ते': { transliteration: 'Namaste', partOfSpeech: 'Interjection', meaning: 'Greetings / I bow to you' },
  'प्रणाम': { transliteration: 'Pranaam', partOfSpeech: 'Noun / Greeting', meaning: 'Respectful salutation' },
  'धन्यवाद': { transliteration: 'Dhanyavaad', partOfSpeech: 'Noun', meaning: 'Thank you / Gratitude' },
  'स्वागतम्': { transliteration: 'Swaagatam', partOfSpeech: 'Noun / Greeting', meaning: 'Welcome' },
  'कक्षा': { transliteration: 'Kakshaa', partOfSpeech: 'Noun', meaning: 'Classroom / Session' },
  'मित्र': { transliteration: 'Mitra', partOfSpeech: 'Noun', meaning: 'Friend / Companion' },
  'दोस्त': { transliteration: 'Dost', partOfSpeech: 'Noun', meaning: 'Friend (colloquial)' },
  'भाषा': { transliteration: 'Bhaashaa', partOfSpeech: 'Noun', meaning: 'Language' },
  'व्याकरण': { transliteration: 'Vyaakaran', partOfSpeech: 'Noun', meaning: 'Grammar' },
  'अभ्यास': { transliteration: 'Abhyaas', partOfSpeech: 'Noun', meaning: 'Practice / Exercise' },
  'सुप्रभात': { transliteration: 'Suprabhaat', partOfSpeech: 'Greeting', meaning: 'Good morning' },
  'साधु': { transliteration: 'Saadhu', partOfSpeech: 'Adverb / Particle', meaning: 'Well done / Righteous' },
  'उत्तम': { transliteration: 'Uttam', partOfSpeech: 'Adjective', meaning: 'Excellent / Supreme' },
  'वाक्य': { transliteration: 'Vaakya', partOfSpeech: 'Noun', meaning: 'Sentence' },
  'है': { transliteration: 'Hai', partOfSpeech: 'Auxiliary Verb', meaning: 'Is / Exists (singular)' },
  'हैं': { transliteration: 'Hain', partOfSpeech: 'Auxiliary Verb', meaning: 'Are / Exist (plural/honorific)' },
  'था': { transliteration: 'Thaa', partOfSpeech: 'Past Aux', meaning: 'Was (masculine)' },
  'थी': { transliteration: 'Thee', partOfSpeech: 'Past Aux', meaning: 'Was (feminine)' },
  'क्या': { transliteration: 'Kyaa', partOfSpeech: 'Interrogative', meaning: 'What / Question marker' },
  'आप': { transliteration: 'Aap', partOfSpeech: 'Pronoun', meaning: 'You (formal honorific)' },
  'तुम': { transliteration: 'Tum', partOfSpeech: 'Pronoun', meaning: 'You (informal / friendly)' },
  'मैं': { transliteration: 'Main', partOfSpeech: 'Pronoun', meaning: 'I / Me' },

  // Tamil
  'வணக்கம்': { transliteration: 'Vanakkam', partOfSpeech: 'Greeting', meaning: 'Greetings / Welcome' },
  'நன்றி': { transliteration: 'Nandri', partOfSpeech: 'Noun', meaning: 'Thank you' },
  'நண்பா': { transliteration: 'Nanbaa', partOfSpeech: 'Noun (vocative)', meaning: 'Friend' },

  // Telugu
  'నమస్కారం': { transliteration: 'Namaskaaram', partOfSpeech: 'Greeting', meaning: 'Greetings' },
  'ధన్యవాదాలు': { transliteration: 'Dhanyavaadaalu', partOfSpeech: 'Noun', meaning: 'Thank you' },

  // Spanish
  'hola': { transliteration: 'OH-lah', partOfSpeech: 'Interjection', meaning: 'Hello' },
  'gracias': { transliteration: 'GRAH-syahs', partOfSpeech: 'Noun', meaning: 'Thank you' },
  'amigo': { transliteration: 'ah-MEE-goh', partOfSpeech: 'Noun', meaning: 'Friend' },
  'bienvenido': { transliteration: 'byen-beh-NEE-doh', partOfSpeech: 'Adjective', meaning: 'Welcome' },

  // French
  'bonjour': { transliteration: 'bohn-ZHOOR', partOfSpeech: 'Greeting', meaning: 'Good day / Hello' },
  'merci': { transliteration: 'mair-SEE', partOfSpeech: 'Interjection', meaning: 'Thank you' },

  // Japanese
  'こんにちは': { transliteration: 'Konnichiwa', partOfSpeech: 'Greeting', meaning: 'Hello / Good afternoon' },
  'ありがとう': { transliteration: 'Arigatou', partOfSpeech: 'Interjection', meaning: 'Thank you' },

  // German
  'hallo': { transliteration: 'HAH-loh', partOfSpeech: 'Greeting', meaning: 'Hello' },
  'danke': { transliteration: 'DAHN-kuh', partOfSpeech: 'Interjection', meaning: 'Thank you' }
};

export interface TokenPart {
  text: string;
  isWord: boolean;
  cleanWord: string;
}

export function tokenizeSentence(text: string, langCode: string): TokenPart[] {
  if (!text) return [];

  // Match words vs non-word characters and whitespace
  // Unicode \p{L} matches any letter, \p{M} matches combining marks (essential for Indic matras), \p{N} matches numbers
  const regex = /([\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}\s]+|\s+)/gu;
  const parts: TokenPart[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const isWord = /[\p{L}\p{M}\p{N}]/u.test(raw);
    parts.push({
      text: raw,
      isWord,
      cleanWord: isWord ? raw.trim() : ''
    });
  }

  return parts;
}

export async function lookupWordToken(
  language: Language,
  word: string,
  contextSentence?: string,
  precomputedTokens?: WordToken[]
): Promise<WordToken> {
  const clean = word.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'?!।॥]/g, '');
  const cacheKey = `${language.code}:${clean.toLowerCase()}`;

  // 1. Check in-memory cache
  if (wordCache.has(cacheKey)) {
    return wordCache.get(cacheKey)!;
  }

  // 2. Check if precomputed breakdown tokens have this word
  if (precomputedTokens && precomputedTokens.length > 0) {
    const found = precomputedTokens.find(
      t => t.surface.toLowerCase() === clean.toLowerCase() || t.lemma.toLowerCase() === clean.toLowerCase()
    );
    if (found) {
      wordCache.set(cacheKey, found);
      return found;
    }
  }

  // 3. Check common local dictionary
  const common = COMMON_LEXICON[clean] || COMMON_LEXICON[clean.toLowerCase()];
  if (common) {
    const token: WordToken = {
      surface: clean,
      lemma: clean,
      transliteration: common.transliteration || clean,
      partOfSpeech: common.partOfSpeech || 'Word',
      meaning: common.meaning || `Meaning of '${clean}' in ${language.name}`,
      grammaticalRole: common.partOfSpeech || 'Lexical component'
    };
    wordCache.set(cacheKey, token);
    return token;
  }

  // 4. Query server /api/word-lookup
  try {
    const serverResult = await getWordLookup(language, clean, contextSentence);
    if (serverResult) {
      wordCache.set(cacheKey, serverResult);
      return serverResult;
    }
  } catch (e) {
    console.warn('Word lookup failed:', e);
  }

  // 5. Fallback token
  const fallback: WordToken = {
    surface: clean,
    lemma: clean,
    transliteration: clean,
    partOfSpeech: 'Word',
    meaning: `Meaning of '${clean}' in ${language.name}`,
    grammaticalRole: 'Lexical component'
  };
  wordCache.set(cacheKey, fallback);
  return fallback;
}

export function cacheTokensFromBreakdown(languageCode: string, tokens: WordToken[]) {
  if (!tokens || !Array.isArray(tokens)) return;
  for (const t of tokens) {
    if (t.surface) {
      wordCache.set(`${languageCode}:${t.surface.trim().toLowerCase()}`, t);
    }
    if (t.lemma) {
      wordCache.set(`${languageCode}:${t.lemma.trim().toLowerCase()}`, t);
    }
  }
}
