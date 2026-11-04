import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND_NAME } from '../../brand';
import { useGlobalState, TimeWindow, StrategyType } from '../../context/GlobalStateContext';
import { TextToggle } from '../ui/TextToggle';
import { PillButton } from '../ui/Button';
import { SideSheet } from '../ui/SideSheet';
import { Select } from '../ui/Select';
import { Slider } from '../ui/Slider';
import { DateRangePicker } from '../ui/DateRangePicker';
import { MENU_OVERLAY_VARIANTS, MENU_ITEM_VARIANTS } from '../../motion';

interface NavProps {
  isOverHero?: boolean;
}

export const Nav: React.FC<NavProps> = ({ isOverHero = false }) => {
  const location = useLocation();
  const {
    window: timeWindow,
    setWindow,
    strategy,
    setStrategy,
    batteryKwh,
    setBatteryKwh,
    batteryKw,
    setBatteryKw,
    startDate,
    endDate,
    setDateRange,
    isScenarioOpen,
    setIsScenarioOpen,
  } = useGlobalState();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Handle scroll detection: transparent over hero, solid ivory when scrolled, hide down/show up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Solid background after 60px
      if (currentScrollY > 60) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        setIsVisible(false); // scrolling down
      } else {
        setIsVisible(true); // scrolling up
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Determine styling based on position and hero state
  const isTransparent = isOverHero && !isScrolled && !isMenuOpen;
  const textColorClass = isTransparent ? 'text-white' : 'text-ink';
  const borderColorClass = isTransparent ? 'border-white/20' : 'border-hairline';
  const bgClass = isTransparent
    ? 'bg-transparent'
    : 'bg-bg/95 backdrop-blur-[8px]';

  const menuItems = [
    { num: '(01)', label: 'Overview', path: '/' },
    { num: '(02)', label: 'Forecast', path: '/forecast' },
    { num: '(03)', label: 'Energy Dispatch', path: '/energy' },
    { num: '(04)', label: 'Cost Analysis', path: '/cost' },
    { num: '(05)', label: 'Models & Diagnostics', path: '/models' },
    { num: '(06)', label: 'Design System', path: '/_design' },
  ];

  const strategyOptions = [
    { value: 'optimised_lp', label: 'Optimised (Linear Programming)' },
    { value: 'rule_based', label: 'Rule-Based Self Consumption' },
    { value: 'grid_only', label: 'Grid-Only Baseline (No Battery)' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        } ${bgClass} border-b ${borderColorClass}`}
      >
        <div className="max-w-[1320px] mx-auto px-6 h-18 md:h-20 flex items-center justify-between">
          {/* Left: Brand Wordmark */}
          <Link
            to="/"
            className={`font-serif tracking-tight text-2xl font-light select-none transition-colors duration-200 ${textColorClass}`}
          >
            {BRAND_NAME}
          </Link>

          {/* Centre: TextToggle Day · Week · Month (hidden below 1024px, moves to menu overlay) */}
          <div className="hidden lg:flex items-center">
            <TextToggle<TimeWindow>
              items={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              value={timeWindow}
              onChange={setWindow}
              layoutId="navTimeWindow"
            />
          </div>

          {/* Right: Pill Button "Run scenario" + Two-line Menu Icon */}
          <div className="flex items-center gap-4">
            <PillButton
              variant={isTransparent ? 'light' : 'primary'}
              showArrow={false}
              onClick={() => setIsScenarioOpen(true)}
              className="hidden sm:inline-flex"
            >
              Run scenario
            </PillButton>

            {/* Two-line Menu Icon */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2.5 flex flex-col justify-center items-center gap-1.5 cursor-pointer rounded-full transition-colors ${
                isTransparent ? 'hover:bg-white/10' : 'hover:bg-surface'
              }`}
              aria-label={isMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              <motion.span
                animate={isMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`w-6 h-[1.5px] block ${
                  isMenuOpen ? 'bg-ink' : isTransparent ? 'bg-white' : 'bg-ink'
                }`}
              />
              <motion.span
                animate={isMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`w-6 h-[1.5px] block ${
                  isMenuOpen ? 'bg-ink' : isTransparent ? 'bg-white' : 'bg-ink'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Full-Screen Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={MENU_OVERLAY_VARIANTS}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-30 bg-bg text-ink flex flex-col justify-between px-6 md:px-12 pt-20 md:pt-22 pb-4 md:pb-6 overflow-y-auto"
          >
            <div className="max-w-[1320px] w-full mx-auto my-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 pb-2 md:pb-2.5 border-b border-hairline/60 gap-3">
                <div className="text-[11px] uppercase tracking-label text-muted">
                  Navigation Directory
                </div>
                {/* Centre toggle moved into menu overlay below 1024px */}
                <div className="lg:hidden flex items-center gap-3">
                  <span className="text-caption text-muted uppercase tracking-label">Window:</span>
                  <TextToggle<TimeWindow>
                    items={[
                      { value: 'day', label: 'Day' },
                      { value: 'week', label: 'Week' },
                      { value: 'month', label: 'Month' },
                    ]}
                    value={timeWindow}
                    onChange={setWindow}
                    layoutId="mobileNavTimeWindow"
                  />
                </div>
              </div>

              <div className="divide-y divide-hairline">
                {menuItems.map((item, index) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <motion.div
                      key={item.path}
                      variants={MENU_ITEM_VARIANTS}
                      custom={index}
                      className="py-2.5 sm:py-3 md:py-3.5 group"
                    >
                      <Link
                        to={item.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-baseline justify-between w-full"
                      >
                        <div className="flex items-baseline gap-4 md:gap-6">
                          <span className="font-serif italic text-muted text-sm md:text-base font-normal group-hover:text-ink transition-colors">
                            {item.num}
                          </span>
                          <span
                            className={`font-serif text-2xl sm:text-3xl md:text-4xl font-light tracking-tight transition-transform duration-300 group-hover:translate-x-2 relative ${
                              isActive ? 'text-ink font-normal' : 'text-ink/80 group-hover:text-ink'
                            }`}
                          >
                            {item.label}
                            {isActive && (
                              <span className="absolute left-0 -bottom-1 w-full h-[1.5px] bg-brass-rule" />
                            )}
                          </span>
                        </div>
                        <span className="text-caption text-muted uppercase tracking-label opacity-0 group-hover:opacity-100 transition-opacity">
                          Explore →
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="max-w-[1320px] w-full mx-auto pt-3 md:pt-4 border-t border-hairline flex flex-col sm:flex-row items-start sm:items-center justify-between text-caption text-muted gap-2">
              <span>{BRAND_NAME} · Renewable Energy Management & Optimisation System</span>
              <div className="flex items-center gap-6">
                <span>FastAPI + HiGHS + React 18</span>
                <span>Seed 42</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SideSheet for "Run Scenario" */}
      <SideSheet
        open={isScenarioOpen}
        onOpenChange={setIsScenarioOpen}
        title="Simulation Parameters"
        description="Configure dispatch strategy, battery specs, and horizon."
      >
        <div className="space-y-6">
          <Select
            label="Optimization Strategy"
            value={strategy}
            onValueChange={(val) => setStrategy(val as StrategyType)}
            options={strategyOptions}
          />

          <Slider
            label="Battery Capacity"
            value={batteryKwh}
            onValueChange={setBatteryKwh}
            min={5.0}
            max={30.0}
            step={1.0}
            unit="kWh"
          />

          <Slider
            label="Max Battery Power"
            value={batteryKw}
            onValueChange={setBatteryKw}
            min={2.0}
            max={10.0}
            step={0.5}
            unit="kW"
          />

          <div>
            <label className="text-[11px] uppercase tracking-label text-muted font-normal block mb-2">
              Simulation Date Horizon
            </label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onRangeChange={setDateRange}
            />
          </div>

          <div className="pt-4 border-t border-hairline">
            <PillButton
              variant="primary"
              className="w-full"
              onClick={() => setIsScenarioOpen(false)}
            >
              Apply Scenario
            </PillButton>
          </div>
        </div>
      </SideSheet>
    </>
  );
};

