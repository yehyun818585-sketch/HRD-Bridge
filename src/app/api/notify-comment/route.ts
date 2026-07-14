import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'

// 댓글이 insert된 직후 클라이언트가 호출하는 알림 API. 대시보드를 안 켜놓고 있어도
// 상대방이 이메일로 알 수 있게 한다. 작성자 본인에게는 보내지 않고,
// 같은 회사 담당자 + 그 회사가 속한 센터 담당자에게 보낸다.
// 이메일 발송 실패는 댓글 저장 자체와 무관하므로 여기서 에러가 나도 200으로 응답한다
// (호출부가 fire-and-forget으로 부르기 때문에 굳이 실패를 전파할 필요가 없다).
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const commentId = typeof body?.commentId === 'string' ? body.commentId : ''
  if (!commentId) {
    return NextResponse.json({ error: 'commentId가 필요합니다.' }, { status: 400 })
  }

  const { data: comment } = await supabase
    .from('comments')
    .select('id, content, user_id, course_id')
    .eq('id', commentId)
    .single()
  if (!comment) {
    return NextResponse.json({ sent: false, reason: '댓글을 찾을 수 없음' })
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, company_id')
    .eq('id', comment.course_id)
    .single()
  if (!course) {
    return NextResponse.json({ sent: false, reason: '과정을 찾을 수 없음' })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, center_id')
    .eq('id', course.company_id)
    .single()
  if (!company) {
    return NextResponse.json({ sent: false, reason: '기업을 찾을 수 없음' })
  }

  // 호출자가 이 과정에 실제로 접근 권한이 있는지 확인 (본인 회사 또는 본인 센터)
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id, center_id')
    .eq('id', user.id)
    .single()

  const authorized =
    (callerProfile?.role === 'company' && callerProfile.company_id === company.id) ||
    (callerProfile?.role === 'center' && callerProfile.center_id === company.center_id)

  if (!authorized) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', comment.user_id)
    .single()

  const authorLabel = `${authorProfile?.name || '알 수 없음'} (${authorProfile?.role === 'center' ? '센터' : '기업'})`
  const excerpt = comment.content.length > 200 ? `${comment.content.slice(0, 200)}...` : comment.content
  const origin = request.nextUrl.origin

  // 같은 회사 담당자 + 그 회사가 속한 센터 담당자 (작성자 본인 제외)
  const { data: recipients } = await supabase
    .from('profiles')
    .select('id, email, role')
    .or(`company_id.eq.${company.id},center_id.eq.${company.center_id}`)
    .neq('id', comment.user_id)

  const companyEmails = (recipients || [])
    .filter((r) => r.role === 'company' && r.email)
    .map((r) => r.email as string)
  const centerEmails = (recipients || [])
    .filter((r) => r.role === 'center' && r.email)
    .map((r) => r.email as string)

  const results = await Promise.all([
    companyEmails.length > 0
      ? sendEmail({
          to: companyEmails,
          subject: `[일학습병행 대시보드] ${course.name} 새 댓글`,
          html: `<p><b>${authorLabel}</b>님이 <b>${course.name}</b>에 댓글을 남겼습니다.</p><p>${excerpt}</p><p><a href="${origin}/my-company">대시보드에서 확인하기</a></p>`,
        })
      : Promise.resolve({ sent: false, reason: '수신자 없음' }),
    centerEmails.length > 0
      ? sendEmail({
          to: centerEmails,
          subject: `[일학습병행 대시보드] ${company.name} - ${course.name} 새 댓글`,
          html: `<p><b>${authorLabel}</b>님이 <b>${company.name} / ${course.name}</b>에 댓글을 남겼습니다.</p><p>${excerpt}</p><p><a href="${origin}/companies/${company.id}?course=${course.id}">대시보드에서 확인하기</a></p>`,
        })
      : Promise.resolve({ sent: false, reason: '수신자 없음' }),
  ])

  return NextResponse.json({ results })
}
