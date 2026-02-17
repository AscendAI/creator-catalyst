import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 1500,
  formatFn = (n) => n.toLocaleString(),
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number>();

  useEffect(() => {
    // Cancel any existing animation first
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startValue = previousValue.current;
    const endValue = value;

    // Skip animation if value is 0 - just display it immediately
    if (endValue === 0) {
      setDisplayValue(0);
      previousValue.current = 0;
      return;
    }

    // Skip reverse animations (when going from higher to lower value)
    // Instead, animate from 0 to the new value
    const animateFrom = endValue < startValue ? 0 : startValue;
    
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = animateFrom + (endValue - animateFrom) * easeOut;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{formatFn(Math.round(displayValue))}</span>;
}

export function AnimatedCurrency({
  value,
  duration = 1500,
  className,
}: Omit<AnimatedNumberProps, "formatFn">) {
  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      formatFn={(n) => `$${n.toLocaleString()}`}
      className={className}
    />
  );
}
