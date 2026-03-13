import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileLock2,
  LayoutDashboard,
  LineChart,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";

const features = [
  {
    title: "Role-based operations",
    description:
      "Separate student, staff, and admin responsibilities with secure access controls and granular permissions.",
    icon: ShieldCheck,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Structured case tracking",
    description:
      "Capture grievances consistently, preserve auditability, and reduce manual follow-up with automated workflows.",
    icon: FileLock2,
    gradient: "from-violet-500 to-purple-500",
  },
  {
    title: "AI-ready insights seam",
    description:
      "Run baseline processing by default and enable Groq later without redesign for intelligent automation.",
    icon: BrainCircuit,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    title: "Operations dashboard",
    description:
      "Give teams a clear command center for grievance workflows and real-time action visibility.",
    icon: LayoutDashboard,
    gradient: "from-emerald-500 to-teal-500",
  },
];

const benefits = [
  {
    icon: Timer,
    title: "Faster resolution times",
    description: "Reduce response time by 60% with automated routing and SLA tracking",
  },
  {
    icon: TrendingUp,
    title: "Data-driven insights",
    description: "Identify patterns and root causes with AI-powered analytics",
  },
  {
    icon: Users,
    title: "Enhanced student experience",
    description: "Transparent tracking and consistent communication throughout resolution",
  },
  {
    icon: CheckCircle2,
    title: "Compliance ready",
    description: "Complete audit trails and accountability for institutional requirements",
  },
];

const stats = [
  { value: "95%", label: "Issue Resolution Rate" },
  { value: "3.2x", label: "Faster Processing" },
  { value: "24/7", label: "System Availability" },
  { value: "100%", label: "Audit Compliance" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <MessageSquareText className="size-5 text-white" />
            </div>
            <span className="min-w-0 text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base md:text-lg">
              <span className="sm:hidden">Student Grievance</span>
              <span className="hidden sm:inline">Student Grievance Intelligence</span>
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-primary">
                Privacy
              </Link>
              <Link href="/terms" className="text-muted-foreground transition-colors hover:text-primary">
                Terms
              </Link>
              <Link href="/contact" className="text-muted-foreground transition-colors hover:text-primary">
                Contact
              </Link>
            </nav>
            <ThemeSwitcher />
            <Button asChild variant="ghost" size="sm" className="px-2.5 sm:px-3">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild size="sm" className="px-3 sm:px-4">
              <Link href="/register">
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Get Started</span>
                <ArrowRight className="ml-1 hidden size-4 sm:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 md:px-8">
        {/* Hero Section */}
        <section className="grid items-center gap-8 py-6 md:grid-cols-2 md:gap-12 md:py-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-3 py-2 text-sm font-medium text-secondary-foreground shadow-sm sm:px-4">
              <Sparkles className="size-4 text-primary" />
              <span className="text-primary">Production-ready AI platform</span>
            </div>
            
            <h1 className="text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-5xl">
              Transform campus grievance management with{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                AI-powered insights
              </span>
            </h1>
            
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Launch a secure, intelligent grievance platform with authentication, RBAC, 
              real-time analytics, and optional AI provider integration that enhances 
              decision-making without creating dependencies.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button asChild size="lg" className="h-12 w-full px-6 sm:w-auto">
                <Link href="/register">
                  Create account
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 w-full px-6 sm:w-auto">
                <Link href="/app">
                  <LayoutDashboard className="mr-2 size-4" />
                  View dashboard
                </Link>
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-2xl font-bold text-primary">{stat.value}</div>
                  <div className="text-[11px] leading-4 text-muted-foreground sm:text-xs">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="surface-card relative overflow-hidden rounded-3xl p-4 sm:p-6">
              {/* Decorative elements */}
              <div className="absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/30 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-gradient-to-tr from-violet-400/30 to-purple-400/30 blur-3xl" />
              
              <Image
                src="/campus-support.svg"
                alt="Illustration of students receiving support from campus services"
                width={720}
                height={520}
                className="relative z-10 h-auto w-full rounded-2xl border border-border/60 shadow-2xl"
                priority
              />
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-4 -left-4 z-20 hidden rounded-xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur md:block">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                  <Zap className="size-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Live Analytics</div>
                  <div className="text-xs text-muted-foreground">Real-time insights</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 md:py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">
              Comprehensive grievance management
            </h2>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              Everything you need to streamline student support, track issues, and drive 
              institutional improvements through data-driven insights.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <Card 
                key={feature.title} 
                className="group surface-card rounded-2xl border-2 transition-all hover:border-primary/25 hover:shadow-xl"
              >
                <CardHeader>
                  <div className={`mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                    <feature.icon className="size-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 md:py-16">
          <div className="surface-card overflow-hidden rounded-3xl">
            <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-2 md:p-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(5,150,105,0.16)] dark:border-emerald-500 dark:bg-emerald-500">
                  <LineChart className="size-4" />
                  Measurable impact
                </div>
                <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
                  Why institutions choose our platform
                </h2>
                <p className="text-base text-muted-foreground sm:text-lg">
                  Transform your student support operations with proven results and 
                  enterprise-grade reliability.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {benefits.map((benefit) => (
                  <div 
                    key={benefit.title}
                    className="space-y-3 rounded-xl border border-border/70 bg-background/55 p-6 backdrop-blur"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                      <benefit.icon className="size-5 text-white" />
                    </div>
                    <h3 className="font-semibold">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16">
          <div className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-slate-950 p-6 text-center text-white shadow-2xl sm:p-8 md:p-12">
            {/* Background pattern */}
            <div className="absolute inset-0">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              <div className="absolute left-0 top-0 size-72 rounded-full bg-sky-500/25 blur-3xl" />
              <div className="absolute bottom-0 right-0 size-72 rounded-full bg-amber-400/16 blur-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(203_76%_36%_/_0.18),transparent_58%)]" />
            </div>

            <div className="relative z-10 mx-auto max-w-3xl space-y-6">
              <h2 className="text-3xl font-bold sm:text-4xl md:text-5xl">
                Ready to transform your grievance management?
              </h2>
              <p className="text-base text-white/78 sm:text-lg">
                Join leading institutions in delivering better student support through 
                intelligent automation and actionable insights.
              </p>
              <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row sm:flex-wrap sm:gap-4">
                <Button asChild size="lg" className="h-12 w-full px-8 shadow-lg shadow-sky-950/20 sm:w-auto">
                  <Link href="/register">
                    Get started free
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="lg" 
                  variant="outline" 
                  className="h-12 w-full border-white/20 bg-white/10 px-8 text-white hover:bg-white/20 hover:text-white sm:w-auto"
                >
                  <Link href="/app">
                    <LayoutDashboard className="mr-2 size-4" />
                    View demo
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-background/70 py-8 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquareText className="size-4" />
              <span>&copy; 2026 Student Grievance Intelligence. All rights reserved.</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:justify-end md:gap-6">
              <Link href="/privacy" className="text-muted-foreground transition-colors hover:text-primary">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-muted-foreground transition-colors hover:text-primary">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-muted-foreground transition-colors hover:text-primary">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

