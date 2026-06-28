"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  Camera,
  Dna,
  FileText,
  Globe,
  Megaphone,
  Sparkles,
  User,
} from "lucide-react";
import { BrandSwitcher } from "@/components/brand/BrandSwitcher";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/brands", label: "Brands", icon: Building2 },
  {
    label: "Business DNA",
    icon: Dna,
    children: [
      { href: "/business-dna/overview", label: "Overview" },
      { href: "/business-dna/catalog", label: "Catalog" },
      { href: "/business-dna/assets", label: "Assets" },
    ],
  },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/photoshoot", label: "Photoshoot", icon: Camera },
  { href: "/brand-book", label: "Brand Book", icon: BookOpen },
  { href: "/websites", label: "Websites", icon: Globe },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-all duration-200",
        active
          ? "glass-nav-active font-semibold text-foreground"
          : "font-normal text-muted hover:bg-white/40 hover:text-foreground"
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-[20px] w-[20px] shrink-0", active ? "text-accent" : "text-muted")}
          strokeWidth={active ? 2.25 : 1.75}
        />
      )}
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="glass-sidebar relative z-20 flex h-full shrink-0 flex-col px-3 py-5"
      style={{ width: "var(--sidebar-width)" }}
    >
      <Link href="/business-dna/overview" className="mb-5 flex items-center gap-2.5 px-3 py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#5856d6] shadow-md shadow-accent/20">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[17px] font-semibold tracking-tight text-foreground">Ad AI</span>
      </Link>

      <BrandSwitcher />

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          if (item.children) {
            return (
              <div key={item.label} className="mb-2">
                <div className="mb-1 flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-light">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                {item.children.map((child) => (
                  <NavLink
                    key={child.href}
                    href={child.href}
                    label={child.label}
                    active={pathname.startsWith(child.href)}
                  />
                ))}
              </div>
            );
          }

          return (
            <NavLink
              key={item.href}
              href={item.href!}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.href!)}
            />
          );
        })}

        <div className="mt-auto pt-4">
          <div className="glass-divider mb-3" />
          <NavLink
            href="/docs"
            label="Documentation"
            icon={FileText}
            active={pathname.startsWith("/docs")}
          />
        </div>
      </nav>
    </aside>
  );
}

export function TopBar() {
  return (
    <header
      className="glass-header relative z-10 flex shrink-0 items-center justify-end px-6"
      style={{ height: "var(--header-height)" }}
    >
      <button
        type="button"
        className="glass-tile flex h-9 w-9 items-center justify-center !rounded-full !p-0 transition-transform hover:scale-105 active:scale-95"
        aria-label="User profile"
      >
        <User className="h-4 w-4 text-muted" />
      </button>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas flex h-screen overflow-hidden">
      <Sidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && (
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{subtitle}</p>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass-card p-5", className)}>
      {children}
    </div>
  );
}

/** Elevated glass tile — macOS widget style */
export function Tile({
  children,
  className,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "glass-tile p-5 text-left",
        selected && "glass-tile-selected",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function GlassBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("glass-bar fixed bottom-0 right-0 px-8 py-4", className)}
      style={{ left: "var(--sidebar-width)" }}
    >
      {children}
    </div>
  );
}

export function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      e.preventDefault();
      onChange([...tags, e.currentTarget.value.trim()]);
      e.currentTarget.value = "";
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="glass-input flex flex-wrap gap-2 rounded-xl p-3">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 rounded-lg bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="ml-0.5 text-accent/70 hover:text-accent"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        placeholder={placeholder ?? "Type and press Enter"}
        onKeyDown={handleKeyDown}
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-light"
      />
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "glass-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "glass-btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export { LayoutGrid } from "lucide-react";
