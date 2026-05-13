'use client';

import Drawer from "./Drawer";

interface DrawerProviderProps {
  children: React.ReactNode;
}

export default function DrawerProvider({ children }: DrawerProviderProps) {
  return (
    <div className="flex h-screen bg-[var(--background)] overflow-hidden fixed inset-0">
      <Drawer>
        {children}
      </Drawer>
    </div>
  );
}
