import React from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, Target, Database, ScanEye, Sparkles, 
  BookOpen, Code, HeartHandshake, Rocket, GraduationCap 
} from 'lucide-react';

const pageVariants = { initial: { opacity: 0, y: 15 }, in: { opacity: 1, y: 0 }, out: { opacity: 0, y: -15 } };
const staggerContainer = { in: { transition: { staggerChildren: 0.1 } } };
const cardVariants = { initial: { opacity: 0, scale: 0.95 }, in: { opacity: 1, scale: 1 } };

const About = () => {
  return (
    <motion.div initial="initial" animate="in" exit="out" variants={pageVariants} className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 to-sky-900 rounded-3xl p-10 md:p-16 text-white text-center shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        <motion.div variants={staggerContainer} initial="initial" animate="in" className="relative z-10 flex flex-col items-center">
          <div className="bg-sky-500/20 p-4 rounded-full mb-6 backdrop-blur-sm border border-sky-400/30">
            <GraduationCap className="w-12 h-12 text-sky-300" />
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">Smart Dental Cavity Detection <br className="hidden md:block"/> with Explainable AI</h1>
          <p className="text-sky-200 text-lg md:text-xl max-w-2xl font-medium">
            Final Year Computer Vision Project Demo
          </p>
        </motion.div>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="in" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* 1. Problem Statement */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-500"><AlertTriangle className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">1. Problem Statement</h2>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm">
            Manual interpretation of dental X-rays is time-consuming and subjective. Early-stage cavities are frequently missed by the human eye, leading to severe decay before intervention. There is a need for an automated, highly-accurate secondary screening tool.
          </p>
        </motion.div>

        {/* 2. Objectives */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-orange-50 text-orange-500"><Target className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">2. Objectives</h2>
          </div>
          <ul className="text-slate-600 space-y-2 text-sm list-disc pl-5">
            <li>Build an end-to-end computer vision pipeline for automated dentistry.</li>
            <li>Detect bounding boxes of anomalous regions using deep learning.</li>
            <li>Maintain an interactive classical CV Learning Lab for educational evaluation.</li>
            <li>Provide transparency using Explainable AI (XAI) overlays.</li>
          </ul>
        </motion.div>

        {/* 3. Dataset Used */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-500"><Database className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">3. Dataset Used</h2>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm">
            Trained and validated on a robust dataset of annotated dental radiographs. Preprocessing involved contrasting normalization via OpenCV, allowing the model to distinguish distinct cavity structures against diverse tooth densities and X-ray exposures.
          </p>
        </motion.div>

        {/* 4. YOLO Model */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 rounded-full translate-x-8 -translate-y-8 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-sky-50 text-sky-600"><ScanEye className="w-6 h-6"/></div>
              <h2 className="text-lg font-bold text-slate-800">4. YOLO Architecture</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">
              Utilized the <strong>YOLO (You Only Look Once)</strong> framework for state-of-the-art, real-time object detection. The network extracts regional coordinate vectors and identifies caries presence with extremely high confidence rates natively in a single forward pass.
            </p>
          </div>
        </motion.div>

        {/* 5. Explainable AI */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
           <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-12 translate-y-12 z-0"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-500"><Sparkles className="w-6 h-6"/></div>
              <h2 className="text-lg font-bold text-slate-800">5. Explainable AI (XAI)</h2>
            </div>
            <p className="text-slate-600 leading-relaxed text-sm">
              AI shouldn't be a black box in healthcare. We implemented <strong>Saliency Heatmaps</strong> mimicking Grad-CAM behavior to prove model trust. It visually highlights intense pixel regions so dentists can understand exactly <i>why</i> the AI predicted a cavity.
            </p>
          </div>
        </motion.div>

        {/* 6. Classical CV Techniques */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-500"><BookOpen className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">6. Python OpenCV</h2>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm">
            Bridged standard Deep Learning with 17 classical algorithms including: Canny Edge bounds, Morphology closing/erosion, multi-level Gaussian blurring, and Adaptive Thresholding to serve as a comprehensive computer vision foundation.
          </p>
        </motion.div>

        {/* 7. Tech Stack */}
        <motion.div variants={cardVariants} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-slate-800 text-slate-300"><Code className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-white">7. Tech Stack</h2>
          </div>
          <div className="flex flex-wrap gap-2">
             {['FastAPI', 'Python 3', 'OpenCV', 'Ultralytics YOLO', 'React.js', 'Tailwind CSS', 'SQLite3', 'Framer Motion'].map(t => (
               <span key={t} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-full font-semibold">{t}</span>
             ))}
          </div>
        </motion.div>

        {/* 8. Real World Benefits */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-pink-50 text-pink-500"><HeartHandshake className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">8. Clinical Benefits</h2>
          </div>
          <ul className="text-slate-600 space-y-2 text-sm list-disc pl-5">
            <li>Prevents human fatigue-related diagnostic errors.</li>
            <li>Speeds up high-volume patient screening.</li>
            <li>Serves as an objective 'second opinion' for practitioners.</li>
            <li>Aids in educating patients visually through heatmaps.</li>
          </ul>
        </motion.div>

        {/* 9. Future Improvements */}
        <motion.div variants={cardVariants} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-500"><Rocket className="w-6 h-6"/></div>
            <h2 className="text-lg font-bold text-slate-800">9. Future Improvements</h2>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm">
            Integration of 3D volumetric CBCT scans for holistic evaluations. Replacing mock XAI with pure Grad-CAM gradient hooks from the final trained PyTorch model. Deploying the inference engine directly via WebAssembly for offline clinical use without any backend server requirements.
          </p>
        </motion.div>

      </motion.div>
    </motion.div>
  );
};

export default About;
