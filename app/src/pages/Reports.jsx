import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Trash2, Calendar, Search, AlertCircle, Eye, Activity, CheckCircle, AlertTriangle, ArrowUpDown, Filter } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 } };
const staggerContainer = { in: { transition: { staggerChildren: 0.1 } } };
const cardVariants = { initial: { opacity: 0, scale: 0.95 }, in: { opacity: 1, scale: 1 } };

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [dbError, setDbError] = useState(null);
  
  const [selectedReport, setSelectedReport] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchReports = async (currentFilter) => {
    setLoading(true);
    setDbError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/reports?filter=${currentFilter}`);
      if (!response.ok) throw new Error('Failed to load DB');
      const data = await response.json();
      setReports(data);
    } catch (err) {
      setDbError("Unable to connect to the local SQLite database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(filter);
  }, [filter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`http://localhost:8000/api/reports/${deleteId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setReports(reports.filter(r => r.id !== deleteId));
        setDeleteId(null);
      }
    } catch (err) {
      alert("Failed to delete record.");
    }
  };

  const getFilteredAndSortedReports = () => {
    let filtered = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.id.toString().includes(q) || 
        r.summary.toLowerCase().includes(q)
      );
    }
    
    return filtered.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.date_time) - new Date(a.date_time);
      if (sortOrder === 'oldest') return new Date(a.date_time) - new Date(b.date_time);
      if (sortOrder === 'highest_confidence') return b.confidence - a.confidence;
      return 0;
    });
  };

  const downloadPDF = (report) => {
    const isCavity = report.cavity_count > 0;
    const aiInterpretation = isCavity 
      ? `The model identified ${report.cavity_count} suspicious cavity region(s) in the provided scan with a maximum confidence of ${(report.confidence * 100).toFixed(1)}%. Professional dental consultation and physical examination are highly recommended.`
      : `No suspicious cavity regions were detected by the current model. The scan appears clear based on the AI analysis.`;

    const element = document.createElement('div');
    element.innerHTML = `
      <style>
        body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.5; }
        .pdf-container { padding: 40px; background: #ffffff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
        .logo-area { display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 40px; height: 40px; background: #0ea5e9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold; }
        .logo-text { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
        .logo-sub { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
        .report-meta { text-align: right; }
        .report-id { font-size: 18px; font-weight: 700; color: #0ea5e9; margin: 0; }
        .report-date { font-size: 14px; color: #64748b; margin: 5px 0 0 0; }
        
        .section-title { font-size: 16px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 15px; border-left: 4px solid #0ea5e9; padding-left: 10px; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
        .card-label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
        .card-value { font-size: 16px; color: #0f172a; font-weight: 600; margin: 0; }
        
        .status-box { background: ${isCavity ? '#fffbeb' : '#f0fdf4'}; border: 1px solid ${isCavity ? '#fde68a' : '#bbf7d0'}; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
        .status-title { font-size: 18px; font-weight: 700; color: ${isCavity ? '#d97706' : '#16a34a'}; margin: 0 0 10px 0; display: flex; align-items: center; gap: 10px;}
        .status-text { font-size: 14px; color: #334155; margin: 0; }
        
        .images-section { display: flex; gap: 20px; margin-bottom: 30px; }
        .image-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
        .image-header { background: #f1f5f9; padding: 10px; font-size: 12px; font-weight: 700; color: #475569; text-align: center; border-bottom: 1px solid #e2e8f0; }
        .image-body { padding: 10px; background: #ffffff; text-align: center; }
        .image-body img { max-width: 100%; height: auto; border-radius: 4px; max-height: 250px; object-fit: contain; }
        
        .tech-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 30px; font-size: 12px; }
        .tech-list { margin: 0; padding-left: 20px; color: #475569; }
        .tech-list li { margin-bottom: 5px; }
        
        .disclaimer { font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; page-break-inside: avoid; }
      </style>
      <div class="pdf-container">
        <!-- Header -->
        <div class="header">
          <div class="logo-area">
            <div class="logo-icon">DV</div>
            <div>
              <p class="logo-text">DentalVision AI</p>
              <p class="logo-sub">Dental Cavity Detection Report</p>
            </div>
          </div>
          <div class="report-meta">
            <p class="report-id">Report #${report.id}</p>
            <p class="report-date">Generated: ${new Date(report.date_time).toLocaleString()}</p>
          </div>
        </div>

        <!-- Session Details -->
        <h3 class="section-title">Session Details</h3>
        <div class="grid-3">
          <div class="card">
            <div class="card-label">Scan Session ID</div>
            <p class="card-value">SSN-${new Date(report.date_time).getTime().toString().slice(-6)}</p>
          </div>
          <div class="card">
            <div class="card-label">Analysis Timestamp</div>
            <p class="card-value">${new Date(report.date_time).toLocaleTimeString()}</p>
          </div>
          <div class="card">
            <div class="card-label">Source System</div>
            <p class="card-value">Local CV Engine</p>
          </div>
        </div>

        <!-- Result Summary -->
        <h3 class="section-title">Result Summary</h3>
        <div class="grid-2">
          <div class="card">
            <div class="card-label">Total Cavities Detected</div>
            <p class="card-value" style="font-size: 24px; color: ${isCavity ? '#ef4444' : '#10b981'};">${report.cavity_count}</p>
          </div>
          <div class="card">
            <div class="card-label">Maximum Confidence Score</div>
            <p class="card-value" style="font-size: 24px;">${(report.confidence * 100).toFixed(1)}%</p>
          </div>
        </div>

        <!-- Interpretation -->
        <div class="status-box">
          <h4 class="status-title">${isCavity ? '⚠️ Findings Detected' : '✅ Clear Scan'}</h4>
          <p class="status-text">${aiInterpretation}</p>
        </div>

        <!-- Images Section -->
        <h3 class="section-title">Image Analysis</h3>
        <div class="images-section">
          <div class="image-card">
            <div class="image-header">Original Uploaded Scan</div>
            <div class="image-body">
              <img src="data:image/jpeg;base64,${report.original_img_base64}" />
            </div>
          </div>
          <div class="image-card">
            <div class="image-header">YOLO Bounding Boxes</div>
            <div class="image-body">
              <img src="data:image/jpeg;base64,${report.annotated_img_base64}" />
            </div>
          </div>
          ${report.heatmap_img_base64 ? `
          <div class="image-card">
            <div class="image-header">XAI Saliency Heatmap</div>
            <div class="image-body">
              <img src="data:image/jpeg;base64,${report.heatmap_img_base64}" />
            </div>
          </div>` : ''}
        </div>

        <!-- Technical Section -->
        <h3 class="section-title">Technical Specifications</h3>
        <div class="tech-box">
          <ul class="tech-list">
            <li><strong>Model Architecture:</strong> YOLOv8 (Custom Trained)</li>
            <li><strong>Dataset Base:</strong> Proprietary custom dental cavity dataset</li>
            <li><strong>Explainability Method:</strong> Post-inference mock saliency via spatial blur</li>
            <li><strong>Processing:</strong> Edge-based local inference</li>
          </ul>
        </div>

        <!-- Disclaimer -->
        <div class="disclaimer">
          <strong>DISCLAIMER:</strong> This Artificial Intelligence system is designed for educational and preliminary screening purposes only. It does not replace a professional diagnosis by a licensed dentist. Always consult a qualified healthcare provider for medical advice and treatment.
          <br/><br/>
          DentalVision AI &copy; 2026 | Generated Automatically
        </div>
      </div>
    `;

    const opt = {
      margin:       0,
      filename:     `DentalVision_Report_${report.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const processedReports = getFilteredAndSortedReports();

  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Prediction History</h2>
          <p className="text-slate-500 mt-1">Locally secured SQLite anomaly reports generated by the cavity detection module.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['all', 'today', 'week', 'month'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${filter === f ? 'bg-white shadow pointer-events-none text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f === 'week' ? 'This Week' : (f === 'month' ? 'This Month' : f)}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters: Search and Sort */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm shadow-sm transition-all"
            placeholder="Search by Report ID or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-slate-400" />
          </div>
          <select
            className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 sm:text-sm shadow-sm appearance-none cursor-pointer text-slate-700 font-medium"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Sort by Newest</option>
            <option value="oldest">Sort by Oldest</option>
            <option value="highest_confidence">Highest Confidence</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center h-64 text-sky-600">
           <Activity className="w-10 h-10 animate-spin mb-4" />
           <p className="font-semibold text-slate-600">Querying Database...</p>
        </div>
      )}

      {!loading && dbError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 mb-3 text-red-500" />
          <h3 className="text-lg font-bold">Database Connection Error</h3>
          <p>{dbError}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !dbError && processedReports.length === 0 && (
         <div className="bg-slate-50 border border-slate-200 border-dashed p-12 rounded-2xl flex flex-col items-center justify-center text-center">
          <Search className="w-12 h-12 mb-3 text-slate-300" />
          <h3 className="text-lg font-bold text-slate-700">No Reports Found</h3>
          <p className="text-slate-500">Run a cavity detection scan or adjust your search filters.</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !dbError && processedReports.length > 0 && (
        <motion.div variants={staggerContainer} initial="initial" animate="in" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {processedReports.map((r) => (
              <motion.div 
                layout
                key={r.id} 
                variants={cardVariants} 
                initial="initial" animate="in" exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                
                <div className="flex bg-slate-50 p-3 items-center justify-between border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report #{r.id}</span>
                  <span className="flex items-center text-xs font-medium text-slate-500"><Calendar className="w-3.5 h-3.5 mr-1"/> {new Date(r.date_time).toLocaleDateString()}</span>
                </div>

                <div className="flex h-36 bg-slate-900 border-b border-slate-200">
                   <div className="flex-1 border-r border-slate-800 p-1 relative">
                      <span className="absolute top-1 left-1 bg-black/60 text-[9px] text-white px-1.5 rounded uppercase font-bold tracking-widest z-10">Original</span>
                      <img src={`data:image/jpeg;base64,${r.original_img_base64}`} alt="orig" className="w-full h-full object-contain mix-blend-screen" />
                   </div>
                   <div className="flex-1 p-1 flex items-center justify-center relative">
                      <span className="absolute top-1 left-1 bg-sky-600/80 text-[9px] text-white px-1.5 rounded uppercase font-bold tracking-widest z-10">Detection</span>
                      <img src={`data:image/jpeg;base64,${r.annotated_img_base64}`} alt="YOLO" className="w-full h-full object-contain" />
                   </div>
                </div>

                <div className="p-5 flex-1">
                   <div className={`inline-flex items-center text-xs font-bold uppercase tracking-wider px-2 py-1 rounded mb-3 ${r.cavity_count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {r.cavity_count} {r.cavity_count === 1 ? 'Anomaly' : 'Anomalies'}
                   </div>
                   <h4 className="text-sm font-semibold text-slate-800 line-clamp-2">{r.summary}</h4>
                   <div className="mt-4 flex items-center space-x-4 border-t border-slate-100 pt-4">
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Confidence</p>
                        <p className="text-lg font-black text-slate-800">{(r.confidence * 100).toFixed(1)}%</p>
                      </div>
                   </div>
                </div>

                <div className="border-t border-slate-100 p-2 flex gap-1 bg-slate-50">
                   <button onClick={() => setSelectedReport(r)} className="flex-1 flex items-center justify-center py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors rounded">
                      <Eye className="w-4 h-4 mr-1.5" /> View
                   </button>
                   <button onClick={() => downloadPDF(r)} className="flex items-center justify-center py-2 px-3 text-sm font-semibold text-sky-600 hover:bg-sky-100 transition-colors rounded" title="Download PDF">
                      <Download className="w-4 h-4" />
                   </button>
                   <button onClick={() => setDeleteId(r.id)} className="flex items-center justify-center py-2 px-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* View Modal */}
      <AnimatePresence>
        {selectedReport && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-bold text-lg text-slate-800 flex items-center"><FileText className="w-5 h-5 mr-2 text-indigo-500" /> Report #{selectedReport.id}</h3>
                 <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-700 bg-white shadow-sm p-1.5 rounded-lg border border-slate-200 font-bold">Close X</button>
              </div>
              <div className="p-6 overflow-y-auto">
                 <div className="flex flex-col md:flex-row gap-6 mb-6">
                    <div className="flex-1">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Patient Scan Input</h4>
                       <img src={`data:image/jpeg;base64,${selectedReport.original_img_base64}`} className="w-full rounded border border-slate-200" alt="Original" />
                    </div>
                    <div className="flex-1">
                       <h4 className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-2">YOLO Detection Vector</h4>
                       <img src={`data:image/jpeg;base64,${selectedReport.annotated_img_base64}`} className="w-full rounded border border-sky-200" alt="Detected" />
                    </div>
                    <div className="flex-1">
                       <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">XAI Saliency Region</h4>
                       <img src={`data:image/jpeg;base64,${selectedReport.heatmap_img_base64}`} className="w-full rounded border border-indigo-200" alt="Heatmap" />
                    </div>
                 </div>
                 <div className={`p-4 rounded-xl border flex items-start gap-4 ${selectedReport.cavity_detected ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    {selectedReport.cavity_detected ? <AlertTriangle className="w-8 h-8 text-amber-500 mt-1" /> : <CheckCircle className="w-8 h-8 text-emerald-500 mt-1" />}
                    <div>
                      <h4 className="font-bold text-lg">{selectedReport.cavity_count} Anomalies Detected</h4>
                      <p className="text-sm mt-1 mb-2 font-medium">{selectedReport.summary}</p>
                      <p className="text-xs opacity-75">Date Scanned: {new Date(selectedReport.date_time).toLocaleString()}</p>
                      <p className="text-xs opacity-75 mt-0.5">Model Confidence: {(selectedReport.confidence * 100).toFixed(1)}%</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-xl text-center">
               <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle className="w-8 h-8" />
               </div>
               <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Report #{deleteId}?</h3>
               <p className="text-sm text-slate-500 mb-6">This action will permanently erase the scan from the local database. You cannot undo this.</p>
               <div className="flex gap-3">
                 <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200">Cancel</button>
                 <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 shadow-md shadow-red-200">Erase</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default Reports;
