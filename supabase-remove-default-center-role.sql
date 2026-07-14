-- =============================================
-- 신규 가입자 기본 역할 제거 (보안 수정)
-- 지금까지는 누구나 회원가입만 하면 자동으로 role='center'가 부여되어
-- 전체 기업 데이터를 열람할 수 있었다. 신규 가입자는 role 없음(NULL, 권한 없음)으로
-- 시작하도록 바꾼다. role/company_id 배정은 이후 초대코드 절차에서 처리한다.
--
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- 주의: 기존에 이미 생성된 계정의 role은 이 스크립트로 바뀌지 않는다(신규 가입부터 적용).
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
