import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TimeWindow = 'day' | 'week' | 'month';
export type StrategyType = 'optimised_lp' | 'rule_based' | 'grid_only';

interface GlobalState {
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  strategy: StrategyType;
  setStrategy: (s: StrategyType) => void;
  batteryKwh: number;
  setBatteryKwh: (kwh: number) => void;
  batteryKw: number;
  setBatteryKw: (kw: number) => void;
  startDate: string;
  endDate: string;
  setDateRange: (start: string, end: string) => void;
  resetToDefaults: () => void;
  isScenarioOpen: boolean;
  setIsScenarioOpen: (open: boolean) => void;
}

const GlobalStateContext = createContext<GlobalState | null>(null);

const DEFAULT_START = '2026-05-26';
const DEFAULT_STRATEGY: StrategyType = 'optimised_lp';
const DEFAULT_BATTERY_KWH = 10.0;
const DEFAULT_BATTERY_KW = 5.0;

function computeEndDate(startDate: string, window: TimeWindow): string {
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '2026-05-26 23:00:00';

  if (window === 'day') {
    return `${startDate} 23:00:00`;
  } else if (window === 'week') {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} 23:00:00`;
  } else {
    // month
    const end = new Date(d);
    end.setDate(end.getDate() + 29);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} 23:00:00`;
  }
}

export const GlobalStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isScenarioOpen, setIsScenarioOpen] = React.useState(false);

  const window = (searchParams.get('window') as TimeWindow) || 'day';
  const strategy = (searchParams.get('strategy') as StrategyType) || DEFAULT_STRATEGY;
  const batteryKwh = parseFloat(searchParams.get('battery_kwh') || String(DEFAULT_BATTERY_KWH));
  const batteryKw = parseFloat(searchParams.get('battery_kw') || String(DEFAULT_BATTERY_KW));
  const startDate = searchParams.get('start') || DEFAULT_START;
  const endDate = searchParams.get('end') || computeEndDate(startDate, window);

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(key, value);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setWindow = useCallback(
    (w: TimeWindow) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('window', w);
          const currentStart = next.get('start') || DEFAULT_START;
          next.set('end', computeEndDate(currentStart, w));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setStrategy = useCallback(
    (s: StrategyType) => {
      updateParam('strategy', s);
    },
    [updateParam]
  );

  const setBatteryKwh = useCallback(
    (kwh: number) => {
      updateParam('battery_kwh', kwh.toString());
    },
    [updateParam]
  );

  const setBatteryKw = useCallback(
    (kw: number) => {
      updateParam('battery_kw', kw.toString());
    },
    [updateParam]
  );

  const setDateRange = useCallback(
    (start: string, end: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('start', start);
          next.set('end', end);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const resetToDefaults = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('strategy', DEFAULT_STRATEGY);
        next.set('battery_kwh', String(DEFAULT_BATTERY_KWH));
        next.set('battery_kw', String(DEFAULT_BATTERY_KW));
        next.set('window', 'week');
        const currentStart = next.get('start') || DEFAULT_START;
        next.set('end', computeEndDate(currentStart, 'week'));
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const value = useMemo(
    () => ({
      window,
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
      resetToDefaults,
      isScenarioOpen,
      setIsScenarioOpen,
    }),
    [
      window,
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
      resetToDefaults,
      isScenarioOpen,
    ]
  );

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
};

export function useGlobalState(): GlobalState {
  const ctx = useContext(GlobalStateContext);
  if (!ctx) {
    throw new Error('useGlobalState must be used within GlobalStateProvider');
  }
  return ctx;
}

