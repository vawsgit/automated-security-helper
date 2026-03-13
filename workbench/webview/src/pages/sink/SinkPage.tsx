import { useState } from 'react';
import { sinkRegistry } from './sink-registry';
import { ComponentWrapper } from './components/component-wrapper';
import { SinkHeader } from './components/sink-header';

export default function SinkPage() {
  const [searchFilter, setSearchFilter] = useState('');

  const filtered = Object.entries(sinkRegistry).filter(
    ([, config]) => config.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen">
      <SinkHeader
        searchFilter={searchFilter}
        onSearchChange={setSearchFilter}
      />
      <div className="grid flex-1 gap-4 p-4">
        {filtered.map(([key, config]) => {
          const Demo = config.component;
          return (
            <ComponentWrapper
              key={key}
              name={key}
              className={config.className}
            >
              <Demo />
            </ComponentWrapper>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center opacity-50 py-8 text-sm">
            No components match &quot;{searchFilter}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

SinkPage.displayName = 'SinkPage';
