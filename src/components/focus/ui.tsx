import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card as ShadCard } from "@/components/ui/card";
import { Input as ShadInput } from "@/components/ui/input";
import { Textarea as ShadTextarea } from "@/components/ui/textarea";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select as RSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { X as XIcon, type LucideIcon } from "lucide-react";
import { accentFor } from "./constants";

/* FOCUS primitives — thin, themed wrappers over the project's shadcn/ui components. */

export function Card({
  className,
  hi,
  onClick,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hi?: boolean }) {
  return (
    <ShadCard
      onClick={onClick}
      className={cn(
        "focus-card min-w-0 gap-0 rounded-[14px] border-[color:var(--focus-border)] py-0 text-[color:var(--focus-foreground)]",
        hi && "focus-card-hi",
        onClick &&
          "cursor-pointer transition-[box-shadow,border-color] duration-200 hover:border-[color:color-mix(in_oklab,var(--focus-primary)_45%,var(--focus-border))]",
        className,
      )}
      {...rest}
    >
      {children}
    </ShadCard>
  );
}

type BtnVariant = "primary" | "ghost" | "soft" | "danger" | "outline";
export const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BtnVariant;
    size?: "sm" | "md" | "lg";
    icon?: LucideIcon;
  }
>(function Btn({ variant = "soft", size = "md", icon: Icon, className, children, ...rest }, ref) {
  const v: Record<BtnVariant, string> = {
    primary:
      "bg-[var(--focus-primary)] text-[color:var(--focus-primary-foreground)] shadow-sm hover:bg-[color:color-mix(in_oklab,var(--focus-primary)_88%,black)]",
    soft: "bg-[var(--focus-soft)] text-[color:var(--focus-primary)] hover:bg-[color:color-mix(in_oklab,var(--focus-soft)_85%,var(--focus-primary))]",
    outline:
      "bg-[var(--focus-card)] text-[color:var(--focus-foreground)] border border-[color:color-mix(in_oklab,var(--focus-foreground)_28%,transparent)] hover:border-[color:var(--focus-foreground)] hover:bg-[var(--focus-card)]",
    ghost:
      "bg-transparent text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)] hover:bg-[var(--focus-bg2)]",
    danger:
      "bg-[color:color-mix(in_oklab,var(--focus-destructive)_10%,transparent)] text-[color:var(--focus-destructive)] hover:bg-[color:color-mix(in_oklab,var(--focus-destructive)_18%,transparent)]",
  };
  const s = {
    sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
    md: "h-10 px-4 text-[15px] gap-2 rounded-lg",
    lg: "h-12 px-6 text-base gap-2 rounded-lg",
  }[size];
  return (
    <Button
      ref={ref}
      className={cn(
        "font-semibold transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-[var(--focus-primary)]/40",
        v[variant],
        s,
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />}
      {children}
    </Button>
  );
});

export function IconBtn({
  icon: Icon,
  label,
  className,
  active,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--focus-muted)] transition-colors hover:bg-[var(--focus-bg2)] hover:text-[color:var(--focus-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-primary)]/40",
            active && "text-[color:var(--focus-primary)]",
            className,
          )}
          {...rest}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Badge({
  children,
  color = "var(--focus-muted)",
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <ShadBadge
      variant="outline"
      className={cn(
        "rounded-md border-0 px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
      style={{
        color,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
      }}
    >
      {children}
    </ShadBadge>
  );
}

const fieldCls =
  "rounded-lg bg-[var(--focus-card)] border-[color:var(--focus-border)] text-[16px] text-[color:var(--focus-foreground)] shadow-none sm:text-[15px] placeholder:text-[color:var(--focus-muted)]/70 focus-visible:ring-[3px] focus-visible:ring-[var(--focus-primary)]/20 focus-visible:border-[color:var(--focus-primary)]";
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, ...p }, ref) {
    return <ShadInput ref={ref} className={cn(fieldCls, "h-10", className)} {...p} />;
  },
);
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...p }, ref) {
    return <ShadTextarea ref={ref} className={cn(fieldCls, "min-h-20", className)} {...p} />;
  },
);

