import { GoogleGenAI } from '@google/genai';
import type { Language, Persona, Message, GrammarCorrectionResult, ToneStyle, DifficultyLevel, SentenceBreakdownResult, WordToken } from '../types.ts';

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim() === '') {
    return null;
  }
  return key.trim();
}

function getAI(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeJsonParse(text: string | undefined, fallback: any) {
  if (!text) return fallback;
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('JSON parse fallback triggered:', e);
    return fallback;
  }
}

// Low-demand, high-availability Gemini models:
// gemini-3.1-flash-lite is the fastest and most resilient against 503 high demand spikes.
const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash'
];

async function executeWithRetry<T>(apiKey: string, fn: (ai: GoogleGenAI, model: string) => Promise<T>): Promise<T> {
  const ai = getAI(apiKey);
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(ai, model);
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTemporary = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE') || msg.includes('429');
        
        if (isTemporary && attempt === 0) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        console.warn(`Model ${model} failed on attempt ${attempt + 1}:`, msg.slice(0, 100));
        break; // Move to next candidate model
      }
    }
  }

  let errorMsg = lastError?.message || 'Failed to generate response';
  try {
    const parsed = JSON.parse(errorMsg);
    if (parsed.error?.message) {
      errorMsg = parsed.error.message;
    }
  } catch (_) {}

  throw new Error(errorMsg);
}

export interface ChatOptions {
  tone?: ToneStyle;
  difficulty?: DifficultyLevel;
}

const TONE_INSTRUCTIONS: Record<ToneStyle, string> = {
  formal: `TONE & REGISTER: Strictly Formal, Respectful & Scholarly.
- Use high-register polite pronouns and honorifics (e.g., in Hindi/Sanskrit use 'आप' / 'भवान्/भवती' with respectful plural verb forms; in French use 'vous'; in Spanish use 'usted').
- Use grammatically elegant phrasing, complete standard syntax, and avoid colloquial contractions, street slang, or overly casual abbreviations.
- Maintain a courteous, dignified and scholarly demeanor.`,

  casual: `TONE & REGISTER: Casual, Relaxed & Modern Conversational.
- Speak naturally like a real friend or peer on the street.
- Use contemporary conversational phrases, friendly everyday idioms, informal pronouns (e.g., in Hindi 'तुम' or friendly 'यार'), and relaxed banter.
- Keep the dialogue upbeat, vibrant, and relatable.`,

  supportive: `TONE & REGISTER: Ultra-Supportive, Warm & Patient Peer Buddy.
- Be extremely encouraging, kind, empathetic, and positive.
- Celebrate the user's effort, use gentle validation, and keep the emotional tone uplifting and safe.
- Frame any correction gently so the learner never feels intimidated.`,

  professional: `TONE & REGISTER: Professional, Corporate & Business Poised.
- Use business-appropriate vocabulary, clear and efficient phrasing, and corporate courtesy.
- Focus on productivity, workplace collaboration, constructive discussion, and meeting etiquette.`,

  witty: `TONE & REGISTER: Playful, Witty & Entertaining.
- Add clever humor, friendly banter, playful analogies, and lively energy while maintaining respectful rapport.`
};

const DIFFICULTY_INSTRUCTIONS: Record<DifficultyLevel, string> = {
  beginner: `DIFFICULTY CALIBRATION: BEGINNER (CEFR A1-A2).
- Use simple high-frequency vocabulary, clear grammatical structures, and short sentences (1-2 clauses max).
- Avoid rare idioms, complex subjunctive moods, or heavily nested compound clauses.
- Focus on practical, foundational words that a beginner can easily parse and learn.`,

  intermediate: `DIFFICULTY CALIBRATION: INTERMEDIATE (CEFR B1-B2).
- Use natural everyday conversational fluency, common idiomatic expressions, varied sentence connectors, and standard grammatical diversity.
- Mix compound sentences and conversational idioms naturally without making them impenetrable.`,

  advanced: `DIFFICULTY CALIBRATION: ADVANCED (CEFR C1-C2).
- Use rich, sophisticated, and nuanced vocabulary, native-level idioms, stylistic flourishes, and complex syntactic structures.
- Challenge the learner with subtle distinctions in meaning, cultural references, and advanced grammar patterns.`
};

