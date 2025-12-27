'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ center?: string; companyA?: string; companyB?: string; companyC?: string }>({})
  const [centerEmail, setCenterEmail] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const supabase = createClient()

  const createTestAccount = async (type: 'center' | 'companyA' | 'companyB' | 'companyC', email: string) => {
    if (!email) {
      setResults(prev => ({ ...prev, [type]: '이메일을 입력해주세요.' }))
      return
    }

    setLoading(true)
    const password = 'test1234'

    // 1. 회원가입
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setResults(prev => ({ ...prev, [type]: `오류: ${error.message}` }))
      setLoading(false)
      return
    }

    if (data.user) {
      // 2. 프로필 업데이트 (역할 및 소속 기업 설정)
      let profileUpdate
      if (type === 'center') {
        profileUpdate = { role: 'center', name: '센터 담당자' }
      } else if (type === 'companyA') {
        profileUpdate = { role: 'company', name: 'A사 담당자', company_id: '11111111-1111-1111-1111-111111111111' }
      } else if (type === 'companyB') {
        profileUpdate = { role: 'company', name: 'B사 담당자', company_id: '22222222-2222-2222-2222-222222222222' }
      } else {
        profileUpdate = { role: 'company', name: 'C사 담당자', company_id: '33333333-3333-3333-3333-333333333333' }
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', data.user.id)

      if (profileError) {
        setResults(prev => ({ ...prev, [type]: `프로필 설정 오류: ${profileError.message}` }))
      } else {
        setResults(prev => ({
          ...prev,
          [type]: `성공! ${email} / ${password}`
        }))
      }
    }

    // 로그아웃 (다른 계정 생성을 위해)
    await supabase.auth.signOut()
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">테스트 계정 설정</h1>
        <p className="mt-2 text-gray-600">
          센터 담당자와 기업 담당자 테스트 계정을 생성합니다.
        </p>
      </div>

      {/* 테스트 계정 생성 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 센터 담당자 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-blue-900">센터 담당자</h2>
              <p className="text-sm text-blue-700">모든 기업 조회, 댓글 작성</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-blue-800 mb-4">
            <p><strong>이메일:</strong> center@example.com</p>
            <p><strong>비밀번호:</strong> test1234</p>
            <p><strong>역할:</strong> center</p>
          </div>

          <button
            onClick={() => createTestAccount('center', 'center@example.com')}
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? '생성 중...' : '센터 계정 생성'}
          </button>

          {results.center && (
            <p className={`mt-2 text-sm ${results.center.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
              {results.center}
            </p>
          )}
        </div>

        {/* 기업 담당자 A사 */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-green-900">기업 담당자 (A사)</h2>
              <p className="text-sm text-green-700">본인 기업만 조회/수정</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-green-800 mb-4">
            <p><strong>이메일:</strong> company@example.com</p>
            <p><strong>비밀번호:</strong> test1234</p>
            <p><strong>역할:</strong> company (A사 소속)</p>
          </div>

          <button
            onClick={() => createTestAccount('companyA', 'company@example.com')}
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? '생성 중...' : 'A사 계정 생성'}
          </button>

          {results.companyA && (
            <p className={`mt-2 text-sm ${results.companyA.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
              {results.companyA}
            </p>
          )}
        </div>
      </div>

      {/* 기업 담당자 B사 */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-orange-900">기업 담당자 (B사)</h2>
            <p className="text-sm text-orange-700">본인 기업만 조회/수정</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-orange-800 mb-4">
          <p><strong>이메일:</strong> companyb@example.com</p>
          <p><strong>비밀번호:</strong> test1234</p>
          <p><strong>역할:</strong> company (B사 소속)</p>
        </div>

        <button
          onClick={() => createTestAccount('companyB', 'companyb@example.com')}
          disabled={loading}
          className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
        >
          {loading ? '생성 중...' : 'B사 계정 생성'}
        </button>

        {results.companyB && (
          <p className={`mt-2 text-sm ${results.companyB.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
            {results.companyB}
          </p>
        )}
      </div>

      {/* 기업 담당자 C사 */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-purple-900">기업 담당자 (C사)</h2>
            <p className="text-sm text-purple-700">본인 기업만 조회/수정</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-purple-800 mb-4">
          <p><strong>이메일:</strong> companyc@example.com</p>
          <p><strong>비밀번호:</strong> test1234</p>
          <p><strong>역할:</strong> company (C사 소속)</p>
        </div>

        <button
          onClick={() => createTestAccount('companyC', 'companyc@example.com')}
          disabled={loading}
          className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {loading ? '생성 중...' : 'C사 계정 생성'}
        </button>

        {results.companyC && (
          <p className={`mt-2 text-sm ${results.companyC.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>
            {results.companyC}
          </p>
        )}
      </div>

      {/* 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h3 className="font-semibold text-amber-900 mb-2">Supabase 설정 필요</h3>
        <p className="text-sm text-amber-800 mb-3">
          이메일/비밀번호 로그인을 사용하려면 Supabase 대시보드에서 다음 설정이 필요합니다:
        </p>
        <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1">
          <li>Authentication → Providers → Email 활성화</li>
          <li>"Confirm email" 옵션 비활성화 (테스트용)</li>
          <li>또는 생성된 계정의 이메일을 수동으로 확인 처리</li>
        </ol>
      </div>

      {/* 테스트 방법 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">테스트 방법</h3>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <p><strong>브라우저 1:</strong> center@example.com 로그인 → /companies 페이지에서 모든 기업 확인</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <p><strong>브라우저 2 (시크릿):</strong> company@example.com 로그인 → /my-company 페이지에서 A사 정보만 확인</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-medium">3</span>
            <p><strong>댓글 테스트:</strong> 양쪽에서 댓글을 주고받으며 실시간 소통 확인</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Link
          href="/login"
          className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
        >
          로그인 페이지로
        </Link>
        <Link
          href="/"
          className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
