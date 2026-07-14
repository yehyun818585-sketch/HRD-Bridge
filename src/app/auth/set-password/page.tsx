'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// 센터 초대 메일을 통해 가입한 기업 담당자가 처음 로그인할 때 비밀번호를 설정하는 페이지.
// role/company_id는 초대 시점에 이미 handle_new_user() 트리거가 반영해뒀으므로 여기서는 손대지 않는다.
export default function SetPasswordPage() {
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setHasSession(!!user)
      setChecking(false)
    }
    check()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (checking) {
    return <div className="flex items-center justify-center min-h-[40vh] text-gray-500">확인 중...</div>
  }

  if (!hasSession) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-red-600 font-medium">초대 링크가 유효하지 않거나 만료되었습니다.</p>
        <p className="text-gray-500 text-sm mt-2">센터 담당자에게 다시 초대를 요청해주세요.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 설정</h1>
          <p className="mt-2 text-gray-600">초대가 확인되었습니다. 로그인에 사용할 비밀번호를 설정해주세요.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {loading ? '처리중...' : '비밀번호 설정하고 시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
