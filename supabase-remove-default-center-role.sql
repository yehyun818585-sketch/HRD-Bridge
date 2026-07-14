-- =============================================
-- 가입 경로별 role/company_id 자동 반영 (보안 수정)
-- 1) 신규 가입자는 기본적으로 role 없음(NULL, 권한 없음)으로 시작한다.
--    지금까지는 회원가입만 하면 자동으로 role='center'가 부여되어 전체 기업
--    데이터를 열람할 수 있었다.
-- 2) 센터가 /api/invite-user로 기업 담당자를 초대할 때 실어 보낸 role/company_id
--    메타데이터가 있으면, 가입 즉시 그 값을 그대로 프로필에 반영한다.
-- 3) 센터 셀프 가입(코드 입력)은 메타데이터 없이 가입한 뒤 /api/claim-center-role에서
--    별도로 role을 'center'로 올리므로, 이 트리거에서는 손대지 않는다(NULL로 시작).
--
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- 주의: 기존에 이미 생성된 계정의 role은 이 스크립트로 바뀌지 않는다(신규 가입부터 적용).
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'role',  -- 초대 메타데이터의 role, 없으면 NULL(권한 없음)
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid  -- 초대 메타데이터의 company_id, 없으면 NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
