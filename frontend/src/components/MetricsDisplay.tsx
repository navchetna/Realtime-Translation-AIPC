import type { SessionMetrics } from '../types';

interface MetricsDisplayProps {
  metrics: SessionMetrics;
}

export function MetricsDisplay({ metrics }: MetricsDisplayProps) {
  return (
    <div className="metrics-display">
      <div className="metric-card">
        <div className="metric-label">ASR RTF</div>
        <div className="metric-value">{metrics.asrRTF.toFixed(3)}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">LLM Tokens/s</div>
        <div className="metric-value">{metrics.llmTokensPerSec.toFixed(1)}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">TTS RTF</div>
        <div className="metric-value">{metrics.ttsRTF.toFixed(3)}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">E2E Latency</div>
        <div className="metric-value">{(metrics.totalLatency * 1000).toFixed(0)}ms</div>
      </div>
    </div>
  );
}
