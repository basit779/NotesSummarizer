'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/github-dark.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Renders AI-generated markdown notes with premium study-note typography.
 * Supports GFM tables, task lists, code blocks with syntax highlighting,
 * blockquotes, and inline code.
 */
export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={cn('ss-md', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="mono text-[26px] md:text-[30px] leading-tight font-semibold tracking-tightest text-white mt-8 first:mt-0 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mono text-[20px] md:text-[22px] leading-tight font-semibold tracking-tight text-white mt-8 first:mt-0 mb-3 flex items-center gap-2.5">
              <span className="inline-block h-4 w-[3px] rounded-full bg-mint-400" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mono text-[16.5px] font-semibold text-white/95 mt-6 mb-2 tracking-tight">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mono text-[14.5px] font-semibold text-white/85 mt-5 mb-1.5 uppercase tracking-wider text-mint-300">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[15.5px] leading-[1.75] text-white/80 mb-4 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 space-y-2 list-none pl-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 space-y-2 list-decimal pl-6 text-[15px] text-white/80 [&_li]:pl-1 marker:text-mint-400 marker:font-mono marker:text-[13px]">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            // react-markdown passes `ordered` on some builds; don't leak it to DOM.
            const isOrdered = (props as { ordered?: boolean }).ordered;
            if (isOrdered) return <li className="text-[15px] leading-relaxed text-white/80">{children}</li>;
            return (
              <li className="flex gap-2.5 text-[15px] leading-relaxed text-white/80">
                <span className="mt-[0.55em] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-mint-400/80" />
                <span className="flex-1 min-w-0">{children}</span>
              </li>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-5 rounded-xl border-l-2 border-mint-400/60 bg-mint-500/[0.04] pl-4 pr-4 py-3 text-white/80 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className?.includes('language-');
            if (inline) {
              return (
                <code className="mono rounded-md bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-[13px] text-mint-300">
                  {children}
                </code>
              );
            }
            return (
              <code className={cn('mono text-[13px]', className)} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-5 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0b0b0d] p-4 text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mint-400 hover:text-mint-300 underline underline-offset-2 decoration-mint-400/30 transition-colors cursor-pointer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-mint-300 not-italic">{children}</em>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-white/[0.06] px-4 py-2.5 text-left text-[12px] mono font-semibold text-white/70 tracking-wider uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/[0.04] px-4 py-2.5 text-[14px] text-white/80">{children}</td>
          ),
          tr: ({ children }) => <tr className="hover:bg-white/[0.015] transition-colors">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
