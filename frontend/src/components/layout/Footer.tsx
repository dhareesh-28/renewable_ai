import React from 'react';
import { BRAND_NAME, BRAND_TAGLINE } from '../../brand';
import { PillButton } from '../ui/Button';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-moss text-moss-text border-t border-hairline/20 mt-28">
      <div className="max-w-[1320px] mx-auto px-6 py-20 md:py-28">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-hairline/20">
          {/* Brand Col */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <span className="font-serif text-3xl font-light tracking-tight text-[#FAF7F2]">
                {BRAND_NAME}
              </span>
              <p className="mt-3 text-moss-text/75 text-body max-w-sm font-light">
                {BRAND_TAGLINE}
              </p>
            </div>
            <div className="mt-8 text-caption text-moss-text/60 font-sans">
              Autonomous microgrid optimization for residential solar, battery, and dynamic time-of-use tariffs.
            </div>
          </div>

          {/* Core Modules Col */}
          <div className="md:col-span-3">
            <span className="text-[11px] uppercase tracking-label text-moss-text/60 font-normal block mb-4">
              Core Modules
            </span>
            <ul className="space-y-2.5 text-ui font-light">
              <li>
                <a href="/forecast" className="hover:text-white transition-colors">
                  Random Forest Forecasting
                </a>
              </li>
              <li>
                <a href="/energy" className="hover:text-white transition-colors">
                  HiGHS Linear Programming
                </a>
              </li>
              <li>
                <a href="/cost" className="hover:text-white transition-colors">
                  Time-of-Use Arbitrage
                </a>
              </li>
              <li>
                <a href="/models" className="hover:text-white transition-colors">
                  Isolation Forest Diagnostics
                </a>
              </li>
            </ul>
          </div>

          {/* System Specs Col */}
          <div className="md:col-span-4">
            <span className="text-[11px] uppercase tracking-label text-moss-text/60 font-normal block mb-4">
              Simulated Architecture
            </span>
            <div className="space-y-2 text-caption text-moss-text/75 tabular-nums font-sans">
              <div className="flex justify-between py-1 border-b border-hairline/10">
                <span>Photovoltaic Array</span>
                <span className="font-sans text-moss-text font-medium">10.0 kWp</span>
              </div>
              <div className="flex justify-between py-1 border-b border-hairline/10">
                <span>Storage System</span>
                <span className="font-sans text-moss-text font-medium">10.0 kWh (5.0 kW)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-hairline/10">
                <span>Optimizer Solver</span>
                <span className="font-sans text-moss-text font-medium">linear programming (SciPy HiGHS)</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Simulation Seed</span>
                <span className="font-sans text-moss-text font-medium">42</span>
              </div>
            </div>

            <div className="mt-6">
              <PillButton
                variant="light"
                showArrow={false}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Return to Top ↑
              </PillButton>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-caption text-moss-text/50 gap-4">
          <div>
            © 2026 {BRAND_NAME} System. Software-Only Academic Renewable Optimization Project.
          </div>
          <div className="flex items-center gap-6">
            <span>FastAPI</span>
            <span>React + Vite</span>
            <span>Apache ECharts</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

