export type LanguageCategory = 'all' | 'indian' | 'european' | 'asian' | 'other';

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  category: LanguageCategory;
  bcp47: string;
  script?: string;
  description?: string;
};

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type ToneStyle = 'formal' | 'casual' | 'supportive' | 'professional' | 'witty';

export type Persona = {
  id: string;
  name: string;
  description: string;
  avatar: string;
  scenario: string;
  initialMessage: string;
  defaultTone?: ToneStyle;
  defaultDifficulty?: DifficultyLevel;
  tagline?: string;
};

export type HighlightSegment = {
  errorText: string;
  correctedText: string;
  reason: string;
};

export type GrammarCorrectionResult = {
  isCorrect: boolean;
  original: string;
  correction: string;
  explanation: string;
  highlightSegments?: HighlightSegment[];
};

export type WordToken = {
  surface: string;
  lemma: string;
  transliteration?: string;
  partOfSpeech: string;
  meaning: string;
  grammaticalRole?: string;
};

export type ClauseItem = {
  clause: string;
  type: 'main' | 'subordinate' | 'relative' | 'conditional' | 'coordinate';
  function: string;
};

export type SentenceBreakdownResult = {
  sentence: string;
  literalTranslation: string;
  naturalTranslation: string;
  clauseStructure: ClauseItem[];
  tokens: WordToken[];
  grammarNotes: string[];
  registerAnalysis: {
    politenessLevel: string;
    tone: string;
    appropriateness: string;
  };
  alternativeExpressions: {
    expression: string;
    register: 'casual' | 'formal' | 'poetic' | 'business';
    explanation: string;
  }[];
};

export type SavedVocabularyItem = {
  id: string;
  word: string;
  lemma: string;
  transliteration?: string;
  translation: string;
  languageCode: string;
  languageName: string;
  partOfSpeech: string;
  contextSentence?: string;
  savedAt: number;
  mastered: boolean;
};

export type DailyActivityEntry = {
  date: string;
  messagesSent: number;
  wordsLearned: number;
};

export type FluencyMetrics = {
  currentStreakDays: number;
  longestStreakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  activeDates: string[];  // Array of YYYY-MM-DD active days
  totalMessagesSent: number;
  totalWordsLearned: number;
  grammarChecksCount: number;
  grammarCorrectCount: number;
  accuracyRate: number;   // 0 - 100 percentage
  savedVocabulary: SavedVocabularyItem[];
  personaUsageCount: Record<string, number>;
  dailyActivity: Record<string, DailyActivityEntry>;
};

export type UserFluencyMetrics = FluencyMetrics;

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transliteration?: string;
  translation?: string;
  correction?: string;
  explanation?: string;
  grammarFeedback?: GrammarCorrectionResult;
  checkingGrammar?: boolean;
  showFeedbackDetails?: boolean;
  breakdown?: SentenceBreakdownResult;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  language: Language;
  persona: Persona;
  difficulty?: DifficultyLevel;
  tone?: ToneStyle;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

