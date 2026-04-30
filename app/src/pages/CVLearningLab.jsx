import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Activity, BookOpen, SlidersHorizontal, ArrowRightLeft, Image as ImageIcon, CheckCircle, Info } from 'lucide-react';

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 } };

const techniquesConfig = {
  enhancement: [
    { id: 'grayscale', name: 'Grayscale Conversion', desc: 'Converts color imagery to shades of gray. In dentistry, most X-rays are natively grayscale to emphasize bone density, but applying this ensures standard baseline processing.', params: [] },
    { id: 'sharpening', name: 'Image Sharpening', desc: 'Applies a high-pass filter to enhance edges. Useful for making micro-fractures in enamel pop out before edge detection.', params: [] },
    { id: 'histogram_equalization', name: 'Histogram Equalization', desc: 'Spreads out the most frequent intensity values. Great for overall contrast enhancement on underexposed X-rays.', params: [] },
    { id: 'clahe', name: 'CLAHE Contrast', desc: 'Contrast Limited Adaptive Histogram Equalization. Superior to global equalization as it prevents over-amplifying noise in empty spaces—perfect for varying tissue densities.', params: [{ id: 'param1', name: 'Clip Limit', min: 1, max: 10, step: 0.1, default: 2.0 }] }
  ],
  filtering: [
    { id: 'gaussian_blur', name: 'Gaussian Blur', desc: 'Smooths the image by averaging local pixels. Essential for reducing sensor noise in digital radiographs before edge algorithms run.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 31, step: 2, default: 5 }] },
    { id: 'median_blur', name: 'Median Blur', desc: 'Replaces pixels with the median of their neighbors. Excellent for removing "salt-and-pepper" noise while crucially preserving sharp edges of teeth.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 31, step: 2, default: 5 }] }
  ],
  edges: [
    { id: 'canny_edge', name: 'Canny Edge Detection', desc: 'Multi-stage algorithm to detect a wide range of edges. The gold standard for outlining tooth boundaries and deep cavities.', params: [{ id: 'param1', name: 'Threshold 1', min: 0, max: 255, step: 1, default: 100 }, { id: 'param2', name: 'Threshold 2', min: 0, max: 255, step: 1, default: 200 }] },
    { id: 'sobel_edge', name: 'Sobel Edge Detection', desc: 'Computes gradient approximation. Highlights strong structural changes, useful for identifying the gumline.', params: [] },
    { id: 'prewitt_edge', name: 'Prewitt Edge Detection', desc: 'Similar to Sobel but slightly more sensitive to noise. Used for rough boundary estimation.', params: [] }
  ],
  morphology: [
    { id: 'erosion', name: 'Erosion', desc: 'Erodes away boundaries of foreground object. Can separate connected artifacts or remove thin noise near the tooth root.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 21, step: 2, default: 3 }] },
    { id: 'dilation', name: 'Dilation', desc: 'Expands the boundaries of foreground objects. Helps patch broken structural lines computed by Canny.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 21, step: 2, default: 3 }] },
    { id: 'opening', name: 'Opening (Erosion > Dilation)', desc: 'Brilliant for removing small white noise dots in the background without affecting the size of the tooth structures.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 21, step: 2, default: 5 }] },
    { id: 'closing', name: 'Closing (Dilation > Erosion)', desc: 'Used for closing small black holes in the foreground. Important for making sure a tooth boundary is a solid continuous shape.', params: [{ id: 'param1', name: 'Kernel Size', min: 1, max: 21, step: 2, default: 5 }] }
  ],
  segmentation: [
    { id: 'binary_threshold', name: 'Binary Thresholding', desc: 'Converts an image to black/white strictly based on a hard limit. A rudimentary way to isolate dense bone matter.', params: [{ id: 'param1', name: 'Threshold Value', min: 0, max: 255, step: 1, default: 127 }] },
    { id: 'adaptive_threshold', name: 'Adaptive Thresholding', desc: 'Calculates threshold locally. Heavily preferred in dentistry since lighting/density is never uniform across a full mouth block.', params: [{ id: 'param1', name: 'Block Size (Odd)', min: 3, max: 51, step: 2, default: 11 }, { id: 'param2', name: 'C Constraint', min: 0, max: 20, step: 1, default: 2 }] },
    { id: 'segmentation', name: 'K-Means Color Quantization', desc: 'Groups pixels into K distinct values. A classical approach to segment different densities: enamel, dentin, and pulp.', params: [{ id: 'param1', name: 'K (Clusters)', min: 2, max: 10, step: 1, default: 3 }] }
  ],
  shape: [
    { id: 'contour_detection', name: 'Contour Detection', desc: 'Traces continuous lines along borders. The final step to generate polygons for AI area calculations.', params: [{ id: 'param1', name: 'Binarize Threshold', min: 0, max: 255, step: 1, default: 127 }] }
  ]
};

// Flatten to easily find technique by ID
const allTechniques = Object.values(techniquesConfig).flat();

const CVLearningLab = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [selectedTechId, setSelectedTechId] = useState('canny_edge');
  const [params, setParams] = useState({ param1: 100, param2: 200 }); // Defaults for Canny
  
  const [loading, setLoading] = useState(false);
  const [resultBase64, setResultBase64] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const activeTech = allTechniques.find(t => t.id === selectedTechId);

  // Update default params when technique changes
  useEffect(() => {
    if (activeTech) {
      const newParams = { param1: 0, param2: 0 };
      if (activeTech.params[0]) newParams.param1 = activeTech.params[0].default;
      if (activeTech.params[1]) newParams.param2 = activeTech.params[1].default;
      setParams(newParams);
      setResultBase64(null); // Clear previous result
    }
  }, [selectedTechId]);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileSelection(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) handleFileSelection(e.target.files[0]);
  };

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile.type.startsWith('image/')) return alert('Please upload an image.');
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResultBase64(null);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('technique', selectedTechId);
    formData.append('param1', params.param1);
    formData.append('param2', params.param2);

    try {
      const response = await fetch('http://localhost:8000/api/cv_lab', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      setResultBase64(data.processed_image_base64);
    } catch (err) {
      alert("Error executing OpenCV algorithm on the backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Computer Vision Learning Lab</h2>
          <p className="text-slate-500 mt-1">Interact with classic OpenCV filtering and morphology techniques.</p>
        </div>
        <div className="p-3 bg-indigo-100/50 text-indigo-600 rounded-xl hidden md:block">
          <BookOpen className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Controls (takes 1 col) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* File Upload Block */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">1. Image Input</h3>
             <div 
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl flex items-center justify-center transition-colors cursor-pointer min-h-[120px] relative overflow-hidden group
                ${isDragActive ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
              `}
            >
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
              <div className="text-center p-4">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">{file ? file.name : "Choose File"}</p>
              </div>
            </div>
          </div>

          {/* Technique Picker Block */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">2. Pipeline Stage</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Technique Category & Filter</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 bg-slate-50"
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                >
                  <optgroup label="Enhancement">
                    {techniquesConfig.enhancement.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Filtering">
                    {techniquesConfig.filtering.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Edge Detection">
                    {techniquesConfig.edges.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Morphology">
                    {techniquesConfig.morphology.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Segmentation">
                    {techniquesConfig.segmentation.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                  <optgroup label="Shape Analysis">
                    {techniquesConfig.shape.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </optgroup>
                </select>
              </div>

              {activeTech?.params.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                    Parameters
                  </div>
                  
                  {activeTech.params.map((p, idx) => {
                    const val = idx === 0 ? params.param1 : params.param2;
                    return (
                      <div key={p.id} className="mb-3 last:mb-0">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{p.name}</span>
                          <span className="text-indigo-600 font-bold">{val}</span>
                        </div>
                        <input 
                          type="range" 
                          min={p.min} max={p.max} step={p.step} 
                          value={val}
                          onChange={(e) => setParams({ ...params, [idx === 0 ? 'param1' : 'param2']: Number(e.target.value) })}
                          className="w-full accent-indigo-600"
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              <button 
                onClick={handleProcess} 
                disabled={!file || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3 rounded-lg font-semibold transition-colors flex justify-center items-center shadow-md shadow-indigo-200"
              >
                {loading ? <Activity className="w-5 h-5 animate-spin mr-2" /> : "Apply Filter"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Visualizer (takes 3 cols) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          
          {/* Comparison View */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <ArrowRightLeft className="w-5 h-5 mr-2 text-slate-400" />
                  Before / After Visualizer
                </h3>
                {resultBase64 && (
                  <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Success
                  </span>
                )}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px]">
                {/* Original */}
                <div className="bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden border border-slate-200">
                  <div className="absolute top-0 left-0 bg-black/60 text-white px-3 py-1 text-xs font-semibold rounded-br-lg backdrop-blur z-10 block">
                    Original Input
                  </div>
                  {previewUrl ? (
                    <img src={previewUrl} className="w-full h-full object-contain" alt="Original" />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">No Image</span>
                    </div>
                  )}
                </div>

                {/* Processed */}
                <div className="bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden border border-slate-200">
                  <div className="absolute top-0 left-0 bg-indigo-600 text-white px-3 py-1 text-xs font-semibold rounded-br-lg backdrop-blur z-10 block">
                    {activeTech?.name} Output
                  </div>
                  
                  {loading && (
                     <div className="absolute inset-0 bg-slate-900/80 backdrop-blur z-20 flex flex-col items-center justify-center">
                       <Activity className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                       <span className="text-indigo-300 font-medium text-sm">Processing OpenCV array...</span>
                     </div>
                  )}

                  {!loading && resultBase64 ? (
                    <img src={`data:image/jpeg;base64,${resultBase64}`} className="w-full h-full object-contain" alt="Processed Output" />
                  ) : (!loading && <div className="text-slate-600 flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-sm">Run filter to see output</span>
                    </div>
                  )}
                </div>
             </div>
          </div>

          {/* Educational Explaination */}
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-sm border border-indigo-100 p-6 flex gap-4">
             <div className="shrink-0 pt-1">
               <Info className="w-6 h-6 text-indigo-500" />
             </div>
             <div>
               <h4 className="font-bold text-indigo-900 mb-1">{activeTech?.name} Explained</h4>
               <p className="text-slate-700 text-sm leading-relaxed">
                 {activeTech?.desc}
               </p>
             </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export default CVLearningLab;
