import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  LogOut,
  Settings,
  User,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSidebarStore } from '../../store/sidebarStore';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu';
import { UploadButton } from './UploadButton';

function useBreadcrumbs() {
  const location = useLocation();

  const segments = location.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => ({
      label: segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      href: '/' + segment,
    }));

  return segments;
}

export function Header({ onMobileMenuOpen }) {
  const { toggle } = useSidebarStore();
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const [notificationCount] = useState(3);

  const handleLogout = () => {
    localStorage.removeItem('sona_auth');
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/50 glass px-4">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenuOpen}
      >
        <Menu className="size-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      {/* Desktop sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={toggle}
      >
        <Menu className="size-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>

      {/* Breadcrumb */}
      <nav className="hidden items-center gap-1 text-sm md:flex">
        <span className="text-muted-foreground">Home</span>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            <ChevronRight className="size-3 text-muted-foreground/50" />
            <span
              className={cn(
                i === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <UploadButton />
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {notificationCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
              {notificationCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer rounded-full ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar className="size-8 border border-border/50">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-xs font-semibold text-white">
                SC
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground">
                  admin@sonacomstar.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="mr-2 size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
