import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Activity, Layers, X, ScanEye, Microscope } from 'lucide-react';

const ORAL_API_URL = 'http://127.0.0.1:8001';
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'];
const MAX_FILES = 12;
const DISEASE_CLASSES = ['Variation', 'OPMD', 'Oral Cancer'];

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
  'Use bright, even lighting — daylight or a white LED.',
  'Hold camera 15–25 cm away. Tap to focus, keep steady.',
  'Centre the lesion or tissue of interest.',
  'Pull cheeks, lips or tongue back gently so the area is fully visible.',
  'Multiple angles help (up to 12 photos per analysis).',
  'Submit original photos — no cropping, filters, or rotation.',
];

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 } };
const staggerContainer = { in: { transition: { staggerChildren: 0.12 } } };
const cardVariants = { initial: { opacity: 0, y: 20 }, in: { opacity: 1, y: 0 } };

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return `"${file.name}" is not a supported type.`;
  if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) return `"${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB.`;
  return null;
}

function verdictClass(label) {
  if (!label) return '';
  if (label.includes('Cancer'))    return 'bg-red-50 text-red-700 border border-red-200';
  if (label.includes('OPMD'))      return 'bg-pink-50 text-pink-700 border border-pink-200';
  if (label.includes('Variation')) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (label.includes('Abnormal'))  return 'bg-red-50 text-red-700 border border-red-200';
  if (label.includes('Normal'))    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  return '';
}

function probFillColor(name) {
  const n = name.toLowerCase();
  if (n.includes('cancer')) return 'bg-gradient-to-r from-red-400 to-red-600';
  if (n.includes('opmd')) return 'bg-gradient-to-r from-pink-400 to-pink-600';
  if (n.includes('variation')) return 'bg-gradient-to-r from-amber-400 to-amber-600';
  if (n.includes('abnormal')) return 'bg-gradient-to-r from-orange-400 to-red-500';
  return 'bg-gradient-to-r from-emerald-400 to-emerald-600';
}

