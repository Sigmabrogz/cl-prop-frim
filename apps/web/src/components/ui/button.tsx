import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-md text-sm font-semibold",
    "ring-offset-background transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // Default - subtle background
        default: [
          "bg-background-tertiary text-foreground",
          "border border-border",
          "hover:bg-background-hover hover:border-foreground-subtle",
        ].join(" "),

        // Primary - gold brand color
        primary: [
          "bg-primary text-primary-foreground",
          "hover:bg-primary-hover",
          "shadow-sm hover:shadow-md",
        ].join(" "),

        // Secondary
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-background-hover",
        ].join(" "),

        // Outline
        outline: [
          "border border-border bg-transparent",
          "hover:bg-background-tertiary hover:border-foreground-subtle",
        ].join(" "),

        // Ghost - no background
        ghost: [
          "bg-transparent",
          "hover:bg-background-tertiary",
        ].join(" "),

        // Link style
        link: [
          "text-info underline-offset-4",
          "hover:underline",
          "p-0 h-auto",
        ].join(" "),

        // Destructive / danger
        destructive: [
          "bg-loss text-white",
          "hover:bg-loss-hover",
          "shadow-sm",
        ].join(" "),

        // ===== TRADING VARIANTS =====

        // Buy/Long - profit green
        success: [
          "bg-profit text-white font-semibold",
          "hover:bg-profit-hover",
          "hover:shadow-glow-profit",
          "transition-shadow duration-200",
        ].join(" "),

        // Sell/Short - loss red
        danger: [
          "bg-loss text-white font-semibold",
          "hover:bg-loss-hover",
          "hover:shadow-glow-loss",
          "transition-shadow duration-200",
        ].join(" "),

        // Buy outline variant
        "success-outline": [
          "border-2 border-profit text-profit bg-transparent",
          "hover:bg-profit-muted",
        ].join(" "),

        // Sell outline variant
        "danger-outline": [
          "border-2 border-loss text-loss bg-transparent",
          "hover:bg-loss-muted",
        ].join(" "),

        // Premium glow effect - for CTAs
        glow: [
          "bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/30",
          "hover:shadow-xl hover:shadow-primary/40",
          "hover:bg-primary-hover",
          "transition-shadow duration-300",
        ].join(" "),

        // Warning
        warning: [
          "bg-warning text-primary-foreground",
          "hover:bg-warning/90",
        ].join(" "),
      },
      size: {
        xs: "h-7 px-2 text-xs rounded",
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        md: "h-10 px-4",
        lg: "h-11 px-6",
        xl: "h-12 px-8 text-base",
        "2xl": "h-14 px-10 text-lg",
        // Icon-only buttons
        icon: "h-9 w-9 p-0",
        "icon-xs": "h-7 w-7 p-0",
        "icon-sm": "h-8 w-8 p-0",
        "icon-lg": "h-11 w-11 p-0",
        "icon-xl": "h-12 w-12 p-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Determine icon size based on button size
    const iconSize = size === "xs" || size === "icon-xs" ? "h-3 w-3"
      : size === "sm" || size === "icon-sm" ? "h-3.5 w-3.5"
      : size === "lg" || size === "xl" || size === "icon-lg" || size === "icon-xl" ? "h-5 w-5"
      : "h-4 w-4";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn(iconSize, "animate-spin")} />
        ) : leftIcon ? (
          <span className={cn("shrink-0", iconSize, "[&>svg]:h-full [&>svg]:w-full")}>
            {leftIcon}
          </span>
        ) : null}

        {/* Hide children for icon-only sizes when loading */}
        {!(isLoading && size?.toString().startsWith("icon")) && children}

        {rightIcon && !isLoading && (
          <span className={cn("shrink-0", iconSize, "[&>svg]:h-full [&>svg]:w-full")}>
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

// Trading-specific button variants as separate components for convenience
const BuyButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  ({ children = "Buy / Long", ...props }, ref) => (
    <Button ref={ref} variant="success" {...props}>
      {children}
    </Button>
  )
);
BuyButton.displayName = "BuyButton";

const SellButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant">>(
  ({ children = "Sell / Short", ...props }, ref) => (
    <Button ref={ref} variant="danger" {...props}>
      {children}
    </Button>
  )
);
SellButton.displayName = "SellButton";

export { Button, BuyButton, SellButton, buttonVariants };
