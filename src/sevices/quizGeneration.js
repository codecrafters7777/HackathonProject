import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateQuiz(transcript, summary) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: `You are an expert quiz creator. Generate a comprehensive quiz based on the provided content. 
        
        Return a JSON array of quiz questions with this exact format:
        [
          {
            "id": 1,
            "type": "multiple-choice",
            "question": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": 0,
            "explanation": "Why this is correct"
          },
          {
            "id": 2,
            "type": "short-answer",
            "question": "Question text",
            "correctAnswer": "Expected answer",
            "explanation": "Additional context"
          }
        ]
        
        Create 5-8 questions total, mixing multiple-choice and short-answer types.`
      }, {
        role: 'user',
        content: `Based on this content, create a quiz:\n\nSummary: ${summary}\n\nFull Transcript: ${transcript}`
      }],
      max_tokens: 1500,
      temperature: 0.5
    });

    const quizContent = response.choices[0].message.content;
    
    // Parse JSON response
    const quiz = JSON.parse(quizContent);
    
    return quiz;
  } catch (error) {
    throw new Error(`Quiz generation failed: ${error.message}`);
  }
}