// Generates fallback responses in authentic script if API key is not yet set
function getFallbackChatResponse(language: Language, persona: Persona, userInput: string, tone: ToneStyle, difficulty: DifficultyLevel) {
  const code = language.code;
  let reply = "Hello! That was nicely said. Let's keep practicing!";
  let transl = "Hello! That was nicely said. Let's keep practicing!";

  if (persona.id === 'formal_teacher') {
    switch (code) {
      case 'hi':
        reply = `उत्तम प्रयास। आपका वाक्य व्याकरणिक दृष्टि से ध्यान देने योग्य है। क्या आप इसे और विस्तार देना चाहेंगे?`;
        transl = "(Uttam prayaas.) Excellent attempt. Your sentence is grammatically noteworthy. Would you like to expand further?";
        break;
      case 'es':
        reply = `Excelente esfuerzo. Su frase es digna de mención gramatical. ¿Desea profundizar en este tema?`;
        transl = "Excellent effort. Your sentence is noteworthy grammatically. Would you like to delve deeper into this topic?";
        break;
      default:
        reply = `Very good attempt. Your phrasing is clear and structured. What aspect of this topic shall we explore next?`;
        transl = `Very good attempt. Let us proceed with our formal study.`;
    }
  } else if (persona.id === 'casual_friend') {
    switch (code) {
      case 'hi':
        reply = `अरे वाह दोस्त! बिल्कुल सही बात कही। और बता, आगे क्या सोचा है?`;
        transl = "(Arre waah dost! Bilkul sahi baat kahi.) Hey awesome friend! Very nicely said. Tell me more, what's next?";
        break;
      case 'es':
        reply = `¡Qué bien amigo! Suena súper natural. ¿Qué más cuentas?`;
        transl = "So good friend! Sounds super natural. What else is new?";
        break;
      default:
        reply = `Nice one! That sounds super natural. What else is on your mind?`;
        transl = `Nice one! Let's keep chatting casually.`;
    }
  } else if (persona.id === 'language_buddy') {
    switch (code) {
      case 'hi':
        reply = `बहुत बढ़िया! मुझे आपकी बात बहुत पसंद आई। आप धीरे-धीरे बहुत अच्छा सीख रहे हैं! 🌟`;
        transl = "(Bahut badhiya!) Wonderful! I really liked what you said. You are learning so well step by step! 🌟";
        break;
      case 'es':
        reply = `¡Maravilloso trabajo! Me encantó lo que dijiste. ¡Estás progresando muchísimo! 🌟`;
        transl = "Wonderful work! I loved what you said. You are progressing so much! 🌟";
        break;
      default:
        reply = `Wonderful job! You're making great progress step by step. What should we try next? 🌟`;
        transl = `Wonderful job! Keep practicing with confidence.`;
    }
  } else {
    switch (code) {
      case 'hi':
        reply = `बहुत अच्छा प्रयास! "${userInput}" कहना एक अच्छा तरीका है। क्या आप इसके बारे में और कुछ बताना चाहेंगे?`;
        transl = "(Bahut accha prayaas!) Great attempt! Would you like to tell me more about this?";
        break;
      case 'sa':
        reply = `साधु! भवतः वाक्यम् उत्तमम् अस्ति। वयं अग्रे अपि संभाषणं कुर्मः।`;
        transl = "(Saadhu! Bhavatah vaakyam uttamam asti.) Well done! Your sentence is good. Let us converse further.";
        break;
      case 'ta':
        reply = `மிகவும் நன்று! நீங்கள் கூறியது அருமை. இதைப்பற்றி மேலும் பேசலாமா?`;
        transl = "(Migavum nandru!) Very good! What you said is nice. Shall we speak more about this?";
        break;
      case 'es':
        reply = `¡Muy bien dicho! Me gusta tu pronunciación y vocabulario. ¿Qué más te gustaría practicar?`;
        transl = "Very well said! I like your vocabulary. What else would you like to practice?";
        break;
      default:
        reply = `Great job! "${userInput}" is a wonderful contribution to our practice. Let's keep going!`;
        transl = `Great job! Let's continue practicing ${language.name}.`;
        break;
    }
  }

  return {
    content: reply,
    translation: transl,
    correction: null,
    explanation: null,
    modelUsed: 'preview-engine'
  };
}

