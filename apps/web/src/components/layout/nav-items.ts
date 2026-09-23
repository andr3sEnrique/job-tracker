import { Briefcase, Inbox, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { title: 'Resumen', href: '/', icon: LayoutDashboard },
  { title: 'Candidaturas', href: '/applications', icon: Briefcase },
  { title: 'Revisión', href: '/review', icon: Inbox },
  { title: 'Ajustes', href: '/settings', icon: Settings },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
