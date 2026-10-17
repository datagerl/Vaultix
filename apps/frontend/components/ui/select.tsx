import React, { forwardRef, createContext, useContext, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  options?: { value: string; label: string }[];
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType>({});

// Main Select component - supports both HTML select and Radix UI-style usage
const SelectRoot = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className, containerClassName, id, children, options, value, onValueChange, ...props }, ref) => {
    const inputId = id || props.name;
    const [open, setOpen] = useState(false);

    // If using Radix UI-style with children, render differently
    const isRadixStyle = React.Children.toArray(children).some(
      (child) => React.isValidElement(child) && (child.type === SelectTrigger || (child as any).type?.displayName === 'SelectTrigger')
    );

    if (isRadixStyle) {
      return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
          <div className={twMerge('space-y-2', containerClassName)}>
            {label && (
              <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
                {label}
              </label>
            )}
            {children}
            {helperText && !error && (
              <p className="text-xs text-muted-foreground">{helperText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </SelectContext.Provider>
      );
    }

    // Standard HTML select
    return (
      <div className={twMerge('space-y-2', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            value={value}
            onChange={(e) => {
              onValueChange?.(e.target.value);
            }}
            className={twMerge(
              'block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm p-2 border text-foreground',
              error && 'border-destructive focus:border-destructive focus:ring-destructive',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
        </div>
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

SelectRoot.displayName = 'Select';

const SelectTrigger = forwardRef<HTMLButtonElement, { children?: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => {
    const { open, setOpen } = useContext(SelectContext);
    
    return (
      <button
        ref={ref}
        type="button"
        className={twMerge(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        onClick={() => setOpen?.(!open)}
      >
        {children}
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder, className }: { placeholder?: string; className?: string }) => {
  const { value } = useContext(SelectContext);
  return <span className={className}>{value || placeholder}</span>;
};

const SelectContent = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const { open } = useContext(SelectContext);
  
  if (!open) return null;
  
  return (
    <div className={twMerge('absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg', className)}>
      {children}
    </div>
  );
};

const SelectItem = ({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) => {
  const { onValueChange, setOpen } = useContext(SelectContext);
  
  return (
    <div
      className={twMerge('relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground', className)}
      onClick={() => {
        onValueChange?.(value);
        setOpen?.(false);
      }}
    >
      {children}
    </div>
  );
};

// Export main component as Select
export const Select = SelectRoot;
export { SelectContent, SelectItem, SelectTrigger, SelectValue };
export default SelectRoot;
