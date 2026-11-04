import React, { useState, useEffect, useRef } from 'react';
import { useGlobalState } from '../../context/GlobalStateContext';
import { DateRangePicker } from '../ui/DateRangePicker';
import { TextToggle } from '../ui/TextToggle';
import { Slider } from '../ui/Slider';
import { TextLink } from '../ui/Button';

interface ScenarioBarProps {
  showBatteryControls?: boolean;
}

export const ScenarioBar: React.FC<ScenarioBarProps> = ({ showBatteryControls = false }) => {
  const {
    strategy,
    setStrategy,
    batteryKwh,
    setBatteryKwh,
    batteryKw,
    setBatteryKw,
    startDate,
    endDate,
    setDateRange,
    resetToDefaults,
  } = useGlobalState();

  // Local state for 400ms debounced sliders so UI moves instantly at 60fps
  const [localKwh, setLocalKwh] = useState(batteryKwh);
  const [localKw, setLocalKw] = useState(batteryKw);

  // Sync from external / URL changes immediately
  useEffect(() => {
    setLocalKwh(batteryKwh);
  }, [batteryKwh]);

  useEffect(() => {
    setLocalKw(batteryKw);
  }, [batteryKw]);

  const kwhTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleKwhChange = (val: number) => {
    setLocalKwh(val);
    if (kwhTimerRef.current) clearTimeout(kwhTimerRef.current);
    kwhTimerRef.current = setTimeout(() => {
      setBatteryKwh(val);
    }, 400);
  };

  const kwTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleKwChange = (val: number) => {
    setLocalKw(val);
    if (kwTimerRef.current) clearTimeout(kwTimerRef.current);
    kwTimerRef.current = setTimeout(() => {
      setBatteryKw(val);
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (kwhTimerRef.current) clearTimeout(kwhTimerRef.current);
      if (kwTimerRef.current) clearTimeout(kwTimerRef.current);
    };
  }, []);

  const strategyOptions = [
    { value: 'grid_only' as const, label: 'Grid-only' },
    { value: 'rule_based' as const, label: 'Rule-based' },
    { value: 'optimised_lp' as const, label: 'Optimised' },
  ];

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    if (kwhTimerRef.current) clearTimeout(kwhTimerRef.current);
    if (kwTimerRef.current) clearTimeout(kwTimerRef.current);
    resetToDefaults();
  };

  return (
    <div className="sticky top-18 md:top-20 z-20 w-full bg-surface/95 backdrop-blur-[6px] border-b border-hairline py-3">
      <div className="max-w-[1320px] mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        {/* Left Controls */}
        <div className="flex flex-wrap items-center gap-6">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onRangeChange={setDateRange}
          />

          <TextToggle
            items={strategyOptions}
            value={strategy}
            onChange={setStrategy}
            layoutId="scenarioStrategyToggle"
          />

          {showBatteryControls && (
            <div className="flex items-center gap-6 pl-4 border-l border-hairline">
              <div className="w-36">
                <Slider
                  label="Capacity"
                  value={localKwh}
                  onValueChange={handleKwhChange}
                  min={5.0}
                  max={30.0}
                  step={1.0}
                  unit="kWh"
                />
              </div>
              <div className="w-36">
                <Slider
                  label="Power"
                  value={localKw}
                  onValueChange={handleKwChange}
                  min={2.0}
                  max={10.0}
                  step={0.5}
                  unit="kW"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right reset action */}
        <div>
          <TextLink href="#reset" onClick={handleReset} showArrow={false} className="text-caption text-muted hover:text-ink">
            Reset to defaults
          </TextLink>
        </div>
      </div>
    </div>
  );
};