export async function handleChatRequest(
  language: Language,
  persona: Persona,
  history: Message[],
  userInput: string,
  options?: ChatOptions
) {
  const activeTone: ToneStyle = options?.tone || persona.defaultTone || 'formal';
  const activeDifficulty: DifficultyLevel = options?.difficulty || persona.defaultDifficulty || 'intermediate';

  const apiKey = getApiKey();
  if (!apiKey) {
    return getFallbackChatResponse(language, persona, userInput, activeTone, activeDifficulty);
  }

  const toneRule = TONE_INSTRUCTIONS[activeTone] || TONE_INSTRUCTIONS.formal;
  const difficultyRule = DIFFICULTY_INSTRUCTIONS[activeDifficulty] || DIFFICULTY_INSTRUCTIONS.intermediate;

  const systemInstruction = `
    You are an authentic, engaging conversational language partner named "${persona.name}". 
    PERSONA SCENARIO: ${persona.scenario}
    TARGET LANGUAGE: ${language.name} (${language.nativeName}).
    ${language.script ? `NATIVE SCRIPT: ${language.script}. Write the response in authentic ${language.script} script.` : ''}
    
    ===============================
    PERSONA & TONE ADJUSTMENT:
    ${toneRule}
    
    DIFFICULTY LEVEL ADJUSTMENT:
    ${difficultyRule}
    ===============================
    
    CRITICAL RULES:
    1. Respond PRIMARILY in ${language.name} using its correct native script. For example:
       - Hindi, Sanskrit, Marathi: write in Devanagari script.
       - Tamil: write in Tamil script (தமிழ்).
       - Telugu: write in Telugu script (తెలుగు).
       - Kannada: write in Kannada script (ಕನ್ನಡ).
       - Malayalam: write in Malayalam script (മലയാളം).
       - Bengali: write in Bengali script (বাংলা).
       - Gujarati: write in Gujarati script (ગુજરાતી).
       - Punjabi: write in Gurmukhi script (ਪੰਜਾਬੀ).
       - Urdu: write in Nastaliq/Perso-Arabic script (اردو).
    2. Keep your conversational response tailored to the selected DIFFICULTY (${activeDifficulty}) and TONE (${activeTone}).
       - For Beginner: 1-2 concise, accessible sentences.
       - For Intermediate: 2-3 natural sentences with common idioms.
       - For Advanced: 2-4 rich, expressive sentences with nuanced vocabulary.
    3. If the user makes a grammar, vocabulary, or honorific mistake in ${language.name}, provide a constructive, supportive correction tailored to the persona.
    4. Maintain the persona role-play consistently.
    5. Your output MUST be a valid JSON object with the following schema:
       {
         "content": "Your conversational response in ${language.name} (in native script)",
         "translation": "English translation (for non-Latin scripts, include both Romanized pronunciation in parentheses and English meaning)",
         "correction": "Optional correction if the user made an error in their previous message (leave empty or null if no error)",
         "explanation": "Optional short, friendly explanation of why the correction was made (leave empty or null if no error)"
       }
  `;

  const contents = [
    ...(history || []).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user',
      parts: [{ text: userInput }]
    }
  ];

  return executeWithRetry(apiKey, async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: contents as any,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    const parsed = safeJsonParse(response.text, {
      content: "Hello! Let's continue practicing.",
      translation: "Hello! Let's continue practicing."
    });
    parsed.modelUsed = model;
    return parsed;
  });
}

