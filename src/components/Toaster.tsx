import { Toaster as SonnerToaster } from "sonner";

export default function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      gap={8}
      visibleToasts={4}
      closeButton
      offset="calc(0.75rem + env(safe-area-inset-top))"
      mobileOffset="calc(0.75rem + env(safe-area-inset-top))"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "vyou-toast pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-[#1a1c22]/85 px-4 py-3 text-[13px] leading-snug text-white shadow-[0_12px_36px_-14px_rgba(0,0,0,0.7)] backdrop-blur-xl ring-1 ring-black/5",
          title: "font-medium tracking-tight",
          description: "mt-0.5 text-[12px] text-white/60",
          icon: "vyou-toast-icon mt-[1px] shrink-0",
          error:
            "border-rose-400/25 bg-rose-500/[0.14] text-rose-50 [&_.vyou-toast-icon]:text-rose-300",
          success:
            "border-emerald-400/25 bg-emerald-500/[0.14] text-emerald-50 [&_.vyou-toast-icon]:text-emerald-300",
          info: "border-sky-400/25 bg-sky-500/[0.14] text-sky-50 [&_.vyou-toast-icon]:text-sky-300",
          warning:
            "border-amber-400/25 bg-amber-500/[0.14] text-amber-50 [&_.vyou-toast-icon]:text-amber-200",
          actionButton:
            "rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white active:scale-95",
          cancelButton:
            "rounded-full px-3 py-1 text-[12px] text-white/60 active:scale-95",
          closeButton:
            "!border-white/10 !bg-white/[0.08] !text-white/70",
        },
      }}
    />
  );
}
