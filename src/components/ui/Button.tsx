// src/components/ui/Button.tsx
import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:pointer-events-none disabled:opacity-50 select-none rounded-md';

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-base gap-2.5',
    };

    const variantStyles = {
      primary:
        'bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm shadow-cyan-900/30 active:bg-cyan-700',
      cyan:
        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 active:bg-cyan-500/30',
      secondary:
        'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white active:bg-slate-800',
      outline:
        'border border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white',
      ghost:
        'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 active:bg-slate-800',
      danger:
        'bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 active:bg-rose-600/40',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {!isLoading && leftIcon}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
