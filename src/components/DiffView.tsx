import React, { useMemo } from 'react';
import { parseDiff, Diff, Hunk, tokenize } from 'react-diff-view';
import { refractor } from 'refractor';
// Refractor 5.x ESM imports
import javascript from 'refractor/javascript';
import typescript from 'refractor/typescript';
import 'react-diff-view/style/index.css';

// Explicitly register languages
refractor.register(javascript);
refractor.register(typescript);

interface DiffViewProps {
  diffText: string;
}

export const DiffView: React.FC<DiffViewProps> = ({ diffText }) => {
  const files = parseDiff(diffText);

  if (files.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500 text-sm italic">
        No changes detected in this changeset.
      </div>
    );
  }

  return (
    <div className="diff-view flex flex-col gap-6 p-2">
      {files.map(({ oldPath, newPath, hunks, type }, i) => {
        const lang = (newPath || oldPath || '').split('.').pop() || 'javascript';
        
        // Use Memoized tokens for performance
        const tokens = useMemo(() => {
          if (!hunks || !Array.isArray(hunks)) return null;
          try {
            return tokenize(hunks, {
              highlight: true,
              refractor,
              language: lang === 'ts' || lang === 'tsx' ? 'typescript' : 'javascript',
            });
          } catch (e) {
            console.error('Tokenization failed:', e);
            return null;
          }
        }, [hunks, lang]);

        return (
          <div key={i} className="rounded-xl border border-white/5 bg-[#08080c] overflow-hidden shadow-2xl transition-all hover:border-white/10">
            <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${type === 'add' ? 'bg-emerald-500/10 text-emerald-500' : type === 'delete' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-500/10 text-slate-500'}`}>
                  {type}
                 </span>
                 <span className="text-xs font-mono text-slate-300 font-bold tracking-tight">
                  {oldPath === '/dev/null' ? newPath : oldPath}
                 </span>
              </div>
            </div>
            <div className="p-2 bg-black/20">
              <Diff viewType="split" diffType={type} hunks={hunks} tokens={tokens || undefined}>
                {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
              </Diff>
            </div>
          </div>
        );
      })}
    </div>
  );
};
