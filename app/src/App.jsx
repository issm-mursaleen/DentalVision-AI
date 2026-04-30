import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CavityDetection from './pages/CavityDetection';
import OralScreening from './pages/OralScreening';
import CVLearningLab from './pages/CVLearningLab';
import Reports from './pages/Reports';
import About from './pages/About';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="cavity-detection" element={<CavityDetection />} />
        <Route path="oral-screening" element={<OralScreening />} />
        <Route path="learning-lab" element={<CVLearningLab />} />
        <Route path="reports" element={<Reports />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}

export default App;

