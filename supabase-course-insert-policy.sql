-- =============================================
-- 과정(course) 생성 정책 - 지금까지 courses에는 UPDATE 정책만 있고 INSERT 정책이
-- 없어서, 기업이 새 과정을 만들 방법이 아예 없었다(RLS가 기본적으로 막음).
-- 기업 담당자가 본인 회사 소속으로만 새 과정을 만들 수 있게 허용한다.
--
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- =============================================

DROP POLICY IF EXISTS "기업은 본인 회사 과정 생성 가능" ON courses;
CREATE POLICY "기업은 본인 회사 과정 생성 가능" ON courses
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company'
      AND profiles.company_id = courses.company_id
    )
  );
