import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 센터 셀프 가입 코드 검증. 코드 비교는 여기(서버)에서만 일어나고,
// 정답값(CENTER_INVITE_CODE)은 브라우저로 전송되지 않는다.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''

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

  const { error } = await supabase
    .from('profiles')
    .update({ role: 'center' })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
