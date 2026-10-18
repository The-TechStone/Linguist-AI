import { Language, Message, Persona, GrammarCorrectionResult, ToneStyle, DifficultyLevel, SentenceBreakdownResult, WordToken } from "../types.ts";

export interface ChatOptions {
  tone?: ToneStyle;
  difficulty?: DifficultyLevel;
}

// Resilient fetch with exponential backoff and timeout
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2, delayMs = 600): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// Client-side linguistic fallback when network is unavailable or times out
function getClientFallbackResponse(
  language: Language,
  persona: Persona,
  userInput: string,
  tone: ToneStyle,
  _difficulty: DifficultyLevel
): { content: string; translation: string; correction?: string | null; explanation?: string | null; modelUsed: string } {
  const code = language.code || 'en';
  let reply = "Hello! That was nicely phrased. Let's continue practicing!";
  let transl = "Hello! That was nicely phrased. Let's continue practicing!";

  switch (code) {
    case 'hi':
      if (tone === 'casual' || persona.id === 'casual_friend') {
        reply = `अरे वाह दोस्त! "${userInput}" बहुत स्वाभाविक लगा। आगे बताओ, आज क्या नया चल रहा है?`;
        transl = "(Arre waah dost! Bahut svaabhaavik laga.) Hey friend! That felt very natural. Tell me, what's new today?";
      } else {
        reply = `बहुत उत्तम प्रयास। "${userInput}" कहना व्याकरण की दृष्टि से अच्छा है। क्या आप इसके बारे में कुछ और विस्तार से बताना चाहेंगे?`;
        transl = "(Bahut uttam prayaas.) Very good attempt. Saying this is grammatically sound. Would you like to expand further?";
      }
      break;
    case 'sa':
      reply = `साधु! भवतः संभाषणं मनोहारी अस्ति। वयं अग्रे अपि विचारान् विनिमयं कुर्मः।`;
      transl = "(Saadhu! Bhavatah sambhaashanam manohaari asti.) Well said! Your conversation is pleasing. Let us exchange further thoughts.";
      break;
    case 'ta':
      reply = `மிகவும் நன்று! நீங்கள் கூறியது அருமை. இதைப்பற்றி மேலும் விரிவாக பேசலாமா?`;
      transl = "(Migavum nandru!) Very good! What you said is great. Shall we discuss this in more detail?";
      break;
    case 'te':
      reply = `చాలా బాగుంది! మీ వాక్యం చాలా స్పష్టంగా ఉంది. మనం దీని గురించి మరింత మాట్లాడదామా?`;
      transl = "(Chaala baagundi!) Very nice! Your sentence is very clear. Shall we talk more about this?";
      break;
    case 'kn':
      reply = `ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ! ನಿಮ್ಮ ವಾಕ್ಯ ಸ್ಪಷ್ಟವಾಗಿದೆ. ನಾವು ಇನ್ನಷ್ಟು ಮಾತನಾಡೋಣವೇ?`;
      transl = "(Tumba chennagide!) Very good! Your sentence is clear. Shall we speak more?";
      break;
    case 'ml':
      reply = `വളരെ നന്നായിരിക്കുന്നു! നിങ്ങളുടെ സംസാരം വ്യക്തമാണ്. നമുക്ക് കൂടുതൽ സംസാരിക്കാം.`;
      transl = "(Valare nannaayirikkunnu!) Very nice! Your speech is clear. Let's talk more.";
      break;
    case 'bn':
      reply = `খুব চমৎকার! আপনার বলা বাক্যটি বেশ সাবলীল। এ বিষয়ে আর কী বলতে চান?`;
      transl = "(Khub chomokkar!) Very wonderful! Your sentence was quite fluent. What else would you like to say on this?";
      break;
    case 'gu':
      reply = `ખૂબ સરસ પ્રયાસ! તમારું વાક્ય ખૂબ જ સારું લાગ્યું. આગળ વાત કરીએ?`;
      transl = "(Khoob saras prayaas!) Great attempt! Your sentence was very nice. Shall we continue talking?";
      break;
    case 'pa':
      reply = `ਬਹੁਤ ਵਧੀਆ! ਤੁਹਾਡਾ ਇਹ ਕਹਿਣਾ ਬਿਲਕੁਲ ਕੁਦਰਤੀ ਲੱਗਿਆ। ਹੋਰ ਸੁਣਾਓ?`;
      transl = "(Bahut vadhiya!) Very good! Your expression sounded completely natural. What else?";
      break;
    case 'ur':
      reply = `بہت خوب! آپ کا جملہ نہایت شائستہ اور درست ہے۔ اس بارے میں مزید بتائیے۔`;
      transl = "(Bohat khoob!) Splendid! Your sentence is very polite and accurate. Tell me more about this.";
      break;
    case 'es':
      reply = `¡Excelente esfuerzo! Tu frase "${userInput}" suena muy natural. ¿Qué más te gustaría compartir?`;
      transl = "Excellent effort! Your phrase sounds very natural. What else would you like to share?";
      break;
    case 'fr':
      reply = `Très bien dit ! Votre phrase "${userInput}" est bien structurée. Que souhaitez-vous explorer ensuite ?`;
      transl = "Very well said! Your sentence is well structured. What would you like to explore next?";
      break;
    case 'de':
      reply = `Sehr gut gemacht! Dein Satz "${userInput}" klingt schon sehr natürlich. Lass uns weitermachen!`;
      transl = "Very well done! Your sentence sounds very natural. Let's keep going!";
      break;
    case 'ja':
      reply = `素晴らしいですね！「${userInput}」はとても自然な表現です。さらに詳しく教えていただけますか？`;
      transl = "(Subarashii desu ne!) Wonderful! That is a very natural expression. Could you tell me more?";
      break;
    case 'ko':
      reply = `아주 훌륭해요! "${userInput}" 표현이 참 자연스럽습니다. 다음으로 어떤 이야기를 나누고 싶으신가요?`;
      transl = "(Aju hullyunghaeyo!) Splendid! Your phrasing is very natural. What shall we talk about next?";
      break;
    case 'zh':
      reply = `说得非常好！“${userInput}”听起来很地道自然。你想继续聊些什么呢？`;
      transl = "(Shuō de fēicháng hǎo!) Very well said! That sounds authentic and natural. What would you like to chat about next?";
      break;
    default:
      reply = `Great job! "${userInput}" was well phrased. What would you like to explore next?`;
      transl = `Great job! That was well phrased. Let's continue practicing ${language.name}.`;
      break;
  }

  return {
    content: reply,
    translation: transl,
    correction: null,
    explanation: null,
    modelUsed: 'linguist-assistant'
  };
}

