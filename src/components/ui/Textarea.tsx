// src/components/ui/Textarea.tsx
import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`w-full bg-slate-950 border text-slate-100 placeholder-slate-500 text-sm rounded-md p-3 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 ${
            error ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 hover:border-slate-700 focus:border-cyan-500'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
