import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
