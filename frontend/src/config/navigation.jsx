import {
  LayoutDashboard,
  Package,
  Clock,
  Truck,
  Layers,
  FileText,
  History,
} from 'lucide-react';

export const navigation = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Inventory Analytics',
    items: [
      { label: 'Closing Inventory',  href: '/closing-inventory',  icon: Package },
      { label: 'Storage Ageing',     href: '/storage-ageing',     icon: Clock },
      { label: 'Product Analytics',  href: '/product-analytics',  icon: Layers },
      { label: 'In-Transit (GIT)',   href: '/in-transit',         icon: Truck },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Reports',         href: '/reports',         icon: FileText },
      { label: 'Report History',  href: '/report-history',  icon: History },
    ],
  },
];
