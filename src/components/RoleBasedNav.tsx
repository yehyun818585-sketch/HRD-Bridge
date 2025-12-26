'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function RoleBasedNav() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        setUserRole(profile?.role || null)
      }
      setLoading(false)
    }

    fetchRole()

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole()
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="w-20 h-6 bg-gray-200 animate-pulse rounded"></div>
  }

  // 센터 담당자용 메뉴
  if (userRole === 'center') {
    return (
      <Link
        href="/companies"
        className={`transition ${
          pathname.startsWith('/companies')
            ? 'text-blue-600 font-medium'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        기업 현황
      </Link>
    )
  }

  // 기업 담당자용 메뉴
  if (userRole === 'company') {
    return (
      <Link
        href="/my-company"
        className={`transition ${
          pathname === '/my-company'
            ? 'text-green-600 font-medium'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        내 기업
      </Link>
    )
  }

  // 로그인 안 된 경우 또는 역할 없는 경우 - 둘 다 표시
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/companies"
        className={`transition ${
          pathname.startsWith('/companies')
            ? 'text-blue-600 font-medium'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        센터용
      </Link>
      <span className="text-gray-300">|</span>
      <Link
        href="/my-company"
        className={`transition ${
          pathname === '/my-company'
            ? 'text-green-600 font-medium'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        기업용
      </Link>
    </div>
  )
}
