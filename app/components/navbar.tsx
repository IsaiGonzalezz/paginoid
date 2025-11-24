'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Clock, Target } from 'lucide-react';

const navItems = [
    { name: 'Estantería', href: '/', icon: BookOpen },
    { name: 'Cronómetro', href: '/cronometro', icon: Clock },
    { name: 'Metas', href: '/metas', icon: Target },
];

const Navbar: React.FC = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-xl sm:hidden">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {navItems.map((item) => {
                    const isActive = item.href === '/' 
                        ? pathname === '/' 
                        : pathname.startsWith(item.href);
                    
                    const Icon = item.icon;
                    
                    return (
                        <Link key={item.name} href={item.href} className="flex flex-col items-center justify-center p-2 text-xs font-medium w-full h-full transition duration-150 ease-in-out">
                            <Icon 
                                className={`w-6 h-6 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} 
                                aria-label={item.name}
                            />
                            <span className={`mt-1 ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default Navbar;