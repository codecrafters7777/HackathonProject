import { OpenAI } from 'openai';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function transcribeAudio(filePath) {
  try {
    // Extract audio from video if needed
    const audioPath = await extractAudio(filePath);
    
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'text'
    });

    // Clean up temporary audio file
    if (audioPath !== filePath) {
      fs.unlinkSync(audioPath);
    }

    return transcription;
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

async function extractAudio(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(path.extname(inputPath), '.wav');
    
    ffmpeg(inputPath)
      .toFormat('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}
