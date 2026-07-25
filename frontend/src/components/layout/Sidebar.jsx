import { useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { navigation } from '../../config/navigation';
import { useSidebarStore } from '../../store/sidebarStore';
import { Badge } from '../ui/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip';
import { ScrollArea } from '../ui/ScrollArea';
import { Button } from '../ui/Button';

function SidebarLogo({ collapsed }) {
  return (
    <div className="flex h-16 items-center gap-3 px-4 border-b border-border/50 bg-background/40">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-md border border-slate-200 dark:border-slate-800 dark:bg-slate-900 ring-1 ring-black/5">
        <img src="/logo-icon-bold-dark.png" alt="Sona Comstar" className="size-full object-contain dark:hidden" />
        <img src="/logo-icon-bold-white.png" alt="Sona Comstar" className="hidden size-full object-contain dark:block" />
      </div>
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="whitespace-nowrap">
              <p className="text-base font-black tracking-tight text-foreground">
                SONA COMSTAR
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                Inventory Analytics
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItemLink({ item, collapsed, isActive }) {
  const Icon = item.icon;

  const linkContent = (
    <Link
      to={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
        isActive
          ? 'nav-active text-primary'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && item.badge && (
        <Badge
          variant="secondary"
          className="ml-auto text-[10px] px-1.5 py-0 h-5"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function NavSectionGroup({ section, collapsed, pathname }) {
  return (
    <div className="mb-2">
      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mb-1 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
          >
            {section.title}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={pathname === item.href}
          />
        ))}
      </div>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { isCollapsed, toggle } = useSidebarStore();

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 72 : 280 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative hidden h-screen flex-col border-r border-border/50 bg-sidebar md:flex"
    >
      <SidebarLogo collapsed={isCollapsed} />

      <ScrollArea className="flex-1 px-2 py-3">
        <nav>
          {navigation.map((section) => (
            <NavSectionGroup
              key={section.title}
              section={section}
              collapsed={isCollapsed}
              pathname={pathname}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="border-t border-border/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="w-full justify-center"
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronLeft className="size-4" />
          </motion.div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-xs"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  );
}

export function MobileSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const { setMobileOpen } = useSidebarStore();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setMobileOpen(false);
    }
  }, [pathname, setMobileOpen]);

  return (
    <nav className="px-2 py-4 space-y-1">
      {navigation.map((section) => (
        <NavSectionGroup
          key={section.title}
          section={section}
          collapsed={false}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}