export const LANGUAGES: Language[] = [
  // Indian Classical & Major Languages (User explicitly requested)
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'hi-IN',
    script: 'Devanagari',
    description: 'Widely spoken across India and the global diaspora'
  },
  {
    code: 'sa',
    name: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    flag: '🕉️',
    category: 'indian',
    bcp47: 'sa-IN',
    script: 'Devanagari',
    description: 'Classical sacred language of ancient Indian philosophy and literature'
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'ta-IN',
    script: 'Tamil',
    description: 'Ancient classical Dravidian language with rich literary history'
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'te-IN',
    script: 'Telugu',
    description: 'Dravidian language known as the "Italian of the East"'
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'kn-IN',
    script: 'Kannada',
    description: 'Classical language of Karnataka with profound literary tradition'
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'ml-IN',
    script: 'Malayalam',
    description: 'Classical language of Kerala known for palindrome scripts and culture'
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'bn-IN',
    script: 'Bengali',
    description: 'Language of Rabindranath Tagore, spoken in Bengal and Bangladesh'
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'mr-IN',
    script: 'Devanagari',
    description: 'Indo-Aryan language of Maharashtra and vibrant arts'
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'gu-IN',
    script: 'Gujarati',
    description: 'Language of Mahatma Gandhi and vibrant commercial heritage'
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'pa-IN',
    script: 'Gurmukhi',
    description: 'Lively language of Punjab and global music cultures'
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇮🇳',
    category: 'indian',
    bcp47: 'ur-IN',
    script: 'Perso-Arabic',
    description: 'Poetic language celebrated for ghazals and polite etiquette'
  },

  // English & Major Global Languages
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🌐',
    category: 'european',
    bcp47: 'en-US',
    script: 'Latin',
    description: 'Global lingua franca for international communication & business'
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    category: 'european',
    bcp47: 'es-ES',
    script: 'Latin',
    description: 'Spoken across Spain, Latin America, and worldwide'
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    category: 'european',
    bcp47: 'fr-FR',
    script: 'Latin',
    description: 'Language of diplomacy, literature, and francophone nations'
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    category: 'european',
    bcp47: 'de-DE',
    script: 'Latin',
    description: 'Major language of central Europe, engineering, and philosophy'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    category: 'european',
    bcp47: 'it-IT',
    script: 'Latin',
    description: 'Melodic Romance language of art, gastronomy, and music'
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    category: 'european',
    bcp47: 'pt-BR',
    script: 'Latin',
    description: 'Global language of Brazil, Portugal, and lusophone Africa'
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    category: 'european',
    bcp47: 'ru-RU',
    script: 'Cyrillic',
    description: 'East Slavic language with deep literary classics'
  },

  // East Asian & Middle Eastern
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    category: 'asian',
    bcp47: 'ja-JP',
    script: 'Kanji / Kana',
    description: 'Language of Japan, rich in honorifics and cultural expressions'
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    category: 'asian',
    bcp47: 'ko-KR',
    script: 'Hangul',
    description: 'Language of the Korean peninsula with scientific Hangul script'
  },
  {
    code: 'zh',
    name: 'Chinese (Mandarin)',
    nativeName: '中文',
    flag: '🇨🇳',
    category: 'asian',
    bcp47: 'zh-CN',
    script: 'Simplified Hanzi',
    description: 'Most spoken first language globally with tonal phonology'
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    category: 'asian',
    bcp47: 'ar-SA',
    script: 'Arabic',
    description: 'Semitic language with rich poetry, spoken across Arab world'
  },
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    category: 'other',
    bcp47: 'tr-TR',
    script: 'Latin',
    description: 'Turkic language bridging Europe and Asia with vowel harmony'
  }
];

