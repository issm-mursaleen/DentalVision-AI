import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Activity, CheckCircle, AlertTriangle, Image as ImageIcon, X, Sparkles, Layers, ScanEye, Download, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 } };
const staggerContainer = { in: { transition: { staggerChildren: 0.15 } } };
const cardVariants = { initial: { opacity: 0, y: 20 }, in: { opacity: 1, y: 0 } };

const CavityDetection = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAnalyzingQuality, setIsAnalyzingQuality] = useState(false);
  const [qualityResult, setQualityResult] = useState(null);
  const [result, setResult] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG).');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null); 
    setQualityResult(null);
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setQualityResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async (e, ignoreQuality = false) => {
    if (e) e.preventDefault();
    if (!file) return;
    
    setResult(null);
    setQualityResult(null);

    const formData = new FormData();
    formData.append('file', file);

    if (!ignoreQuality) {
      // Step 1: Pre-check Pipeline
      setIsAnalyzingQuality(true);
      try {
        const qualityRes = await fetch('http://localhost:8000/api/image-quality', {
          method: 'POST',
          body: formData,
        });
        
        if (!qualityRes.ok) throw new Error('Quality API Error');
        
        const qData = await qualityRes.json();
        
        if (qData.is_poor_quality) {
          setQualityResult(qData);
          setIsAnalyzingQuality(false);
          return; // Stop here, show quality card
        }
      } catch (err) {
        console.error("Quality check failed, proceeding to detection anyway.", err);
      }
      setIsAnalyzingQuality(false);
    }

    // Step 2: Detection Pipeline
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/detect_cavity', {
        method: 'POST',
        body: formData, 
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ 
        cavity_detected: false, 
        confidence_score: 0, 
        cavity_count: 0,
        message: "Error processing the image via backend. Ensure the python server is running.",
        annotated_image_base64: null,
        heatmap_image_base64: null
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!result || !previewUrl) return;

    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b;">
        <div style="display: flex; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #0ea5e9; margin: 0;">DentalVision AI</h1>
          <span style="font-size: 14px; color: #64748b; margin-left: auto;">Diagnostic Report</span>
        </div>
        
        <p><strong>Date & Time:</strong> ${new Date().toLocaleString()}</p>
        
        <div style="background-color: ${result.cavity_detected ? '#fef3c7' : '#d1fae5'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0;">${result.cavity_count > 0 ? 'Findings Detected' : 'Clear Scan'}</h2>
          <p style="margin: 0;"><strong>Anomalies Detected:</strong> ${result.cavity_count}</p>
          <p style="margin: 5px 0 0 0;"><strong>AI Confidence:</strong> ${(result.confidence_score * 100).toFixed(1)}%</p>
          <p style="margin: 5px 0 0 0;"><strong>Summary:</strong> ${result.message}</p>
        </div>

        <div style="display: flex; gap: 20px; margin-top: 30px;">
          <div style="flex: 1;">
            <h3 style="font-size: 16px; margin-bottom: 8px;">Original Scan</h3>
            <img src="${previewUrl}" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 4px;" />
          </div>
          <div style="flex: 1;">
            <h3 style="font-size: 16px; margin-bottom: 8px;">YOLO Detection Output</h3>
            <img src="data:image/jpeg;base64,${result.annotated_image_base64}" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 4px;" />
          </div>
        </div>
        
        ${result.heatmap_image_base64 ? `
        <div style="margin-top: 30px;">
          <h3 style="font-size: 16px; margin-bottom: 8px;">Explainability Saliency Heatmap</h3>
          <img src="data:image/jpeg;base64,${result.heatmap_image_base64}" style="width: 50%; max-width: 350px; border: 1px solid #cbd5e1; border-radius: 4px;" />
          <p style="font-size: 12px; color: #64748b; margin-top: 5px;">The highlighted regions were important in AI cavity prediction.</p>
        </div>` : ''}

        <div style="margin-top: 40px; padding: 15px; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center; background-color: #f8fafc;">
          <p style="font-weight: bold; color: #334155; margin: 0 0 5px 0;">Clinical Notice</p>
          <p style="margin: 0; color: #64748b; font-size: 14px;">Please consult a certified dental professional for final diagnosis. AI predictions are strictly supplementary.</p>
        </div>
      </div>
    `;

    const opt = {
      margin:       0.5,
      filename:     'DentalVision_Report.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const getStatusColor = (status) => {
    if (status === 'Good') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (status === 'Poor' || status === 'Low') return 'text-red-600 bg-red-50 border-red-200';
    if (status === 'Dark' || status === 'Overexposed') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-600 bg-slate-50 border-slate-200';
  };

  const getStatusIcon = (status) => {
    if (status === 'Good') return <CheckCircle2 className="w-5 h-5 mr-2" />;
    if (status === 'Poor' || status === 'Low' || status === 'Dark' || status === 'Overexposed') return <AlertCircle className="w-5 h-5 mr-2" />;
    return null;
  };

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Cavity Detection & XAI</h2>
          <p className="text-slate-500 mt-1">AI bounding boxes and Explainable AI saliency heatmaps.</p>
        </div>
        <div className="p-3 bg-sky-100/50 text-sky-600 rounded-xl hidden md:block">
          <ScanEye className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Span 1 if 3 cols): Upload & Actions */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full sticky top-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Input X-Ray Image</h3>
          
          <div 
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors cursor-pointer min-h-[250px] mb-6 relative overflow-hidden group
              ${isDragActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              onChange={handleFileChange} 
              accept="image/*" 
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Upload Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
            ) : null}
            
            <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none p-4 text-center">
               <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors ${previewUrl ? 'bg-slate-900/50 text-white backdrop-blur' : (isDragActive ? 'bg-sky-100 text-sky-600' : 'bg-white text-slate-400 border border-slate-200 shadow-sm')}`}>
                <Upload className="w-6 h-6" />
              </div>
              {!previewUrl && (
                <>
                  <h4 className="text-sm font-semibold text-slate-700 mb-1">Click or drag image</h4>
                  <p className="text-xs text-slate-500">JPG, PNG (Max 5MB)</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-auto">
            <button 
              onClick={handleReset}
              disabled={!file || (loading && !isAnalyzingQuality)}
              className="px-4 py-3 rounded-lg font-semibold transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={(e) => handleUpload(e, false)} 
              disabled={!file || loading || isAnalyzingQuality}
              className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white py-3 rounded-lg font-semibold transition-colors flex justify-center items-center shadow-md shadow-sky-200 disabled:shadow-none"
            >
              {loading || isAnalyzingQuality ? (
                <><Activity className="w-5 h-5 animate-spin mr-2" /> {isAnalyzingQuality ? 'Analyzing Quality...' : 'Running Inference...'}</>
              ) : "Run Detection"}
            </button>
          </div>
        </div>

        {/* Right Column (Span 2 if 3 cols): Results Pipeline */}
        <div className="lg:col-span-2 bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col h-full relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {!loading && !isAnalyzingQuality && !result && !qualityResult && (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[400px]"
              >
                <Layers className="w-16 h-16 mb-4 opacity-30 text-slate-500" />
                <p className="font-semibold text-slate-600 text-lg">Awaiting Analysis Pipeline</p>
                <p className="text-sm mt-1">Upload an image and run detection to generate results.</p>
              </motion.div>
            )}

            {isAnalyzingQuality && (
              <motion.div 
                key="loading-quality"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-500">
                     <ShieldAlert className="w-8 h-8" />
                  </div>
                </div>
                <p className="mt-6 text-slate-800 font-semibold animate-pulse text-lg">Pre-Check: Analyzing Image Quality...</p>
              </motion.div>
            )}

            {loading && !isAnalyzingQuality && (
              <motion.div 
                key="loading-inference"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm"
              >
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-slate-200 border-t-sky-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-sky-600">
                     <ScanEye className="w-8 h-8" />
                  </div>
                </div>
                <p className="mt-6 text-slate-800 font-semibold animate-pulse text-lg">Executing YOLO & XAI Heatmap Models...</p>
              </motion.div>
            )}

            {/* Quality Score Card */}
            {!loading && !isAnalyzingQuality && qualityResult && !result && (
              <motion.div 
                key="quality-card"
                variants={staggerContainer}
                initial="initial"
                animate="in"
                className="flex flex-col h-full space-y-6 max-w-xl mx-auto w-full pt-4"
              >
                <motion.div variants={cardVariants} className="bg-red-50 border border-red-200 p-6 rounded-2xl flex flex-col items-center text-center shadow-sm">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-red-800 mb-2">Poor Image Quality Detected</h3>
                  <p className="text-red-600 font-medium">Upload a clearer image for better cavity detection.</p>
                </motion.div>

                <motion.div variants={cardVariants} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h4 className="font-bold text-slate-800">Quality Score Card</h4>
                    <div className="flex items-center">
                      <span className="text-sm text-slate-500 mr-2">Overall Score:</span>
                      <span className={`text-xl font-black ${qualityResult.overall_score >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {qualityResult.overall_score}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-2">
                    <table className="w-full text-left">
                      <tbody>
                        <tr className="border-b border-slate-50">
                          <td className="py-4 px-4 text-slate-600 font-semibold">Blur (Laplacian)</td>
                          <td className="py-4 px-4 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(qualityResult.blur)}`}>
                              {getStatusIcon(qualityResult.blur)} {qualityResult.blur}
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-50">
                          <td className="py-4 px-4 text-slate-600 font-semibold">Brightness</td>
                          <td className="py-4 px-4 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(qualityResult.brightness)}`}>
                              {getStatusIcon(qualityResult.brightness)} {qualityResult.brightness}
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-50">
                          <td className="py-4 px-4 text-slate-600 font-semibold">Contrast</td>
                          <td className="py-4 px-4 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(qualityResult.contrast)}`}>
                              {getStatusIcon(qualityResult.contrast)} {qualityResult.contrast}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-4 px-4 text-slate-600 font-semibold">Resolution</td>
                          <td className="py-4 px-4 text-right">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(qualityResult.resolution)}`}>
                              {getStatusIcon(qualityResult.resolution)} {qualityResult.resolution}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                <motion.div variants={cardVariants} className="flex gap-4 pt-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-semibold transition-colors shadow-sm"
                  >
                    Upload Clearer Image
                  </button>
                  <button 
                    onClick={(e) => handleUpload(e, true)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-semibold transition-colors"
                  >
                    Proceed Anyway
                  </button>
                </motion.div>
              </motion.div>
            )}

            {/* Inference Result */}
            {!loading && !isAnalyzingQuality && result && (
              <motion.div 
                key="result"
                variants={staggerContainer}
                initial="initial"
                animate="in"
                className="flex flex-col h-full space-y-6"
              >
                
                {/* 3-Image Pipeline Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Original Image */}
                  <motion.div variants={cardVariants} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-widest p-2 text-center border-b border-slate-200">Original Scan</div>
                    <div className="bg-slate-900 aspect-square flex items-center justify-center p-2 relative">
                       {previewUrl ? <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Original" /> : null}
                    </div>
                  </motion.div>

                  {/* YOLO Output */}
                  <motion.div variants={cardVariants} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-sky-50 text-xs font-semibold text-sky-700 uppercase tracking-widest p-2 text-center border-b border-sky-100">YOLO Detection</div>
                    <div className="bg-slate-900 aspect-square flex items-center justify-center p-2 relative">
                       {result.annotated_image_base64 ? (
                         <img src={`data:image/jpeg;base64,${result.annotated_image_base64}`} className="max-w-full max-h-full object-contain" alt="YOLO Annotated" />
                       ) : <span className="text-slate-500 text-xs">Error</span>}
                    </div>
                  </motion.div>

                  {/* XAI Heatmap */}
                  <motion.div variants={cardVariants} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
                     {/* Info Sparkle Icon */}
                    <div className="absolute top-[40px] right-2 z-10 bg-indigo-500/80 p-1.5 rounded-full backdrop-blur-md shadow-lg" title="Explainable AI Layer">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>

                    <div className="bg-indigo-50 text-xs font-semibold text-indigo-700 uppercase tracking-widest p-2 text-center border-b border-indigo-100">XAI Heatmap</div>
                    <div className="bg-slate-900 aspect-square flex items-center justify-center p-2 relative">
                        {result.heatmap_image_base64 ? (
                         <img src={`data:image/jpeg;base64,${result.heatmap_image_base64}`} className="max-w-full max-h-full object-contain mix-blend-screen" alt="XAI Heatmap" />
                       ) : <span className="text-slate-500 text-xs">Error</span>}
                    </div>
                  </motion.div>

                </div>

                {/* XAI Info Panel */}
                <motion.div variants={cardVariants} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-start gap-4">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">Explainability Module Active</h4>
                    <p className="text-sm text-slate-600 mt-0.5">
                      <strong>The highlighted regions were important in AI cavity prediction.</strong> The generated Saliency Heatmap reveals which specific pixels the underlying YOLO model focused heavily on to draw its bounding boxes.
                    </p>
                  </div>
                </motion.div>

                {/* Metrics & Recap */}
                <motion.div variants={cardVariants} className="flex gap-4 pt-2">
                  <div className={`flex-1 flex items-center p-4 rounded-xl border ${result.cavity_detected ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    {result.cavity_detected ? <AlertTriangle className="w-8 h-8 mr-3 text-amber-600 shrink-0" /> : <CheckCircle className="w-8 h-8 mr-3 text-emerald-600 shrink-0" />}
                    <div>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-wider">{result.cavity_detected ? 'Findings Present' : 'Clear Scan'}</p>
                      <p className="text-lg font-bold">{result.cavity_count} {result.cavity_count === 1 ? 'Anomaly' : 'Anomalies'} Detected</p>
                      <p className="text-sm mt-0.5 opacity-90">{result.message}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col justify-center items-center w-36 shrink-0">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Max Confidence</p>
                    <p className="text-2xl font-black text-slate-800">{(result.confidence_score * 100).toFixed(1)}%</p>
                  </div>
                </motion.div>

                {/* PDF Action */}
                <motion.div variants={cardVariants} className="pt-2">
                  <button 
                    onClick={generatePDF}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-semibold transition-colors shadow-md"
                  >
                    <Download className="w-5 h-5" /> Download Professional PDF Report
                  </button>
                </motion.div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </motion.div>
  );
};

export default CavityDetection;
