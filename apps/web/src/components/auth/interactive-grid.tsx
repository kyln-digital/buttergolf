"use client";

import React, { useState } from "react";

/**
 * InteractiveGridPattern is a component that renders a grid pattern with interactive squares.
 * Customized for ButterGolf branding with Spiced Clementine (#F45314) accents.
 *
 * The SVG is absolutely positioned to fill its (relatively positioned) parent and scales its
 * grid to cover that box, so it never contributes to the parent's layout width. This app has
 * no Tailwind, so sizing/positioning must be inline rather than utility classes.
 *
 * @param width - The width of each square.
 * @param height - The height of each square.
 * @param squares - The number of squares in the grid. The first element is the number of horizontal squares, and the second element is the number of vertical squares.
 * @param className - The class name of the grid.
 * @param squaresClassName - The class name of the squares.
 */
interface InteractiveGridPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontal, vertical]
  className?: string;
  squaresClassName?: string;
}

/**
 * The InteractiveGridPattern component.
 *
 * @see InteractiveGridPatternProps for the props interface.
 * @returns A React component.
 */
export function InteractiveGridPattern({
  width = 40,
  height = 40,
  squares = [24, 24],
  className = "",
  squaresClassName = "",
  style,
  ...props
}: InteractiveGridPatternProps) {
  const [horizontal, vertical] = squares;
  const [hoveredSquare, setHoveredSquare] = useState<number | null>(null);
  const gridWidth = width * horizontal;
  const gridHeight = height * vertical;

  return (
    <svg
      viewBox={`0 0 ${gridWidth} ${gridHeight}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }}
      {...props}
    >
      {Array.from({ length: horizontal * vertical }).map((_, index) => {
        const x = (index % horizontal) * width;
        const y = Math.floor(index / horizontal) * height;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            className={`transition-all duration-100 ease-in-out [&:not(:hover)]:duration-1000 ${squaresClassName}`}
            style={{
              stroke: "rgba(244, 83, 20, 0.25)", // Spiced Clementine at 25% opacity
              fill: hoveredSquare === index ? "rgba(244, 83, 20, 0.15)" : "transparent",
            }}
            onMouseEnter={() => setHoveredSquare(index)}
            onMouseLeave={() => setHoveredSquare(null)}
          />
        );
      })}
    </svg>
  );
}
