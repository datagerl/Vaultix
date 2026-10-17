import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className, containerClassName, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className={twMerge('space-y-2', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            ref={ref}
            id={inputId}
            className={twMerge(
              'block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm p-2 border text-foreground placeholder:text-muted-foreground',
              error && 'border-destructive focus:border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          />
        </div>
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export { TextArea };
// Alias for compatibility with lowercase imports
export { TextArea as Textarea };
export default TextArea;
