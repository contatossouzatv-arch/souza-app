import * as React from "react"
import { OOTPInput, OOTPInputContext } from "input-otp"
import { Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOOTP = React.forwardRef(({ className, containerClassName, ...props }, ref) => (
  <OOTPInput
    ref={ref}
    containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props} />
))
InputOOTP.displayName = "InputOOTP"

const InputOOTPGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
InputOOTPGroup.displayName = "InputOOTPGroup"

const InputOOTPSlot = React.forwardRef(({ index, className, ...props }, ref) => {
  const inputOOTPContext = React.useContext(OOTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOOTPContext.slots[index]

  return (
    (<div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className
      )}
      {...props}>
      {char}
      {hasFakeCaret && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>)
  );
})
InputOOTPSlot.displayName = "InputOOTPSlot"

const InputOOTPSeparator = React.forwardRef(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
))
InputOOTPSeparator.displayName = "InputOOTPSeparator"

export { InputOOTP, InputOOTPGroup, InputOOTPSlot, InputOOTPSeparator }
