import { Link } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/profile/UserAvatar";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-transparent transition hover:ring-primary/40"
          aria-label="Open profile menu"
        >
          <UserAvatar
            userId={user.id}
            initials={user.avatar ?? user.fullName.charAt(0)}
            className="h-9 w-9 text-xs"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <Link
          to="/profile/$userId"
          params={{ userId: user.id }}
          search={{ tab: "timeline" }}
          onClick={() => setOpen(false)}
          className="block cursor-pointer rounded-sm px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/feed" className="cursor-pointer" onClick={() => setOpen(false)}>
            <User className="mr-2 h-4 w-4" />
            Hope feed
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={() => {
            setOpen(false);
            void signOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
