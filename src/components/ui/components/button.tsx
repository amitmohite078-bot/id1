import * as React from 'react';
import { cn } from '../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-b from-zinc-900 to-zinc-950 text-white font-medium border border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:from-zinc-800 hover:to-zinc-900 active:scale-[0.98]',
  secondary:
    'bg-white/80 text-zinc-900 border border-white/90 backdrop-blur-md shadow-sm hover:bg-white active:scale-[0.98]',
  outline:
    'border border-zinc-200/80 bg-white/70 backdrop-blur-md text-zinc-900 shadow-sm hover:bg-white hover:border-zinc-300 active:scale-[0.98]',
  ghost: 'text-zinc-700 hover:bg-white/80 hover:text-zinc-900',
  danger:
    'bg-gradient-to-b from-red-600 to-red-700 text-white border border-red-400/30 shadow-[0_4px_12px_rgba(220,38,38,0.25)] hover:from-red-500 hover:to-red-600 active:scale-[0.98]',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

