'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// 이메일에 Supabase의 action_link를 그대로 넣으면, Gmail/보안 스캐너가 메일을
// 열람하기 전에 링크를 미리 방문(스캔)해 1회용 토큰을 소모시켜 정작 사용자가
// 클릭할 땐 "otp_expired"가 뜨는 문제가 있었다. 이를 피하려고 이메일 링크는
// 이 페이지(정적 로드, 토큰 미소모)로 보내고, 실제 토큰 검증은 사용자가
// 버튼을 눌러야만(스캐너는 클릭하지 않음) verifyOtp가 호출되도록 분리했다.
function AcceptInviteForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const tokenHash = searchParams.get('token_hash')

  const handleAccept = async () => {
    if (!tokenHash) return
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
    setLoading(false)

    if (error) {
      setError('링크가 만료되었거나 이미 사용됐습니다. 센터 담당자에게 재초대를 요청해주세요.')
      return
    }

    router.push('/auth/set-password')
  }

  if (!tokenHash) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-red-600 font-medium">초대 링크가 올바르지 않습니다.</p>
        <p className="text-gray-500 text-sm mt-2">센터 담당자에게 다시 초대를 요청해주세요.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">일학습병행 대시보드 초대</h1>
          <p className="mt-2 text-gray-600">아래 버튼을 눌러 가입을 완료해주세요.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>
        )}

        <button
          onClick={handleAccept}
          disabled={loading}
          className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
        >
          {loading ? '처리중...' : '초대 수락하고 가입하기'}
        </button>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh] text-gray-500">불러오는 중...</div>}>
      <AcceptInviteForm />
    </Suspense>
  )
}
