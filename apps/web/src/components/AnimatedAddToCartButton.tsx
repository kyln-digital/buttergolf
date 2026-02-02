"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@buttergolf/ui";
import styles from "./AnimatedAddToCartButton.module.css";

interface AnimatedAddToCartButtonProps {
  onAddToCart: () => Promise<void>;
  disabled?: boolean;
}

const BURST_SEGMENTS = Array.from({ length: 8 }, (_, idx) => ({
  id: `burst-${idx}`,
  order: idx,
}));

// Butter brand colors for burst animation
const COLORS = [
  "#E25F2F", // Primary Butter Orange
  "#FF8D5C", // Light Butter Orange (butter300)
  "#FFE38A", // Butter Yellow (butter100)
  "#FEFAD6", // Butter Cream (background)
  "#1A2E44", // Navy secondary
];

// Utility function to get random value in range (replaces gsap.utils.random)
function randomInRange(min: number, max: number, snap = 0.01): number {
  const value = Math.random() * (max - min) + min;
  return snap ? Math.round(value / snap) * snap : value;
}

// Utility function to get random item from array
function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function AnimatedAddToCartButton({
  onAddToCart,
  disabled = false,
}: Readonly<AnimatedAddToCartButtonProps>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleClick = async () => {
    if (!buttonRef.current || isAdding || disabled) return;

    const button = buttonRef.current;

    // Set random delays and colors for burst animation using vanilla JS
    const burstElements = button.querySelectorAll(".burst g");
    for (const el of burstElements) {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty("--d", String(randomInRange(0, 0.4, 0.01)));
      htmlEl.style.setProperty("--color", randomFromArray(COLORS));
    }

    // Start loading state
    setIsAdding(true);
    button.disabled = true;

    try {
      // Call the add to cart function
      await onAddToCart();

      // Wait for all animations to complete
      await Promise.all(button.getAnimations({ subtree: true }).map((a) => a.finished));

      // Reset after brief delay
      setTimeout(() => {
        setIsAdding(false);
        button.disabled = false;
      }, 500);
    } catch (error) {
      // On error, reset immediately
      console.error("Failed to add to cart:", error);
      setIsAdding(false);
      button.disabled = false;
    }
  };

  return (
    <Button
      ref={buttonRef}
      onPress={handleClick}
      aria-label="Add to cart"
      className={styles.addToCart}
      data-adding={isAdding}
      disabled={disabled}
      chromeless
    >
      <span className={`${styles.flex} ${styles.addToCartText}`}>
        <span className={`${styles.svgWrapper} ${styles.addToCartIcon}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="var(--icon-stroke-width)"
              d="M16.608 9.421V6.906H3.392v8.016c0 .567.224 1.112.624 1.513.4.402.941.627 1.506.627H8.63M8.818 3h2.333c.618 0 1.212.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.344c0-.622.246-1.218.683-1.658A2.33 2.33 0 0 1 8.82 3"
            />
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="var(--icon-stroke-width)"
              d="M14.608 12.563v5m2.5-2.5h-5"
            />
          </svg>
        </span>
        <span className={styles.addToCartTextContent}>Add to cart</span>
      </span>
      <span className={`${styles.flex} ${styles.added}`}>
        <span className={`${styles.svgWrapper} ${styles.addToCartIconAdded}`}>
          <svg
            className={styles.checkmarkBurst}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g className={styles.check}>
              <path
                className={styles.ring}
                d="M21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className={styles.tick}
                d="M9 12.75L11.25 15L15 9.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g className={`${styles.burst} burst`}>
              {BURST_SEGMENTS.map((segment) => (
                <g key={segment.id} style={{ "--index": segment.order } as CSSProperties}>
                  <path
                    className={styles.wiggle}
                    pathLength={1}
                    d="M12 8.5 Q13 9.5 12 10.5 Q11 11.5 12 12.5 Q13 13.5 12 15.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <line
                    className={styles.line}
                    strokeLinecap="round"
                    pathLength={1}
                    x1="12"
                    y1="8.5"
                    x2="12"
                    y2="15.5"
                    stroke="currentColor"
                  />
                </g>
              ))}
            </g>
          </svg>
        </span>
      </span>
    </Button>
  );
}