const EMPTY = "__none__";
export function Select({
  value,
  onChange,
  options,
  labels,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
  className?: string;
  placeholder?: string;
}) {
  return (
    <RSelect
      dir="rtl"
      value={value === "" ? EMPTY : value}
      onValueChange={(v) => onChange(v === EMPTY ? "" : v)}
    >
      <SelectTrigger className={cn(fieldCls, "h-10 w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="focus-popover">
        {options.map((o) => (
          <SelectItem key={o || EMPTY} value={o === "" ? EMPTY : o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </RSelect>
  );
}

export function Check({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="size-[18px] rounded-[5px] border-[color:color-mix(in_oklab,var(--focus-foreground)_30%,transparent)] data-[state=checked]:bg-[var(--focus-primary)] data-[state=checked]:border-[color:var(--focus-primary)] data-[state=checked]:text-[color:var(--focus-primary-foreground)]"
      />
      {label && (
        <label htmlFor={id} className="cursor-pointer select-none text-sm">
          {label}
        </label>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-[13px] font-medium text-[color:var(--focus-muted)]">{label}</div>
      {children}
      {hint && <div className="text-xs text-[color:var(--focus-muted)]/80">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--focus-soft)] text-[color:var(--focus-primary)]">
        <Icon className="size-6" />
      </div>
      <div>
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="mt-1 text-sm text-[color:var(--focus-muted)]">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Progress({
  value,
  color = "var(--focus-primary)",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--focus-bg2)]", className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon }[];
}) {
  return (
    <div className="no-scrollbar -mx-4 flex max-w-[100vw] gap-2 overflow-x-auto px-4 sm:mx-0 sm:inline-flex sm:max-w-none sm:flex-wrap sm:overflow-visible sm:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-4 text-[14px] transition-colors",
            value === o.value
              ? "border-transparent bg-[var(--focus-soft)] font-semibold text-[color:var(--focus-primary)]"
              : "border-[color:var(--focus-border)] bg-[var(--focus-card)] text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]",
          )}
        >
          {o.icon && <o.icon className="size-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className={cn("focus-dialog rounded-2xl sm:max-w-md", className)}>
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription
            className={description ? "text-[color:var(--focus-muted)]" : "sr-only"}
          >
            {description ?? title}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        dir="rtl"
        className="focus-dialog w-full overflow-y-auto border-r p-0 sm:max-w-xl [&>button.absolute]:hidden"
      >
        <SheetHeader className="sticky top-0 z-10 flex-row items-center gap-3 space-y-0 border-b border-[color:var(--focus-border)] bg-[var(--focus-card)]/95 px-5 py-3.5 text-right backdrop-blur sm:px-6 sm:py-4">
          <SheetTitle className="min-w-0 flex-1 truncate text-xl font-bold">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
          <SheetClose
            aria-label="סגור"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--focus-bg2)] text-[color:var(--focus-muted)] transition-colors hover:text-[color:var(--focus-foreground)]"
          >
            <XIcon className="size-4" />
          </SheetClose>
        </SheetHeader>
        <div className="px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--focus-muted)]">
      {children}
    </kbd>
  );
}

export function SectionTitle({
  children,
  action,
  icon: Icon,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[17px] font-bold">
        {Icon && <Icon className="size-4 text-[color:var(--focus-muted)]" />}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b border-[color:var(--focus-border)] sm:mb-6">
      <div className="-mb-px min-w-0 border-b-[3px] border-[color:var(--focus-navy)] pb-3">
        <h1 className="text-[23px] leading-tight font-bold sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[color:var(--focus-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 pb-3">{actions}</div>}
    </div>
  );
}

/** Grow-style navy → indigo headline number card */
export function GradientStat({
  label,
  value,
  sub,
  icon: Icon,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-gradient flex min-w-0 flex-col justify-between rounded-[14px] p-5 text-right transition-transform duration-200",
        onClick && "hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[17px] font-bold">
        {Icon && <Icon className="size-[18px] opacity-80" />}
        {label}
      </div>
      <div className="mt-3 truncate text-[28px] leading-none font-bold tabular-nums sm:mt-4 sm:text-[34px]">
        {value}
      </div>
      {sub && <div className="focus-on-gradient-muted mt-3 text-sm font-medium">{sub}</div>}
    </button>
  );
}

/** white KPI card — label, tinted icon, big number, sub line */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  subColor,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  color?: string;
  subColor?: string;
  onClick?: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13.5px] font-bold sm:text-[15px]">{label}</span>
        {Icon && (
          <span className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-[var(--focus-soft)] text-[color:var(--focus-primary)] sm:flex">
            <Icon className="size-[18px]" />
          </span>
        )}
      </div>
      <div
        className="mt-2.5 truncate text-[21px] leading-none font-bold tabular-nums sm:mt-3 sm:text-[28px]"
        style={{ color }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="mt-2 truncate text-[12px] font-medium text-[color:var(--focus-muted)] sm:text-[13px]"
          style={{ color: subColor }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

/** Grow-style link action: "לכל ההתנועות ›" */
export function LinkAction({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--focus-primary)] hover:underline"
    >
      {children}
      <span aria-hidden>‹</span>
    </button>
  );
}

/** client/project avatar — initials on a tinted square */
export function ProjectAvatar({
  id,
  name,
  size = 40,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  const c = accentFor(id);
  const initials =
    name
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[10px] font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        color: c,
        background: `color-mix(in oklab, ${c} 13%, var(--focus-card))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 22%, transparent)`,
      }}
    >
      {initials}
    </span>
  );
}
