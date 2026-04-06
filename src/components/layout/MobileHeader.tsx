// src/components/layout/MobileHeader.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Bell, Filter, Settings, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/actions';

export function MobileHeader() {
  const { setOpenMobile: setFilterSheetOpen } = useSidebar();
  const pathname = usePathname();

  if (pathname.startsWith('/dashboard/settings')) {
    return null;
  }


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <div>
        <h1 className="font-headline text-xl font-bold">Dashboard</h1>
        {/* Placeholder for opportunity count */}
        <p className="text-xs text-muted-foreground">Live opportunities</p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Bell className="size-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        {pathname === '/dashboard' && (
          <Button variant="ghost" size="icon" onClick={() => setFilterSheetOpen(true)}>
            <Filter className="size-5" />
            <span className="sr-only">Filters</span>
          </Button>
        )}
        <Link href="/dashboard/settings" passHref>
          <Button variant="ghost" size="icon">
            <Settings className="size-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
        <form action={logout}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="size-5" />
            <span className="sr-only">Log out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
