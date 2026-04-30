import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'];
const MAX_FILES = 12;

const DISEASE_CLASSES = ['Variation', 'OPMD', 'Oral Cancer'];

// Eight intraoral sites the model was trained on (matches SMART-OM).
const CAPTURE_REGIONS = [
  { name: 'Dorsal tongue',        hint: 'Top surface of the tongue.' },
  { name: 'Ventral tongue',       hint: 'Underside of the tongue.' },
  { name: 'Left buccal mucosa',   hint: 'Inside of the left cheek.' },
  { name: 'Right buccal mucosa',  hint: 'Inside of the right cheek.' },
  { name: 'Upper lip',            hint: 'Inner surface of the upper lip.' },
  { name: 'Lower lip',            hint: 'Inner surface of the lower lip.' },
  { name: 'Upper arch',           hint: 'Hard palate and upper gums.' },
  { name: 'Lower arch',           hint: 'Floor of mouth and lower gums.' },
];

const CAPTURE_TIPS = [
  'Use bright, even lighting — daylight or a white LED. Avoid direct flash to prevent glare.',
  'Hold the camera 15–25 cm away. Tap to focus, keep it steady.',
  'Centre the lesion or tissue of interest. Fill at least 60% of the frame.',
  'Pull cheeks, lips or tongue back gently so the area is fully visible.',
  'Multiple angles help if the lesion is irregular (up to 12 photos per analysis).',
  'Submit the original photo straight from the camera — no cropping, filters, or rotation.',
];

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported type (JPEG/PNG/BMP/WebP).`;
  }
  if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) {
    return `"${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB.`;
  }
  return null;
}

function verdictClass(label) {
  if (!label) return '';
  if (label.includes('Cancer')) return 'verdict-cancer';
  if (label.includes('OPMD')) return 'verdict-opmd';
  if (label.includes('Variation')) return 'verdict-variation';
  if (label.includes('Abnormal')) return 'verdict-abnormal';
  if (label.includes('Normal')) return 'verdict-normal';
  return '';
}

function probFillClass(name) {
  const n = name.toLowerCase();
  if (n.includes('cancer')) return 'prob-fill-cancer';
  if (n.includes('opmd')) return 'prob-fill-opmd';
  if (n.includes('variation')) return 'prob-fill-variation';
  if (n.includes('abnormal')) return 'prob-fill-abnormal';
  return 'prob-fill-normal';
}