export async function handleCorrectionRequest(language: Language, text: string): Promise<GrammarCorrectionResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      isCorrect: true,
      original: text,
      correction: text,
      explanation: 'Grammar analysis ready. (Configure GEMINI_API_KEY in secrets for deep AI syntax analysis).',
      highlightSegments: []
    };
  }

  const prompt = `
    You are an expert language teacher in ${language.name} (${language.nativeName}).
    Analyze the user's sentence for grammar, spelling, word choice, case endings, agreement, and natural phrasing:
    "${text}"

    CRITICAL REQUIREMENTS:
    - If the input is already correct, natural, or acceptable in ${language.name}:
      Set "isCorrect": true, "correction": "${text}", "explanation": "Grammatically accurate and natural!", "highlightSegments": []
    - If there are errors (grammar, gender/case agreement, spelling, awkward phrasing):
      Set "isCorrect": false
      "correction": the natural, correct sentence in ${language.name} (using authentic native script)
      "explanation": a short, encouraging English explanation (1-2 sentences)
      "highlightSegments": an array of specific mistake segments found in the input sentence:
        [
          {
            "errorText": "exact erroneous substring from input",
            "correctedText": "corrected replacement for this segment",
            "reason": "short explanation for this specific part"
          }
        ]

    Output strictly a JSON object:
    {
      "isCorrect": boolean,
      "original": "${text}",
      "correction": string,
      "explanation": string,
      "highlightSegments": [
        {
          "errorText": string,
          "correctedText": string,
          "reason": string
        }
      ]
    }
  `;

  return executeWithRetry(apiKey, async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = safeJsonParse(response.text, null);
    if (!parsed) return null;

    return {
      isCorrect: Boolean(parsed.isCorrect),
      original: parsed.original || text,
      correction: parsed.correction || text,
      explanation: parsed.explanation || '',
      highlightSegments: Array.isArray(parsed.highlightSegments) ? parsed.highlightSegments : []
    };
  });
}

function getFallbackBreakdown(language: Language, sentence: string): SentenceBreakdownResult {
  // Simple token splitting for fallback
  const rawWords = sentence
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'?!।॥]/g, ' ')
    .split(/\s+/)
    .filter(w => w.trim().length > 0);

  const tokens: WordToken[] = rawWords.map((word, idx) => {
    return {
      surface: word,
      lemma: word,
      transliteration: word,
      partOfSpeech: idx === 0 ? 'Noun/Subject' : (idx === rawWords.length - 1 ? 'Verb/Predicate' : 'Particle/Modifier'),
      meaning: `Word '${word}' in ${language.name}`,
      grammaticalRole: idx === 0 ? 'Clause Agent / Subject' : 'Predicate phrase component'
    };
  });

  return {
    sentence,
    literalTranslation: `Literal reading of: "${sentence}"`,
    naturalTranslation: `Natural translation of: "${sentence}" in ${language.name}`,
    clauseStructure: [
      {
        clause: sentence,
        type: 'main',
        function: 'Principal declarative statement'
      }
    ],
    tokens,
    grammarNotes: [
      `Sentence follows standard syntactic word order for ${language.name}.`,
      `Grammatical alignment and honorific register configured for ${language.nativeName}.`
    ],
    registerAnalysis: {
      politenessLevel: 'Standard polite / contextual',
      tone: 'Conversational',
      appropriateness: 'Suitable for daily dialogue and learning practice'
    },
    alternativeExpressions: [
      {
        expression: sentence,
        register: 'formal',
        explanation: 'Standard formal variant suitable for study or writing.'
      },
      {
        expression: sentence,
        register: 'casual',
        explanation: 'Everyday spoken phrasing for friendly chat.'
      }
    ]
  };
}

