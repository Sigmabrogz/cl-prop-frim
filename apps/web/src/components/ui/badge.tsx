import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-semibold transition-all duration-150",
    "select-none whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        // Default
        default: [
          "bg-background-tertiary text-foreground",
          "border border-border",
        ].join(" "),

        // Primary - gold brand
        primary: [
          "bg-primary text-primary-foreground",
          "border border-transparent",
        ].join(" "),

        // Secondary
        secondary: [
          "bg-secondary text-secondary-foreground",
          "border border-transparent",
        ].join(" "),

        // Outline
        outline: [
          "bg-transparent text-foreground",
          "border border-border",
        ].join(" "),

        // Ghost
        ghost: [
          "bg-transparent text-foreground-muted",
          "border border-transparent",
        ].join(" "),

        // ===== STATUS BADGES =====

        // Success / Profit / Filled
        success: [
          "bg-profit-muted text-profit",
          "border border-profit/20",
        ].join(" "),

        // Danger / Loss / Rejected
        danger: [
          "bg-loss-muted text-loss",
          "border border-loss/20",
        ].join(" "),

        // Warning / Pending
        warning: [
          "bg-warning-muted text-warning",
          "border border-warning/20",
        ].join(" "),

        // Info
        info: [
          "bg-info-muted text-info",
          "border border-info/20",
        ].join(" "),

        // ===== TRADING STATUS BADGES =====

        // Live / Active
        live: [
          "bg-profit text-white",
          "border border-transparent",
          "animate-pulse-subtle",
        ].join(" "),

        // Pending order
        pending: [
          "bg-warning-muted text-warning",
          "border border-warning/30",
        ].join(" "),

        // Filled order
        filled: [
          "bg-profit-muted text-profit",
          "border border-profit/30",
        ].join(" "),

        // Cancelled order
        cancelled: [
          "bg-background-tertiary text-foreground-muted",
          "border border-border",
        ].join(" "),

        // Rejected order
        rejected: [
          "bg-loss-muted text-loss",
          "border border-loss/30",
        ].join(" "),

        // Partial fill
        partial: [
          "bg-info-muted text-info",
          "border border-info/30",
        ].join(" "),

        // ===== ACCOUNT STATUS =====

        // Active account
        active: [
          "bg-profit-muted text-profit",
          "border border-profit/20",
        ].join(" "),

        // Inactive account
        inactive: [
          "bg-background-tertiary text-foreground-muted",
          "border border-border",
        ].join(" "),

        // Funded account
        funded: [
          "bg-primary-muted text-primary",
          "border border-primary/20",
        ].join(" "),

        // Challenge phase
        challenge: [
          "bg-info-muted text-info",
          "border border-info/20",
        ].join(" "),

        // Breached account
        breached: [
          "bg-loss-muted text-loss",
          "border border-loss/30",
        ].join(" "),

        // ===== SPECIAL =====

        // Pro / Premium
        pro: [
          "bg-gradient-to-r from-primary to-warning",
          "text-primary-foreground",
          "border border-transparent",
        ].join(" "),

        // New
        new: [
          "bg-accent-purple/15 text-accent-purple",
          "border border-accent-purple/20",
        ].join(" "),
      },

      size: {
        xs: "h-4 px-1.5 text-[10px] rounded",
        sm: "h-5 px-2 text-xs rounded",
        default: "h-6 px-2.5 text-xs rounded-md",
        lg: "h-7 px-3 text-sm rounded-md",
      },

      // Dot indicator
      dot: {
        true: "pl-1.5",
        false: "",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Show a dot indicator before the text */
  dot?: boolean;
  /** Custom dot color class */
  dotColor?: string;
  /** Icon to show before text */
  icon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  size,
  dot,
  dotColor,
  icon,
  children,
  ...props
}: BadgeProps) {
  // Determine dot color based on variant if not provided
  const getDotColor = () => {
    if (dotColor) return dotColor;
    switch (variant) {
      case "success":
      case "live":
      case "filled":
      case "active":
        return "bg-profit";
      case "danger":
      case "rejected":
      case "breached":
        return "bg-loss";
      case "warning":
      case "pending":
        return "bg-warning";
      case "info":
      case "partial":
      case "challenge":
        return "bg-info";
      case "primary":
      case "funded":
        return "bg-primary";
      default:
        return "bg-foreground-muted";
    }
  };

  return (
    <div
      className={cn(badgeVariants({ variant, size, dot }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
            variant === "live" && "animate-pulse",
            getDotColor()
          )}
        />
      )}
      {icon && (
        <span className="mr-1 shrink-0 [&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}

// ===== TRADING-SPECIFIC BADGE COMPONENTS =====

/** Status badge for order status */
interface OrderStatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: "pending" | "filled" | "partial" | "cancelled" | "rejected";
}

function OrderStatusBadge({ status, ...props }: OrderStatusBadgeProps) {
  const statusConfig = {
    pending: { variant: "pending" as const, label: "Pending" },
    filled: { variant: "filled" as const, label: "Filled" },
    partial: { variant: "partial" as const, label: "Partial" },
    cancelled: { variant: "cancelled" as const, label: "Cancelled" },
    rejected: { variant: "rejected" as const, label: "Rejected" },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size="sm" dot {...props}>
      {config.label}
    </Badge>
  );
}

/** Status badge for account status */
interface AccountStatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: "active" | "inactive" | "funded" | "challenge" | "breached";
}

function AccountStatusBadge({ status, ...props }: AccountStatusBadgeProps) {
  const statusConfig = {
    active: { variant: "active" as const, label: "Active" },
    inactive: { variant: "inactive" as const, label: "Inactive" },
    funded: { variant: "funded" as const, label: "Funded" },
    challenge: { variant: "challenge" as const, label: "Challenge" },
    breached: { variant: "breached" as const, label: "Breached" },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size="sm" dot {...props}>
      {config.label}
    </Badge>
  );
}

/** Live indicator badge */
function LiveBadge({ children = "LIVE", ...props }: Omit<BadgeProps, "variant">) {
  return (
    <Badge variant="live" size="xs" dot {...props}>
      {children}
    </Badge>
  );
}

/** Side badge (Buy/Sell) */
interface SideBadgeProps extends Omit<BadgeProps, "variant"> {
  side: "buy" | "sell" | "long" | "short";
}

function SideBadge({ side, ...props }: SideBadgeProps) {
  const isBuy = side === "buy" || side === "long";
  return (
    <Badge
      variant={isBuy ? "success" : "danger"}
      size="sm"
      {...props}
    >
      {side.toUpperCase()}
    </Badge>
  );
}

export {
  Badge,
  OrderStatusBadge,
  AccountStatusBadge,
  LiveBadge,
  SideBadge,
  badgeVariants,
};
