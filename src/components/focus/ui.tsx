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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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
        "focus-card min-w-0 rounded-[22px] border-[color:var(--focus-border)] text-[color:var(--focus-foreground)] shadow-none gap-0 py-0",
        hi && "focus-card-hi",
        onClick &&
          "cursor-pointer transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color:color-mix(in_oklab,var(--focus-mint)_35%,var(--focus-border))]",
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
      "bg-[var(--focus-mint)] text-[color:var(--focus-mint-foreground)] hover:bg-[color:color-mix(in_oklab,var(--focus-mint)_88%,white)] shadow-[0_6px_24px_-8px_color-mix(in_oklab,var(--focus-mint)_60%,transparent)]",
    soft: "bg-[var(--focus-card-hi)] text-[color:var(--focus-foreground)] border border-[color:var(--focus-border)] hover:bg-[color:color-mix(in_oklab,var(--focus-card-hi)_80%,white_6%)]",
    outline:
      "bg-transparent text-[color:var(--focus-foreground)] border border-[color:var(--focus-border)] hover:bg-[var(--focus-card-hi)]",
    ghost:
      "bg-transparent text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)] hover:bg-[var(--focus-card-hi)]",
    danger:
      "bg-[color:color-mix(in_oklab,var(--focus-destructive)_14%,transparent)] text-[color:var(--focus-destructive)] border border-[color:color-mix(in_oklab,var(--focus-destructive)_30%,transparent)] hover:bg-[color:color-mix(in_oklab,var(--focus-destructive)_22%,transparent)]",
  };
  const s = {
    sm: "h-8 px-3 text-sm gap-1.5 rounded-xl",
    md: "h-10 px-4 gap-2 rounded-xl",
    lg: "h-12 px-6 text-base gap-2 rounded-2xl",
  }[size];
  return (
    <Button
      ref={ref}
      className={cn(
        "font-medium transition-all active:scale-[.97] focus-visible:ring-2 focus-visible:ring-[var(--focus-mint)]",
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
            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--focus-muted)] transition-colors hover:bg-[var(--focus-card-hi)] hover:text-[color:var(--focus-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-mint)]",
            active && "text-[color:var(--focus-mint)]",
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
        "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
        background: `color-mix(in oklab, ${color} 10%, transparent)`,
      }}
    >
      {children}
    </ShadBadge>
  );
}

const fieldCls =
  "rounded-xl bg-[var(--focus-bg2)] border-[color:var(--focus-border)] text-[color:var(--focus-foreground)] placeholder:text-[color:var(--focus-muted)]/70 focus-visible:ring-2 focus-visible:ring-[var(--focus-mint)]/60 focus-visible:border-transparent";
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
        className="size-[18px] rounded-md border-[color:var(--focus-border)] data-[state=checked]:bg-[var(--focus-mint)] data-[state=checked]:border-[color:var(--focus-mint)] data-[state=checked]:text-[color:var(--focus-mint-foreground)]"
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
      <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--focus-bg2)] text-[color:var(--focus-muted)] ring-1 ring-[var(--focus-border)]">
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
  color = "var(--focus-mint)",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-[var(--focus-border)]/60", className)}
    >
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
    <div className="inline-flex rounded-xl border border-[color:var(--focus-border)] bg-[var(--focus-bg2)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-sm transition-colors",
            value === o.value
              ? "bg-[var(--focus-card-hi)] text-[color:var(--focus-foreground)] shadow-sm"
              : "text-[color:var(--focus-muted)] hover:text-[color:var(--focus-foreground)]",
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
      <DialogContent dir="rtl" className={cn("focus-dialog rounded-[24px] sm:max-w-md", className)}>
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>{title}</DialogTitle>
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
        className="focus-dialog w-full overflow-y-auto border-r p-0 sm:max-w-xl"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-[color:var(--focus-border)] bg-[var(--focus-bg2)]/95 px-6 py-4 text-right backdrop-blur">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5">{children}</div>
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
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[color:var(--focus-muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