export const PERSONAS: Persona[] = [
  {
    id: 'formal_teacher',
    name: 'Formal Teacher',
    avatar: '👨‍🏫',
    tagline: 'Structured & Academic',
    description: 'Polite honorifics, structured grammar explanations, formal vocabulary, and rigorous pronunciation guidance.',
    scenario: 'You are a respected, scholarly language teacher. You maintain an encouraging yet polite and formal academic tone, using proper honorifics, clear grammatical explanations, and structured sentence construction.',
    defaultTone: 'formal',
    defaultDifficulty: 'intermediate',
    initialMessage: 'Welcome to our language class. Today we shall focus on structured, formal conversation. What topic shall we study?'
  },
  {
    id: 'casual_friend',
    name: 'Casual Friend',
    avatar: '😎',
    tagline: 'Colloquial & Relaxed',
    description: 'Everyday street slang, modern contractions, natural banter, hobbies, and chill conversational flow.',
    scenario: 'You are a close, easygoing friend catching up casually. You use natural modern conversational idioms, relaxed slang, friendly informal pronouns, and warm humor.',
    defaultTone: 'casual',
    defaultDifficulty: 'beginner',
    initialMessage: 'Hey there! What’s up? What are you up to today?'
  },
  {
    id: 'language_buddy',
    name: 'Language Buddy',
    avatar: '🤝',
    tagline: 'Patient & Encouraging',
    description: 'Gentle and empathetic peer learner. Simple vocabulary, high encouragement, and zero intimidation.',
    scenario: 'You are a patient, encouraging language learning buddy. You speak in simple, accessible sentences, celebrate every effort the user makes, and never make them feel intimidated.',
    defaultTone: 'supportive',
    defaultDifficulty: 'beginner',
    initialMessage: 'Hi friend! I am so excited to practice with you today. Don’t worry about making mistakes—let’s just have fun!'
  },
  {
    id: 'strict_grammarian',
    name: 'Strict Grammarian',
    avatar: '🧐',
    tagline: 'Precision & Syntax Master',
    description: 'Laser focus on case endings, verb conjugations, gender agreements, and impeccable syntax.',
    scenario: 'You are a sharp linguistic coach with high standards. You gently challenge the user to refine their syntax, tense consistency, and case endings.',
    defaultTone: 'formal',
    defaultDifficulty: 'advanced',
    initialMessage: 'Greetings. Let us refine your language precision. Construct your sentences with care, and I shall critique your syntax.'
  },
  {
    id: 'business_colleague',
    name: 'Professional Colleague',
    avatar: '💼',
    tagline: 'Corporate & Workplace',
    description: 'Business etiquette, workplace meetings, project presentations, formal emails, and negotiations.',
    scenario: 'You are a courteous, professional corporate colleague collaborating on a project. You converse with business etiquette and professional terminology.',
    defaultTone: 'professional',
    defaultDifficulty: 'intermediate',
    initialMessage: 'Good day! Thank you for scheduling time to connect. Shall we review our agenda or discuss today’s project?'
  },
  {
    id: 'cultural_storyteller',
    name: 'Cultural Storyteller',
    avatar: '🪔',
    tagline: 'Lore, Idioms & Folklore',
    description: 'Weaves traditional proverbs, folklore, mythological anecdotes, and cultural heritage into dialogue.',
    scenario: 'You are an expressive cultural storyteller who cherishes literature, proverbs, and folklore. You infuse rich cultural idioms and imagery into your speech.',
    defaultTone: 'supportive',
    defaultDifficulty: 'intermediate',
    initialMessage: 'Greetings! Every language holds the soul of a culture. Would you like to hear a proverb or tell me a story from your homeland?'
  },
  {
    id: 'travel_guide',
    name: 'Local Travel Guide',
    avatar: '🧭',
    tagline: 'Real-world City Explorer',
    description: 'Practical street navigation, ordering local street food, bargaining at markets, and discovering hidden spots.',
    scenario: 'You are a knowledgeable local city guide showing a visitor around town. You role-play street scenarios like ordering food, asking transit directions, and shopping.',
    defaultTone: 'casual',
    defaultDifficulty: 'beginner',
    initialMessage: 'Welcome to town! Where are you headed today? I can guide you to the best local food spots or historical landmarks!'
  },
  {
    id: 'philosopher',
    name: 'Classical Philosopher',
    avatar: '🏛️',
    tagline: 'Deep Reflections & Wisdom',
    description: 'Reflective discourse on ethics, ancient literature, the purpose of life, and contemplative philosophies.',
    scenario: 'You are a contemplative classical philosopher. You discuss life, ethics, literature, and wisdom with depth and poetic grace.',
    defaultTone: 'formal',
    defaultDifficulty: 'advanced',
    initialMessage: 'Greetings, fellow seeker of knowledge. What profound question or thought occupies your mind today?'
  },
  {
    id: 'barista',
    name: 'The Cozy Barista',
    avatar: '☕',
    tagline: 'Cafe & Daily Routine',
    description: 'Order beverages and snacks, discuss morning routines, and chat warmly over a coffee cup.',
    scenario: 'You are a warm, welcoming barista at a local cafe. The user is a customer looking to order and practice casual conversation.',
    defaultTone: 'casual',
    defaultDifficulty: 'beginner',
    initialMessage: 'Welcome! What can I get started for you today?'
  }
];

// Helper to look up persona by ID (supporting legacy aliases)
export function findPersonaById(id: string): Persona {
  const normalized = id.toLowerCase();
  if (normalized === 'tutor') return PERSONAS.find(p => p.id === 'formal_teacher')!;
  if (normalized === 'friend') return PERSONAS.find(p => p.id === 'casual_friend')!;
  if (normalized === 'traveler') return PERSONAS.find(p => p.id === 'travel_guide')!;
  if (normalized === 'interviewer') return PERSONAS.find(p => p.id === 'business_colleague')!;
  
  return PERSONAS.find(p => p.id === normalized) || PERSONAS[0];
}

