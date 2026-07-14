-- =============================================
-- 센터 다중화: 센터가 여러 개일 수 있고, 각 센터는 자기 소속 회사만 봐야 한다.
-- 지금까지는 센터가 1개라고 가정하고 companies/profiles에 소속 센터 정보가 아예 없었다.
--
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- =============================================

CREATE TABLE IF NOT EXISTS centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id);

-- 기존 A/B/C사와 기존 센터 계정을 "서중대학교 산학협력단" 센터 하나로 이관
INSERT INTO centers (name) VALUES ('서중대학교 산학협력단')
  ON CONFLICT (name) DO NOTHING;

UPDATE companies SET center_id = (SELECT id FROM centers WHERE name = '서중대학교 산학협력단')
  WHERE center_id IS NULL;

UPDATE profiles SET center_id = (SELECT id FROM centers WHERE name = '서중대학교 산학협력단')
  WHERE role = 'center' AND center_id IS NULL;

-- =============================================
-- RLS: centers 테이블 활성화 + 정책, companies/courses 조회를 센터 단위로 제한
-- (supabase-rls-policies.sql을 이미 실행했다면 이 아래 블록으로 companies/courses의
--  기존 "authenticated_select" 정책이 교체된다)
-- =============================================

ALTER TABLE centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON centers;
CREATE POLICY "authenticated_select" ON centers
  FOR SELECT TO authenticated USING (true);

-- 센터 가입 시 새 센터명을 입력하면 find-or-create로 새 row가 생길 수 있어 INSERT 허용
DROP POLICY IF EXISTS "인증 사용자 센터 생성" ON centers;
CREATE POLICY "인증 사용자 센터 생성" ON centers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select" ON companies;
CREATE POLICY "센터/기업 소속 기준 조회" ON companies
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        (profiles.role = 'center' AND profiles.center_id = companies.center_id)
        OR (profiles.role = 'company' AND profiles.company_id = companies.id)
      )
    )
  );

DROP POLICY IF EXISTS "authenticated_select" ON courses;
CREATE POLICY "센터/기업 소속 기준 조회" ON courses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM companies
      JOIN profiles ON profiles.id = auth.uid()
      WHERE companies.id = courses.company_id
      AND (
        (profiles.role = 'center' AND profiles.center_id = companies.center_id)
        OR (profiles.role = 'company' AND profiles.company_id = companies.id)
      )
    )
  );
