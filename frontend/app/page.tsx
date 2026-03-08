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
    <div className="min-h-screen w-full">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--border)] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
              <MessageSquareText className="size-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Student Grievance Intelligence
            </span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-4 text-sm md:flex">
              <Link href="/privacy" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Privacy
              </Link>
              <Link href="/terms" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Terms
              </Link>
              <Link href="/contact" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Contact
              </Link>
            </nav>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 md:px-8">
        {/* Hero Section */}
        <section className="grid items-center gap-12 py-8 md:grid-cols-2 md:py-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2 text-sm font-medium">
              <Sparkles className="size-4 text-[var(--primary)]" />
              <span className="text-[var(--primary)]">Production-ready AI platform</span>
            </div>
            
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight md:text-5xl">
              Transform campus grievance management with <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] bg-clip-text text-transparent">AI-powered insights</span>
            </h1>
            
            <p className="max-w-xl text-lg leading-relaxed text-[var(--muted-foreground)]">
              Launch a secure, intelligent grievance platform with authentication, RBAC, 
              real-time analytics, and optional AI provider integration that enhances 
              decision-making without creating dependencies.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="h-12 px-6">
                <Link href="/register">
                  Create account
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <Link href="/app">
                  <LayoutDashboard className="mr-2 size-4" />
                  View dashboard
                </Link>
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-2xl font-bold text-[var(--primary)]">{stat.value}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="surface-card relative overflow-hidden rounded-3xl p-6">
              {/* Decorative elements */}
              <div className="absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/30 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-gradient-to-tr from-violet-400/30 to-purple-400/30 blur-3xl" />
              
              <Image
                src="/campus-support.svg"
                alt="Illustration of students receiving support from campus services"
                width={720}
                height={520}
                className="relative z-10 h-auto w-full rounded-2xl border border-white/50 shadow-2xl"
                priority
              />
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-4 -left-4 z-20 hidden rounded-xl border border-[var(--border)] bg-white p-4 shadow-xl md:block">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                  <Zap className="size-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Live Analytics</div>
                  <div className="text-xs text-[var(--muted-foreground)]">Real-time insights</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Comprehensive grievance management
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-[var(--muted-foreground)]">
              Everything you need to streamline student support, track issues, and drive 
              institutional improvements through data-driven insights.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <Card 
                key={feature.title} 
                className="group surface-card rounded-2xl border-2 transition-all hover:border-[var(--primary)]/20 hover:shadow-xl"
              >
                <CardHeader>
                  <div className={`mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                    <feature.icon className="size-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-[var(--muted-foreground)]">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-16">
          <div className="surface-card overflow-hidden rounded-3xl">
            <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  <LineChart className="size-4" />
                  Measurable impact
                </div>
                <h2 className="text-3xl font-bold md:text-4xl">
                  Why institutions choose our platform
                </h2>
                <p className="text-lg text-[var(--muted-foreground)]">
                  Transform your student support operations with proven results and 
                  enterprise-grade reliability.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {benefits.map((benefit) => (
                  <div 
                    key={benefit.title}
                    className="space-y-3 rounded-xl border border-[var(--border)] bg-white/50 p-6"
                  >
                    <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]">
                      <benefit.icon className="size-5 text-white" />
                    </div>
                    <h3 className="font-semibold">{benefit.title}</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] p-12 text-center text-white">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute left-0 top-0 size-64 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-0 right-0 size-64 rounded-full bg-white blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto max-w-3xl space-y-6">
              <h2 className="text-4xl font-bold md:text-5xl">
                Ready to transform your grievance management?
              </h2>
              <p className="text-lg text-blue-100">
                Join leading institutions in delivering better student support through 
                intelligent automation and actionable insights.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <Button asChild size="lg" variant="secondary" className="h-12 px-8">
                  <Link href="/register">
                    Get started free
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="lg" 
                  variant="outline" 
                  className="h-12 border-white/20 bg-white/10 px-8 text-white hover:bg-white/20"
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
      <footer className="border-t border-[var(--border)] bg-white/50 py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <MessageSquareText className="size-4" />
              <span>&copy; 2026 Student Grievance Intelligence. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

