-- =============================================
-- RLS 정책 재설정 - 비로그인(anon) 조회 차단
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다(기존 정책을 지우고 다시 만듦).
-- =============================================

-- 1. 이름을 아는 기존 정책 제거
DROP POLICY IF EXISTS "프로필 조회" ON profiles;
DROP POLICY IF EXISTS "본인 프로필 수정" ON profiles;
DROP POLICY IF EXISTS "기업 조회" ON companies;
DROP POLICY IF EXISTS "과정 조회" ON courses;
DROP POLICY IF EXISTS "기업만 과정 수정" ON courses;
DROP POLICY IF EXISTS "댓글 조회" ON comments;
DROP POLICY IF EXISTS "댓글 작성" ON comments;
DROP POLICY IF EXISTS "본인 댓글 수정" ON comments;
DROP POLICY IF EXISTS "본인 댓글 삭제" ON comments;

-- 2. course_files는 supabase-schema.sql에 없던 테이블이라 기존 정책명을 모름 -> 전부 조회해서 제거
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'course_files'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.course_files', pol.policyname);
  END LOOP;
END $$;

-- 3. RLS 활성화 (이미 켜져 있어도 안전)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_files ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. 읽기(SELECT): 인증된 사용자만 (요청 핵심 사항)
-- =============================================

CREATE POLICY "authenticated_select" ON companies
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON courses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select" ON course_files
  FOR SELECT TO authenticated USING (true);

-- =============================================
-- 5. 쓰기: 기존 기능이 계속 동작하도록 최소한으로 유지
--    (RLS를 켜면 정책 없는 명령은 전부 막히므로 필요)
-- =============================================

-- 프로필: 본인만 수정
CREATE POLICY "본인 프로필 수정" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 과정: 기업 역할 + 본인 회사 과정만 수정
CREATE POLICY "기업만 과정 수정" ON courses
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company'
      AND profiles.company_id = courses.company_id
    )
  );

-- 댓글: 인증된 사용자면 작성 가능, 본인 댓글만 수정/삭제
CREATE POLICY "댓글 작성" ON comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 댓글 수정" ON comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "본인 댓글 삭제" ON comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- course_files: 현재 앱 코드에 역할 구분이 없어 "로그인만 하면 업로드/삭제 가능"으로 맞춤
-- (자기 회사 과정으로 더 제한하고 싶다면 courses.company_id와 profiles.company_id를 대조하는 조건 추가 필요)
CREATE POLICY "인증 사용자 파일 업로드" ON course_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "인증 사용자 파일 수정" ON course_files
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "인증 사용자 파일 삭제" ON course_files
  FOR DELETE TO authenticated USING (true);
