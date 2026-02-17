import { Button } from "@/components/ui/button";
import { DollarSign, Users, Zap, TrendingUp, Video, Shield, ArrowRight } from "lucide-react";
import { SiTiktok, SiInstagram } from "react-icons/si";
import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";

const STAR_COUNT = 200;
const ATTRACTION_RADIUS = 150;
const ATTRACTION_STRENGTH = 0.015;

interface Star {
  id: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  driftVx: number;
  driftVy: number;
  size: number;
  opacity: number;
  isStatic: boolean;
}

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  const starElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const mousePos = useRef({ x: -1000, y: -1000 });
  const rafId = useRef<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    
    const rect = hero.getBoundingClientRect();
    const stars: Star[] = [];
    
    for (let i = 0; i < STAR_COUNT; i++) {
      const homeX = Math.random() * rect.width;
      const homeY = Math.random() * rect.height;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.03;
      const isStatic = i < 50;
      stars.push({
        id: i,
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        driftVx: isStatic ? 0 : Math.cos(angle) * speed,
        driftVy: isStatic ? 0 : Math.sin(angle) * speed,
        size: isStatic ? 1 + Math.random() * 1.5 : 1.5 + Math.random() * 2,
        opacity: isStatic ? 0.15 + Math.random() * 0.2 : 0.2 + Math.random() * 0.35,
        isStatic,
      });
    }
    starsRef.current = stars;
    setInitialized(true);
    
    const animate = () => {
      const heroRect = hero.getBoundingClientRect();
      const mx = mousePos.current.x;
      const my = mousePos.current.y - heroRect.top;
      const friction = 0.92;
      
      for (let i = 0; i < starsRef.current.length; i++) {
        const star = starsRef.current[i];
        
        if (star.isStatic) {
          const el = starElementsRef.current[i];
          if (el) {
            el.style.transform = `translate3d(${star.x}px, ${star.y}px, 0)`;
          }
          continue;
        }
        
        const dx = mx - star.x;
        const dy = my - star.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < ATTRACTION_RADIUS && mx > 0 && my > 0 && my < heroRect.height) {
          const force = (ATTRACTION_RADIUS - dist) / ATTRACTION_RADIUS;
          const easeForce = force * force;
          star.vx += dx * ATTRACTION_STRENGTH * easeForce;
          star.vy += dy * ATTRACTION_STRENGTH * easeForce;
        } else {
          star.vx += star.driftVx;
          star.vy += star.driftVy;
          
          if (star.x < 0 || star.x > heroRect.width) {
            star.driftVx *= -1;
            star.x = Math.max(0, Math.min(heroRect.width, star.x));
          }
          if (star.y < 0 || star.y > heroRect.height) {
            star.driftVy *= -1;
            star.y = Math.max(0, Math.min(heroRect.height, star.y));
          }
        }
        
        star.vx *= friction;
        star.vy *= friction;
        star.x += star.vx;
        star.y += star.vy;
        
        const el = starElementsRef.current[i];
        if (el) {
          el.style.transform = `translate3d(${star.x}px, ${star.y}px, 0)`;
        }
      }
      
      rafId.current = requestAnimationFrame(animate);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseLeave = () => {
      mousePos.current = { x: -1000, y: -1000 };
    };
    
    rafId.current = requestAnimationFrame(animate);
    hero.addEventListener('mousemove', handleMouseMove, { passive: true });
    hero.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      hero.removeEventListener('mousemove', handleMouseMove);
      hero.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1A]">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1A]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-10 h-10 rounded-lg" />
              <span className="font-bold text-xl text-[#38BDF8]" style={{ fontFamily: "'Lilita One', cursive" }}>Creator Catalyst</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button className="border-0 bg-[#38BDF8] text-[#0A0F1A] hover:bg-[#0EA5E9] font-semibold">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 pb-8 px-2 sm:px-3 lg:px-4">
        <div 
          ref={heroRef}
          className="relative overflow-hidden mx-auto rounded-[2rem] sm:rounded-[3rem]"
          style={{ background: '#0F172A' }}
        >
          {initialized && starsRef.current.map((star, i) => (
            <div
              key={star.id}
              ref={el => { starElementsRef.current[i] = el; }}
              className="pointer-events-none absolute rounded-full will-change-transform"
              style={{
                width: `${star.size}px`,
                height: `${star.size}px`,
                marginLeft: `-${star.size / 2}px`,
                marginTop: `-${star.size / 2}px`,
                opacity: star.opacity,
                background: 'hsl(199 70% 70%)',
                boxShadow: `0 0 ${star.size * 2}px hsl(199 60% 60% / 0.5)`,
                transform: `translate3d(${star.x}px, ${star.y}px, 0)`,
              }}
            />
          ))}

          <section className="pt-16 pb-20 px-6 sm:px-12 lg:px-16 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#38BDF8]/5 via-transparent to-transparent" />
            <div className="absolute top-32 left-1/3 w-96 h-96 bg-[#38BDF8]/8 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-[#38BDF8]/6 rounded-full blur-[100px]" />
            
            <div className="max-w-7xl mx-auto relative">
              <div className="text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/10 mb-8 backdrop-blur-sm">
                  <img src="/creator-catalyst-logo.png" alt="" className="w-6 h-6 rounded" />
                  <span className="text-sm text-white/80 tracking-wide font-bold">Platform Especially For Our UGC Creators</span>
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl tracking-tight mb-6 leading-[1.1]" style={{ fontFamily: "'Lilita One', cursive" }}>
                  <span className="text-white">Get Paid for</span>
                  <br />
                  <span className="text-[#38BDF8]">
                    UGC Content
                  </span>
                </h1>
                
                <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                  Track your videos across TikTok and Instagram. Earn base pay plus bonuses when your content hits view milestones.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Link href="/signup">
                    <Button size="lg" className="gap-2 text-lg px-8 py-6 transition-transform duration-200 hover:scale-105 bg-[#38BDF8] text-[#0A0F1A] hover:bg-[#0EA5E9] border-0 font-semibold">
                      Start Earning
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center justify-center gap-8 text-white/40">
                  <div className="flex items-center gap-2 transition-colors duration-200 hover:text-[#38BDF8]/70">
                    <SiTiktok className="h-5 w-5" />
                    <span className="text-sm font-medium">TikTok</span>
                  </div>
                  <div className="flex items-center gap-2 transition-colors duration-200 hover:text-[#38BDF8]/70">
                    <SiInstagram className="h-5 w-5" />
                    <span className="text-sm font-medium">Instagram</span>
                  </div>
                </div>
              </div>

              <div className="mt-20 max-w-5xl mx-auto">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="group relative p-6 rounded-xl bg-gradient-to-br from-[#38BDF8]/10 to-sky-500/5 border border-white/10 transition-all duration-500 hover:border-[#38BDF8]/40 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-24 h-24 bg-[#38BDF8]/20 rounded-full blur-2xl group-hover:bg-[#38BDF8]/40 group-hover:scale-150 transition-all duration-700" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="h-5 w-5 text-[#38BDF8] group-hover:animate-pulse" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#38BDF8]/80">Tracking</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#38BDF8] transition-colors duration-300">Cross-Platform Sync</h3>
                      <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">We match your videos across TikTok and Instagram automatically</p>
                    </div>
                  </div>

                  <div className="group relative p-6 rounded-xl bg-gradient-to-br from-cyan-500/10 to-[#38BDF8]/5 border border-white/10 transition-all duration-500 hover:border-cyan-400/40 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-cyan-500/20 rounded-full blur-2xl group-hover:bg-cyan-400/40 group-hover:scale-150 transition-all duration-700" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400/80">Earnings</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors duration-300">Base Pay + Bonuses</h3>
                      <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">Earn fixed pay per video plus bonuses at 5K, 100K, and 1M views</p>
                    </div>
                  </div>

                  <div className="group relative p-6 rounded-xl bg-gradient-to-br from-sky-500/10 to-[#38BDF8]/5 border border-white/10 transition-all duration-500 hover:border-sky-400/40 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden">
                    <div className="absolute -left-8 -top-8 w-24 h-24 bg-sky-500/15 rounded-full blur-2xl group-hover:bg-sky-400/30 group-hover:scale-150 transition-all duration-700" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-5 w-5 text-sky-400 group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-sky-400/80">Analytics</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-sky-300 transition-colors duration-300">Real-Time Metrics</h3>
                      <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">Track views, likes, and comments across all your content</p>
                    </div>
                  </div>

                  <div className="group relative p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-[#38BDF8]/5 border border-white/10 transition-all duration-500 hover:border-blue-400/40 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-500/15 rounded-full blur-2xl group-hover:bg-blue-400/30 group-hover:scale-150 transition-all duration-700" />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400/80">Security</span>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-300 transition-colors duration-300">No OAuth Login Required</h3>
                      <p className="text-sm text-white/50 group-hover:text-white/70 transition-colors duration-300">We never ask for your social media passwords - your accounts stay safe</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-16 max-w-4xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-3xl text-white mb-4" style={{ fontFamily: "'Lilita One', cursive" }}>How It Works</h2>
                  <p className="text-white/50">Simple steps to start earning from your content</p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-[#38BDF8]/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-[#38BDF8]">1</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Connect Your Accounts</h3>
                    <p className="text-sm text-white/50">Link your TikTok and Instagram profiles to the dashboard</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-cyan-400">2</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Post Quality Content</h3>
                    <p className="text-sm text-white/50">Videos must follow our content rules and community guidelines to qualify for payouts</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-sky-400">3</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Get Paid</h3>
                    <p className="text-sm text-white/50">Earn base pay plus bonuses when you hit view milestones</p>
                  </div>
                </div>
              </div>

              <div className="mt-20 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                  <Shield className="h-4 w-4 text-[#38BDF8]" />
                  <span className="text-sm text-white/70">Secure & Transparent Payments</span>
                </div>
                <h2 className="text-3xl text-white mb-4" style={{ fontFamily: "'Lilita One', cursive" }}>Ready to Start Earning?</h2>
                <p className="text-white/50 mb-8 max-w-xl mx-auto">Join creators who are already getting paid for their content across platforms.</p>
                <Link href="/signup">
                  <Button size="lg" className="gap-2 text-lg px-8 py-6 transition-transform duration-200 hover:scale-105 bg-[#38BDF8] text-[#0A0F1A] hover:bg-[#0EA5E9] border-0 font-semibold">
                    Create Your Account
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="py-8 px-4 bg-[#0A0F1A] border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/creator-catalyst-logo.png" alt="Creator Catalyst" className="w-8 h-8 rounded" />
            <span className="font-semibold text-[#38BDF8]" style={{ fontFamily: "'Lilita One', cursive" }}>Creator Catalyst</span>
          </div>
          <p className="text-sm text-white/40">Creator Payment Platform</p>
        </div>
      </footer>
    </div>
  );
}
