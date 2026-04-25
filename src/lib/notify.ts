import { toast, type ExternalToast } from "sonner";

// Single async-notification surface for VYou. Use for anything the user shouldn't
// have to read inline — submission outcomes, edge-function failures, credit
// awards. Inline UI stays for first-class states (empty list, missing photo).
export const notify = {
  success: (message: string, opts?: ExternalToast) => toast.success(message, opts),
  error: (message: string, opts?: ExternalToast) => toast.error(message, opts),
  info: (message: string, opts?: ExternalToast) => toast.info(message, opts),
  warning: (message: string, opts?: ExternalToast) => toast.warning(message, opts),
  message: (message: string, opts?: ExternalToast) => toast(message, opts),
  loading: (message: string, opts?: ExternalToast) => toast.loading(message, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
  credit: (message: string, opts?: ExternalToast) =>
    toast.success(message, { icon: "✨", ...opts }),
};