export default function App() {
  const [files, setFiles] = useState([]);            // [{ file, preview, id }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);      // { predictions: [...] }
  const [dragging, setDragging] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);   // open by default for first-time users
  const fileInputRef = useRef(null);

  // Cleanup previews on unmount.
  useEffect(() => {
    return () => files.forEach(f => URL.revokeObjectURL(f.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (incoming) => {
    const list = Array.from(incoming);
    const errors = [];
    const accepted = [];
    for (const f of list) {
      if (files.length + accepted.length >= MAX_FILES) {
        errors.push(`Skipping "${f.name}" — limit is ${MAX_FILES} files.`);
        continue;
      }
      const err = validateFile(f);
      if (err) {
        errors.push(err);
      } else {
        accepted.push({
          file: f,
          preview: URL.createObjectURL(f),
          id: `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        });
      }
    }
    if (accepted.length) {
      setFiles(prev => [...prev, ...accepted]);
      setGuideOpen(false);   // collapse guide once user starts uploading
    }
    setError(errors.length ? errors.join(' ') : null);
    setResults(null);
  };

  const openPicker = (e) => {
    e?.stopPropagation();
    fileInputRef.current?.click();
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.id !== id);
    });
    setResults(null);
  };

  const reset = () => {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setResults(null);
    setError(null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const analyze = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      if (files.length === 1) {
        const fd = new FormData();
        fd.append('file', files[0].file);
        const r = await axios.post(`${API_URL}/predict`, fd);
        setResults({ predictions: [{ ...r.data, filename: files[0].file.name }] });
      } else {
        const fd = new FormData();
        for (const f of files) fd.append('files', f.file);
        const r = await axios.post(`${API_URL}/predict_batch`, fd);
        setResults(r.data);
      }
    } catch (err) {
      if (err.response) {
        setError(`Server error (${err.response.status}): ${err.response.data?.detail || 'Unknown'}`);
      } else if (err.request) {
        setError(`Cannot reach the analysis server at ${API_URL}.`);
      } else {
        setError('Unexpected error — please retry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const previewsByName = useMemo(
    () => Object.fromEntries(files.map(f => [f.file.name, f.preview])),
    [files],
  );

  return (
    <div className="App app-shell">
      <header className="site-header glass-header">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <img
              src="/logo.png"
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="brand-monogram" style={{color: '#fff', fontWeight: 700}}>DE</span>
          </div>
          <div className="brand-text">
            <h1>Digital Eye</h1>
            <p>Oral pathology screening &amp; localisation</p>
          </div>
        </div>
        <div className="header-status">{API_URL.replace(/^https?:\/\//, '')}</div>
      </header>

      <main className="container">

        {/* ── Capture guide (collapsible) ── */}
        <section className="section glass-card guide">
          <button
            className="guide-toggle"
            onClick={() => setGuideOpen(o => !o)}
            aria-expanded={guideOpen}
          >
            <span className="guide-title-row">
              <span className="badge">Read first</span>
              <span className="guide-title">How to take photos</span>
            </span>
            <span className="guide-chevron" aria-hidden="true">{guideOpen ? '▾' : '▸'}</span>
          </button>

          {!guideOpen && (
            <p className="guide-summary">
              Bright lighting · 15–25&nbsp;cm distance · clear view of one of 8 intraoral regions ·
              no edits or filters.
            </p>
          )}

          {guideOpen && (
            <div className="guide-body">
              <div className="guide-grid">
                {CAPTURE_REGIONS.map((r, i) => (
                  <div className="guide-card" key={r.name}>
                    <span className="guide-num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="guide-region">{r.name}</p>
                      <p className="guide-hint">{r.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
              <ol className="tip-list">
                {CAPTURE_TIPS.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>
          )}
        </section>

        {/* ── Upload zone (drop only, click on Choose files button) ── */}
        <section
          className={`section glass-card upload-zone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="upload-headline">
            {files.length === 0 ? 'Drop intraoral images here' : 'Add more images'}
          </p>
          <p className="upload-hint">
            JPEG · PNG · BMP · WebP &nbsp;·&nbsp; up to {MAX_FILES} files &nbsp;·&nbsp; max {MAX_FILE_SIZE_MB} MB each
          </p>
          <button className="btn btn-primary" onClick={openPicker}>
            Choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </section>

        {error && <div className="error-msg">{error}</div>}

        {/* ── Selected images + actions ── */}
        {files.length > 0 && (
          <section className="section glass-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  Selected images <span className="count-pill">{files.length}</span>
                </h2>
                <p className="section-sub">Review your selection, then run the analysis.</p>
              </div>
              <div className="action-row">
                <button className="btn btn-primary" onClick={analyze} disabled={loading}>
                  {loading && <span className="spinner" />}
                  {loading ? 'Analyzing…' : `Analyze ${files.length} image${files.length === 1 ? '' : 's'}`}
                </button>
                <button className="btn btn-danger" onClick={reset}>Clear all</button>
              </div>
            </div>

            <div className="thumb-grid">
              {files.map(f => (
                <div className="thumb" key={f.id}>
                  <img src={f.preview} alt={f.file.name} />
                  <span className="thumb-name">{f.file.name}</span>
                  <button
                    className="thumb-remove"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Remove ${f.file.name}`}
                  >×</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Results ── */}
        {results?.predictions && (
          <section className="section glass-card">
            <h2 className="section-title">Analysis results</h2>
            <p className="section-sub">
              {results.predictions.length} prediction{results.predictions.length === 1 ? '' : 's'} —
              the heatmap highlights the region driving the diagnosis (top-quartile activations only).
            </p>
            <div className="result-grid">
              {results.predictions.map((p, i) => (
                <ResultCard
                  key={i}
                  pred={p}
                  preview={previewsByName[p.filename] || files[i]?.preview}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ResultCard({ pred, preview }) {
  if (pred.error) {
    return (
      <div className="result-card glass-card">
        <div className="panel">
          <span className="panel-title">{pred.filename || 'image'}</span>
          <div className="error-msg">Failed: {pred.error}</div>
        </div>
      </div>
    );
  }

  const finalLabel = pred.final_label || pred.binary?.class_name || 'Unknown';
  const finalConf = pred.disease?.confidence_score ?? pred.binary?.confidence_score ?? 0;
  const isAbnormal = pred.binary?.class_index === 1;

  return (
    <div className="result-card glass-card">
      <div className="panel">
        <span className="panel-title">Original</span>
        <div className="image-frame">{preview && <img src={preview} alt="" />}</div>
      </div>

      <div className="panel">
        <span className="panel-title">Annotated ROI (Grad-CAM++)</span>
        <div className="image-frame">
          {pred.heatmap_base64
            ? <img src={`data:image/jpeg;base64,${pred.heatmap_base64}`} alt="ROI heatmap" />
            : <div className="frame-empty">No heatmap</div>}
        </div>

        <div className="summary-row">
          <span className="filename">{pred.filename || ''}</span>
          <span className={`verdict ${verdictClass(finalLabel)}`}>
            {finalLabel} · {(finalConf * 100).toFixed(1)}%
          </span>
        </div>

        <div className="probs">
          {pred.binary?.probabilities && (
            <>
              <ProbBar name="Normal"   pct={pred.binary.probabilities[0] * 100} />
              <ProbBar name="Abnormal" pct={pred.binary.probabilities[1] * 100} />
            </>
          )}
          {isAbnormal && pred.disease?.probabilities && DISEASE_CLASSES.map((n, idx) => (
            <ProbBar key={n} name={n} pct={pred.disease.probabilities[idx] * 100} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProbBar({ name, pct }) {
  return (
    <div className="prob-row">
      <div className="prob-row-header">
        <span className="prob-name">{name}</span>
        <span className="prob-pct">{pct.toFixed(1)}%</span>
      </div>
      <div className="prob-bar">
        <div
          className={`prob-fill ${probFillClass(name)}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
