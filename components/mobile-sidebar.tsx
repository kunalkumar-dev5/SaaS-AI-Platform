"use client";

import { useSyncExternalStore } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "@/components/sidebar";

const emptySubscribe = () => () => {};

const MobileSidebar = () => {
    const isMounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );

    if (!isMounted) {
        return null;
    }

    return (
        <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
                <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
                <Sidebar />
            </SheetContent>
        </Sheet>
    );
};

export default MobileSidebar;