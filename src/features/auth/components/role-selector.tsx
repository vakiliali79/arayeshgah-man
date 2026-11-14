import { StoreIcon, ScissorsIcon, UserIcon } from "@/components/icons";
import { ROLE_META, SELF_ASSIGNABLE_ROLES, type SelfAssignableRole } from "@/config/roles";
import { cn } from "@/lib/utils";

const icons: Record<SelfAssignableRole, typeof UserIcon> = {
  customer: UserIcon,
  stylist: ScissorsIcon,
  salon_owner: StoreIcon,
};

/** انتخاب نوع حساب با radio بومی (بدون نیاز به JS و دسترس‌پذیر) */
export function RoleSelector({ defaultValue = "customer", error }: { defaultValue?: SelfAssignableRole; error?: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium">نوع حساب</legend>
      <div className="grid grid-cols-3 gap-2">
        {SELF_ASSIGNABLE_ROLES.map((role) => {
          const Icon = icons[role];
          return (
            <label key={role} className="cursor-pointer">
              <input type="radio" name="role" value={role} defaultChecked={role === defaultValue} className="peer sr-only" />
              <span
                className={cn(
                  "flex h-full flex-col items-center gap-1.5 rounded-md border border-border bg-surface p-3 text-center transition-all",
                  "peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:shadow-soft peer-focus-visible:ring-4 peer-focus-visible:ring-primary-100",
                  "hover:border-primary-200",
                )}
              >
                <Icon size={22} className="text-primary-600" />
                <span className="text-sm font-semibold">{ROLE_META[role].label}</span>
                <span className="hidden text-[0.7rem] leading-4 text-muted sm:block">{ROLE_META[role].description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}
