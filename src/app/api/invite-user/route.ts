import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendEmail } from '@/lib/email'

// 센터 담당자만 호출 가능한 기업 담당자 초대 API. 기업은 셀프 가입이 불가능하고
// 이 경로로만 계정이 생성된다. company_id는 초대 메일의 사용자 메타데이터에 실어 보내고,
// 가입 완료 시 handle_new_user() 트리거가 그대로 profiles에 반영한다.
// (센터 계정은 이 API가 아니라 /api/claim-center-role의 코드 검증으로 생성된다.)
//
// 회사는 센터가 이름으로 직접 지정한다 - 내 센터 소속에 같은 이름 회사가 있으면 거기로
// 초대하고, 없으면(신규 회사) 그 자리에서 만든다. DB 작업은 claim-center-role과 마찬가지로
// 관리자 클라이언트로 수행해 RLS 정책 상태와 무관하게 항상 동작하게 한다.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, center_id')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'center' || !callerProfile.center_id) {
    return NextResponse.json({ error: '센터 담당자만 초대할 수 있습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim().replace(/\s+/g, ' ') : ''

  if (!email || !companyName) {
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

  // 내 센터 소속에서 같은 이름 회사를 찾고, 없으면 새로 만든다.
  const { data: existingCompany, error: findError } = await admin
    .from('companies')
    .select('id')
    .eq('center_id', callerProfile.center_id)
    .eq('name', companyName)
    .maybeSingle()

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }

  let companyId = existingCompany?.id

  if (!companyId) {
    const { data: createdCompany, error: createError } = await admin
      .from('companies')
      .insert({ name: companyName, center_id: callerProfile.center_id })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    companyId = createdCompany.id
  }

  // Supabase 기본 초대 메일(inviteUserByEmail)은 영문 템플릿에 Site URL 설정을 그대로 쓰기 때문에
  // 센터명/회사명을 넣을 수 없고 로컬 개발 중 저장된 localhost 주소가 노출되는 문제가 있었다.
  // generateLink로 계정 생성 + 링크 발급까지만 하고, 실제 발송은 우리 Resend 템플릿으로 직접 한다.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { role: 'company', company_id: companyId },
      redirectTo: `${request.nextUrl.origin}/auth/callback?next=/auth/set-password`,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  const { data: centerRow } = await admin
    .from('centers')
    .select('name')
    .eq('id', callerProfile.center_id)
    .single()
  const centerName = centerRow?.name || '센터'

  const emailResult = await sendEmail({
    to: [email],
    subject: `[일학습병행 대시보드] ${centerName}에서 ${companyName} 담당자님을 초대했습니다`,
    html: `
      <p><b>${centerName}</b>가 <b>${companyName}</b> 담당자님을 일학습병행 정보 미러링 대시보드에 초대합니다.</p>
      <p>아래 버튼을 눌러 비밀번호를 설정하고 가입을 완료해주세요.</p>
      <p><a href="${linkData.properties.action_link}">초대 수락하고 가입하기</a></p>
    `,
  })

  return NextResponse.json({ success: true, email: emailResult })
}