// Localized initial greetings for authentic immersion
export function getLocalizedGreeting(personaId: string, language: Language): string {
  const code = language.code;
  const pId = personaId.toLowerCase();

  // 1. Formal Teacher / Tutor
  if (pId === 'formal_teacher' || pId === 'tutor') {
    switch (code) {
      case 'hi': return 'नमस्ते! भाषा कक्षा में आपका स्वागत है। आज हम किस व्याकरणिक या औपचारिक विषय का अध्ययन करेंगे? 👨‍🏫';
      case 'sa': return 'नमः! संस्कृतकक्षायां भवतः स्वागतम्। अद्य वयं कं विषयम् अधिकृत्य अभ्यासं कुर्मः? 👨‍🏫';
      case 'ta': return 'வணக்கம்! மொழிப் பயிற்சிக்கு வரவேற்கிறேன். இன்று எந்தத் தலைப்பைப் பற்றி முறையாக விவாதிக்கலாம்? 👨‍🏫';
      case 'te': return 'నమస్కారం! భాషా తరగతికి స్వాగతం. ఈరోజు మనం ఏ అంశంపై నిర్మాణాత్మక అభ్యాసం చేద్దాం? 👨‍🏫';
      case 'kn': return 'ನಮಸ್ಕಾರ! ತರಗತಿಗೆ ಸುಸ್ವಾಗತ. ಇಂದು ನಾವು ಯಾವ ವಿಷಯವನ್ನು ಕ್ರಮಬದ್ಧವಾಗಿ ಕಲಿಯೋಣ? 👨‍🏫';
      case 'ml': return 'നമസ്കാരം! ഭാഷാ ക്ലാസ്സിലേക്ക് സ്വാഗതം. ഇന്ന് ഏത് വിഷയത്തിലാണ് നാം പരിശീലിക്കേണ്ടത്? 👨‍🏫';
      case 'bn': return 'নমস্কার! ভাষা শিক্ষণ ক্লাসে আপনাকে স্বাগতম। আজ আমরা কোন বিষয় নিয়ে আলোচনা করব? 👨‍🏫';
      case 'mr': return 'नमस्कार! भाषा वर्गात आपले स्वागत आहे. आज आपण कोणत्या विषयाचा सविस्तर अभ्यास करूया? 👨‍🏫';
      case 'gu': return 'નમસ્તે! વર્ગખંડમાં આપનું સ્વાગત છે. આજે આપણે કયા વિષય પર વિધિવત અભ્યાસ કરીશું? 👨‍🏫';
      case 'pa': return 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਭਾਸ਼ਾ ਕਲਾਸ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਅੱਜ ਅਸੀਂ ਕਿਸ ਵਿਸ਼ੇ ਤੇ ਅਭਿਆਸ ਕਰਾਂਗੇ? 👨‍🏫';
      case 'ur': return 'آداب! زبان کی کلاس میں آپ کا خیر مقدم ہے۔ آج ہم کس موضوع پر مشق کریں گے؟ 👨‍🏫';
      case 'es': return '¡Buenos días! Bienvenido a nuestra sesión formal. ¿Qué tema gramatical o conversacional desea practicar hoy? 👨‍🏫';
      case 'fr': return 'Bonjour ! Bienvenue à notre cours de langue. Quel sujet aimeriez-vous aborder avec rigueur aujourd\'hui ? 👨‍🏫';
      case 'de': return 'Guten Tag! Willkommen zu unserer Unterrichtsstunde. Welches Thema möchten Sie heute vertiefen? 👨‍🏫';
      case 'it': return 'Buongiorno! Benvenuto alla lezione formale. Quale argomento desidera approfondire oggi? 👨‍🏫';
      case 'ja': return 'こんにちは。本日のレッスンへようこそ。どのようなテーマで学習を進めましょうか？ 👨‍🏫';
      case 'ko': return '안녕하세요! 수업에 오신 것을 환영합니다. 오늘 어떤 주제로 대화를 연습해 볼까요? 👨‍🏫';
      case 'zh': return '你好！欢迎来到语言课堂。今天你想系统练习哪个主题？ 👨‍🏫';
      case 'ar': return 'أهلاً بك في درسنا اللغوي. ما هو الموضوع الذي تود مناقشته بتعمق اليوم؟ 👨‍🏫';
      default: return 'Welcome to our language class. What topic shall we study with structured precision today? 👨‍🏫';
    }
  }

  // 2. Casual Friend
  if (pId === 'casual_friend' || pId === 'friend') {
    switch (code) {
      case 'hi': return 'अरे दोस्त! बहुत दिनों बाद मिले। हाल-चाल कैसा है? सब बढ़िया? 😎';
      case 'sa': return 'अये मित्र! चिरकालात् पश्चात् दृश्यते। भवान् कथम् अस्ति? 😎';
      case 'ta': return 'ஹே நண்பா! ரொம்ப நாளாச்சு பாத்து. எப்படி இருக்கீங்க? 😎';
      case 'te': return 'హాయ్ బావా! చాలా రోజుల తర్వాత కలిశాము. ఎలా ఉన్నావ్? 😎';
      case 'kn': return 'ಹೇ ಸ್ನೇಹಿತ! ನೋಡಿ ತುಂಬಾ ದಿನವಾಯಿತು. ಹೇಗಿದ್ದೀಯಾ? 😎';
      case 'ml': return 'ഹായ് അളിയാ! കണ്ടിട്ട് കുറേ നാളായി. എന്തൊക്കെയുണ്ട് വിശೇಷങ്ങൾ? 😎';
      case 'bn': return 'আরে বন্ধু! অনেক দিন পর দেখা। কেমন চলছে সব? 😎';
      case 'mr': return 'अरे मित्रा! खूप दिवसांनी भेटलो. काय मग, कसा आहेस? 😎';
      case 'gu': return 'અરે મિત્ર! ઘણા દિવસે મળ્યા. શું ચાલે છે? 😎';
      case 'pa': return 'ਕੀ ਹਾਲ ਹੈ ਦੋਸਤ! ਬੜੇ ਚਿਰਾਂ ਬਾਅਦ ਮਿਲੇ। ਸਭ ਠੀਕ-ਠਾਕ? 😎';
      case 'ur': return 'ارے دوست! بہت دنوں بعد ملاقات ہوئی۔ کیا چل رہا ہے آج کل؟ 😎';
      case 'es': return '¡Qué onda amigo! ¿Cómo va todo? ¿Qué planes tienes para hoy? 😎';
      case 'fr': return 'Salut mon pote ! Quoi de neuf ? Comment ça va depuis le temps ? 😎';
      case 'de': return 'Hey Kumpel! Wie läuft’s bei dir? Was gibt’s Neues? 😎';
      case 'it': return 'Ehi amico! Come va? Cosa fai di bello oggi? 😎';
      case 'ja': return 'やあ！最近どう？元気にしてた？ 😎';
      case 'ko': return '안녕 친구야! 요즘 어떻게 지내? 재밌는 일 있어? 😎';
      case 'zh': return '嗨朋友！好久不见，最近过得怎么样？ 😎';
      case 'ar': return 'أهلاً يا صديقي! كيف الأحوال؟ ما هي أخبارك اليوم؟ 😎';
      default: return 'Hey friend! How have you been? What’s going on today? 😎';
    }
  }

  // 3. Language Buddy
  if (pId === 'language_buddy') {
    switch (code) {
      case 'hi': return 'नमस्ते दोस्त! घबराने की कोई बात नहीं, गलतियाँ सीखने का हिस्सा हैं। आज क्या बोलना चाहोगे? 🤝';
      case 'sa': return 'नमः सखे! प्रमादाः शिक्षणस्य अङ्गमेव। अद्य किं सम्भाषितुम् इच्छसि? 🤝';
      case 'ta': return 'வணக்கம் நண்பா! தவறுகளைப் பற்றி கவலைப்படாதே, ஒன்றாகக் கற்போம். இன்று என்ன பேசலாம்? 🤝';
      case 'te': return 'నమస్కారం మిత్రమా! తప్పులు జరిగినా పర్లేదు, ధైర్యంగా ప్రాక్టీస్ చేద్దాం! 🤝';
      case 'kn': return 'ನಮಸ್ಕಾರ ಗೆಳೆಯ! ತಪ್ಪುಗಳ ಬಗ್ಗೆ ಚಿಂತೆ ಬೇಡ, ಧೈರ್ಯವಾಗಿ ಮಾತನಾಡೋಣ! 🤝';
      case 'ml': return 'നമസ്കാരം കൂട്ടുകാരാ! തെറ്റുകൾ സ്വാഭാവികമാണ്, നമുക്ക് സന്തോഷത്തോടെ പരിശീലിക്കാം! 🤝';
      case 'bn': return 'নমস্কার বন্ধু! ভুল নিয়ে একদম চিন্তা করবেন না, আমরা ধীরে ধীরে শিখব! 🤝';
      case 'mr': return 'नमस्कार मित्रा! चुकांची अजिबात काळजी करू नकोस, आपण मिळून मस्त शिकूया! 🤝';
      case 'es': return '¡Hola! No te preocupes por los errores, ¡aprenderemos juntos paso a paso! ¿De qué quieres hablar? 🤝';
      case 'fr': return 'Coucou ! Ne t’inquiète pas des erreurs, on est là pour progresser ensemble. De quoi as-tu envie de parler ? 🤝';
      case 'de': return 'Hallo! Keine Sorge wegen Fehlern, wir lernen Schritt für Schritt gemeinsam. Worüber möchtest du sprechen? 🤝';
      case 'it': return 'Ciao! Non preoccuparti degli errori, siamo qui per imparare insieme. Di cosa vuoi parlare? 🤝';
      case 'ja': return 'こんにちは！間違えても全然大丈夫。楽しく一緒に練習しましょう！ 🤝';
      case 'ko': return '안녕! 실수해도 괜찮아, 천천히 같이 연습해보자! 🤝';
      case 'zh': return '你好！不要怕犯错，一步一步来，我们一起快乐练习！ 🤝';
      case 'ar': return 'مرحباً يا رفيقي! لا تقلق بشأن الأخطاء، فالأخطاء هي طريق التعلم. عمّا تريد التحدث اليوم؟ 🤝';
      default: return 'Hi there! Don’t worry about mistakes—we will learn together step by step! What shall we talk about? 🤝';
    }
  }

  // 4. Strict Grammarian
  if (pId === 'strict_grammarian') {
    switch (code) {
      case 'hi': return 'अभिवादन। शुद्ध व्याकरण और वाक्य संरचना हमारी प्राथमिकता है। कृपया अपना वाक्य प्रस्तुत करें। 🧐';
      case 'sa': return 'अभिवादनम्। शुद्धव्याकरणम् एव अस्माकं मुख्यं लक्ष्यम्। कृपया वाक्यं वदतु। 🧐';
      case 'ta': return 'வணக்கம். தூய இலக்கணமும் வாக்கிய அமைப்பும் நமது இலக்கு. உங்கள் வாக்கியத்தைக் கூறுங்கள். 🧐';
      case 'es': return 'Saludos. La precisión gramatical y la concordancia sintáctica son esenciales. Presente su frase. 🧐';
      case 'fr': return 'Salutations. La rigueur grammaticale et la syntaxe exacte sont de mise. Veuillez vous exprimer. 🧐';
      case 'de': return 'Guten Tag. Grammatikalische Präzision und korrekte Syntax stehen an erster Stelle. Bitte beginnen Sie. 🧐';
      default: return 'Greetings. Precise grammar and syntax are our focus. Let us construct impeccable sentences together. 🧐';
    }
  }

  // 5. Professional Colleague / Interviewer
  if (pId === 'business_colleague' || pId === 'interviewer') {
    switch (code) {
      case 'hi': return 'नमस्कार। हमारी व्यावसायिक बैठक में आपका स्वागत है। क्या हम कार्यसूची या आज के प्रोजेक्ट पर चर्चा शुरू करें? 💼';
      case 'sa': return 'अद्य व्यावसायिकगोष्ठ्यां आगमनाय धन्यवादः। कार्यसूचीम् अधिकृत्य वदामः वा? 💼';
      case 'ta': return 'வணக்கம். இன்றைய அலுவலக சந்திப்பிற்கு நன்றி. திட்டப்பணி குறித்து விவாதிக்கலாமா? 💼';
      case 'es': return 'Estimado colega, un gusto saludarle. ¿Revisamos los puntos clave de nuestra agenda de trabajo? 💼';
      case 'fr': return 'Bonjour cher collègue. Merci pour votre temps. Pouvons-nous passer en revue les priorités du projet ? 💼';
      case 'de': return 'Guten Tag. Vielen Dank für Ihre Zeit. Sollen wir die Tagesordnung unseres Projekts besprechen? 💼';
      default: return 'Good day! Thank you for connecting. Shall we review our project agenda or discuss business matters? 💼';
    }
  }

  // 6. Cultural Storyteller
  if (pId === 'cultural_storyteller') {
    switch (code) {
      case 'hi': return 'प्रणाम! हर भाषा में सदियों की कहानियाँ, मुहावरे और लोकगाथाएँ छिपी हैं। क्या आप कोई कथा सुनना चाहेंगे? 🪔';
      case 'sa': return 'प्रणामः! अस्माकं भाषायां पौराणिकी कथाः सूक्तयश्च सन्ति। अद्य का कथा श्रोतव्या? 🪔';
      case 'ta': return 'வணக்கம்! நம் மொழியில் தொன்மையான கதைகளும் பழமொழிகளும் நிறைந்துள்ளன. இன்று என்ன கதை கேட்கலாம்? 🪔';
      case 'es': return '¡Saludos cordiales! Cada lengua guarda mitos y leyendas fascinantes. ¿Qué historia tradicional le gustaría descubrir? 🪔';
      case 'fr': return 'Bienvenue ! Chaque langue recèle des contes et proverbes séculaires. Aimeriez-vous entendre une légende ? 🪔';
      default: return 'Warm greetings! Every tongue carries timeless legends and folklore. Would you like to explore a traditional story or idiom? 🪔';
    }
  }

  // 7. Travel Guide / Traveler
  if (pId === 'travel_guide' || pId === 'traveler') {
    switch (code) {
      case 'hi': return 'नमस्ते! शहर में आपका स्वागत है। क्या आपको किसी प्रसिद्ध बाज़ार, दर्शनीय स्थल या स्ट्रीट फ़ूड तक का रास्ता जानना है? 🧭';
      case 'sa': return 'स्वागतम्! नगरे भवतः स्वागतम्। कुत्र गन्तुम् इच्छति भवान्? 🧭';
      case 'ta': return 'வணக்கம்! இந்த ஊருக்கு உங்களை வரவேற்கிறேன். எங்கு செல்ல வழிகாட்ட வேண்டும்? 🧭';
      case 'es': return '¡Bienvenido a la ciudad! ¿A dónde te gustaría ir hoy? ¡Te mostraré los mejores rincones y delicias locales! 🧭';
      case 'fr': return 'Bienvenue dans la ville ! Où souhaitez-vous vous rendre ? Je connais les meilleurs recoins et restos locaux ! 🧭';
      default: return 'Welcome to town! Where are you exploring today? I can guide you to the best local markets and spots! 🧭';
    }
  }

  // 8. Classical Philosopher
  if (pId === 'philosopher') {
    switch (code) {
      case 'hi': return 'प्रणाम विचारशील मित्र। जीवन, सत्य और ज्ञान के विषय में आज आपका क्या चिंतन है? 🏛️';
      case 'sa': return 'नमः तत्वजिज्ञासो! जीवनस्य रहस्यं दर्शनं च अधिकृत्य किं विचारयसि? 🏛️';
      case 'es': return 'Saludos, buscador de la verdad. ¿Qué cuestión ética o existencial ocupa su mente hoy? 🏛️';
      default: return 'Greetings, seeker of wisdom. What philosophical question or timeless thought occupies your mind today? 🏛️';
    }
  }

  // 9. Barista fallback
  switch (code) {
    case 'hi': return 'नमस्ते! हमारे कैफ़े में आपका स्वागत है। आज आप क्या लेना पसंद करेंगे? ☕';
    case 'sa': return 'नमः! अस्माकं उपाहारगृहे भवतः स्वागतम्। अद्य किं स्वीकरिष्यति? ☕';
    case 'ta': return 'வணக்கம்! எங்கள் காபி கடைக்கு உங்களை வரவேற்கிறோம். இன்று என்ன அருந்த விரும்புகிறீர்கள்? ☕';
    case 'es': return '¡Hola! Bienvenido a nuestra cafetería. ¿Qué te gustaría tomar hoy? ☕';
    case 'fr': return 'Bonjour ! Bienvenue dans notre café. Que puis-je vous servir aujourd\'hui ? ☕';
    default: return 'Welcome to the cafe! What can I get started for you today? ☕';
  }
}
