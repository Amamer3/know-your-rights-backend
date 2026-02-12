import OpenAI from 'openai';
import dotenv from 'dotenv';
import { supabase } from '../config/supabase.js';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a legal assistant specializing in the Constitution of the Republic of Ghana (1992). 
Your task is to provide an assessment of a user's legal situation based on the Constitution and relevant Ghanaian laws.

Context Information:
{{CONTEXT}}

Guidelines:
1. Use the provided context information to answer accurately.
2. Always reference specific Articles or Chapters of the Constitution of Ghana.
3. Provide a clear summary of the user's rights in the given situation.
4. Suggest immediate actions or next steps they can take.
5. Maintain a professional, supportive, and informative tone.
6. Clarify that you are an AI assistant and this is not professional legal advice from a lawyer.
7. If the situation is an emergency, emphasize contacting the relevant authorities immediately.

Format your response clearly with sections: 
- Situation Summary
- Relevant Constitutional Articles
- Assessment of Rights
- Recommended Actions
- Important Disclaimer
`;

export const transcribeAudio = async (filePath: string) => {
  try {
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
    });
    return response.text;
  } catch (error) {
    console.error('Transcription Error:', error);
    throw new Error('Failed to transcribe audio.');
  }
};

export const getRelevantContext = async (description: string) => {
  try {
    const { data, error } = await supabase
      .from('constitution_articles')
      .select('article_number, article_title, article_content')
      .textSearch('article_content', description)
      .limit(3);

    if (error || !data || data.length === 0) {
      return 'No specific constitutional articles found for this query. Use your general knowledge of the Ghanaian Constitution.';
    }

    return data.map(art => `Article ${art.article_number}: ${art.article_title}\n${art.article_content}`).join('\n\n');
  } catch (error) {
    console.error('Context Retrieval Error:', error);
    return 'Error retrieving context.';
  }
};

export const assessLegalSituation = async (description: string) => {
  try {
    const context = await getRelevantContext(description);
    const prompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: description },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'No assessment generated.';
  } catch (error: any) {
    console.error('OpenAI Error:', error);
    // Return a structured error so the controller can handle fallback
    throw error;
  }
};
