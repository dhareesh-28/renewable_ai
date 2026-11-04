import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { BRAND_NAME } from './brand';
import { Nav } from './components/layout/Nav';
import { Footer } from './components/layout/Footer';
import Home from './pages/Home';
import Forecast from './pages/Forecast';
import Energy from './pages/Energy';
import Cost from './pages/Cost';
import Models from './pages/Models';
import DesignPreview from './pages/DesignPreview';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  const location = useLocation();
  const isOverHero = location.pathname === '/';

  // Distinct document title per route
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': `${BRAND_NAME} — Renewable Energy Architecture & Microgrid Management`,
      '/forecast': `${BRAND_NAME} — Solar Generation Forecast & Fault Diagnostics`,
      '/energy': `${BRAND_NAME} — Energy Storage & Nodal Balance Dispatch`,
      '/cost': `${BRAND_NAME} — Tariff Arbitrage & Cost Optimization`,
      '/models': `${BRAND_NAME} — Machine Learning Model Benchmarks & Scientific Rigor`,
      '/_design': `${BRAND_NAME} — Design System Tokens & Component Library`,
    };
    document.title = titles[location.pathname] || `${BRAND_NAME} — Page Not Found`;
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      <Nav isOverHero={isOverHero} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/energy" element={<Energy />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/models" element={<Models />} />
          <Route path="/_design" element={<DesignPreview />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default App;

