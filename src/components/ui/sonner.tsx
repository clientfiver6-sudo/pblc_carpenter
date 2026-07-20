"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-surface !text-ink !border-border !shadow-2 !rounded-xl",
          title: "!text-ink !font-semibold !text-sm",
          description: "!text-ink-3 !text-sm",
          actionButton: "!bg-ink !text-white !font-semibold",
          cancelButton: "!bg-surface-2 !text-ink-3",
          success: "!border-moss/30 [&>[data-icon]]:!text-moss",
          error: "!border-danger/30 [&>[data-icon]]:!text-danger",
          warning: "!border-warning/30 [&>[data-icon]]:!text-warning",
          info: "!border-info/30 [&>[data-icon]]:!text-info",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
