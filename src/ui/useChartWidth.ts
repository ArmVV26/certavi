import { useLayoutEffect, useRef, useState } from 'react';

/** Width used before the first measurement and wherever there is no layout (tests, old engines). */
export const DEFAULT_CHART_WIDTH = 360;

/** A chart narrower than this cannot fit its axis labels. */
const MIN_CHART_WIDTH = 200;

/**
 * The width in CSS pixels of the SVG it is attached to. The chart draws on a canvas of exactly that
 * width, so one unit is one pixel and the axis text keeps its real size on any screen (a fixed
 * `viewBox` scaled to the container would make the text grow and shrink with it).
 */
export function useChartWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const measured = Math.round(element.getBoundingClientRect().width);
      if (measured > 0) setWidth(Math.max(measured, MIN_CHART_WIDTH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}
