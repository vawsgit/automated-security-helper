import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

const components: Components = {
  // Headings
  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,

  // Block elements
  p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-2 pl-3 my-2 opacity-80 text-sm"
      style={{ borderColor: 'var(--vscode-textBlockQuote-border, var(--border))' }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,

  // Lists
  ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5 text-sm">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  // Code
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre
          className="text-xs p-3 rounded overflow-x-auto font-mono my-2"
          style={{
            background: 'var(--vscode-textCodeBlock-background)',
            border: '1px solid var(--border)',
          }}
        >
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code
        className="text-xs px-1 py-0.5 rounded font-mono"
        style={{ background: 'var(--vscode-textCodeBlock-background)' }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,

  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs w-full border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left px-2 py-1 font-semibold border-b border-border">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border-b border-border">{children}</td>
  ),

  // Inline
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="underline"
      style={{ color: 'var(--vscode-textLink-foreground)' }}
    >
      {children}
    </a>
  ),
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
