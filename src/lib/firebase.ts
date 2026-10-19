import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LANGUAGES, PERSONAS, type ChatSession, type Message, type SavedVocabularyItem, type UserFluencyMetrics } from '../types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection verification at startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Sanitize IDs & string lengths to strictly match firebase-blueprint.json & firestore.rules
export function sanitizeId(raw: string): string {
  const cleaned = String(raw || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'item_' + Date.now();
}

function clampStr(val: string | undefined | null, maxLen: number): string {
  return String(val || '').slice(0, maxLen);
}

function clampNum(val: number | undefined | null, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && !Number.isNaN(val) ? val : fallback;
  return Math.max(min, Math.min(max, n));
}

export interface UserSettingsPreferences {
  theme: 'light' | 'dark' | 'system';
  speechRate: number;
  speechPitch: number;
  preferredVoiceURI: string;
  autoSpeak: boolean;
  defaultLanguageCode: string;
  defaultPersonaId: string;
}

export interface CloudUserState {
  metrics: UserFluencyMetrics;
  settings: UserSettingsPreferences;
  sessions: ChatSession[];
}

export async function signInWithGoogle(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged, type User };

// Load or initialize a signed-in user's complete state from Firestore
export async function loadOrInitUserCloudState(
  user: User,
  fallbackMetrics: UserFluencyMetrics,
  fallbackSettings: UserSettingsPreferences,
  fallbackSessions: ChatSession[]
): Promise<CloudUserState> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let metrics: UserFluencyMetrics = {
    currentStreakDays: fallbackMetrics.currentStreakDays,
    longestStreakDays: fallbackMetrics.longestStreakDays || fallbackMetrics.currentStreakDays || 1,
    lastActiveDate: fallbackMetrics.lastActiveDate || '',
    activeDates: Array.isArray(fallbackMetrics.activeDates) ? [...fallbackMetrics.activeDates] : [],
    totalMessagesSent: fallbackMetrics.totalMessagesSent || 0,
    totalWordsLearned: fallbackMetrics.totalWordsLearned || 0,
    grammarChecksCount: fallbackMetrics.grammarChecksCount || 0,
    grammarCorrectCount: fallbackMetrics.grammarCorrectCount || 0,
    accuracyRate: fallbackMetrics.accuracyRate ?? 100,
    savedVocabulary: [],
    personaUsageCount: { ...(fallbackMetrics.personaUsageCount || {}) },
    dailyActivity: {}
  };

  let settings: UserSettingsPreferences = { ...fallbackSettings };

  if (!snap.exists()) {
    const correctionsCount = Math.max(0, (metrics.grammarChecksCount || 0) - (metrics.grammarCorrectCount || 0));
    // Initialize new user profile document in Firestore
    const createPayload = {
      uid,
      displayName: clampStr(user.displayName || 'Language Learner', 120),
      email: clampStr(user.email || '', 200),
      photoURL: clampStr(user.photoURL || '', 1000),
      currentStreakDays: clampNum(metrics.currentStreakDays, 0, 100000, 1),
      longestStreakDays: clampNum(metrics.longestStreakDays, 0, 100000, 1),
      lastActiveDate: clampStr(metrics.lastActiveDate, 20),
      totalMessagesSent: clampNum(metrics.totalMessagesSent, 0, 10000000, 0),
      totalCorrectionsReceived: clampNum(correctionsCount, 0, 10000000, 0),
      accurateMessagesCount: clampNum(metrics.grammarCorrectCount, 0, 10000000, 0),
      theme: (['light', 'dark', 'system'].includes(settings.theme) ? settings.theme : 'light') as 'light' | 'dark' | 'system',
      speechRate: clampNum(settings.speechRate, 0.25, 2.5, 0.95),
      speechPitch: clampNum(settings.speechPitch, 0.25, 2.5, 1.0),
      preferredVoiceURI: clampStr(settings.preferredVoiceURI, 300),
      autoSpeak: Boolean(settings.autoSpeak),
      defaultLanguageCode: clampStr(settings.defaultLanguageCode || 'hi', 20),
      defaultPersonaId: clampStr(settings.defaultPersonaId || 'language_buddy', 60),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(userRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    // Seed initial fallback vocabulary and sessions for new cloud account
    for (const vocab of fallbackMetrics.savedVocabulary.slice(0, 30)) {
      await saveCloudVocabularyItem(uid, vocab);
    }
    for (const [dateKey, act] of Object.entries(fallbackMetrics.dailyActivity || {})) {
      await saveCloudDailyActivity(uid, dateKey, act.messagesSent, act.wordsLearned);
    }
    for (const sess of fallbackSessions.slice(0, 10)) {
      await saveCloudSessionWithMessages(uid, sess);
    }
  } else {
    const data = snap.data();
    metrics.currentStreakDays = typeof data.currentStreakDays === 'number' ? data.currentStreakDays : 1;
    metrics.longestStreakDays = typeof data.longestStreakDays === 'number' ? data.longestStreakDays : metrics.currentStreakDays;
    metrics.lastActiveDate = typeof data.lastActiveDate === 'string' ? data.lastActiveDate : '';
    metrics.totalMessagesSent = typeof data.totalMessagesSent === 'number' ? data.totalMessagesSent : 0;
    const corrections = typeof data.totalCorrectionsReceived === 'number' ? data.totalCorrectionsReceived : 0;
    const accurate = typeof data.accurateMessagesCount === 'number' ? data.accurateMessagesCount : 0;
    metrics.grammarCorrectCount = accurate;
    metrics.grammarChecksCount = accurate + corrections;
    metrics.accuracyRate = metrics.grammarChecksCount > 0
      ? Math.round((accurate / metrics.grammarChecksCount) * 100)
      : 100;

    settings = {
      theme: (data.theme === 'dark' || data.theme === 'system') ? data.theme : 'light',
      speechRate: typeof data.speechRate === 'number' ? data.speechRate : 0.95,
      speechPitch: typeof data.speechPitch === 'number' ? data.speechPitch : 1.0,
      preferredVoiceURI: typeof data.preferredVoiceURI === 'string' ? data.preferredVoiceURI : '',
      autoSpeak: typeof data.autoSpeak === 'boolean' ? data.autoSpeak : true,
      defaultLanguageCode: typeof data.defaultLanguageCode === 'string' ? data.defaultLanguageCode : 'hi',
      defaultPersonaId: typeof data.defaultPersonaId === 'string' ? data.defaultPersonaId : 'language_buddy'
    };
  }

  // Load Vocabulary Subcollection
  const vocabPath = `users/${uid}/vocabulary`;
  try {
    const vocabQuery = query(collection(db, vocabPath), where('userId', '==', uid));
    const vocabSnap = await getDocs(vocabQuery);
    const loadedVocab: SavedVocabularyItem[] = [];
    vocabSnap.forEach(d => {
      const v = d.data();
      loadedVocab.push({
        id: v.id,
        word: v.word,
        lemma: v.lemma || v.word,
        transliteration: v.transliteration || '',
        translation: v.translation || '',
        languageCode: v.languageCode || 'hi',
        languageName: v.languageName || 'Hindi',
        partOfSpeech: v.partOfSpeech || 'Word',
        contextSentence: v.contextSentence || '',
        savedAt: Date.now(),
        mastered: Boolean(v.mastered)
      });
    });
    metrics.savedVocabulary = loadedVocab;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, vocabPath);
  }

  // Load DailyActivity Subcollection
  const actPath = `users/${uid}/dailyActivity`;
  try {
    const actQuery = query(collection(db, actPath), where('userId', '==', uid));
    const actSnap = await getDocs(actQuery);
    actSnap.forEach(d => {
      const a = d.data();
      if (a.dateKey) {
        metrics.dailyActivity[a.dateKey] = {
          date: a.dateKey,
          messagesSent: typeof a.messagesSent === 'number' ? a.messagesSent : 0,
          wordsLearned: typeof a.wordsLearned === 'number' ? a.wordsLearned : 0
        };
        if (!metrics.activeDates.includes(a.dateKey)) {
          metrics.activeDates.push(a.dateKey);
        }
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, actPath);
  }

  // Load Sessions & Messages
  const sessionsPath = `users/${uid}/sessions`;
  const loadedSessions: ChatSession[] = [];
  try {
    const sessQuery = query(collection(db, sessionsPath), where('userId', '==', uid));
    const sessSnap = await getDocs(sessQuery);

    for (const sDoc of sessSnap.docs) {
      const sData = sDoc.data();
      const sId = sData.id;
      const lang = LANGUAGES.find(l => l.code === sData.languageCode) || LANGUAGES[0];
      const persona = PERSONAS.find(p => p.id === sData.personaId) || PERSONAS[0];

      // Load messages for this session
      const msgsPath = `users/${uid}/sessions/${sId}/messages`;
      const msgsQuery = query(collection(db, msgsPath), where('userId', '==', uid));
      let msgsSnap;
      try {
        msgsSnap = await getDocs(msgsQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, msgsPath);
      }

      const msgs: Message[] = [];
      msgsSnap.forEach(mDoc => {
        const m = mDoc.data();
        msgs.push({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || '',
          transliteration: m.transliteration || undefined,
          translation: m.translation || undefined,
          timestamp: typeof m.timestampMs === 'number' ? m.timestampMs : Date.now(),
          grammarFeedback: m.role === 'user' && (m.correction || m.explanation) ? {
            isCorrect: Boolean(m.isCorrect),
            original: m.content || '',
            correction: m.correction || m.content || '',
            explanation: m.explanation || ''
          } : undefined
        });
      });

      msgs.sort((a, b) => a.timestamp - b.timestamp);

      loadedSessions.push({
        id: sId,
        title: sData.title || `${lang.name} with ${persona.name}`,
        language: lang,
        persona,
        tone: (sData.tone as any) || persona.defaultTone || 'formal',
        difficulty: (sData.difficulty as any) || persona.defaultDifficulty || 'intermediate',
        messages: msgs,
        createdAt: msgs[0]?.timestamp || Date.now(),
        updatedAt: msgs[msgs.length - 1]?.timestamp || Date.now()
      });
    }

    loadedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, sessionsPath);
  }

  return {
    metrics,
    settings,
    sessions: loadedSessions
  };
}

// Update User Profile & Settings in Firestore
export async function syncUserProfileToCloud(
  user: User,
  metrics: UserFluencyMetrics,
  settings: UserSettingsPreferences
): Promise<void> {
  const uid = sanitizeId(user.uid);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const correctionsCount = Math.max(0, (metrics.grammarChecksCount || 0) - (metrics.grammarCorrectCount || 0));

  const updatePayload = {
    displayName: clampStr(user.displayName || 'Language Learner', 120),
    email: clampStr(user.email || '', 200),
    photoURL: clampStr(user.photoURL || '', 1000),
    currentStreakDays: clampNum(metrics.currentStreakDays, 0, 100000, 1),
    longestStreakDays: clampNum(metrics.longestStreakDays, 0, 100000, 1),
    lastActiveDate: clampStr(metrics.lastActiveDate, 20),
    totalMessagesSent: clampNum(metrics.totalMessagesSent, 0, 10000000, 0),
    totalCorrectionsReceived: clampNum(correctionsCount, 0, 10000000, 0),
    accurateMessagesCount: clampNum(metrics.grammarCorrectCount, 0, 10000000, 0),
    theme: (['light', 'dark', 'system'].includes(settings.theme) ? settings.theme : 'light') as 'light' | 'dark' | 'system',
    speechRate: clampNum(settings.speechRate, 0.25, 2.5, 0.95),
    speechPitch: clampNum(settings.speechPitch, 0.25, 2.5, 1.0),
    preferredVoiceURI: clampStr(settings.preferredVoiceURI, 300),
    autoSpeak: Boolean(settings.autoSpeak),
    defaultLanguageCode: clampStr(settings.defaultLanguageCode || 'hi', 20),
    defaultPersonaId: clampStr(settings.defaultPersonaId || 'language_buddy', 60),
    updatedAt: serverTimestamp()
  };

  try {
    await updateDoc(userRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

// Save or Update a Daily Activity entry
export async function saveCloudDailyActivity(
  rawUid: string,
  rawDateKey: string,
  messagesSent: number,
  wordsLearned: number
): Promise<void> {
  const uid = sanitizeId(rawUid);
  const dateKey = sanitizeId(rawDateKey).slice(0, 20);
  const path = `users/${uid}/dailyActivity/${dateKey}`;
  const ref = doc(db, 'users', uid, 'dailyActivity', dateKey);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        dateKey,
        userId: uid,
        messagesSent: clampNum(messagesSent, 0, 100000, 0),
        wordsLearned: clampNum(wordsLearned, 0, 100000, 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(ref, {
        messagesSent: clampNum(messagesSent, 0, 100000, 0),
        wordsLearned: clampNum(wordsLearned, 0, 100000, 0),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Save or Update a Vocabulary Item
export async function saveCloudVocabularyItem(
  rawUid: string,
  item: SavedVocabularyItem
): Promise<void> {
  const uid = sanitizeId(rawUid);
  const vocabId = sanitizeId(item.id);
  const path = `users/${uid}/vocabulary/${vocabId}`;
  const ref = doc(db, 'users', uid, 'vocabulary', vocabId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: vocabId,
        userId: uid,
        word: clampStr(item.word, 200),
        lemma: clampStr(item.lemma || item.word, 200),
        transliteration: clampStr(item.transliteration, 300),
        translation: clampStr(item.translation, 500),
        languageCode: clampStr(item.languageCode, 20),
        languageName: clampStr(item.languageName, 80),
        partOfSpeech: clampStr(item.partOfSpeech || 'Word', 60),
        contextSentence: clampStr(item.contextSentence, 1000),
        mastered: Boolean(item.mastered),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(ref, {
        word: clampStr(item.word, 200),
        lemma: clampStr(item.lemma || item.word, 200),
        transliteration: clampStr(item.transliteration, 300),
        translation: clampStr(item.translation, 500),
        partOfSpeech: clampStr(item.partOfSpeech || 'Word', 60),
        contextSentence: clampStr(item.contextSentence, 1000),
        mastered: Boolean(item.mastered),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCloudVocabularyItem(rawUid: string, rawVocabId: string): Promise<void> {
  const uid = sanitizeId(rawUid);
  const vocabId = sanitizeId(rawVocabId);
  const path = `users/${uid}/vocabulary/${vocabId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'vocabulary', vocabId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Save or Update a Session and its latest messages
export async function saveCloudSessionWithMessages(
  rawUid: string,
  session: ChatSession
): Promise<void> {
  const uid = sanitizeId(rawUid);
  const sessionId = sanitizeId(session.id);
  const sessionPath = `users/${uid}/sessions/${sessionId}`;
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  const lastMsg = session.messages[session.messages.length - 1];

  try {
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      await setDoc(sessionRef, {
        id: sessionId,
        userId: uid,
        title: clampStr(session.title, 200),
        languageCode: clampStr(session.language.code, 20),
        personaId: clampStr(session.persona.id, 60),
        tone: clampStr(session.tone || 'formal', 40),
        difficulty: clampStr(session.difficulty || 'intermediate', 40),
        lastMessagePreview: clampStr(lastMsg?.content || '', 500),
        messageCount: clampNum(session.messages.length, 0, 100000, 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(sessionRef, {
        title: clampStr(session.title, 200),
        languageCode: clampStr(session.language.code, 20),
        personaId: clampStr(session.persona.id, 60),
        tone: clampStr(session.tone || 'formal', 40),
        difficulty: clampStr(session.difficulty || 'intermediate', 40),
        lastMessagePreview: clampStr(lastMsg?.content || '', 500),
        messageCount: clampNum(session.messages.length, 0, 100000, 0),
        updatedAt: serverTimestamp()
      });
    }

    // Sync messages inside session
    for (const m of session.messages) {
      await saveCloudMessage(uid, sessionId, m);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionPath);
  }
}

export async function saveCloudMessage(
  rawUid: string,
  rawSessionId: string,
  msg: Message
): Promise<void> {
  const uid = sanitizeId(rawUid);
  const sessionId = sanitizeId(rawSessionId);
  const messageId = sanitizeId(msg.id);
  const msgPath = `users/${uid}/sessions/${sessionId}/messages/${messageId}`;
  const msgRef = doc(db, 'users', uid, 'sessions', sessionId, 'messages', messageId);

  try {
    const snap = await getDoc(msgRef);
    if (!snap.exists()) {
      await setDoc(msgRef, {
        id: messageId,
        sessionId,
        userId: uid,
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: clampStr(msg.content, 4000),
        transliteration: clampStr(msg.transliteration, 4000),
        translation: clampStr(msg.translation, 4000),
        isCorrect: msg.grammarFeedback ? Boolean(msg.grammarFeedback.isCorrect) : true,
        correction: clampStr(msg.grammarFeedback?.correction, 4000),
        explanation: clampStr(msg.grammarFeedback?.explanation, 4000),
        timestampMs: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        createdAt: serverTimestamp()
      });
    } else {
      await updateDoc(msgRef, {
        content: clampStr(msg.content, 4000),
        transliteration: clampStr(msg.transliteration, 4000),
        translation: clampStr(msg.translation, 4000),
        isCorrect: msg.grammarFeedback ? Boolean(msg.grammarFeedback.isCorrect) : true,
        correction: clampStr(msg.grammarFeedback?.correction, 4000),
        explanation: clampStr(msg.grammarFeedback?.explanation, 4000)
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, msgPath);
  }
}

export async function deleteCloudSession(rawUid: string, rawSessionId: string): Promise<void> {
  const uid = sanitizeId(rawUid);
  const sessionId = sanitizeId(rawSessionId);
  const sessionPath = `users/${uid}/sessions/${sessionId}`;
  try {
    const msgsPath = `users/${uid}/sessions/${sessionId}/messages`;
    const q = query(collection(db, msgsPath), where('userId', '==', uid));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, sessionPath);
  }
}
