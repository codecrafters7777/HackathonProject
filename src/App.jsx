// client/src/App.jsx
import { useState } from 'react';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [answers, setAnswers] = useState({});

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return alert('Choose file first');
    const fd = new FormData();
    fd.append('file', file);

    const resp = await fetch('http://localhost:4000/api/transcribe', {
      method: 'POST',
      body: fd
    });
    const json = await resp.json();
    setTranscript(json.transcript || '');
    setAssistantText(json.assistantText || '');

    // Try parse JSON produced by the model
    try {
      const obj = JSON.parse(json.assistantText);
      setParsed(obj);
    } catch (err) {
      // If model returned text around JSON, try extract first { ... } block
      const match = json.assistantText.match(/\{[\s\S]*\}/);
      if (match) {
        try { setParsed(JSON.parse(match[0])); } catch (e) { console.error(e); }
      } else {
        console.error('Failed to parse model output.');
      }
    }
  }

  function handleAnswerChange(qIndex, optIndex) {
    setAnswers(prev => ({ ...prev, [qIndex]: optIndex }));
  }

  function computeScore() {
    if (!parsed) return null;
    let correct = 0;
    parsed.questions.forEach((q, i) => {
      if (answers[i] === q.answer) correct++;
    });
    return `${correct} / ${parsed.questions.length}`;
  }

  return (
    <div className="app-container">
      <h2 className="title">Upload lecture audio/video</h2>
      <form className="upload-form" onSubmit={handleUpload}>
        <input type="file" accept="audio/*,video/*" onChange={e => setFile(e.target.files[0])} className="file-input" />
        <button type="submit" className="upload-btn">Upload & Process</button>
      </form>

      <h3 className="section-title">Transcript</h3>
      <pre className="transcript-box">{transcript}</pre>

      <h3 className="section-title">Summary + Quiz (model output)</h3>
      <pre className="model-output-box">{assistantText}</pre>

      {parsed && (
        <>
          <h3 className="section-title">Summary</h3>
          <p className="summary-text">{parsed.summary}</p>

          <h3 className="section-title">Quiz</h3>
          {parsed.questions.map((q, i) => (
            <div key={i} className="quiz-question">
              <div className="question-text"><b>Q{i+1}:</b> {q.q}</div>
              {q.options.map((opt, idx) => (
                <label key={idx} className="option-label">
                  <input type="radio" name={`q${i}`} onChange={() => handleAnswerChange(i, idx)} />
                  {opt}
                </label>
              ))}
            </div>
          ))}

          <div className="score-box"><b>Score:</b> {computeScore()}</div>
        </>
      )}
    </div>
  );
}
