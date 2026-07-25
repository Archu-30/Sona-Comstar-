import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Building,
  ShieldCheck,
  Key,
  Save,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Briefcase,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar';

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    fullName: 'Admin User',
    email: 'admin@sonacomstar.com',
    phone: '+91 98765 43210',
    department: 'Supply Chain & Logistics',
    plantLocation: 'Plant 1 - Main Warehouse',
    employeeId: 'SC-2026-88',
    role: 'System Administrator',
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Profile details saved successfully!');
    }, 600);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passwordState.currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setIsChangingPass(true);
    setTimeout(() => {
      setIsChangingPass(false);
      setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password updated successfully!');
    }, 700);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings, personal information, and system credentials.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 px-3 py-1 text-xs">
          <ShieldCheck className="size-3.5 text-primary" />
          Role: System Administrator
        </Badge>
      </div>

      {/* Profile Overview Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl"
      >
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-2xl border-2 border-white/30 bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 shadow-2xl text-white">
                <User className="size-10 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 size-4 rounded-full border-2 border-slate-900 bg-emerald-500 ring-2 ring-emerald-500/30" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{profile.fullName}</h2>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  Active
                </Badge>
              </div>
              <p className="text-sm text-indigo-200/90">{profile.email}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1">
                  <Briefcase className="size-3.5 text-indigo-300" />
                  {profile.department}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-indigo-300" />
                  {profile.plantLocation}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs text-slate-300 border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div>
              <span className="text-slate-400">Employee ID:</span>{' '}
              <span className="font-mono font-semibold text-white">{profile.employeeId}</span>
            </div>
            <div>
              <span className="text-slate-400">System Access:</span>{' '}
              <span className="font-medium text-emerald-300">Full SAP Analytics & Admin</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
              <Clock className="size-3 text-indigo-300" /> Last logged in: Today at 11:55 AM
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-indigo-500/10 blur-3xl" />
      </motion.div>

      {/* Main Grid: Details Form & Password / Security */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Personal Details Form (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:col-span-2"
        >
          <div className="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
            <User className="size-5 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Personal Information</h3>
              <p className="text-xs text-muted-foreground">Update your account profile and contact details</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={profile.fullName}
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone Number</label>
                <Input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Employee ID</label>
                <Input type="text" value={profile.employeeId} disabled className="bg-muted/50 font-mono" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Department</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Plant Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={profile.plantLocation}
                    onChange={(e) => setProfile({ ...profile, plantLocation: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving} className="gap-2">
                <Save className="size-4" />
                {isSaving ? 'Saving Changes…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </motion.div>

        {/* Security & Password Column (1 col) */}
        <div className="space-y-6">
          {/* Security & Password Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
              <Key className="size-5 text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">Change Password</h3>
                <p className="text-xs text-muted-foreground">Update your login security credentials</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Current Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordState.currentPassword}
                    onChange={(e) => setPasswordState({ ...passwordState, currentPassword: e.target.value })}
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwordState.newPassword}
                    onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })}
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={passwordState.confirmPassword}
                  onChange={(e) => setPasswordState({ ...passwordState, confirmPassword: e.target.value })}
                />
              </div>

              <Button type="submit" variant="outline" disabled={isChangingPass} className="w-full gap-2 mt-2">
                <Key className="size-4" />
                {isChangingPass ? 'Updating Password…' : 'Update Password'}
              </Button>
            </form>
          </motion.div>

          {/* System Permissions Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">System Access & Privileges</h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">SAP Inventory Matching</span>
                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Verified
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Excel Data Import & Export</span>
                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Allowed
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Database Schema Admin</span>
                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Full Control
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
