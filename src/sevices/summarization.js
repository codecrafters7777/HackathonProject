import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateSummary(transcript) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'You are an expert at summarizing educational content. Create a concise, well-structured summary that captures the key points and main concepts.'
      }, {
        role: 'user',
        content: `Please summarize this transcript, highlighting the main topics and key learning points:\n\n${transcript}`
      }],
      max_tokens: 500,
      temperature: 0.3
    });

    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`Summarization failed: ${error.message}`);
  }
}
