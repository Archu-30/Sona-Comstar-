import {
  LayoutDashboard,
  Package,
  Clock,
  Truck,
  BarChart3,
  Brain,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Inventory Analytics',
    items: [
      { label: 'Closing Inventory', href: '/closing-inventory', icon: Package },
      { label: 'Storage Ageing', href: '/storage-ageing', icon: Clock },
      { label: 'In-Transit (GIT)', href: '/in-transit', icon: Truck },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart3 },
      { label: 'AI Insights', href: '/ai-insights', icon: Brain },
    ],
  },
];
