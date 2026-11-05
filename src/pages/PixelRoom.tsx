/**
 * Decorative pixel-art scene for the homepage hero: a little desk with a
 * CRT monitor, a plant and a window full of stars. Purely presentational.
 */
const PIXELS: [number, number, number, number, string][] = [
  // window frame + night sky
  [2, 1, 10, 8, "#0f1630"],
  [3, 2, 8, 6, "#263f88"],
  [4, 3, 1, 1, "#ffdf68"],
  [8, 2, 1, 1, "#ffffff"],
  [9, 5, 1, 1, "#ffdf68"],
  [6, 6, 1, 1, "#ffffff"],
  [6, 2, 1, 6, "#0f1630"],
  [3, 5, 8, 1, "#0f1630"],
  // monitor
  [15, 4, 9, 7, "#0f1630"],
  [16, 5, 7, 5, "#d8dcf1"],
  [17, 6, 5, 3, "#5b3fd9"],
  [18, 7, 1, 1, "#2fe6ff"],
  [20, 7, 1, 1, "#f4b6d2"],
  [18, 11, 3, 1, "#0f1630"],
  [17, 12, 5, 1, "#0f1630"],
  // desk
  [1, 13, 26, 1, "#0f1630"],
  [1, 14, 26, 1, "#a6b5e7"],
  [2, 15, 1, 4, "#0f1630"],
  [25, 15, 1, 4, "#0f1630"],
  // plant
  [5, 9, 1, 2, "#2f9e44"],
  [4, 8, 1, 1, "#2f9e44"],
  [6, 8, 1, 1, "#2f9e44"],
  [3, 7, 1, 1, "#2f9e44"],
  [7, 7, 1, 1, "#2f9e44"],
  [4, 11, 3, 2, "#c4572e"],
  // mug
  [11, 11, 2, 2, "#ffdf68"],
  [13, 11, 1, 1, "#ffdf68"],
];

export function PixelRoom({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 19"
      width={280}
      height={190}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {PIXELS.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}
