// A/B 실험 프레임워크 타입 (OMO-2596)

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'
export type GoalMetric = 'cvr' | 'ctr' | 'rpv' | 'aov'
export type ExperimentEventType = 'impression' | 'click' | 'conversion'

export interface Experiment {
  id: string
  key: string
  name: string
  description: string | null
  surface: string
  status: ExperimentStatus
  goal_metric: GoalMetric
  min_sample_per_variant: number
  confidence_level: number
  auto_promote: boolean
  max_runtime_days: number
  winner_variant_id: string | null
  decided_at: string | null
  decision_reason: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface ExperimentVariant {
  id: string
  experiment_id: string
  key: string
  name: string
  is_control: boolean
  weight: number
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
}

export interface ExperimentPerf {
  experiment_id: string
  variant_id: string
  variant_key: string
  variant_name: string
  is_control: boolean
  is_active: boolean
  weight: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  cvr: number
  ctr: number
  rpv: number
  aov: number
}
