import { embeddingModel } from '../../../lib/ai';

export async function POST(req) {
  const { text } = await req.json();

  const result = await embeddingModel.embedContent(text.slice(0, 8000));

  return Response.json({ embedding: result.embedding.values });
}