function ProbBar({ name, pct }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-700">{name}</span>
        <span className="font-mono text-slate-500">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${probFillColor(name)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function ResultCard({ pred, preview }) {
  if (pred.error) {
    return (
      <motion.div variants={cardVariants} className="bg-red-50 border border-red-200 rounded-xl p-4">
        <span className="text-sm font-semibold text-red-700">{pred.filename || 'image'}</span>
        <p className="text-sm text-red-600 mt-1">Failed: {pred.error}</p>
      </motion.div>
    );
  }

  const finalLabel = pred.final_label || pred.binary?.class_name || 'Unknown';
  const finalConf = pred.disease?.confidence_score ?? pred.binary?.confidence_score ?? 0;
  const isAbnormal = pred.binary?.class_index === 1;

  return (
    <motion.div variants={cardVariants} className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-sm">
      {/* Original */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Original</span>
        <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
          {preview && <img src={preview} alt="" className="w-full h-full object-cover" />}
        </div>
      </div>

      {/* Annotated ROI */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Annotated ROI (Grad-CAM++)</span>
        <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
          {pred.heatmap_base64
            ? <img src={`data:image/jpeg;base64,${pred.heatmap_base64}`} alt="ROI heatmap" className="w-full h-full object-cover" />
            : <div className="flex items-center justify-center h-full text-slate-400 text-sm">No heatmap</div>
          }
        </div>

        {/* Verdict */}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <span className="text-xs font-mono text-slate-500 break-all">{pred.filename || ''}</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${verdictClass(finalLabel)}`}>
            {finalLabel} · {(finalConf * 100).toFixed(1)}%
          </span>
        </div>

        {/* Probability bars */}
        <div className="flex flex-col gap-2 mt-3">
          {pred.binary?.probabilities && (
            <>
              <ProbBar name="Normal" pct={pred.binary.probabilities[0] * 100} />
              <ProbBar name="Abnormal" pct={pred.binary.probabilities[1] * 100} />
            </>
          )}
          {isAbnormal && pred.disease?.probabilities && DISEASE_CLASSES.map((n, idx) => (
            <ProbBar key={n} name={n} pct={pred.disease.probabilities[idx] * 100} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const OralScreening = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const fileInputRef = useRef(null);

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
      if (err) errors.push(err);
      else accepted.push({
        file: f,
        preview: URL.createObjectURL(f),
        id: `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      });
    }
    if (accepted.length) { setFiles(prev => [...prev, ...accepted]); setGuideOpen(false); }
    setError(errors.length ? errors.join(' ') : null);
    setResults(null);
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter(f => f.id !== id);
    });
    setResults(null);
  };

  const reset = () => { files.forEach(f => URL.revokeObjectURL(f.preview)); setFiles([]); setResults(null); setError(null); };

  const analyze = async () => {
    if (!files.length) return;
    setLoading(true); setError(null); setResults(null);
    try {
      if (files.length === 1) {
        const fd = new FormData(); fd.append('file', files[0].file);
        const r = await fetch(`${ORAL_API_URL}/predict`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const data = await r.json();
        setResults({ predictions: [{ ...data, filename: files[0].file.name }] });
      } else {
        const fd = new FormData();
        for (const f of files) fd.append('files', f.file);
        const r = await fetch(`${ORAL_API_URL}/predict_batch`, { method: 'POST', body: fd });
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        setResults(await r.json());
      }
    } catch (err) {
      setError(err.message || 'Cannot reach the Oral Screening API.');
    } finally { setLoading(false); }
  };

  const previewsByName = useMemo(
    () => Object.fromEntries(files.map(f => [f.file.name, f.preview])),
    [files],
  );

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Oral Cancer Screening</h2>
          <p className="text-slate-500 mt-1">Two-stage hierarchical classification with Grad-CAM++ ROI localisation.</p>
        </div>
        <div className="p-3 bg-teal-100/50 text-teal-600 rounded-xl hidden md:block">
          <Microscope className="w-8 h-8" />
        </div>
      </div>

      {/* Capture Guide */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <button className="w-full flex items-center justify-between text-left" onClick={() => setGuideOpen(o => !o)}>
          <span className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-100 text-teal-700 border border-teal-200">Read first</span>
            <span className="text-base font-semibold text-slate-800">How to take photos</span>
          </span>
          <span className="text-slate-400 text-lg">{guideOpen ? '▾' : '▸'}</span>
        </button>
        {!guideOpen && (
          <p className="mt-3 text-sm text-slate-500">Bright lighting · 15–25&nbsp;cm distance · clear view of one of 8 intraoral regions · no edits or filters.</p>
        )}
        <AnimatePresence>
          {guideOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {CAPTURE_REGIONS.map((r, i) => (
                  <div key={r.name} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-teal-50/50 hover:border-teal-100 transition-colors">
                    <span className="font-mono text-xs font-bold text-teal-600 bg-teal-100 px-2 py-0.5 rounded-md shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{r.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{r.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
              <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1.5 pl-1 marker:text-teal-500 marker:font-semibold">
                {CAPTURE_TIPS.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Upload Intraoral Images</h3>

          <div
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer min-h-[220px] mb-4 group
              ${dragging ? 'border-teal-400 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-teal-300'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-teal-100 text-teal-600' : 'bg-white text-slate-400 border border-slate-200 shadow-sm group-hover:text-teal-500'}`}>
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">{files.length === 0 ? 'Drop images here' : 'Add more images'}</p>
            <p className="text-xs text-slate-500 mt-1">JPEG · PNG · BMP · WebP · up to {MAX_FILES} files</p>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" multiple accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

          {/* Thumbnails */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {files.map(f => (
                <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group">
                  <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                  <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-auto">
            <button onClick={reset} disabled={!files.length || loading}
              className="px-4 py-3 rounded-lg font-semibold transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
            <button onClick={analyze} disabled={!files.length || loading}
              className="flex-1 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 disabled:from-teal-400 disabled:to-cyan-400 text-white py-3 rounded-lg font-semibold transition-all flex justify-center items-center shadow-md shadow-teal-200/30 disabled:shadow-none">
              {loading ? (<><Activity className="w-5 h-5 animate-spin mr-2" /> Analyzing…</>) : `Analyze ${files.length} image${files.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col min-h-[400px]">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
          )}

          <AnimatePresence mode="wait">
            {!loading && !results && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Layers className="w-16 h-16 mb-4 opacity-40 text-slate-500" />
                <p className="font-semibold text-slate-600 text-lg">Awaiting Analysis</p>
                <p className="text-sm mt-1 text-slate-500">Upload images and run the analysis to see results.</p>
              </motion.div>
            )}

            {loading && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-teal-500">
                    <ScanEye className="w-7 h-7" />
                  </div>
                </div>
                <p className="mt-5 text-slate-700 font-semibold animate-pulse">Running two-stage inference & Grad-CAM++…</p>
              </motion.div>
            )}

            {!loading && results?.predictions && (
              <motion.div key="results" variants={staggerContainer} initial="initial" animate="in" className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Analysis Results</h3>
                    <p className="text-sm text-slate-500">
                      {results.predictions.length} prediction{results.predictions.length === 1 ? '' : 's'} — heatmap highlights top-quartile activations.
                    </p>
                  </div>
                </div>
                {results.predictions.map((p, i) => (
                  <ResultCard key={i} pred={p} preview={previewsByName[p.filename] || files[i]?.preview} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default OralScreening;
