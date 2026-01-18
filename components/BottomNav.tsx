'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  icon: string;
  activeIcon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: '/', icon: '🏠', activeIcon: '🏠', label: 'Hem' },
  { href: '/suggest', icon: '💡', activeIcon: '💡', label: 'Förslag' },
  { href: '/rate', icon: '👆', activeIcon: '👆', label: 'Betygsätt' }, // Center action
  { href: '/plan', icon: '📅', activeIcon: '📅', label: 'Vecka' },
  { href: '/profile', icon: '👤', activeIcon: '👤', label: 'Profil' },
];

export function BottomNav() {
  const pathname = usePathname();
  
  // Don't show nav on login page
  if (pathname === '/login') return null;
  
  return (
    <nav className="bottom-nav">
      {navItems.map((item, index) => {
        const isActive = pathname === item.href;
        const isCenter = index === 2; // Rate button is center
        
        if (isCenter) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="nav-action"
              aria-label={item.label}
            >
              <span>{item.icon}</span>
            </Link>
          );
        }
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-item-icon">
              {isActive ? item.activeIcon : item.icon}
            </span>
            <span className="nav-item-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
