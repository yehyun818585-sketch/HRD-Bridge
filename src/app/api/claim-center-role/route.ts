import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 센터 셀프 가입 코드 검증. 코드 비교는 여기(서버)에서만 일어나고,
// 정답값(CENTER_INVITE_CODE)은 브라우저로 전송되지 않는다.
// 센터명은 자유 입력이라, 기존에 등록된 같은 이름의 센터가 있으면 거기에 합류시키고
// 없으면 새로 만든다(find-or-create). 오타로 인한 중복 생성은 클라이언트 쪽 확인
// 단계(재입력 확인)로 줄인다 - 완벽히 막지는 못한다.
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

  // 같은 이름의 센터가 이미 있으면 합류, 없으면 새로 생성
  const { data: existingCenter } = await supabase
    .from('centers')
    .select('id')
    .eq('name', centerName)
    .maybeSingle()

  let centerId = existingCenter?.id

  if (!centerId) {
    const { data: createdCenter, error: createError } = await supabase
      .from('centers')
      .insert({ name: centerName })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    centerId = createdCenter.id
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'center', center_id: centerId })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
