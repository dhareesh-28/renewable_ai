import React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onValueChange,
  label,
  placeholder = 'Select...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11px] uppercase tracking-label text-muted font-normal select-none">
          {label}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          className="inline-flex items-center justify-between gap-3 px-3.5 py-2 text-ui bg-raised border border-hairline rounded-control text-ink hover:border-ink/50 focus:outline-none focus:border-ink transition-colors cursor-pointer select-none"
          aria-label={label}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className="text-muted shrink-0">
            <ChevronDown size={14} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 min-w-[200px] bg-raised border border-hairline rounded-control shadow-md py-1.5 text-ui text-ink overflow-hidden animate-in fade-in-80 duration-150"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((opt) => (
                <RadixSelect.Item
                  key={opt.value}
                  value={opt.value}
                  className="relative flex items-center justify-between px-3 py-2 text-ui rounded-[4px] cursor-pointer outline-none select-none hover:bg-surface focus:bg-surface data-[highlighted]:bg-surface transition-colors"
                >
                  <div className="flex flex-col">
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    {opt.description && (
                      <span className="text-caption text-muted">{opt.description}</span>
                    )}
                  </div>
                  <RadixSelect.ItemIndicator className="text-ink ml-2">
                    <Check size={14} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
};

