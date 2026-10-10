import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface UserProfileLinkProps {
  userId: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export function UserProfileLink({ userId, className, children, onClick }: UserProfileLinkProps) {
  return (
    <Link
      to="/profile/$userId"
      params={{ userId }}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      {children}
    </Link>
  );
}
