import { forwardRef } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = forwardRef<HTMLElement, ToasterProps>((props, _ref) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      duration={4000}
      closeButton
      // Explicit swipe support so users can flick toasts away on touch devices
      // even before the auto-dismiss timer fires.
      swipeDirections={["bottom", "left", "right"]}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          // Sonner ships a 20×20 close button styled for light themes. Override
          // for an accessible touch target (44×44 minimum per Apple HIG /
          // Material) and theme it to the Dark Void palette so it doesn't
          // show as a white pill on dark toasts.
          closeButton:
            "!h-11 !w-11 !min-h-[44px] !min-w-[44px] !bg-background !border-border !text-foreground hover:!bg-muted hover:!border-foreground/30 !transform-none !left-auto !right-2 !top-2 !rounded-full",
        },
      }}
      {...props}
    />
  );
});

Toaster.displayName = "Toaster";

export { Toaster, toast };
