interface CodeBlockProps {
  code: string;
  startLine: number;
  highlightLines?: number[];
}

export function CodeBlock({ code, startLine, highlightLines = [] }: CodeBlockProps) {
  const lines = code.split('\n');
  const highlightSet = new Set(highlightLines);

  return (
    <pre
      className="text-xs p-3 rounded overflow-x-auto font-mono"
      style={{
        background: 'var(--vscode-textCodeBlock-background)',
        border: '1px solid var(--border)',
      }}
    >
      <code>
        {lines.map((line, i) => {
          const lineNum = startLine + i;
          const isHighlighted = highlightSet.has(lineNum);
          return (
            <div
              key={lineNum}
              className={`flex ${isHighlighted ? 'bg-yellow-500/10' : ''}`}
            >
              <span className="inline-block w-10 text-right pr-3 opacity-40 select-none shrink-0">
                {lineNum}
              </span>
              <span className="flex-1">{line}</span>
            </div>
          );
        })}
      </code>
    </pre>
  );
}
