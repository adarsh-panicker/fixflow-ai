// src/components/ui/Input.tsx
import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-slate-950 border text-slate-100 placeholder-slate-500 text-sm rounded-md transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 h-9 ${
              leftIcon ? 'pl-9 pr-3' : 'px-3'
            } ${error ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 hover:border-slate-700 focus:border-cyan-500'} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
        {helperText && !error && <p className="text-[11px] text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
