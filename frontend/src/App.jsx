import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import PublicDisplay from './pages/PublicDisplay';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicDisplay />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
