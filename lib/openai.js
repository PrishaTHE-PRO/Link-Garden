import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // server-side only, never exposed to browser
});

export default openai;
