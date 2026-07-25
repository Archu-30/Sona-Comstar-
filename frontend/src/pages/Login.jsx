import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  CheckCircle2,
  BarChart3,
  Boxes,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

const DEMO_USER = 'admin';
const DEMO_PASS = 'sona@123';

// Floating background orbs
const ORBS = [
  { size: 420, x: '-8%', y: '-12%', from: '#4f46e5', to: '#7c3aed', dur: 16 },
  { size: 360, x: '75%', y: '-6%', from: '#0891b2', to: '#2563eb', dur: 20 },
  { size: 300, x: '60%', y: '70%', from: '#7c3aed', to: '#db2777', dur: 18 },
  { size: 260, x: '-4%', y: '68%', from: '#059669', to: '#0891b2', dur: 22 },
];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${(i * 53) % 100}%`,
  size: 3 + ((i * 7) % 5),
  delay: (i % 9) * 1.4,
  dur: 12 + ((i * 3) % 10),
}));

const FEATURES = [
  { icon: BarChart3, text: 'Real-time inventory analytics' },
  { icon: Boxes, text: 'Storage ageing & GIT tracking' },
  { icon: TrendingUp, text: 'Multi-period trend comparison' },
  { icon: ShieldCheck, text: 'Values matched to SAP reports' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | error | success
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (status === 'loading' || status === 'success') return;
      setStatus('loading');
      setErrorMsg('');
      await new Promise((r) => setTimeout(r, 900));
      if (username.trim() === DEMO_USER && password === DEMO_PASS) {
        setStatus('success');
        localStorage.setItem('sona_auth', '1');
        setTimeout(() => navigate('/dashboard', { replace: true }), 900);
      } else {
        setStatus('error');
        setErrorMsg('Invalid username or password');
        setTimeout(() => setStatus('idle'), 600);
      }
    },
    [username, password, status, navigate]
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      {/* Animated aurora orbs */}
      {ORBS.map((o, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute rounded-full opacity-30 blur-3xl"
          style={{
            width: o.size,
            height: o.size,
            left: o.x,
            top: o.y,
            background: `radial-gradient(circle at 30% 30%, ${o.from}, ${o.to})`,
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -35, 25, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      {/* Rising particles */}
      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          className="pointer-events-none absolute rounded-full bg-white/40"
          style={{ left: p.left, bottom: -12, width: p.size, height: p.size }}
          animate={{ y: [0, -900], opacity: [0, 0.7, 0] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <AnimatePresence>
        {status !== 'success' ? (
          <motion.div
            key="panel"
            className="relative z-10 mx-4 flex w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          >
            {/* Left branding panel */}
            <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600/90 via-violet-600/80 to-cyan-600/80 p-10 md:flex">
              <motion.div
                className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div>
                <motion.div
                  className="flex items-center gap-4"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                >
                  <motion.div
                    className="flex h-16 items-center justify-center rounded-2xl bg-white p-2.5 shadow-2xl ring-2 ring-white/40"
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img src="/logo-bold-dark.png" alt="Sona Comstar" className="h-full w-auto object-contain" />
                  </motion.div>
                  <div>
                    <p className="text-xl font-black tracking-wider text-white">SONA COMSTAR</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-200">
                      Inventory Analytics
                    </p>
                  </div>
                </motion.div>

                <motion.h2
                  className="mt-10 text-3xl font-bold leading-snug text-white"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                >
                  Every value,
                  <br />
                  exactly as in SAP.
                </motion.h2>
              </div>

              <div className="space-y-3">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.text}
                    className="flex items-center gap-3 text-sm text-white/90"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.12, duration: 0.5 }}
                  >
                    <span className="flex size-7 items-center justify-center rounded-lg bg-white/15">
                      <f.icon className="size-4" />
                    </span>
                    {f.text}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right form panel */}
            <div className="w-full p-8 sm:p-10 md:w-1/2">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="mt-1 text-sm text-white/60">
                  Sign in to access the analytics dashboard
                </p>
              </motion.div>

              <motion.form
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
                animate={status === 'error' ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Username
                  </label>
                  <div className="group relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-indigo-300" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      autoComplete="username"
                      className="h-11 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-10 pr-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-400 focus:bg-white/[0.1] focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                >
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Password
                  </label>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-indigo-300" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-11 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-10 pr-10 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-indigo-400 focus:bg-white/[0.1] focus:ring-2 focus:ring-indigo-400/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/80"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {errorMsg && (
                    <motion.p
                      className="text-sm text-rose-400"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {errorMsg}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={status === 'loading'}
                  className="relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 disabled:opacity-80"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {/* Shimmer sweep */}
                  <motion.span
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ['-120%', '320%'] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {status === 'loading' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  {status === 'loading' ? 'Signing in…' : 'Sign In'}
                </motion.button>

                <motion.p
                  className="text-center text-xs text-white/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  Demo credentials — user: <span className="text-white/70">admin</span> ·
                  password: <span className="text-white/70">sona@123</span>
                </motion.p>
              </motion.form>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            className="relative z-10 flex flex-col items-center gap-4"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 14 }}
          >
            <motion.div
              initial={{ rotate: -90, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
            >
              <CheckCircle2 className="size-20 text-emerald-400" />
            </motion.div>
            <motion.p
              className="text-lg font-semibold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Welcome back, Admin
            </motion.p>
            <motion.p
              className="text-sm text-white/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              Loading your dashboard…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
