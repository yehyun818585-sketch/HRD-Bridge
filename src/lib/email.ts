import 'server-only'
import { Resend } from 'resend'

// 커스텀 도메인 인증 없이 바로 쓸 수 있는 Resend 기본 발신 주소.
// 실제 서비스로 발전시킬 땐 회사 도메인으로 교체 권장.
const FROM_ADDRESS = 'HRD-Bridge <onboarding@resend.dev>'

export interface SendEmailInput {
  to: string[]
  subject: string
  html: string
}

// RESEND_API_KEY가 없으면 조용히 스킵한다 - 이메일 발송 실패가 댓글/승인 같은
// 핵심 기능을 막으면 안 되므로, 호출부에서 에러를 던지지 않고 결과만 반환한다.
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<{ sent: boolean; reason?: string }> {
  if (to.length === 0) {
    return { sent: false, reason: '수신자 없음' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY 미설정' }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    })

    if (error) {
      return { sent: false, reason: error.message }
    }
    return { sent: true }
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : '알 수 없는 오류' }
  }
}
