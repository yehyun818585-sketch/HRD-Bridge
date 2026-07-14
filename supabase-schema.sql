-- =============================================
-- 한국산인공 대시보드 - Supabase 스키마
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 기업 테이블
CREATE TABLE companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 과정 테이블
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  stage TEXT DEFAULT '준비중',
  issues TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 사용자 프로필 테이블 (역할 포함)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'company' CHECK (role IN ('company', 'center')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 댓글 테이블
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================

-- RLS 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 프로필: 모든 인증 사용자가 조회 가능
CREATE POLICY "프로필 조회" ON profiles
  FOR SELECT TO authenticated USING (true);

-- 프로필: 본인만 수정 가능
CREATE POLICY "본인 프로필 수정" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 기업: 모든 인증 사용자가 조회 가능
CREATE POLICY "기업 조회" ON companies
  FOR SELECT TO authenticated USING (true);

-- 과정: 모든 인증 사용자가 조회 가능
CREATE POLICY "과정 조회" ON courses
  FOR SELECT TO authenticated USING (true);

-- 과정: 기업 역할만 자신의 과정 수정 가능
CREATE POLICY "기업만 과정 수정" ON courses
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company'
      AND profiles.company_id = courses.company_id
    )
  );

-- 댓글: 모든 인증 사용자가 조회 가능
CREATE POLICY "댓글 조회" ON comments
  FOR SELECT TO authenticated USING (true);

-- 댓글: 모든 인증 사용자가 작성 가능
CREATE POLICY "댓글 작성" ON comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 댓글: 본인 댓글만 수정 가능
CREATE POLICY "본인 댓글 수정" ON comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 댓글: 본인 댓글만 삭제 가능
CREATE POLICY "본인 댓글 삭제" ON comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- 새 사용자 가입 시 프로필 자동 생성
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NULL  -- 역할 없음: 초대코드 등으로 별도 배정 전까지 접근 권한 없음
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 샘플 데이터 (테스트용)
-- =============================================

-- 샘플 기업
INSERT INTO companies (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'A사'),
  ('22222222-2222-2222-2222-222222222222', 'B사'),
  ('33333333-3333-3333-3333-333333333333', 'C사');

-- 샘플 과정
INSERT INTO courses (company_id, name, status, stage, issues) VALUES
  ('11111111-1111-1111-1111-111111111111', 'AI 개발자 양성과정', 'pending', '승인대기', '전담인력 누락'),
  ('11111111-1111-1111-1111-111111111111', '웹개발 실무과정', 'approved', '승인완료', NULL),
  ('22222222-2222-2222-2222-222222222222', '데이터분석 실무', 'draft', '준비중', '증빙서류 미첨부'),
  ('22222222-2222-2222-2222-222222222222', '클라우드 엔지니어 과정', 'pending', '승인대기', NULL),
  ('33333333-3333-3333-3333-333333333333', '보안전문가 과정', 'pending', '승인대기', NULL);

-- =============================================
-- Realtime 활성화 (댓글 알림용)
-- =============================================
-- Supabase 대시보드에서 comments 테이블의 Realtime을 활성화하세요
