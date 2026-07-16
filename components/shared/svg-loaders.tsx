/**
 * Inline SVG loaders adapted from the SVG-Loaders collection
 * (https://github.com/SamHerbert/SVG-Loaders, MIT). All draw in
 * `currentColor` so they inherit the surrounding text color, and all are
 * decorative: pair them with an `aria-live` text label for the actual status.
 * Reduced-motion users get a static ellipsis instead of the SMIL animation.
 *
 * `DASH_LOADERS` is the pool the dashboard picks from at random for each
 * streaming run — one loader per submission, start to finish.
 */

import { useId } from 'react';

interface LoaderProps {
  /** Rendered square size in px (three-dots renders size × size/4). */
  size?: number;
  className?: string;
}

export type SvgLoader = (props: LoaderProps) => React.JSX.Element;

function Frame({
  className,
  children,
  viewBox,
  fill,
  stroke,
  width,
  height,
}: LoaderProps & {
  children: React.ReactNode;
  viewBox: string;
  fill?: string;
  stroke?: string;
  width: number;
  height: number;
}) {
  return (
    <span aria-hidden className={className}>
      <svg
        width={width}
        height={height}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        fill={fill}
        stroke={stroke}
        className="motion-reduce:hidden"
      >
        {children}
      </svg>
      <span aria-hidden className="hidden motion-reduce:inline">
        …
      </span>
    </span>
  );
}

const DOT = (cx: number, initialR: number, values: string, opacity: string) => (
  <circle cx={cx} cy="15" r={initialR}>
    <animate
      attributeName="r"
      begin="0s"
      dur="0.8s"
      values={values}
      calcMode="linear"
      repeatCount="indefinite"
    />
    <animate
      attributeName="fill-opacity"
      begin="0s"
      dur="0.8s"
      values={opacity}
      calcMode="linear"
      repeatCount="indefinite"
    />
  </circle>
);

/** Three pulsing dots. Wider than tall (4:1), so it renders at 1.5×size wide
 *  to hold its own next to the square loaders in the random pool. */
export function ThreeDotsLoader({ size = 16, className }: LoaderProps) {
  return (
    <Frame
      size={size}
      className={className}
      width={size * 1.5}
      height={size * 0.375}
      viewBox="0 0 120 30"
      fill="currentColor"
    >
      {DOT(15, 15, '15;9;15', '1;.5;1')}
      {DOT(60, 9, '9;15;9', '.5;1;.5')}
      {DOT(105, 15, '15;9;15', '1;.5;1')}
    </Frame>
  );
}

const PUFF_RING = (begin: string) => (
  <circle cx="22" cy="22" r="1">
    <animate
      attributeName="r"
      begin={begin}
      dur="1.8s"
      values="1; 20"
      calcMode="spline"
      keyTimes="0; 1"
      keySplines="0.165, 0.84, 0.44, 1"
      repeatCount="indefinite"
    />
    <animate
      attributeName="stroke-opacity"
      begin={begin}
      dur="1.8s"
      values="1; 0"
      calcMode="spline"
      keyTimes="0; 1"
      keySplines="0.3, 0.61, 0.355, 1"
      repeatCount="indefinite"
    />
  </circle>
);

/** Expanding-ring "puff". */
export function PuffLoader({ size = 14, className }: LoaderProps) {
  return (
    <Frame
      size={size}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      stroke="currentColor"
    >
      <g fill="none" fillRule="evenodd" strokeWidth="3">
        {PUFF_RING('0s')}
        {PUFF_RING('-0.9s')}
      </g>
    </Frame>
  );
}