export async function handleGrammarBreakdown(
  language: Language,
  sentence: string,
  persona?: Persona
): Promise<SentenceBreakdownResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return getFallbackBreakdown(language, sentence);
  }

  const prompt = `
    You are an expert computational linguist, philologist, and language teacher for ${language.name} (${language.nativeName}).
    Analyze this sentence in ${language.name}:
    "${sentence}"
    ${persona ? `Context: Persona is "${persona.name}" with scenario: "${persona.scenario}".` : ''}

    Return a comprehensive, deep grammatical analysis strictly formatted as a JSON object:
    {
      "sentence": "${sentence}",
      "literalTranslation": "Detailed literal translation reflecting original structure",
      "naturalTranslation": "Natural, fluent English translation",
      "clauseStructure": [
        {
          "clause": "exact substring or clause",
          "type": "main" | "subordinate" | "relative" | "conditional" | "coordinate",
          "function": "Grammatical function (e.g. Main Predicate Clause, Adverbial Time Clause, Topic Phrase)"
        }
      ],
      "tokens": [
        {
          "surface": "word token as it appears in sentence",
          "lemma": "dictionary lemma / base root",
          "transliteration": "Romanization or phonetic spelling (e.g. Romaji for Japanese, Pinyin for Chinese, IAST for Sanskrit/Hindi/Indic, phonetic guide for European)",
          "partOfSpeech": "e.g. Proper Noun, Transitive Verb, Postposition, Case Marker, Adjective, Auxiliary",
          "meaning": "English meaning in this context",
          "grammaticalRole": "e.g. Nominative Agent, Accusative Direct Object, Imperfective Past, Honorific suffix"
        }
      ],
      "grammarNotes": [
        "1-3 critical linguistic insights regarding word order, verb conjugation, case markers, or sandhi/mutation"
      ],
      "registerAnalysis": {
        "politenessLevel": "e.g. High Honorific, Casual, Formal Standard",
        "tone": "e.g. Academic, Friendly, Business, Poetic",
        "appropriateness": "Where and when this phrasing should be used"
      },
      "alternativeExpressions": [
        {
          "expression": "Alternative phrasing in ${language.name}",
          "register": "casual" | "formal" | "poetic" | "business",
          "explanation": "Why or when to use this alternative expression"
        }
      ]
    }
  `;

  return executeWithRetry(apiKey, async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = safeJsonParse(response.text, null);
    if (!parsed) {
      return getFallbackBreakdown(language, sentence);
    }

    return {
      sentence: parsed.sentence || sentence,
      literalTranslation: parsed.literalTranslation || sentence,
      naturalTranslation: parsed.naturalTranslation || sentence,
      clauseStructure: Array.isArray(parsed.clauseStructure) ? parsed.clauseStructure : [],
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
      grammarNotes: Array.isArray(parsed.grammarNotes) ? parsed.grammarNotes : [],
      registerAnalysis: parsed.registerAnalysis || {
        politenessLevel: 'Standard',
        tone: 'Conversational',
        appropriateness: 'General use'
      },
      alternativeExpressions: Array.isArray(parsed.alternativeExpressions) ? parsed.alternativeExpressions : []
    };
  });
}

export async function handleWordLookup(
  language: Language,
  word: string,
  contextSentence?: string
): Promise<WordToken> {
  const cleanWord = word.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'?!।॥]/g, '');
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      surface: cleanWord,
      lemma: cleanWord,
      transliteration: cleanWord,
      partOfSpeech: 'Word',
      meaning: `Translation of '${cleanWord}' in ${language.name}`,
      grammaticalRole: 'Lexical component'
    };
  }

  const prompt = `
    You are an expert lexicographer in ${language.name} (${language.nativeName}).
    Analyze this specific word: "${cleanWord}"
    ${contextSentence ? `Found in context sentence: "${contextSentence}"` : ''}

    Output strictly a JSON object:
    {
      "surface": "${cleanWord}",
      "lemma": "dictionary lemma / base form",
      "transliteration": "Romanized transliteration or phonetic guide (e.g. Romaji, Pinyin, IAST)",
      "partOfSpeech": "Part of speech (e.g. Noun, Verb, Adjective, Postposition, Particle)",
      "meaning": "Clear, contextual English meaning",
      "grammaticalRole": "Grammatical function in this context (e.g. Direct Object, Locative Case, Past Participle)"
    }
  `;

  return executeWithRetry(apiKey, async (ai, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = safeJsonParse(response.text, null);
    if (!parsed) {
      return {
        surface: cleanWord,
        lemma: cleanWord,
        transliteration: cleanWord,
        partOfSpeech: 'Word',
        meaning: `Definition of ${cleanWord}`,
        grammaticalRole: 'Contextual word'
      };
    }

    return {
      surface: parsed.surface || cleanWord,
      lemma: parsed.lemma || cleanWord,
      transliteration: parsed.transliteration || cleanWord,
      partOfSpeech: parsed.partOfSpeech || 'Word',
      meaning: parsed.meaning || '',
      grammaticalRole: parsed.grammaticalRole || ''
    };
  });
}

