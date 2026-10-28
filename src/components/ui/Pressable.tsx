import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { haptic } from '@/lib/haptics'

type Props = HTMLMotionProps<'button'> & { haptics?: 'tap' | 'select' | 'heavy' | false; scale?: number }

/** Button with a tactile press: slight scale-down and a haptic tick. */
export const Pressable = forwardRef<HTMLButtonElement, Props>(function Pressable(
  { haptics = 'tap', scale = 0.96, onClick, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      onClick={(e) => {
        if (haptics) haptic(haptics)
        onClick?.(e)
      }}
      {...rest}
    />
  )
})
