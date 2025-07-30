"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole } from "@/types";

interface UserRoleSwitcherProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
}

const roles: UserRole[] = ["PLAYER", "MANAGER", "OWNER", "PROMOTER", "REFEREE"];

export function UserRoleSwitcher({ role, onRoleChange }: UserRoleSwitcherProps) {
  return (
    <Select value={role} onValueChange={(value) => onRoleChange(value as UserRole)}>
      <SelectTrigger className="w-[180px] font-semibold bg-transparent border-2 border-primary text-primary focus:ring-primary">
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r} className="font-semibold">
            {r.charAt(0) + r.slice(1).toLowerCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
