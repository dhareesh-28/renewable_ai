import React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';

export interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultValue,
  value,
  onValueChange,
  className = '',
}) => {
  return (
    <RadixTabs.Root
      defaultValue={defaultValue || items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={`flex flex-col w-full ${className}`}
    >
      <RadixTabs.List className="flex items-center gap-6 border-b border-hairline pb-px mb-6">
        {items.map((tab) => (
          <RadixTabs.Trigger
            key={tab.value}
            value={tab.value}
            className="group relative pb-3 text-ui font-normal text-muted hover:text-ink transition-colors cursor-pointer data-[state=active]:text-ink data-[state=active]:font-medium after:content-[''] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1.5px] after:bg-ink after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform after:duration-200"
          >
            {tab.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((tab) => (
        <RadixTabs.Content
          key={tab.value}
          value={tab.value}
          className="focus:outline-none"
        >
          {tab.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
};

