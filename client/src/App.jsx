import React, { useEffect, useRef, useState } from 'react';
import './App.css';

export default function App() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [filePreviewImg, setFilePreviewImg] = useState(null);
  const [type, setType] = useState('');

  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(false);

  const hiddenFileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (filePreviewImg) URL.revokeObjectURL(filePreviewImg);
    };
  }, [fileUrl, filePreviewImg]);

  function onFileChosen(f) {
    if (!f) return;
    setFile(f);
    setType(f.type);
    const url = URL.createObjectURL(f);
    setFileUrl(url);

    if (f.type.startsWith('video/'))
      captureVideoThumbnail(url).then(dataUrl => {
        if (dataUrl) setFilePreviewImg(dataUrl);
      }).catch(() => {});
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFileChosen(f);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  async function captureVideoThumbnail(url) {
    return new Promise((resolve) => {
      const vid = document.createElement('video');
      vid.crossOrigin = 'anonymous';
      vid.src = url;
      vid.muted = true;
      vid.playsInline = true;
      vid.currentTime = 0.1;
      const clean = () => vid.remove();

      vid.addEventListener('loadeddata', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = vid.videoWidth || 320;
          canvas.height = vid.videoHeight || 180;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        } finally {
          clean();
        }
      });

      vid.addEventListener('error', () => { clean(); resolve(null); });
    });
  }

  function downloadTranscript() {
    const blob = new Blob([transcript || ''], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'transcript.txt';
    a.click();
  }

  function resetQuiz() {
    setAnswers({});
    setSelected({});
    setRevealed(false);
  }

  function handleOptionClick(qIndex, optIndex) {
    setSelected(prev => ({ ...prev, [qIndex]: optIndex }));
  }

  function computeScore() {
    if (!parsed) return null;
    let correct = 0;
    parsed.questions.forEach((q, i) => {
      if (selected[i] === q.answer) correct++;
    });
    return `${correct} / ${parsed.questions.length}`;
  }

  function prepareParsedWithImages(raw) {
    if (!raw || !raw.questions) return raw;
    const qWithImages = raw.questions.map(q => {
      const copy = { ...q };
      if (!copy.image) {
        const keyword = (copy.q || '')
          .split(' ')
          .slice(0, 3)
          .join(' ')
          .replace(/[^a-zA-Z0-9 ]/g, '') || 'education';
        copy.image = `https://source.unsplash.com/600x400/?${encodeURIComponent(keyword)}`;
      }
      return copy;
    });
    return { ...raw, questions: qWithImages };
  }

  function tryParseAssistantText(txt) {
    if (!txt) return null;
    try {
      return JSON.parse(txt);
    } catch {
      const match = txt.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }

  function handleUpload(e) {
    e && e.preventDefault();
    if (!file) return setMessage('Please choose a file first');

    setUploading(true);
    setUploadProgress(0);
    setMessage('Uploading...');

    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:4000/api/transcribe');

    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            setTranscript(json.transcript || '');
            setAssistantText(json.assistantText || '');
            const parsedRaw = tryParseAssistantText(json.assistantText);
            const parsedWithImgs = prepareParsedWithImages(parsedRaw);
            setParsed(parsedWithImgs);
            resetQuiz();
            setMessage('Processed successfully');
          } catch {
            setMessage('Server returned invalid JSON');
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            setMessage(`Upload failed: ${errJson.error}`);
          } catch {
            setMessage(`Upload failed: ${xhr.status} ${xhr.statusText}`);
          }
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setMessage('Network error: Could not connect to server');
    };

    xhr.send(fd);
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <h1 className="brand">LectureAI</h1>
        <div className="actions">
          <button className="btn ghost" onClick={() => {
            setTranscript('');
            setAssistantText('');
            setParsed(null);
            setFile(null);
            setFileUrl(null);
            setFilePreviewImg(null);
            setMessage('Cleared');
          }}>Reset</button>
          <button className="btn" onClick={downloadTranscript} disabled={!transcript}>Download Transcript</button>
        </div>
      </div>

      <div className="card upload-card">
        <div
          className={`dropzone ${file ? 'has-file' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => hiddenFileRef.current && hiddenFileRef.current.click()}
        >
          <input
            ref={hiddenFileRef}
            type="file"
            accept="audio/*,video/*"
            style={{ display: 'none' }}
            onChange={e => onFileChosen(e.target.files && e.target.files[0])}
          />

          {!file && (
            <div className="drop-inner">
              <div className="big">📁 Drop audio/video here</div>
              <div className="sub">or click to pick a file</div>
              <div className="hint">Supports .mp4, .mov, .mp3, .wav etc.</div>
            </div>
          )}

          {file && (
            <div className="file-preview">
              <div className="meta">
                <div className="filename">{file.name}</div>
                <div className="filesize">{Math.round(file.size / 1024)} KB • {file.type || 'file'}</div>
              </div>

              <div className="preview-area">
                {type.startsWith('video/') && (
                  <div className="video-wrap">
                    {filePreviewImg ? (
                      <img src={filePreviewImg} alt="poster" className="video-poster" />
                    ) : (
                      <video src={fileUrl} controls className="video-player" />
                    )}
                  </div>
                )}

                {type.startsWith('audio/') && (
                  <audio src={fileUrl} controls className="audio-player" />
                )}
              </div>

              <div className="upload-row">
                <div className="progress">
                  <div className="bar" style={{ width: uploadProgress + '%' }} />
                </div>
                <div className="upload-actions">
                  <button className="btn" onClick={handleUpload} disabled={uploading}>Upload & Process</button>
                  <button className="btn ghost" onClick={() => { setFile(null); setFileUrl(null); setFilePreviewImg(null); }}>Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="status-row">
          <div className="message">{message}</div>
          {uploading && <div className="small">Uploading: {uploadProgress}%</div>}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Transcript</h3>
          <div className="panel transcript-panel">
            {transcript ? <pre>{transcript}</pre> : <div className="empty">No transcript yet</div>}
          </div>
        </div>

        <div className="card">
          <h3>Summary + Raw Model Output</h3>
          <div className="panel model-panel">
            {assistantText ? <pre>{assistantText}</pre> : <div className="empty">No assistant output yet</div>}
          </div>
        </div>
      </div>

      {parsed && (
        <div className="card quiz-card">
          <div className="quiz-header">
            <h2>Summary</h2>
            <p className="summary-text">{parsed.summary}</p>
          </div>

          <div className="questions">
            {parsed.questions.map((q, i) => {
              const isSelected = selected[i] !== undefined;
              const isCorrect = selected[i] === q.answer;
              return (
                <div key={i} className={`quiz-item ${isSelected ? 'answered' : ''} ${revealed ? (isCorrect ? 'correct' : 'incorrect') : ''}`}>
                  <div className="quiz-top">
                    <div className="q-index">Q{i + 1}</div>
                    <div className="q-text">{q.q}</div>
                  </div>

                  {q.image && (
                    <div className="q-image-wrap">
                      <img src={q.image} alt={`illustration ${i + 1}`} loading="lazy" />
                    </div>
                  )}

                  <div className="options">
                    {q.options.map((opt, idx) => {
                      const selectedIdx = selected[i];
                      const showCorrect = revealed && q.answer === idx;
                      const showWrong = revealed && selectedIdx === idx && q.answer !== idx;
                      return (
                        <button
                          key={idx}
                          className={`option-btn ${selectedIdx === idx ? 'sel' : ''} ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`}
                          onClick={() => handleOptionClick(i, idx)}
                        >
                          <span className="opt-label">{String.fromCharCode(65 + idx)}.</span>
                          <span className="opt-text">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="quiz-actions">
            <div className="score">Score: {computeScore()}</div>
            <div className="btns">
              <button className="btn" onClick={() => setRevealed(prev => !prev)}>
                {revealed ? 'Hide Answers' : 'Reveal Answers'}
              </button>
              <button className="btn ghost" onClick={resetQuiz}>Reset Answers</button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">Built with ❤️ — drop another file to analyze more lectures</footer>
    </div>
  );
}
