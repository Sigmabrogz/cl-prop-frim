import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  [
    "flex w-full",
    "text-sm text-foreground placeholder:text-foreground-muted",
    "transition-all duration-150",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "focus-visible:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        // Default - bordered
        default: [
          "rounded-md border border-input bg-background",
          "ring-offset-background",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "focus-visible:border-foreground-subtle",
        ].join(" "),

        // Filled - subtle background
        filled: [
          "rounded-md border border-transparent bg-background-tertiary",
          "focus-visible:bg-background-secondary",
          "focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" "),

        // Flushed - underline only (good for trading inputs)
        flushed: [
          "border-0 border-b-2 border-border rounded-none bg-transparent",
          "focus-visible:border-primary",
          "px-0",
        ].join(" "),

        // Ghost - minimal
        ghost: [
          "border-transparent bg-transparent rounded-md",
          "hover:bg-background-tertiary",
          "focus-visible:bg-background-tertiary",
          "focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" "),

        // Trading input - monospace, right-aligned for numbers
        trading: [
          "rounded-md border border-input bg-background-secondary",
          "font-mono text-right tabular-nums",
          "focus-visible:ring-2 focus-visible:ring-primary",
          "focus-visible:border-primary/50",
        ].join(" "),
      },

      inputSize: {
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-3 text-sm",
        md: "h-10 px-3 text-sm",
        lg: "h-11 px-4 text-base",
        xl: "h-12 px-4 text-base",
      },

      // Error state
      error: {
        true: [
          "border-loss focus-visible:border-loss",
          "focus-visible:ring-loss/30",
        ].join(" "),
        false: "",
      },

      // Full width
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },

    defaultVariants: {
      variant: "default",
      inputSize: "default",
      error: false,
      fullWidth: true,
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Text prefix (e.g., "$") */
  prefix?: string;
  /** Text suffix (e.g., "USD") */
  suffix?: string;
  /** Error state */
  error?: boolean;
  /** Container className for wrapper div */
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      type,
      variant,
      inputSize,
      error,
      fullWidth,
      leftIcon,
      rightIcon,
      prefix,
      suffix,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasLeftAddon = leftIcon || prefix;
    const hasRightAddon = rightIcon || suffix;

    // If no addons, render simple input
    if (!hasLeftAddon && !hasRightAddon) {
      return (
        <input
          type={type}
          className={cn(
            inputVariants({ variant, inputSize, error, fullWidth }),
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />
      );
    }

    // Determine icon size based on input size
    const iconSize =
      inputSize === "xs" || inputSize === "sm"
        ? "h-3.5 w-3.5"
        : inputSize === "lg" || inputSize === "xl"
          ? "h-5 w-5"
          : "h-4 w-4";

    return (
      <div
        className={cn(
          "relative flex items-center",
          fullWidth && "w-full",
          containerClassName
        )}
      >
        {/* Left icon or prefix */}
        {hasLeftAddon && (
          <div
            className={cn(
              "absolute left-0 flex items-center justify-center",
              "text-foreground-muted pointer-events-none",
              inputSize === "xs" || inputSize === "sm" ? "pl-2" : "pl-3"
            )}
          >
            {leftIcon && (
              <span className={cn("[&>svg]:h-full [&>svg]:w-full", iconSize)}>
                {leftIcon}
              </span>
            )}
            {prefix && (
              <span className="text-sm font-medium">{prefix}</span>
            )}
          </div>
        )}

        <input
          type={type}
          className={cn(
            inputVariants({ variant, inputSize, error, fullWidth }),
            hasLeftAddon && (inputSize === "xs" || inputSize === "sm" ? "pl-7" : "pl-9"),
            hasRightAddon && (inputSize === "xs" || inputSize === "sm" ? "pr-7" : "pr-9"),
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />

        {/* Right icon or suffix */}
        {hasRightAddon && (
          <div
            className={cn(
              "absolute right-0 flex items-center justify-center",
              "text-foreground-muted pointer-events-none",
              inputSize === "xs" || inputSize === "sm" ? "pr-2" : "pr-3"
            )}
          >
            {suffix && (
              <span className="text-sm font-medium">{suffix}</span>
            )}
            {rightIcon && (
              <span className={cn("[&>svg]:h-full [&>svg]:w-full", iconSize)}>
                {rightIcon}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ===== TRADING-SPECIFIC INPUT COMPONENTS =====

export interface NumberInputProps extends Omit<InputProps, "type"> {
  /** Currency symbol to display */
  currency?: string;
  /** Decimal places */
  decimals?: number;
}

/** Specialized input for trading amounts */
const TradingInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ currency, suffix, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      variant="trading"
      suffix={suffix || currency}
      {...props}
    />
  )
);
TradingInput.displayName = "TradingInput";

/** Price input with currency prefix */
const PriceInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ currency = "$", ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      variant="trading"
      prefix={currency}
      {...props}
    />
  )
);
PriceInput.displayName = "PriceInput";

/** Search input with icon */
const SearchInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type" | "leftIcon">
>(({ placeholder = "Search...", ...props }, ref) => (
  <Input
    ref={ref}
    type="search"
    variant="filled"
    placeholder={placeholder}
    leftIcon={
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    }
    {...props}
  />
));
SearchInput.displayName = "SearchInput";

// ===== INPUT GROUP =====

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** Group inputs with shared borders */
const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        "[&>*:not(:first-child):not(:last-child)]:rounded-none",
        "[&>*:first-child]:rounded-r-none",
        "[&>*:last-child]:rounded-l-none",
        "[&>*:not(:first-child)]:-ml-px",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
InputGroup.displayName = "InputGroup";

/** Addon element for input groups */
interface InputAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const InputAddon = React.forwardRef<HTMLDivElement, InputAddonProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center",
        "px-3 text-sm font-medium",
        "bg-background-tertiary text-foreground-muted",
        "border border-input rounded-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
InputAddon.displayName = "InputAddon";

export {
  Input,
  TradingInput,
  PriceInput,
  SearchInput,
  InputGroup,
  InputAddon,
  inputVariants,
};
