import { Language, Persona, Message } from '../types';

export interface SuggestionItem {
  text: string;
  translation: string;
  category: 'intro' | 'daily' | 'question' | 'deep' | 'grammar' | 'reply' | 'roleplay';
  tag?: string;
}

// Comprehensive database of rich, authentic conversational suggestions per language
export const SUGGESTIONS_BY_LANGUAGE: Record<string, SuggestionItem[]> = {
  hi: [
    // Hindi
    { text: 'नमस्ते! आज आपका दिन कैसा बीत रहा है?', translation: 'Hello! How is your day going?', category: 'intro', tag: 'Greeting' },
    { text: 'मुझे एक कप अदरक वाली गरमा-गरम चाय चाहिए।', translation: 'I would like a hot cup of ginger tea.', category: 'daily', tag: 'Cafe' },
    { text: 'क्या आप मुझे इस वाक्य का सही व्याकरण समझा सकते हैं?', translation: 'Could you explain the correct grammar of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'आज यहाँ का मौसम सचमुच बहुत सुहावना है।', translation: 'The weather here is really pleasant today.', category: 'daily', tag: 'Weather' },
    { text: 'आपके पसंदीदा लेखक या पसंदीदा किताब कौन सी है?', translation: 'Who is your favorite author or what is your favorite book?', category: 'deep', tag: 'Culture' },
    { text: 'क्या आप मुझे रोज़मर्रा की बोलचाल के मुहावरे सिखा सकते हैं?', translation: 'Can you teach me some everyday conversational idioms?', category: 'grammar', tag: 'Idioms' },
    { text: 'हाँ, मैं आपकी बात से पूरी तरह सहमत हूँ।', translation: 'Yes, I completely agree with your point.', category: 'reply', tag: 'Agreement' },
    { text: 'यह तो बहुत ही दिलचस्प बात है! और विस्तार से बताइए।', translation: 'That is very interesting! Please tell me more in detail.', category: 'reply', tag: 'Follow-up' },
    { text: 'कृपया मुझे नज़दीकी मेट्रो स्टेशन का रास्ता बता दीजिए।', translation: 'Please tell me the directions to the nearest metro station.', category: 'daily', tag: 'Travel' },
    { text: 'भारतीय व्यंजनों में आपकी सबसे प्रिय डिश कौन सी है?', translation: 'Which is your favorite dish in Indian cuisine?', category: 'daily', tag: 'Food' },
    { text: 'क्या हम आज एक काल्पनिक बाज़ार में मोलभाव का अभ्यास करें?', translation: 'Shall we practice bargaining in an imaginary bazaar today?', category: 'roleplay', tag: 'Roleplay' },
    { text: 'कृपया मुझे बताइए कि "तू", "तुम" और "आप" में क्या अंतर है?', translation: 'Please tell me the difference between "Tu", "Tum", and "Aap".', category: 'grammar', tag: 'Grammar' },
    { text: 'सप्ताहांत में आप आमतौर पर क्या करना पसंद करते हैं?', translation: 'What do you usually like to do on weekends?', category: 'deep', tag: 'Habits' },
    { text: 'मुझे हिंदी साहित्य और कविताएँ बहुत पसंद हैं।', translation: 'I really love Hindi literature and poetry.', category: 'intro', tag: 'Culture' },
    { text: 'नहीं, मेरा विचार इससे थोड़ा अलग है।', translation: 'No, my view is slightly different from this.', category: 'reply', tag: 'Opinion' },
    { text: 'क्या आप एक नया शब्द और उसका उदाहरण वाक्य सिखा सकते हैं?', translation: 'Can you teach me a new word and its example sentence?', category: 'grammar', tag: 'Vocab' },
    { text: 'यदि आपको दुनिया में कहीं भी यात्रा करने का मौका मिले, तो कहाँ जाएँगे?', translation: 'If you had the chance to travel anywhere in the world, where would you go?', category: 'deep', tag: 'Imagination' },
    { text: 'कृपया मेरी पिछली गलती को सुधारने में मदद करें।', translation: 'Please help me correct my previous mistake.', category: 'grammar', tag: 'Correction' }
  ],

  sa: [
    // Sanskrit
    { text: 'नमः सर्वेभ्यः! भवान् कथम् अस्ति?', translation: 'Greetings to all! How are you?', category: 'intro', tag: 'Greeting' },
    { text: 'भवतः शुभनाम किम्? मम नाम भाषाभ्यासी अस्ति।', translation: 'What is your auspicious name? My name is language learner.', category: 'intro', tag: 'Intro' },
    { text: 'अद्य वातावरणं रमणीयं सुखदं च वर्तते।', translation: 'Today the atmosphere is pleasant and delightful.', category: 'daily', tag: 'Weather' },
    { text: 'संस्कृतव्याकरणे सन्धेः नियमान् कृपया विवृणोतु।', translation: 'Please explain the rules of Sandhi in Sanskrit grammar.', category: 'grammar', tag: 'Grammar' },
    { text: 'अहं प्रतिदिनं भगवद्गीतायाः श्लोकं पठामि।', translation: 'I read verses of the Bhagavad Gita every day.', category: 'daily', tag: 'Daily' },
    { text: 'आम्, अहं भवता सह पूर्णतया सहमतः अस्मि।', translation: 'Yes, I completely agree with you.', category: 'reply', tag: 'Agreement' },
    { text: 'एतत् वचनम् अतीव ज्ञानवर्धकम् अस्ति! पुनः कथयतु।', translation: 'This statement is very informative! Please say more.', category: 'reply', tag: 'Insight' },
    { text: 'कालिदासस्य मेघदूत-काव्यस्य विषये किञ्चित् वदतु।', translation: 'Tell me something about Kalidasa\'s Meghaduta poem.', category: 'deep', tag: 'Literature' },
    { text: 'संस्कृतभाषायां सरलं सम्भाषणं कर्तुं इच्छामि।', translation: 'I wish to speak simple conversational Sanskrit.', category: 'intro', tag: 'Practice' },
    { text: 'सुभाषितम् एकं श्रावयतु येन मनः प्रसीदति।', translation: 'Recite a wise proverb (subhashita) that pleases the mind.', category: 'deep', tag: 'Wisdom' },
    { text: 'धातुरूपेषु लट्लकारस्य प्रयोगं दर्शयतु।', translation: 'Show me the usage of present tense (lat lakara) in verb roots.', category: 'grammar', tag: 'Grammar' },
    { text: 'पुस्तकालयः कुत्र वर्तते इति मार्गं प्रदर्शयतु।', translation: 'Where is the library located? Please show me the way.', category: 'daily', tag: 'Travel' }
  ],

  ta: [
    // Tamil
    { text: 'வணக்கம்! இன்று உங்கள் நாள் எப்படி செல்கிறது?', translation: 'Vanakkam! How is your day going today?', category: 'intro', tag: 'Greeting' },
    { text: 'எனக்கு ஒரு கப் சூடான பில்டர் காபி வேண்டும்.', translation: 'I would like a cup of hot filter coffee.', category: 'daily', tag: 'Cafe' },
    { text: 'இந்த வாக்கியத்தின் சரியான இலக்கணத்தை விளக்குவீர்களா?', translation: 'Could you explain the correct grammar of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'இன்று வானிலை மிகவும் அருமையாக உள்ளது.', translation: 'The weather is very wonderful today.', category: 'daily', tag: 'Weather' },
    { text: 'திருக்குறளில் உங்களுக்கு மிகவும் பிடித்த குறள் எது?', translation: 'Which is your favorite couplet in Thirukkural?', category: 'deep', tag: 'Literature' },
    { text: 'ஆம், உங்கள் கருத்தை நான் முழுமையாக ஏற்கிறேன்.', translation: 'Yes, I completely accept your opinion.', category: 'reply', tag: 'Agreement' },
    { text: 'இது மிகவும் சுவாரசியமான தகவல்! இன்னும் சொல்லுங்கள்.', translation: 'This is very interesting information! Tell me more.', category: 'reply', tag: 'Curious' },
    { text: 'அருகில் உள்ள இரயில் நிலையத்திற்கு எப்படி செல்வது?', translation: 'How to go to the nearby railway station?', category: 'daily', tag: 'Travel' },
    { text: 'தமிழ்நாட்டின் பாரம்பரிய உணவு வகைகள் பற்றி கூறுங்கள்.', translation: 'Tell me about the traditional food varieties of Tamil Nadu.', category: 'daily', tag: 'Food' },
    { text: 'பேச்சுத் தமிழுக்கும் எழுத்துத் தமிழுக்கும் உள்ள வேறுபாடு என்ன?', translation: 'What is the difference between spoken Tamil and written Tamil?', category: 'grammar', tag: 'Grammar' },
    { text: 'வார இறுதியில் நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?', translation: 'What do you like to do on weekends?', category: 'deep', tag: 'Habits' }
  ],

  te: [
    // Telugu
    { text: 'నమస్కారం! ఈ రోజు మీ దినచర్య ఎలా సాగుతోంది?', translation: 'Hello! How is your daily routine going today?', category: 'intro', tag: 'Greeting' },
    { text: 'నాకు ఒక కప్పు వేడివేడి కాఫీ దొరుకుతుందా?', translation: 'Could I get a cup of piping hot coffee?', category: 'daily', tag: 'Cafe' },
    { text: 'ఈ వాక్యం యొక్క సరైన వ్యాకరణాన్ని వివరించగలరా?', translation: 'Can you explain the correct grammar of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'ఈ రోజు వాతావరణం చాలా ఆహ్లాదకరంగా ఉంది.', translation: 'Today\'s weather is very pleasant.', category: 'daily', tag: 'Weather' },
    { text: 'మీకు అత్యంత ఇష్టమైన తెలుగు పుస్తకం లేదా కవి ఎవరు?', translation: 'Who is your most favorite Telugu book or poet?', category: 'deep', tag: 'Literature' },
    { text: 'అవును, నేను మీ ఆలోచనతో పూర్తిగా ఏకీభవిస్తున్నాను.', translation: 'Yes, I completely agree with your thought.', category: 'reply', tag: 'Agreement' },
    { text: 'ఇది చాలా ఆసక్తికరంగా ఉంది! దీని గురించి మరింత చెప్పండి.', translation: 'This is very interesting! Tell me more about it.', category: 'reply', tag: 'Follow-up' },
    { text: 'దగ్గరలోని బస్ స్టాప్ ఎక్కడ ఉందో దారి చూపగలరా?', translation: 'Can you show me the way to where the nearest bus stop is?', category: 'daily', tag: 'Travel' },
    { text: 'హైదరాబాదీ బిర్యానీ మరియు సంప్రదాయ వంటకాల గురించి చెప్పండి.', translation: 'Tell me about Hyderabadi biryani and traditional dishes.', category: 'daily', tag: 'Food' },
    { text: 'సాధారణ సంభాషణలలో వాడే కొన్ని ముఖ్యమైన సామెతలు నేర్పండి.', translation: 'Teach me some important proverbs used in casual conversations.', category: 'grammar', tag: 'Idioms' }
  ],

  kn: [
    // Kannada
    { text: 'ನಮಸ್ಕಾರ! ಈ ದಿನ ನಿಮ್ಮ ಕೆಲಸ ಹೇಗಿದೆ?', translation: 'Hello! How is your work going today?', category: 'intro', tag: 'Greeting' },
    { text: 'ನನಗೆ ಒಂದು ಕಪ್ ಬಿಸಿ ಫಿಲ್ಟರ್ ಕಾಫಿ ಬೇಕು.', translation: 'I want a cup of hot filter coffee.', category: 'daily', tag: 'Cafe' },
    { text: 'ಈ ವಾಕ್ಯದ ವ್ಯಾಕರಣ ರಚನೆಯನ್ನು ದಯವಿಟ್ಟು ವಿವರಿಸಿ.', translation: 'Please explain the grammatical structure of this sentence.', category: 'grammar', tag: 'Grammar' },
    { text: 'ಇಂದು ಬೆಂಗಳೂರಿನ ಹವಾಮಾನ ತಂಪಾಗಿದೆ ಮತ್ತು ಚೆನ್ನಾಗಿದೆ.', translation: 'Today Bengaluru\'s weather is cool and nice.', category: 'daily', tag: 'Weather' },
    { text: 'ಹೌದು, ನಿಮ್ಮ ಅಭಿಪ್ರಾಯ ಸರಿಯಾಗಿದೆ ಎಂದು ನನಗೆ ಅನಿಸುತ್ತದೆ.', translation: 'Yes, I feel your opinion is correct.', category: 'reply', tag: 'Agreement' },
    { text: 'ಇದು ಬಹಳ ಆಸಕ್ತಿಕರ ವಿಚಾರ! ಮತ್ತಷ್ಟು ವಿವರಣೆ ನೀಡಿ.', translation: 'This is a very interesting thought! Give more explanation.', category: 'reply', tag: 'Curious' },
    { text: 'ಹತ್ತಿರದ ಮೆಟ್ರೋ ನಿಲ್ದಾಣಕ್ಕೆ ಹೋಗುವ ಮಾರ್ಗ ತಿಳಿಸಿ.', translation: 'Tell me the route to go to the nearest metro station.', category: 'daily', tag: 'Travel' },
    { text: 'ಕರ್ನಾಟಕದ ಪ್ರಸಿದ್ಧ ಮೈಸೂರು ಪಾಕ್ ತಯಾರಿಸುವ ವಿಧಾನವೇನು?', translation: 'What is the recipe for Karnataka\'s famous Mysore Pak?', category: 'daily', tag: 'Food' },
    { text: 'ಕನ್ನಡ ಸಾಹಿತ್ಯದ ಜ್ಞಾನಪೀಠ ಪ್ರಶಸ್ತಿ ಪುರಸ್ಕೃತರ ಬಗ್ಗೆ ಹೇಳಿ.', translation: 'Tell me about Jnanpith awardees of Kannada literature.', category: 'deep', tag: 'Literature' }
  ],

  ml: [
    // Malayalam
    { text: 'നമസ്കാരം! ഇന്നത്തെ ദിവസം എങ്ങനെയുണ്ട്?', translation: 'Hello! How is your day today?', category: 'intro', tag: 'Greeting' },
    { text: 'എനിക്ക് ഒരു കപ്പ് ചൂട് ചായ തരുമോ?', translation: 'Will you give me a cup of hot tea?', category: 'daily', tag: 'Cafe' },
    { text: 'ഈ വാക്യത്തിന്റെ ശരിയായ വ്യാകരണം പറഞ്ഞു തരാമോ?', translation: 'Could you explain the correct grammar of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'ഇന്ന് നല്ല മഴയുള്ള സുന്ദരമായ അന്തരീക്ഷമാണ്.', translation: 'Today is a beautiful atmosphere with good rain.', category: 'daily', tag: 'Weather' },
    { text: 'അതെ, ഞാൻ നിങ്ങളുടെ അഭിപ്രായത്തോട് യോജിക്കുന്നു.', translation: 'Yes, I agree with your opinion.', category: 'reply', tag: 'Agreement' },
    { text: 'ഇത് വളരെ അത്ഭുതകരമായ കാര്യമാണ്! കൂടുതൽ പറയൂ.', translation: 'This is a very wonderful thing! Say more.', category: 'reply', tag: 'Follow-up' },
    { text: 'അടുത്തുള്ള റെയിൽവേ സ്റ്റേഷനിലേക്ക് എങ്ങനെ പോകാം?', translation: 'How can I go to the nearby railway station?', category: 'daily', tag: 'Travel' },
    { text: 'കേരളത്തിലെ ഓണസദ്യയെക്കുറിച്ച് വിവരിക്കാമോ?', translation: 'Can you describe the Onam feast of Kerala?', category: 'daily', tag: 'Culture' }
  ],

  bn: [
    // Bengali
    { text: 'নমস্কার! আজকের দিনটা কেমন কাটছে?', translation: 'Hello! How is your day going today?', category: 'intro', tag: 'Greeting' },
    { text: 'এক কাপ খাঁটি দুধ-চা খেলে বেশ ভালো হতো।', translation: 'A cup of authentic milk tea would be so nice.', category: 'daily', tag: 'Cafe' },
    { text: 'এই বাক্যটির ব্যাকরণগত গঠন একটু বুঝিয়ে বলবেন?', translation: 'Could you explain the grammatical structure of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'আজকের মিষ্টি রোদ আর আবহাওয়া সত্যিই চমৎকার।', translation: 'Today\'s sweet sunlight and weather are truly wonderful.', category: 'daily', tag: 'Weather' },
    { text: 'হ্যাঁ, আমি আপনার কথার সাথে পুরোপুরি একমত।', translation: 'Yes, I completely agree with your words.', category: 'reply', tag: 'Agreement' },
    { text: 'এটা তো দারুণ একটা প্রসঙ্গ! আরো খুলে বলুন।', translation: 'This is a fantastic topic! Tell me more openly.', category: 'reply', tag: 'Curious' },
    { text: 'রবীন্দ্রনাথ ঠাকুরের কোন কবিতা আপনার সবচেয়ে প্রিয়?', translation: 'Which poem of Rabindranath Tagore is your favorite?', category: 'deep', tag: 'Literature' },
    { text: 'কলকাতার মিষ্টি দই আর রসগোল্লার স্বাদ অতুলনীয়।', translation: 'The taste of Kolkata\'s sweet curd and rasgulla is incomparable.', category: 'daily', tag: 'Food' }
  ],

  mr: [
    // Marathi
    { text: 'नमस्कार! आजचा दिवस कसा चालू आहे?', translation: 'Hello! How is your day going today?', category: 'intro', tag: 'Greeting' },
    { text: 'मला एक कप वाफाळलेला गरमागरम चहा हवा आहे.', translation: 'I would like a steaming cup of hot tea.', category: 'daily', tag: 'Cafe' },
    { text: 'या वाक्याची व्याकरण रचना मला समजावून सांगाल का?', translation: 'Will you explain the grammatical structure of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'आजचे हवामान फारच आल्हाददायक आणि छान आहे.', translation: 'Today\'s weather is very pleasant and nice.', category: 'daily', tag: 'Weather' },
    { text: 'होय, मी तुमच्या मताशी पूर्णपणे सहमत आहे.', translation: 'Yes, I completely agree with your opinion.', category: 'reply', tag: 'Agreement' },
    { text: 'हा फारच विचार करायला लावणारा विषय आहे!', translation: 'This is a topic that really makes one think!', category: 'deep', tag: 'Opinion' },
    { text: 'जवळचे रेल्वे स्टेशन कुठल्या दिशेला आहे?', translation: 'In which direction is the nearest railway station?', category: 'daily', tag: 'Travel' },
    { text: 'महाराष्ट्रातील मिसळ पाव आणि पुरणपोळीबद्दल सांगा.', translation: 'Tell me about Maharashtra\'s Misal Pav and Puran Poli.', category: 'daily', tag: 'Food' }
  ],

  gu: [
    // Gujarati
    { text: 'નમસ્તે! આજે તમારો દિવસ કેવો રહ્યો?', translation: 'Hello! How has your day been today?', category: 'intro', tag: 'Greeting' },
    { text: 'મને એક કપ સરસ મસાલા ચા આપશો?', translation: 'Will you give me a cup of nice masala tea?', category: 'daily', tag: 'Cafe' },
    { text: 'આ વાક્યમાં વ્યાકરણની કોઈ ભૂલ છે કે નહીં?', translation: 'Is there any grammatical mistake in this sentence or not?', category: 'grammar', tag: 'Grammar' },
    { text: 'હા, હું તમારા વિચાર સાથે તદ્દન સંમત છું.', translation: 'Yes, I totally agree with your thought.', category: 'reply', tag: 'Agreement' },
    { text: 'ગુજરાતના ગરબા અને નવરાત્રી ઉત્સવ વિશે કહો.', translation: 'Tell me about Gujarat\'s Garba and Navratri festival.', category: 'deep', tag: 'Culture' },
    { text: 'આજે સાંજનું જમવાનું શું બનાવવું જોઈએ?', translation: 'What should be cooked for dinner tonight?', category: 'daily', tag: 'Daily' }
  ],

  pa: [
    // Punjabi
    { text: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਤੁਹਾਡਾ ਕੀ ਹਾਲ-ਚਾਲ ਹੈ?', translation: 'Greetings! How are you doing?', category: 'intro', tag: 'Greeting' },
    { text: 'ਇੱਕ ਕੱਪ ਕੜਕ ਮਸਾਲਾ ਚਾਹ ਮਿਲ ਸਕਦੀ ਹੈ?', translation: 'Could I get a cup of strong masala tea?', category: 'daily', tag: 'Cafe' },
    { text: 'ਕੀ ਤੁਸੀਂ ਇਸ ਵਾਕ ਦੀ ਵਿਆਕਰਣ ਠੀਕ ਕਰ ਸਕਦੇ ਹੋ?', translation: 'Can you correct the grammar of this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'ਹਾਂਜੀ, ਮੈਂ ਤੁਹਾਡੀ ਗੱਲ ਨਾਲ ਬਿਲਕੁਲ ਸਹਿਮਤ ਹਾਂ।', translation: 'Yes, I completely agree with what you said.', category: 'reply', tag: 'Agreement' },
    { text: 'ਪੰਜਾਬ ਦੇ ਸੱਭਿਆਚਾਰ ਅਤੇ ਭੰਗੜੇ ਬਾਰੇ ਕੁਝ ਦੱਸੋ।', translation: 'Tell me something about Punjabi culture and Bhangra.', category: 'deep', tag: 'Culture' },
    { text: 'ਮੱਕੀ ਦੀ ਰੋਟੀ ਤੇ ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ ਮੇਰਾ ਮਨਪਸੰਦ ਹੈ।', translation: 'Corn roti and mustard greens are my favorite.', category: 'daily', tag: 'Food' }
  ],

  ur: [
    // Urdu
    { text: 'السلام علیکم! آپ کا دن کیسا گزر رہا ہے؟', translation: 'Peace be upon you! How is your day passing?', category: 'intro', tag: 'Greeting' },
    { text: 'ایک پیالی گرما گرم چائے مل سکتی ہے کیا؟', translation: 'Could I get a cup of hot tea please?', category: 'daily', tag: 'Cafe' },
    { text: 'کیا آپ مجھے اس جملے کی گرامر سمجھا سکتے ہیں؟', translation: 'Could you explain the grammar of this sentence to me?', category: 'grammar', tag: 'Grammar' },
    { text: 'مرزا غالب کا کوئی خوبصورت شعر سنائیے۔', translation: 'Recite a beautiful couplet by Mirza Ghalib.', category: 'deep', tag: 'Poetry' },
    { text: 'جی ہاں، میں آپ کے نقطہ نظر سے بالکل متفق ہوں۔', translation: 'Yes, I completely agree with your viewpoint.', category: 'reply', tag: 'Agreement' },
    { text: 'یہ گفتگو بہت معلوماتی ہے، مزید تفصیل بتائیے۔', translation: 'This conversation is very informative, please elaborate.', category: 'reply', tag: 'Insight' },
    { text: 'اردو زبان کی شیرینی اور ادب کے بارے میں بتائیں۔', translation: 'Tell me about the sweetness and literature of the Urdu language.', category: 'deep', tag: 'Culture' }
  ],

  es: [
    // Spanish
    { text: '¡Hola! ¿Qué tal va tu día hoy?', translation: 'Hello! How is your day going today?', category: 'intro', tag: 'Greeting' },
    { text: '¿Me pones un café con leche y una tostada, por favor?', translation: 'Could I have a coffee with milk and toast, please?', category: 'daily', tag: 'Cafe' },
    { text: '¿Podrías explicarme la diferencia entre "por" y "para"?', translation: 'Could you explain the difference between "por" and "para"?', category: 'grammar', tag: 'Grammar' },
    { text: '¡Hace un día soleado espectacular!', translation: 'It is a spectacularly sunny day!', category: 'daily', tag: 'Weather' },
    { text: 'Totalmente de acuerdo con lo que acabas de decir.', translation: 'Totally agree with what you just said.', category: 'reply', tag: 'Agreement' },
    { text: '¡Qué interesante! Cuéntame más detalles sobre eso.', translation: 'How interesting! Tell me more details about that.', category: 'reply', tag: 'Curious' },
    { text: '¿Cuál es tu plato típico hispano preferido?', translation: 'What is your favorite traditional Hispanic dish?', category: 'daily', tag: 'Food' },
    { text: '¿Cómo se llega al museo más cercano desde aquí?', translation: 'How do you get to the nearest museum from here?', category: 'daily', tag: 'Travel' },
    { text: '¿Puedes recomendarme una película o serie para aprender español?', translation: 'Can you recommend a movie or series to learn Spanish?', category: 'deep', tag: 'Media' },
    { text: 'Hagamos un juego de rol: eres un dependiente de tienda.', translation: 'Let\'s do a roleplay: you are a shop assistant.', category: 'roleplay', tag: 'Roleplay' },
    { text: '¿Cuándo se debe usar el modo subjuntivo exactamente?', translation: 'When exactly should the subjunctive mood be used?', category: 'grammar', tag: 'Grammar' }
  ],

  fr: [
    // French
    { text: 'Bonjour ! Comment se passe votre journée ?', translation: 'Hello! How is your day going?', category: 'intro', tag: 'Greeting' },
    { text: 'Un café noir et un croissant au beurre, s\'il vous plaît.', translation: 'A black coffee and a butter croissant, please.', category: 'daily', tag: 'Cafe' },
    { text: 'Pourriez-vous m\'expliquer l\'accord du participe passé ?', translation: 'Could you explain the agreement of the past participle to me?', category: 'grammar', tag: 'Grammar' },
    { text: 'Il fait un temps magnifique cet après-midi.', translation: 'The weather is magnificent this afternoon.', category: 'daily', tag: 'Weather' },
    { text: 'Je suis tout à fait d\'accord avec votre analyse.', translation: 'I completely agree with your analysis.', category: 'reply', tag: 'Agreement' },
    { text: 'C\'est fascinant ! Pouvez-vous m\'en dire un peu plus ?', translation: 'That\'s fascinating! Can you tell me a bit more?', category: 'reply', tag: 'Follow-up' },
    { text: 'Quelle est la spécialité culinaire française que vous préférez ?', translation: 'Which French culinary specialty do you prefer?', category: 'daily', tag: 'Food' },
    { text: 'Pourriez-vous m\'indiquer le chemin vers la station de métro ?', translation: 'Could you direct me towards the subway station?', category: 'daily', tag: 'Travel' },
    { text: 'Quels sont vos conseils pour améliorer ma prononciation du "R" ?', translation: 'What are your tips to improve my pronunciation of the "R"?', category: 'grammar', tag: 'Phonetics' },
    { text: 'Jouons un jeu de rôle : nous sommes dans une librairie parisienne.', translation: 'Let\'s roleplay: we are in a Parisian bookstore.', category: 'roleplay', tag: 'Roleplay' }
  ],

  de: [
    // German
    { text: 'Hallo! Wie läuft dein Tag bisher?', translation: 'Hello! How is your day going so far?', category: 'intro', tag: 'Greeting' },
    { text: 'Einen großen Cappuccino zum Mitnehmen, bitte.', translation: 'A large cappuccino to take away, please.', category: 'daily', tag: 'Cafe' },
    { text: 'Könntest du mir die vier Fälle (Kasus) kurz erklären?', translation: 'Could you briefly explain the four cases to me?', category: 'grammar', tag: 'Grammar' },
    { text: 'Das Wetter heute ist wirklich herrlich und sonnig.', translation: 'The weather today is truly wonderful and sunny.', category: 'daily', tag: 'Weather' },
    { text: 'Da stimme ich dir vollkommen zu!', translation: 'I completely agree with you on that!', category: 'reply', tag: 'Agreement' },
    { text: 'Das klingt sehr spannend. Erzähl mir mehr darüber.', translation: 'That sounds very exciting. Tell me more about it.', category: 'reply', tag: 'Curious' },
    { text: 'Entschuldigung, wie komme ich zum nächsten Bahnhof?', translation: 'Excuse me, how do I get to the nearest train station?', category: 'daily', tag: 'Travel' },
    { text: 'Was ist der Unterschied zwischen "kennen" und "wissen"?', translation: 'What is the difference between "kennen" and "wissen"?', category: 'grammar', tag: 'Grammar' },
    { text: 'Lass uns eine Debatte führen über Stadtleben versus Landleben.', translation: 'Let us have a debate about city life versus country life.', category: 'deep', tag: 'Debate' }
  ],

  it: [
    // Italian
    { text: 'Ciao! Come sta andando la tua giornata?', translation: 'Hello! How is your day going?', category: 'intro', tag: 'Greeting' },
    { text: 'Un espresso e una brioche alla crema, per favore.', translation: 'An espresso and a cream brioche, please.', category: 'daily', tag: 'Cafe' },
    { text: 'Mi spieghi quando usare il congiuntivo in italiano?', translation: 'Can you explain to me when to use the subjunctive in Italian?', category: 'grammar', tag: 'Grammar' },
    { text: 'Oggi c\'è un sole splendido e l\'aria è tiepida.', translation: 'Today there is wonderful sunshine and mild air.', category: 'daily', tag: 'Weather' },
    { text: 'Sono perfettamente d\'accordo con te.', translation: 'I am in complete agreement with you.', category: 'reply', tag: 'Agreement' },
    { text: 'Che meraviglia! Mi racconti qualcos\'altro?', translation: 'How wonderful! Will you tell me something more?', category: 'reply', tag: 'Curious' },
    { text: 'Qual è la tua ricetta preferita della cucina italiana?', translation: 'What is your favorite Italian recipe?', category: 'daily', tag: 'Food' },
    { text: 'Facciamo una conversazione come se fossimo in piazza a Roma.', translation: 'Let us converse as if we were in a square in Rome.', category: 'roleplay', tag: 'Roleplay' }
  ],

  pt: [
    // Portuguese
    { text: 'Olá! Como você está hoje?', translation: 'Hello! How are you today?', category: 'intro', tag: 'Greeting' },
    { text: 'Um café expresso e um pão de queijo, por favor.', translation: 'An espresso and a cheese bread, please.', category: 'daily', tag: 'Cafe' },
    { text: 'Pode me explicar a diferença entre "ser" e "estar"?', translation: 'Can you explain the difference between "ser" and "estar"?', category: 'grammar', tag: 'Grammar' },
    { text: 'O dia hoje está ensolarado e muito agradável.', translation: 'Today is sunny and very pleasant.', category: 'daily', tag: 'Weather' },
    { text: 'Concordo plenamente com o que você disse.', translation: 'I completely agree with what you said.', category: 'reply', tag: 'Agreement' },
    { text: 'Que interessante! Gostaria de saber mais a respeito.', translation: 'How interesting! I would like to know more about it.', category: 'reply', tag: 'Follow-up' },
    { text: 'Qual é o seu lugar favorito para viajar no Brasil?', translation: 'What is your favorite place to travel in Brazil?', category: 'deep', tag: 'Travel' }
  ],

  ru: [
    // Russian
    { text: 'Привет! Как твои дела сегодня?', translation: 'Hi! How are your things going today?', category: 'intro', tag: 'Greeting' },
    { text: 'Чашку горячего чая с лимоном, пожалуйста.', translation: 'A cup of hot tea with lemon, please.', category: 'daily', tag: 'Cafe' },
    { text: 'Объясните, пожалуйста, глаголы движения с приставками.', translation: 'Please explain verbs of motion with prefixes.', category: 'grammar', tag: 'Grammar' },
    { text: 'Сегодня на улице замечательная и свежая погода.', translation: 'Today outside the weather is wonderful and fresh.', category: 'daily', tag: 'Weather' },
    { text: 'Да, я полностью с вами согласен.', translation: 'Yes, I completely agree with you.', category: 'reply', tag: 'Agreement' },
    { text: 'Это очень любопытно! Расскажите поподробнее.', translation: 'That is very curious! Tell me in more detail.', category: 'reply', tag: 'Follow-up' },
    { text: 'Какое ваше любимое произведение русской литературы?', translation: 'What is your favorite work of Russian literature?', category: 'deep', tag: 'Literature' }
  ],

  ja: [
    // Japanese
    { text: 'こんにちは！今日はどんな一日を過ごしていますか？', translation: 'Hello! What kind of day are you having today?', category: 'intro', tag: 'Greeting' },
    { text: 'アイスコーヒーを一つ、店内でお願いします。', translation: 'One iced coffee, for here please.', category: 'daily', tag: 'Cafe' },
    { text: '助詞の「は」と「が」の使い分けを教えてください。', translation: 'Please teach me the difference in usage between particles "wa" and "ga".', category: 'grammar', tag: 'Grammar' },
    { text: '今日はとても気持ちのいい晴天ですね。', translation: 'Today is very pleasant and clear weather, isn\'t it?', category: 'daily', tag: 'Weather' },
    { text: 'はい、おっしゃる通りだと思います。', translation: 'Yes, I think it is just as you say.', category: 'reply', tag: 'Agreement' },
    { text: 'それはとても興味深いですね！もっと詳しく聞かせてください。', translation: 'That is very interesting! Please tell me more in detail.', category: 'reply', tag: 'Follow-up' },
    { text: '一番近い電車の駅はどちらですか？', translation: 'Which way is the closest train station?', category: 'daily', tag: 'Travel' },
    { text: 'おすすめの日本料理や和菓子は何ですか？', translation: 'What Japanese cuisine or wagashi sweets do you recommend?', category: 'daily', tag: 'Food' },
    { text: '居酒屋での注文のロールプレイをしてみましょう。', translation: 'Let us try a roleplay ordering at an izakaya pub.', category: 'roleplay', tag: 'Roleplay' },
    { text: '敬語（尊敬語・謙譲語・丁寧語）の練習をしたいです。', translation: 'I want to practice honorific speech (keigo).', category: 'grammar', tag: 'Keigo' }
  ],

  ko: [
    // Korean
    { text: '안녕하세요! 오늘 하루는 어떻게 보내고 계세요?', translation: 'Hello! How are you spending your day today?', category: 'intro', tag: 'Greeting' },
    { text: '따뜻한 아메리카노 한 잔 부탁드립니다.', translation: 'One warm Americano, please.', category: 'daily', tag: 'Cafe' },
    { text: '조사 "은/는"과 "이/가"의 차이점을 설명해 주실 수 있나요?', translation: 'Could you explain the difference between particles "eun/neun" and "i/ga"?', category: 'grammar', tag: 'Grammar' },
    { text: '오늘 날씨가 정말 화창하고 시원하네요.', translation: 'The weather today is truly sunny and crisp.', category: 'daily', tag: 'Weather' },
    { text: '네, 저도 그 의견에 전적으로 동의합니다.', translation: 'Yes, I also completely agree with that opinion.', category: 'reply', tag: 'Agreement' },
    { text: '정말 흥미로운 이야기네요! 조금 더 자세히 들려주세요.', translation: 'That\'s a really interesting story! Please tell me a bit more detail.', category: 'reply', tag: 'Curious' },
    { text: '가장 가까운 지하철역이 어디인지 알려주시겠어요?', translation: 'Would you let me know where the closest subway station is?', category: 'daily', tag: 'Travel' },
    { text: '가장 좋아하는 한국 음식이나 길거리 간식이 뭐예요?', translation: 'What is your favorite Korean food or street snack?', category: 'daily', tag: 'Food' },
    { text: '한국의 존댓말과 반말 규칙에 대해 연습하고 싶어요.', translation: 'I want to practice the rules of formal honorific vs casual speech in Korean.', category: 'grammar', tag: 'Honorifics' }
  ],

  zh: [
    // Mandarin Chinese
    { text: '你好！今天过得怎么样？', translation: 'Hello! How is your day going?', category: 'intro', tag: 'Greeting' },
    { text: '请给我一杯热美式咖啡，谢谢。', translation: 'Please give me a cup of hot Americano coffee, thank you.', category: 'daily', tag: 'Cafe' },
    { text: '你能给我讲讲“把”字句和“被”字句的用法吗？', translation: 'Can you explain the usage of "ba" and "bei" construction sentences to me?', category: 'grammar', tag: 'Grammar' },
    { text: '今天天气晴朗，微风习习，感觉很舒服。', translation: 'Today\'s weather is clear with a gentle breeze, feels very comfortable.', category: 'daily', tag: 'Weather' },
    { text: '是的，我非常赞同你的观点。', translation: 'Yes, I strongly agree with your point of view.', category: 'reply', tag: 'Agreement' },
    { text: '这个话题很有趣！能多跟我说一些吗？', translation: 'This topic is very intriguing! Can you tell me a bit more?', category: 'reply', tag: 'Curious' },
    { text: '请问最近的地铁站在哪里？', translation: 'Excuse me, where is the nearest metro station?', category: 'daily', tag: 'Travel' },
    { text: '你最喜欢的中国菜或者传统点心是什么？', translation: 'What is your favorite Chinese dish or traditional dim sum?', category: 'daily', tag: 'Food' },
    { text: '我们来模拟一下在中国餐馆点菜的场景吧。', translation: 'Let us simulate ordering food in a Chinese restaurant.', category: 'roleplay', tag: 'Roleplay' },
    { text: '请教我几个地道的中文日常成语。', translation: 'Please teach me a few authentic everyday Chinese idioms (chengyu).', category: 'grammar', tag: 'Idioms' }
  ],

  ar: [
    // Arabic
    { text: 'مرحباً! كيف تسير أمورك اليوم؟', translation: 'Hello! How are things going with you today?', category: 'intro', tag: 'Greeting' },
    { text: 'فنجان قهوة عربية بالهيل، من فضلك.', translation: 'A cup of Arabic coffee with cardamom, please.', category: 'daily', tag: 'Cafe' },
    { text: 'هل يمكنك أن تشرح لي قواعد الإعراب في هذه الجملة؟', translation: 'Could you explain the inflection rules (i\'rab) in this sentence?', category: 'grammar', tag: 'Grammar' },
    { text: 'نعم، أنا أتفق تماماً مع وجهة نظرك.', translation: 'Yes, I completely agree with your viewpoint.', category: 'reply', tag: 'Agreement' },
    { text: 'هذا موضوع شيق للغاية! حدثني بالمزيد.', translation: 'This is a very interesting topic! Tell me more.', category: 'reply', tag: 'Curious' },
    { text: 'ما هي مدينتك المفضلة في العالم العربي؟', translation: 'What is your favorite city in the Arab world?', category: 'deep', tag: 'Travel' },
    { text: 'علمني بعض الأمثال الشعبية العربية وحكمتها.', translation: 'Teach me some popular Arabic proverbs and their wisdom.', category: 'grammar', tag: 'Wisdom' }
  ],

  tr: [
    // Turkish
    { text: 'Merhaba! Günün nasıl geçiyor?', translation: 'Hello! How is your day going?', category: 'intro', tag: 'Greeting' },
    { text: 'Orta şekerli bir Türk kahvesi alabilir miyim, lütfen?', translation: 'Could I get a medium-sweet Turkish coffee, please?', category: 'daily', tag: 'Cafe' },
    { text: 'Türkçedeki ünlü uyumu kurallarını açıklayabilir misiniz?', translation: 'Can you explain the vowel harmony rules in Turkish?', category: 'grammar', tag: 'Grammar' },
    { text: 'Evet, söylediklerine kesinlikle katılıyorum.', translation: 'Yes, I definitely agree with what you said.', category: 'reply', tag: 'Agreement' },
    { text: 'Bu gerçekten çok ilginç! Biraz daha anlatır mısın?', translation: 'This is really very interesting! Will you tell a bit more?', category: 'reply', tag: 'Curious' },
    { text: 'En sevdiğin geleneksel Türk yemeği nedir?', translation: 'What is your favorite traditional Turkish dish?', category: 'daily', tag: 'Food' }
  ],

  en: [
    // English
    { text: 'Hello! How is your day shaping up?', translation: 'Greeting & check-in', category: 'intro', tag: 'Greeting' },
    { text: 'Could I get an oat milk latte to go, please?', translation: 'Cafe order phrase', category: 'daily', tag: 'Cafe' },
    { text: 'Could you explain the nuance between "affect" and "effect"?', translation: 'Grammar clarification', category: 'grammar', tag: 'Grammar' },
    { text: 'The weather outside is absolutely lovely today.', translation: 'Weather conversation', category: 'daily', tag: 'Weather' },
    { text: 'I completely agree with that perspective.', translation: 'Expressing agreement', category: 'reply', tag: 'Agreement' },
    { text: 'That is a thought-provoking idea! Tell me more.', translation: 'Encouraging elaboration', category: 'reply', tag: 'Insight' },
    { text: 'What is a book or film that profoundly changed how you think?', translation: 'Deep inquiry', category: 'deep', tag: 'Deep' },
    { text: 'Could you give me an example of how native speakers say this naturally?', translation: 'Natural phrasing check', category: 'grammar', tag: 'Fluency' },
    { text: 'Let\'s do a mock job interview or negotiation roleplay.', translation: 'Professional scenario', category: 'roleplay', tag: 'Roleplay' },
    { text: 'What are some colorful idioms used in everyday banter?', translation: 'Idiomatic expressions', category: 'grammar', tag: 'Idioms' },
    { text: 'I see your point, though I see another side to it as well.', translation: 'Polite counterpoint', category: 'reply', tag: 'Debate' }
  ]
};

// Persona-specific suggestion boosters to match persona character
export const PERSONA_SUGGESTION_BOOSTERS: Record<string, Record<string, SuggestionItem[]>> = {
  formal_teacher: {
    hi: [
      { text: 'आदरणीय गुरुजी, कृपया मुझे इस शब्द की व्युत्पत्ति बताइए।', translation: 'Respected teacher, please tell me the etymology of this word.', category: 'grammar', tag: 'Etymology' },
      { text: 'क्या आप मुझे वर्तमान और भूतकाल के कृदंत समझा सकते हैं?', translation: 'Can you explain present and past participles to me?', category: 'grammar', tag: 'Grammar' }
    ],
    es: [
      { text: 'Profesor, ¿podría corregir la concordancia de mi última frase?', translation: 'Teacher, could you correct the agreement of my last sentence?', category: 'grammar', tag: 'Correction' }
    ],
    fr: [
      { text: 'Professeur, quelle est la règle d\'usage du subjonctif imparfait ?', translation: 'Teacher, what is the rule of usage for imperfect subjunctive?', category: 'grammar', tag: 'Grammar' }
    ],
    ja: [
      { text: '先生、この文章の謙譲語の使い方は適切でしょうか？', translation: 'Sensei, is the humble speech usage in this sentence appropriate?', category: 'grammar', tag: 'Keigo' }
    ],
    en: [
      { text: 'Teacher, could you critique the structural syntax of my previous sentence?', translation: 'Formal academic inquiry', category: 'grammar', tag: 'Academic' }
    ]
  },
  casual_friend: {
    hi: [
      { text: 'अरे यार! आज शाम को क्या प्लान है?', translation: 'Hey buddy! What\'s the plan for this evening?', category: 'daily', tag: 'Slang' },
      { text: 'चलो कहीं बाहर चलकर कुछ चटपटा खाते हैं!', translation: 'Come on, let\'s go out and eat something spicy!', category: 'daily', tag: 'Food' }
    ],
    es: [
      { text: '¡Oye tío! ¿Qué planes tienes para este finde?', translation: 'Hey dude! What plans do you have for this weekend?', category: 'daily', tag: 'Slang' }
    ],
    fr: [
      { text: 'Coucou ! T\'as prévu quoi de beau ce soir ?', translation: 'Hey! What nice things do you have planned tonight?', category: 'daily', tag: 'Casual' }
    ],
    ja: [
      { text: 'ねえ、今週末何か面白いことする予定ある？', translation: 'Hey, do you have plans to do anything fun this weekend?', category: 'daily', tag: 'Casual' }
    ],
    en: [
      { text: 'Hey! Any fun plans lined up for the weekend?', translation: 'Casual weekend check-in', category: 'daily', tag: 'Casual' }
    ]
  },
  debate_partner: {
    hi: [
      { text: 'क्या आपको लगता है कि तकनीक इंसानों को अकेला बना रही है?', translation: 'Do you think technology is making humans lonely?', category: 'deep', tag: 'Debate' },
      { text: 'कला और विज्ञान में से समाज के लिए अधिक महत्वपूर्ण क्या है?', translation: 'Between art and science, which is more important for society?', category: 'deep', tag: 'Philosophy' }
    ],
    es: [
      { text: '¿Crees que la inteligencia artificial reemplazará la creatividad humana?', translation: 'Do you think AI will replace human creativity?', category: 'deep', tag: 'Debate' }
    ],
    en: [
      { text: 'Should societies prioritize rapid economic growth or environmental conservation?', translation: 'Philosophical dilemma', category: 'deep', tag: 'Debate' }
    ]
  }
};

/**
 * Dynamically picks and rotates 4 to 6 fresh suggestions based on language, persona, seed, and context.
 * As the user converses, the seed increments or context updates, ensuring suggestions constantly change!
 */
export function getDynamicSuggestions(
  language?: Language | null,
  persona?: Persona | null,
  lastAssistantMessage?: Message | null,
  seed = 0,
  count = 5
): SuggestionItem[] {
  const langCode = language?.code || 'en';
  
  // Base pool from language
  const basePool = SUGGESTIONS_BY_LANGUAGE[langCode] || SUGGESTIONS_BY_LANGUAGE['en'] || [];
  
  // Persona specific booster
  const personaBoosters = (persona && PERSONA_SUGGESTION_BOOSTERS[persona.id]?.[langCode]) || [];
  
  // Combine all available suggestions
  const fullPool = [...personaBoosters, ...basePool];
  if (fullPool.length === 0) {
    return [
      { text: 'Hello! How are you doing today?', translation: 'Greeting', category: 'intro' },
      { text: 'Could I get a coffee, please?', translation: 'Ordering food', category: 'daily' },
      { text: 'What is the weather like today?', translation: 'Daily check-in', category: 'daily' }
    ];
  }

  // If there's an assistant message ending in a question, prioritize contextual replies
  const isQuestion = lastAssistantMessage?.content && 
    (/[?？]\s*$/.test(lastAssistantMessage.content.trim()) || 
     lastAssistantMessage.content.includes('?') || 
     lastAssistantMessage.content.includes('？'));

  const replies = fullPool.filter(s => s.category === 'reply');
  const others = fullPool.filter(s => s.category !== 'reply');

  const selected: SuggestionItem[] = [];

  // If previous message was a question, pick 1 or 2 good replies first
  if (isQuestion && replies.length > 0) {
    const replyIdx = Math.abs(seed) % replies.length;
    selected.push(replies[replyIdx]);
    if (replies.length > 1 && count > 3) {
      selected.push(replies[(replyIdx + 1) % replies.length]);
    }
  }

  // Fill remaining slots rotating through the pool with pseudo-random deterministic stride based on seed
  const remainingCount = count - selected.length;
  const poolToUse = others.length >= remainingCount ? others : fullPool;

  const startIndex = (Math.abs(seed) * 3) % poolToUse.length;
  for (let i = 0; i < poolToUse.length && selected.length < count; i++) {
    const candidate = poolToUse[(startIndex + i) % poolToUse.length];
    if (!selected.some(s => s.text === candidate.text)) {
      selected.push(candidate);
    }
  }

  return selected;
}
