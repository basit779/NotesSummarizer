'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';
import 'highlight.js/styles/github.css';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/** Defence-in-depth on top of react-markdown's default urlTransform: only allow
 *  http(s)/mailto links from AI-generated content. Anything else (javascript:,
 *  data:, etc.) is dropped so a crafted PDF/AI output can't inject a clickable
 *  script URL. */
function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const v = href.trim();
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (v.startsWith('/') || v.startsWith('#')) return v;
  return undefined;
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
            <h1 className="mono text-[26px] md:text-[30px] leading-tight font-semibold tracking-tightest text-black mt-8 first:mt-0 mb-4">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mono text-[20px] md:text-[22px] leading-tight font-semibold tracking-tight text-black mt-8 first:mt-0 mb-3 flex items-center gap-2.5">
              <span className="inline-block h-4 w-[3px] rounded-full bg-black" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mono text-[16.5px] font-semibold text-black/90 mt-6 mb-2 tracking-tight">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mono text-[14.5px] font-semibold text-black/70 mt-5 mb-1.5 uppercase tracking-wider">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[15.5px] leading-[1.75] text-black/75 mb-4 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 space-y-2 list-none pl-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 space-y-2 list-decimal pl-6 text-[15px] text-black/75 [&_li]:pl-1 marker:text-black/50 marker:font-mono marker:text-[13px]">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            // react-markdown passes `ordered` on some builds; don't leak it to DOM.
            const isOrdered = (props as { ordered?: boolean }).ordered;
            if (isOrdered) return <li className="text-[15px] leading-relaxed text-black/75">{children}</li>;
            return (
              <li className="flex gap-2.5 text-[15px] leading-relaxed text-black/75">
                <span className="mt-[0.55em] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                <span className="flex-1 min-w-0">{children}</span>
              </li>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-5 rounded-xl border-l-2 border-black/40 bg-black/[0.03] pl-4 pr-4 py-3 text-black/75 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className?.includes('language-');
            if (inline) {
              return (
                <code className="mono rounded-md bg-black/[0.06] border border-black/[0.08] px-1.5 py-0.5 text-[13px] text-black/80">
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
            <pre className="my-5 overflow-x-auto rounded-xl border border-black/[0.08] bg-[#fafafa] p-4 text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={safeHref(href)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:text-black/70 underline underline-offset-2 decoration-black/30 transition-colors cursor-pointer"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-black/[0.1] to-transparent" />,
          strong: ({ children }) => <strong className="text-black font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-black/70">{children}</em>,
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-xl border border-black/[0.08]">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-black/[0.03]">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-black/[0.08] px-4 py-2.5 text-left text-[12px] mono font-semibold text-black/70 tracking-wider uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-black/[0.06] px-4 py-2.5 text-[14px] text-black/75">{children}</td>
          ),
          tr: ({ children }) => <tr className="hover:bg-black/[0.015] transition-colors">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
