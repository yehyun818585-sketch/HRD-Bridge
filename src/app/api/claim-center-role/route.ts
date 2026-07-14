import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// 센터 셀프 가입 코드 검증. 코드 비교는 여기(서버)에서만 일어나고,
// 정답값(CENTER_INVITE_CODE)은 브라우저로 전송되지 않는다.
// 센터명은 자유 입력이라, 기존에 등록된 같은 이름의 센터가 있으면 거기에 합류시키고
// 없으면 새로 만든다(find-or-create). 오타로 인한 중복 생성은 클라이언트 쪽 확인
// 단계(재입력 확인)로 줄인다 - 완벽히 막지는 못한다.
//
// 실제 DB 쓰기(센터 조회/생성, 프로필 갱신)는 관리자 클라이언트로 수행한다 -
// 이 라우트는 코드 검증을 통과해야만 도달하는 이미 신뢰된 경로라, RLS 정책이
// 어떤 상태든(아직 안 걸었든 일부만 걸었든) 항상 동일하게 동작해야 하기 때문이다.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const centerName = typeof body?.centerName === 'string' ? body.centerName.trim().replace(/\s+/g, ' ') : ''

  if (!centerName) {
    return NextResponse.json({ error: '센터명을 입력해주세요.' }, { status: 400 })
  }

  const expected = process.env.CENTER_INVITE_CODE
  if (!expected) {
    return NextResponse.json(
      { error: 'CENTER_INVITE_CODE가 서버에 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  if (!code || code !== expected) {
    return NextResponse.json({ error: '센터 가입 코드가 올바르지 않습니다.' }, { status: 403 })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않아 가입을 완료할 수 없습니다.' },
      { status: 500 }
    )
  }

  // 같은 이름의 센터가 이미 있으면 합류, 없으면 새로 생성
  const { data: existingCenter, error: findError } = await admin
    .from('centers')
    .select('id')
    .eq('name', centerName)
    .maybeSingle()

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }

  let centerId = existingCenter?.id

  if (!centerId) {
    const { data: createdCenter, error: createError } = await admin
      .from('centers')
      .insert({ name: centerName })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
    centerId = createdCenter.id
  }

  const { error } = await admin
    .from('profiles')
    .update({ role: 'center', center_id: centerId })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
