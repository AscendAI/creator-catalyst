# Creator Catalyst Dashboard

## Overview

The Creator Catalyst Dashboard is a payment system designed for social media content creators publishing videos on Instagram, TikTok, and YouTube Shorts. Its primary purpose is to track video performance across these platforms, calculate creator earnings based on views and milestones, and manage payouts efficiently. The project aims to provide a streamlined experience for both creators to monitor their performance and administrators to manage the creator ecosystem, ensuring fair and timely compensation.

## Branding

- **Brand Name**: Creator Catalyst (formerly NEON / Whisper)
- **Logo**: `/creator-catalyst-logo.png` (PNG format)
- **Favicon**: `/favicon.png`
- **Primary Color**: Sky blue (#38BDF8 / HSL 199 89% 60%)
- **Accent Color**: Pink (#EC4899)
- **Background Theme**: Dark navy (#0A0F1A / #0F172A)
- **Heading Font**: Lilita One (Google Fonts)
- **Body Font**: Inter (Google Fonts)
- **Mono Font**: JetBrains Mono
- **Color Palette**: Sky blue/cyan/pink matching Creator Catalyst logo cube

## User Preferences

I want to be communicated with using clear, concise language. When I ask for an explanation or a decision, please be direct and to the point, avoiding unnecessary jargon.

I prefer an iterative development approach. Make small, focused changes and ask for my feedback frequently. Do not make large-scale changes without prior consultation.

Before implementing any significant architectural changes, adding new dependencies, or modifying core business logic, please ask for my approval and provide a brief explanation of the proposed changes and their impact.

Ensure that all changes are thoroughly tested, and provide clear documentation for any new features or modifications to existing ones.

## System Architecture

The Creator Catalyst Dashboard is built with a modern full-stack architecture. The frontend utilizes React 18 with TypeScript, styled using Tailwind CSS and shadcn/ui components, ensuring a responsive and visually appealing user experience. The backend is powered by Express.js with TypeScript, providing a robust API layer. Data persistence is handled by PostgreSQL, accessed via the Drizzle ORM. Build processes are managed by Vite. User authentication is secured using JWT with bcrypt for password hashing.

The system features distinct dashboards for creators and administrators, each tailored to their specific needs. Key technical implementations include:
- **Creator Management**: Linking Instagram, TikTok, and YouTube accounts.
- **Video Tracking & Pairing**: Automatic matching of videos across platforms based on duration within a 24-hour window.
- **Performance-based Payouts**: A flexible system calculating base pay (configurable per platform), optional YouTube Shorts bonuses, and tiered view bonuses.
- **Support System**: Integrated support ticket functionality for creators.
- **Engagement Features**: Implementation of "Streak Survivor" games and "Bounty Board" challenges to boost creator engagement and provide additional earning opportunities.
- **Payout Cycles**: Management of 2-week payout cycles for organized payment processing. Each cycle snapshots global payout settings (base pay, bonus tiers) at creation time. Individual payout records also snapshot the creator's custom base pay rates. When refreshing a past cycle, the system uses these snapshotted rates instead of current values, ensuring historical accuracy.
- **UI/UX**: Emphasis on a clean, intuitive design with consistent components across the platform, supporting both light and dark modes. Dashboard statistics are displayed with clear visual indicators for performance changes. Uses Creator Catalyst green/teal color scheme with Lilita One font for headings.

## External Dependencies

- **PostgreSQL**: Primary database for all application data.
- **Resend API**: For email functionalities (e.g., notifications, password resets).
- **ScrapeCreators API**: Used for fetching video metrics from Instagram (reels), TikTok (videos), and YouTube (Shorts under 60 seconds). This integration includes specific endpoints for retrieving profile videos, reels, and shorts, along with metrics like views, likes, comments, and duration.

## Recent Changes

- **2026-02-13**: Complete rebrand from "Whisper" to "NEON" (later renamed to "Creator Catalyst") - updated logo, favicon, color theme (purple → green/teal/emerald), added Lilita One heading font, updated all branding text and metadata across all pages.
- **2026-02-17**: Rebranded from "NEON" to "Creator Catalyst" — updated all display names across UI, emails, metadata, and sidebars. Logo file kept as-is.
- **2026-02-13**: Implemented full email verification and password reset flow via Resend API. Emails sent from contact@neonugc.com. Signup sends 6-digit verification code. Added endpoints: verify-email, resend-verification, forgot-password, reset-password. Login checks email verification for non-admin users. Reset password links point to neonugc.com/reset-password.
- **2026-02-15**: Added cross-cycle boundary video pairing. When a creator posts one half of a pair at the end of a cycle and the matching video in the next cycle (within 24h), the earlier video is pulled forward into the next cycle for payout. The previous cycle excludes those pulled-forward videos. Works on both live calculation and recalculation.
- **2026-02-15**: Improved navigation: back buttons on creator detail page now correctly return to the originating page (Creator Hub, Creators list, or Payouts) with filters preserved in URL params.
- **2026-02-15**: Unified cross-boundary video display. Removed separate "Pre-Cycle Videos" section — cross-boundary videos now appear paired in the main current cycle table and in payout history expanded views. Overview earnings now use `calculateCreatorCyclePayout` for consistency with Payouts page. Cycle videos endpoint includes cross-boundary pull-forward and exclusion logic.
- **2026-02-17**: Fixed individual creator payout refresh to use correct rate logic (active cycles use current rates, past cycles use snapshotted rates) — matching the bulk recalculate behavior.
- **2026-02-17**: Replaced "Recalculate Payouts" button on Payouts page with "Sync & Recalculate" — now fetches fresh video data from Instagram/TikTok for all creators before recalculating. Added phased progress bar showing: Unfreezing cycle → Syncing creator X (n/total) → Recalculating payouts → Freezing cycle.
- **2026-02-17**: Lifted payout sync progress into PayoutSyncProvider context so progress bar persists across admin page navigation.
- **2026-02-17**: Removed join date video filtering — all videos now count toward stats, payouts, and eligibility regardless of when the creator joined. The only way to exclude a video is marking it as irrelevant. Cleaned up all ~20 join date filter locations across the server.
