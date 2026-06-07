-- =============================================================
-- 첫 A/B 실험 시드: PDP 1차 CTA 카피 (OMO-2610, 프레임워크 OMO-2596)
-- Marketing 정의. 멱등(idempotent) — 재실행 안전.
-- 대상: 제품 상세(PDP) 1차 CTA("Design Online" 버튼)
-- 지표: ctr (CTA 카피는 클릭 의사결정에 직접 작용 → 같은 화면에서 귀속·빠른 신호)
-- =============================================================

-- 1) 실험 정의 (status=running, started_at 즉시 설정)
INSERT INTO print_marketing_experiments
  (key, name, description, surface, status, goal_metric,
   min_sample_per_variant, confidence_level, auto_promote, max_runtime_days, started_at)
VALUES
  ('pdp_cta_copy',
   'PDP 1차 CTA 카피 A/B',
   'PDP 우측 구성기의 1차 CTA("Design Online") 카피를 현행 vs 혜택형으로 비교. '
   || '카피가 클릭률(노출→CTA 클릭)에 미치는 영향을 측정한다.',
   'product_page',
   'running',
   'ctr',
   200, 0.95, true, 30,
   now())
ON CONFLICT (key) DO UPDATE
  SET status = 'running',
      goal_metric = EXCLUDED.goal_metric,
      surface = EXCLUDED.surface,
      min_sample_per_variant = EXCLUDED.min_sample_per_variant,
      started_at = COALESCE(print_marketing_experiments.started_at, EXCLUDED.started_at);

-- 2) 변형 2개 (control 포함) — config.ctaLabel 을 클라이언트가 렌더
WITH exp AS (
  SELECT id FROM print_marketing_experiments WHERE key = 'pdp_cta_copy'
)
INSERT INTO print_marketing_experiment_variants
  (experiment_id, key, name, is_control, weight, config)
SELECT exp.id, v.key, v.name, v.is_control, v.weight, v.config
FROM exp,
  (VALUES
    ('control', 'Design Online (현행)',          true,  1, '{"ctaLabel":"Design Online"}'::jsonb),
    ('benefit', 'Start Your Free Design (혜택형)', false, 1, '{"ctaLabel":"Start Your Free Design"}'::jsonb)
  ) AS v(key, name, is_control, weight, config)
ON CONFLICT (experiment_id, key) DO UPDATE
  SET config = EXCLUDED.config,
      name = EXCLUDED.name,
      is_active = true;
