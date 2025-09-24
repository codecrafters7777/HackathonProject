import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeAudio } from './services/transcription.js';
import { generateSummary } from './services/summarization.js';
import { generateQuiz } from './services/quizGeneration.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'audio/mpeg', 'audio/wav', 'audio/mp4'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Send immediate response with file info
    res.json({
      message: 'File uploaded successfully',
      fileId: file.filename,
      originalName: file.originalname,
      size: file.size
    });

    // Process file asynchronously
    processFile(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/process/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const filePath = `uploads/${fileId}`;
    
    // Extract audio and transcribe
    const transcript = await transcribeAudio(filePath);
    
    // Generate summary
    const summary = await generateSummary(transcript);
    
    // Generate quiz
    const quiz = await generateQuiz(transcript, summary);
    
    res.json({
      transcript,
      summary,
      quiz,
      status: 'completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