/** Comet tail spinning around the dial. */
export function TailSpinLoader({ size = 16, className }: LoaderProps) {
  const gradientId = useId();
  return (
    <Frame
      size={size}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 38 38"
    >
      <defs>
        <linearGradient
          x1="8.042%"
          y1="0%"
          x2="65.682%"
          y2="23.865%"
          id={gradientId}
        >
          <stop stopColor="currentColor" stopOpacity="0" offset="0%" />
          <stop stopColor="currentColor" stopOpacity=".631" offset="63.146%" />
          <stop stopColor="currentColor" offset="100%" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <g transform="translate(1 1)">
          <path
            d="M36 18c0-9.94-8.06-18-18-18"
            stroke={`url(#${gradientId})`}
            strokeWidth="4"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 18 18"
              to="360 18 18"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </path>
          <circle fill="currentColor" cx="36" cy="18" r="1">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 18 18"
              to="360 18 18"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </g>
    </Frame>
  );
}

/** A faint dial with a rotating arc. */
export function OvalLoader({ size = 16, className }: LoaderProps) {
  return (
    <Frame
      size={size}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 38 38"
      stroke="currentColor"
    >
      <g fill="none" fillRule="evenodd">
        <g transform="translate(1 1)" strokeWidth="4">
          <circle strokeOpacity=".4" cx="18" cy="18" r="18" />
          <path d="M36 18c0-9.94-8.06-18-18-18">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 18 18"
              to="360 18 18"
              dur="1s"
              repeatCount="indefinite"
            />
          </path>
        </g>
      </g>
    </Frame>
  );
}

const BAR = (x: number, begin: string, tall: boolean) => (
  <rect x={x} y={tall ? 0 : 10} width="15" height={tall ? 140 : 120} rx="6">
    <animate
      attributeName="height"
      begin={begin}
      dur="1s"
      values="120;110;100;90;80;70;60;50;40;140;120"
      calcMode="linear"
      repeatCount="indefinite"
    />
    <animate
      attributeName="y"
      begin={begin}
      dur="1s"
      values="10;15;20;25;30;35;40;45;50;0;10"
      calcMode="linear"
      repeatCount="indefinite"
    />
  </rect>
);

/** Five equalizer bars. */
export function BarsLoader({ size = 16, className }: LoaderProps) {
  return (
    <Frame
      size={size}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 135 140"
      fill="currentColor"
    >
      {BAR(0, '0.5s', false)}
      {BAR(30, '0.25s', false)}
      {BAR(60, '0s', true)}
      {BAR(90, '0.25s', false)}
      {BAR(120, '0.5s', false)}
    </Frame>
  );
}

const GRID_DOT = (cx: number, cy: number, begin: string) => (
  <circle cx={cx} cy={cy} r="12.5">
    <animate
      attributeName="fill-opacity"
      begin={begin}
      dur="1s"
      values="1;.2;1"
      calcMode="linear"
      repeatCount="indefinite"
    />
  </circle>
);

/** A 3×3 grid of twinkling dots. */
export function GridLoader({ size = 16, className }: LoaderProps) {
  return (
    <Frame
      size={size}
      className={className}
      width={size}
      height={size}
      viewBox="0 0 105 105"
      fill="currentColor"
    >
      {GRID_DOT(12.5, 12.5, '0s')}
      {GRID_DOT(12.5, 52.5, '100ms')}
      {GRID_DOT(52.5, 12.5, '300ms')}
      {GRID_DOT(52.5, 52.5, '600ms')}
      {GRID_DOT(92.5, 12.5, '800ms')}
      {GRID_DOT(92.5, 52.5, '400ms')}
      {GRID_DOT(12.5, 92.5, '700ms')}
      {GRID_DOT(52.5, 92.5, '500ms')}
      {GRID_DOT(92.5, 92.5, '200ms')}
    </Frame>
  );
}

/** The pool the dashboard's streaming input draws from — one random pick per
 *  analysis run, kept from the first stage through the save. */
export const DASH_LOADERS: SvgLoader[] = [
  ThreeDotsLoader,
  PuffLoader,
  TailSpinLoader,
  OvalLoader,
  BarsLoader,
  GridLoader,
];
