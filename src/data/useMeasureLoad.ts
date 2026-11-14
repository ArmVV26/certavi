import { useEffect, useState } from 'react';
import { afterPaint, startMeasure, type DiagnosticMetric } from './diagnostics';

/**
 * Times how long a screen takes to show its content (Settings → Diagnostics): from its first
 * render until `ready` is true and that content is painted. Once per time the screen is opened.
 */
export function useMeasureLoad(metric: DiagnosticMetric, ready: boolean): void {
  // The initializer runs when the screen first renders; the timer only counts its first stop.
  const [stop] = useState(() => startMeasure(metric));
  useEffect(() => {
    if (ready) afterPaint(stop);
  }, [ready, stop]);
}
