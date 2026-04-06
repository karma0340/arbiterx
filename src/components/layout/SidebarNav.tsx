'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { LayoutDashboard, BrainCircuit, Settings, LogOut } from 'lucide-react';
import { logout } from '@/lib/actions';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/analysis', label: 'AI Analysis', icon: BrainCircuit },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === link.href}
            tooltip={{ children: link.label }}
          >
            <Link href={link.href}>
              <link.icon />
              <span>{link.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
       <SidebarMenuItem>
         <form action={logout} className="w-full">
            <SidebarMenuButton tooltip={{ children: "Logout" }} className="w-full">
                <LogOut />
                <span>Logout</span>
            </SidebarMenuButton>
         </form>
        </SidebarMenuItem>
    </SidebarMenu>
  );
}
