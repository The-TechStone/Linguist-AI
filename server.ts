import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { handleChatRequest, handleCorrectionRequest, handleGrammarBreakdown, handleWordLookup } from './src/server/geminiService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { language, persona, history, userInput, tone, difficulty } = req.body;
    const data = await handleChatRequest(language, persona, history, userInput, { tone, difficulty });
    res.json(data);
  } catch (err: any) {
    console.error('Server /api/chat error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/correction', async (req, res) => {
  try {
    const { language, text } = req.body;
    const data = await handleCorrectionRequest(language, text);
    res.json(data);
  } catch (err: any) {
    console.error('Server /api/correction error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/grammar-breakdown', async (req, res) => {
  try {
    const { language, sentence, persona } = req.body;
    const data = await handleGrammarBreakdown(language, sentence, persona);
    res.json(data);
  } catch (err: any) {
    console.error('Server /api/grammar-breakdown error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/word-lookup', async (req, res) => {
  try {
    const { language, word, contextSentence } = req.body;
    const data = await handleWordLookup(language, word, contextSentence);
    res.json(data);
  } catch (err: any) {
    console.error('Server /api/word-lookup error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Serve frontend in production
app.use(express.static(path.resolve(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
