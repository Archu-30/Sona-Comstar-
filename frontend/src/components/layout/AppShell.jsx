import { useEffect, useCallback } from 'react';
import { useSidebarStore } from '../../store/sidebarStore';
import { Sidebar, MobileSidebar } from './Sidebar';
import { Header } from './Header';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';

export default function AppShell({ children }) {
  const { isMobileOpen, setMobileOpen } = useSidebarStore();

  const handleMobileMenuOpen = useCallback(() => {
    setMobileOpen(true);
  }, [setMobileOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        useSidebarStore.getState().toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar sheet */}
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <MobileSidebar />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMobileMenuOpen={handleMobileMenuOpen}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
