import { useCallback, useRef, useState } from 'react'

export interface RunOutcome {
  success: boolean      // true if no error lines in output
  durationMs: number    // wall-clock time from run start to finish
  lineCount: number     // lines of code in the file at time of run
  filename?: string     // file that was run (used by execution history)
  errorText?: string    // traceback text when success === false
}

/** The three weighted components of the score, each 0–100 */
export interface ScoreBreakdown {
  execution: number
  speed: number
  recovery: number
}

export interface SessionTotals {
  runs: number
  successful: number
}

interface SessionStats {
  totalRuns: number
  successfulRuns: number
  // Rolling window of recent speed samples (ms-per-line of code)
  speedSamples: number[]
  // Timestamp (Date.now()) when the current error streak started; null if clean
  errorStreakStartMs: number | null
  // Most recent closed error-streak recovery duration in seconds
  lastRecoverySeconds: number | null
}

const SPEED_WINDOW = 10          // how many recent runs to average for speed
const SPEED_TUNING_K = 50        // ms-per-line at which speed_factor = 0.5
const RECOVERY_TUNING_K = 30     // seconds at which recovery_factor = 0.5

function computeFactors(stats: SessionStats): { successRate: number; speedFactor: number; recoveryFactor: number } {

  // Component 1: success rate (0–1)
  const successRate = stats.totalRuns === 0 ? 0 : stats.successfulRuns / stats.totalRuns

  // Component 2: speed factor — average ms-per-line, inverted+normalized
  let speedFactor = 1.0
  if (stats.speedSamples.length > 0) {
    const avg = stats.speedSamples.reduce((a, b) => a + b, 0) / stats.speedSamples.length
    speedFactor = 1 / (1 + avg / SPEED_TUNING_K)
  }

  // Component 3: error recovery speed (0–1)
  // If no error has ever occurred → 1.0
  // If currently in an error streak → use elapsed time so far (live penalty)
  // If last streak was closed → use that recovery duration
  let recoveryFactor = 1.0
  if (stats.errorStreakStartMs !== null) {
    // Active error streak — penalise continuously based on elapsed time
    const elapsedSeconds = (Date.now() - stats.errorStreakStartMs) / 1000
    recoveryFactor = 1 / (1 + elapsedSeconds / RECOVERY_TUNING_K)
  } else if (stats.lastRecoverySeconds !== null) {
    recoveryFactor = 1 / (1 + stats.lastRecoverySeconds / RECOVERY_TUNING_K)
  }

  return { successRate, speedFactor, recoveryFactor }
}

function computeScore(stats: SessionStats): number {
  if (stats.totalRuns === 0) return 0
  const { successRate, speedFactor, recoveryFactor } = computeFactors(stats)
  // Weighted formula (0–1), scaled to 0–100 — unchanged
  const raw = successRate * 0.5 + speedFactor * 0.3 + recoveryFactor * 0.2
  return Math.round(raw * 100)
}

function computeBreakdown(stats: SessionStats): ScoreBreakdown {
  if (stats.totalRuns === 0) return { execution: 0, speed: 0, recovery: 0 }
  const f = computeFactors(stats)
  return {
    execution: Math.round(f.successRate * 100),
    speed: Math.round(f.speedFactor * 100),
    recovery: Math.round(f.recoveryFactor * 100),
  }
}

const EMPTY_BREAKDOWN: ScoreBreakdown = { execution: 0, speed: 0, recovery: 0 }
const EMPTY_TOTALS: SessionTotals = { runs: 0, successful: 0 }

export function useEfficiencyScore() {
  const stats = useRef<SessionStats>({
    totalRuns: 0,
    successfulRuns: 0,
    speedSamples: [],
    errorStreakStartMs: null,
    lastRecoverySeconds: null,
  })

  const [score, setScore] = useState(0)
  const [breakdown, setBreakdown] = useState<ScoreBreakdown>(EMPTY_BREAKDOWN)
  const [totals, setTotals] = useState<SessionTotals>(EMPTY_TOTALS)

  const recordRun = useCallback((outcome: RunOutcome) => {
    const s = stats.current

    s.totalRuns++
    if (outcome.success) s.successfulRuns++

    // Speed sample: ms-per-line (floor at 1 to avoid division by zero)
    const msPerLine = outcome.durationMs / Math.max(1, outcome.lineCount)
    s.speedSamples.push(msPerLine)
    if (s.speedSamples.length > SPEED_WINDOW) s.speedSamples.shift()

    // Error recovery tracking
    if (!outcome.success) {
      // First error in a clean streak → start the clock
      if (s.errorStreakStartMs === null) {
        s.errorStreakStartMs = Date.now() - outcome.durationMs // start from when run began
      }
    } else {
      // Successful run — close any active error streak
      if (s.errorStreakStartMs !== null) {
        const recoveryMs = Date.now() - s.errorStreakStartMs
        s.lastRecoverySeconds = recoveryMs / 1000
        s.errorStreakStartMs = null
      }
    }

    setScore(computeScore(s))
    setBreakdown(computeBreakdown(s))
    setTotals({ runs: s.totalRuns, successful: s.successfulRuns })
  }, [])

  // Recompute score live even between runs (for the active-streak penalty ticking down)
  // We do NOT use an interval — score only updates when a run completes, which is fine
  // because the penalty is captured at run-time, not in real time between runs.

  const resetStats = useCallback(() => {
    stats.current = {
      totalRuns: 0,
      successfulRuns: 0,
      speedSamples: [],
      errorStreakStartMs: null,
      lastRecoverySeconds: null,
    }
    setScore(0)
    setBreakdown(EMPTY_BREAKDOWN)
    setTotals(EMPTY_TOTALS)
  }, [])

  return { score, breakdown, totals, recordRun, resetStats }
}
