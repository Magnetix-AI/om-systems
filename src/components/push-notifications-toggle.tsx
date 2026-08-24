import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function PushNotificationsToggle() {
  const { state, busy, ready, enable, disable } = usePushNotifications();

  const isIos =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  const handleEnable = async () => {
    const res = await enable();
    if (res.ok) toast.success("ההתראות הופעלו במכשיר הזה");
    else toast.error(res.error ?? "לא ניתן להפעיל התראות");
  };

  const handleDisable = async () => {
    await disable();
    toast.success("ההתראות כובו במכשיר הזה");
  };

  const Icon = state === "on" ? BellRing : state === "denied" ? BellOff : Bell;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="התראות"
          className={state === "on" ? "text-primary" : undefined}
        >
          {busy || !ready ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-right" dir="rtl">
        <div className="space-y-3">
          <div>
            <div className="font-medium text-sm">התראות למכשיר</div>
            <p className="text-xs text-muted-foreground mt-1">
              קבלת התראות על קריאות חדשות ושיוכים — גם כשהאפליקציה סגורה.
            </p>
          </div>

          {state === "unsupported" && (
            <p className="text-xs text-muted-foreground">
              הדפדפן הנוכחי לא תומך בהתראות.
            </p>
          )}

          {state === "denied" && (
            <p className="text-xs text-destructive">
              חסמת התראות עבור האתר. יש לאשר אותן מחדש בהגדרות הדפדפן.
            </p>
          )}

          {isIos && !isStandalone && state !== "on" && (
            <p className="text-xs text-muted-foreground">
              באייפון יש להוסיף קודם את האפליקציה למסך הבית (שיתוף ← "הוסף למסך הבית")
              ורק אז להפעיל התראות.
            </p>
          )}

          {state === "on" ? (
            <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={handleDisable}>
              כבה התראות במכשיר הזה
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={busy || state === "unsupported" || state === "denied"}
              onClick={handleEnable}
            >
              הפעל התראות במכשיר הזה
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
