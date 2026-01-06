import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  [
    "rounded-lg border bg-card text-card-foreground",
    "transition-all duration-200",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-border",
        // Interactive card with hover effect
        interactive: [
          "border-border",
          "hover:border-foreground-subtle",
          "hover:-translate-y-0.5",
          "hover:shadow-md",
          "cursor-pointer",
        ].join(" "),
        // Selected/active state
        selected: [
          "border-primary",
          "bg-primary-muted",
        ].join(" "),
        // Glow effect on hover
        glow: [
          "border-border",
          "hover:border-primary/50",
          "hover:shadow-lg hover:shadow-primary/10",
        ].join(" "),
        // Gradient border
        gradient: [
          "gradient-border",
          "border-transparent",
        ].join(" "),
        // Ghost - minimal styling
        ghost: [
          "border-transparent",
          "bg-transparent",
        ].join(" "),
        // Elevated with shadow
        elevated: [
          "border-border",
          "shadow-md",
          "hover:shadow-lg",
        ].join(" "),
        // Trading panel style
        panel: [
          "border-border",
          "bg-background-secondary",
          "rounded-lg",
        ].join(" "),
      },
      padding: {
        none: "",
        sm: "[&>*:first-child]:p-3 [&>*:not(:first-child)]:p-3 [&>*:not(:first-child)]:pt-0",
        default: "[&>*:first-child]:p-4 [&>*:not(:first-child)]:p-4 [&>*:not(:first-child)]:pt-0",
        lg: "[&>*:first-child]:p-6 [&>*:not(:first-child)]:p-6 [&>*:not(:first-child)]:pt-0",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Add a bottom border */
    bordered?: boolean;
  }
>(({ className, bordered, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 p-4",
      bordered && "border-b border-border pb-3",
      className
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & {
    /** Title size */
    size?: "sm" | "default" | "lg";
  }
>(({ className, size = "default", ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-semibold leading-none tracking-tight",
      size === "sm" && "text-sm",
      size === "default" && "text-base",
      size === "lg" && "text-lg",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Add a top border */
    bordered?: boolean;
  }
>(({ className, bordered, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-4 pt-0",
      bordered && "border-t border-border pt-4 mt-4",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// ===== TRADING-SPECIFIC CARD COMPONENTS =====

/** Stat card for displaying metrics */
interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, change, changeLabel, icon, trend, className, ...props }, ref) => {
    const trendColor = trend === "up" ? "text-profit" : trend === "down" ? "text-loss" : "text-muted-foreground";

    return (
      <Card ref={ref} className={cn("p-4", className)} {...props}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
            {(change !== undefined || changeLabel) && (
              <p className={cn("text-sm font-medium", trendColor)}>
                {change !== undefined && (
                  <span>
                    {change >= 0 ? "+" : ""}
                    {typeof change === "number" ? change.toFixed(2) : change}%
                  </span>
                )}
                {changeLabel && <span className="text-muted-foreground ml-1">{changeLabel}</span>}
              </p>
            )}
          </div>
          {icon && (
            <div className="p-2 rounded-lg bg-background-tertiary text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </Card>
    );
  }
);
StatCard.displayName = "StatCard";

/** Panel card for trading terminal sections */
const PanelCard = React.forwardRef<
  HTMLDivElement,
  CardProps & { title?: string; actions?: React.ReactNode }
>(({ title, actions, children, className, ...props }, ref) => (
  <Card ref={ref} variant="panel" className={cn("flex flex-col", className)} {...props}>
    {(title || actions) && (
      <CardHeader bordered className="flex-row items-center justify-between space-y-0 py-2 px-3">
        {title && <CardTitle size="sm">{title}</CardTitle>}
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </CardHeader>
    )}
    <div className="flex-1 overflow-hidden">
      {children}
    </div>
  </Card>
));
PanelCard.displayName = "PanelCard";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatCard,
  PanelCard,
  cardVariants,
};
