import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// 센터 담당자만 호출 가능한 기업 담당자 초대 API. 기업은 셀프 가입이 불가능하고
// 이 경로로만 계정이 생성된다. company_id는 초대 메일의 사용자 메타데이터에 실어 보내고,
// 가입 완료 시 handle_new_user() 트리거가 그대로 profiles에 반영한다.
// (센터 계정은 이 API가 아니라 /api/claim-center-role의 코드 검증으로 생성된다.)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'center') {
    return NextResponse.json({ error: '센터 담당자만 초대할 수 있습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const companyId = typeof body?.companyId === 'string' ? body.companyId : ''

  if (!email || !companyId) {
    return NextResponse.json({ error: '이메일과 소속 회사를 올바르게 입력해주세요.' }, { status: 400 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 초대를 보낼 수 없습니다. 환경 변수를 추가해주세요.' },
      { status: 500 }
    )
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: 'company', company_id: companyId },
    redirectTo: `${request.nextUrl.origin}/auth/callback?next=/auth/set-password`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
