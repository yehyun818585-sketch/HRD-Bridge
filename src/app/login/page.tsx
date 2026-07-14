'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [centerCode, setCenterCode] = useState('')
  const [centerName, setCenterName] = useState('')
  const [confirmStep, setConfirmStep] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'centerSignup'>('login')

  const switchMode = (next: 'login' | 'centerSignup') => {
    setMode(next)
    setConfirmStep(false)
    setError(null)
  }

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)

    // 센터명은 오타로 다른 센터가 생길 위험이 있어, 실제 가입 전에 한 번 더 확인시킨다.
    if (mode === 'centerSignup' && !confirmStep) {
      if (!centerName.trim()) {
        setError('센터명을 입력해주세요.')
        return
      }
      setConfirmStep(true)
      return
    }

    setLoading(true)

    if (mode === 'centerSignup') {
      // 1) 계정 생성 - 이 시점엔 role이 없는(권한 없음) 상태로 만들어진다.
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // 2) 센터 가입 코드는 서버(/api/claim-center-role)에서만 비교하고,
      //    센터명으로 기존 센터에 합류하거나 새 센터를 만든다.
      const res = await fetch('/api/claim-center-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: centerCode, centerName: centerName.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          `계정은 생성됐지만 센터 권한이 부여되지 않았습니다: ${data?.error || '코드를 확인해주세요.'}`
        )
        setLoading(false)
        return
      }

      router.push('/companies')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  // 테스트 계정 빠른 로그인
  const quickLogin = async (type: 'center' | 'companyA' | 'companyB' | 'companyC') => {
    setLoading(true)
    setError(null)

    const credentialsMap = {
      center: { email: 'center@example.com', password: 'test1234' },
      companyA: { email: 'company@example.com', password: 'test1234' },
      companyB: { email: 'companyb@example.com', password: 'test1234' },
      companyC: { email: 'companyc@example.com', password: 'test1234' },
    }

    const credentials = credentialsMap[type]
    const { error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      const typeNames = { center: '센터', companyA: 'A사', companyB: 'B사', companyC: 'C사' }
      setError(`${typeNames[type]} 테스트 계정이 없습니다.`)
    } else {
      router.push(type === 'center' ? '/companies' : '/my-company')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? '로그인' : '센터 가입'}
          </h1>
          <p className="mt-2 text-gray-600">일학습병행 대시보드</p>
        </div>

        {mode === 'login' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800 mb-3">테스트 계정으로 빠른 로그인</p>
            <div className="flex gap-2">
              <button
                onClick={() => quickLogin('center')}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                센터 담당자
              </button>
              <button
                onClick={() => quickLogin('companyA')}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                A사 담당자
              </button>
              <button
                onClick={() => quickLogin('companyB')}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
              >
                B사 담당자
              </button>
              <button
                onClick={() => quickLogin('companyC')}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
              >
                C사 담당자
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700">{error}</div>
        )}

        {mode === 'centerSignup' && confirmStep ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">아래 센터명이 맞는지 다시 한번 확인해주세요. 오타로 새 센터가 잘못 만들어지면 나중에 되돌리기 번거롭습니다.</p>
              <p className="mt-2 text-lg font-bold text-blue-900">{centerName}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStep(false)}
                disabled={loading}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
              >
                다시 입력
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={loading}
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {loading ? '처리중...' : '맞습니다, 가입 완료'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
            {mode === 'centerSignup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">센터명</label>
                  <input
                    type="text"
                    value={centerName}
                    onChange={(e) => setCenterName(e.target.value)}
                    placeholder="예: 서중대학교 산학협력단"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">센터 가입 코드</label>
                  <input
                    type="text"
                    value={centerCode}
                    onChange={(e) => setCenterCode(e.target.value)}
                    placeholder="센터 관리자에게 받은 코드"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {loading ? '처리중...' : mode === 'login' ? '로그인' : '다음'}
            </button>
          </form>
        )}

        <div className="text-center text-sm space-y-1">
          {mode === 'login' ? (
            <p>
              센터 담당자이신가요?{' '}
              <button onClick={() => switchMode('centerSignup')} className="text-blue-600 hover:underline">
                센터 가입
              </button>
            </p>
          ) : (
            <p>
              이미 계정이 있으신가요?{' '}
              <button onClick={() => switchMode('login')} className="text-blue-600 hover:underline">
                로그인
              </button>
            </p>
          )}
          <p className="text-gray-400">기업 담당자는 셀프 가입할 수 없습니다 — 센터에서 보낸 초대 메일로 가입해주세요.</p>
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
