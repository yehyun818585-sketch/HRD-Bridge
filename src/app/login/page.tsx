'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setError('회원가입 완료! 이메일 확인 후 로그인하세요. (테스트 환경에서는 바로 로그인 가능)')
        setMode('login')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  // 테스트 계정 빠른 로그인
  const quickLogin = async (type: 'center' | 'companyA' | 'companyB' | 'companyC') => {
    setLoading(true)
    setError(null)

    const credentialsMap = {
      center: { email: 'center@example.com', password: 'test1234' },
      companyA: { email: 'companya@example.com', password: 'test1234' },
      companyB: { email: 'companyb@example.com', password: 'test1234' },
      companyC: { email: 'companyc@example.com', password: 'test1234' },
    }

    const credentials = credentialsMap[type]
    const { error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      const typeNames = { center: '센터', companyA: 'A사', companyB: 'B사', companyC: 'C사' }
      setError(`${typeNames[type]} 테스트 계정이 없습니다. 먼저 생성해주세요.`)
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
            {mode === 'login' ? '로그인' : '회원가입'}
          </h1>
          <p className="mt-2 text-gray-600">일학습병행 대시보드</p>
        </div>

        {/* 테스트 계정 빠른 로그인 */}
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
          <p className="text-xs text-amber-600 mt-2">
            * 테스트 계정이 없으면 아래에서 먼저 생성하세요
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className={`p-3 rounded-lg text-sm ${error.includes('완료') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {error}
          </div>
        )}

        {/* 이메일/비밀번호 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
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
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition"
          >
            {loading ? '처리중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {/* 모드 전환 */}
        <div className="text-center text-sm">
          {mode === 'login' ? (
            <p>
              계정이 없으신가요?{' '}
              <button onClick={() => setMode('signup')} className="text-blue-600 hover:underline">
                회원가입
              </button>
            </p>
          ) : (
            <p>
              이미 계정이 있으신가요?{' '}
              <button onClick={() => setMode('login')} className="text-blue-600 hover:underline">
                로그인
              </button>
            </p>
          )}
        </div>

        {/* 구분선 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 text-gray-500">또는</span>
          </div>
        </div>

        {/* Google 로그인 */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google 계정으로 로그인
        </button>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