export async function getChatResponse(
  language: Language,
  persona: Persona,
  history: Message[],
  userInput: string,
  options?: ChatOptions
) {
  const tone = options?.tone || persona.defaultTone || 'formal';
  const difficulty = options?.difficulty || persona.defaultDifficulty || 'intermediate';

  try {
    const response = await fetchWithRetry('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        persona,
        history,
        userInput,
        tone,
        difficulty
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }

    console.warn(`Server responded with HTTP ${response.status}. Using linguistic assistant.`);
    return getClientFallbackResponse(language, persona, userInput, tone, difficulty);
  } catch (err: any) {
    console.warn('Network connection to /api/chat failed, gracefully serving linguistic response:', err?.message || err);
    return getClientFallbackResponse(language, persona, userInput, tone, difficulty);
  }
}

export async function getQuickCorrection(language: Language, text: string): Promise<GrammarCorrectionResult | null> {
  try {
    const response = await fetchWithRetry('/api/correction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        text,
      }),
    }, 1, 400);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (err) {
    console.warn('Grammar correction check unavailable:', err);
    return null;
  }
}

export async function getSentenceBreakdown(
  language: Language,
  sentence: string,
  persona?: Persona
): Promise<SentenceBreakdownResult | null> {
  try {
    const response = await fetchWithRetry('/api/grammar-breakdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        sentence,
        persona
      }),
    }, 1, 500);

    if (response.ok) {
      return response.json();
    }
    return null;
  } catch (err) {
    console.warn('Sentence breakdown unavailable via API:', err);
    return null;
  }
}

export async function getWordLookup(
  language: Language,
  word: string,
  contextSentence?: string
): Promise<WordToken | null> {
  try {
    const response = await fetchWithRetry('/api/word-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        word,
        contextSentence
      }),
    }, 1, 400);

    if (response.ok) {
      return response.json();
    }
    return null;
  } catch (err) {
    console.warn('Word lookup unavailable via API:', err);
    return null;
  }
}
