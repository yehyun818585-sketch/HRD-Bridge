import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'

interface Company {
  id: string
  name: string
  created_at: string
  courses: {
    id: string
    name: string
    status: string
    stage: string
    issues: string | null
  }[]
}

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      created_at,
      courses (
        id,
        name,
        status,
        stage,
        issues
      )
    `)
    .order('name')

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">데이터를 불러오는데 실패했습니다.</p>
        <p className="text-gray-500 text-sm mt-2">Supabase 연결을 확인해주세요.</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인'
      case 'pending': return '대기'
      case 'rejected': return '반려'
      default: return '준비중'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">기업 현황</h1>
        <p className="text-gray-500">총 {companies?.length || 0}개 기업</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">기업명</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">과정명</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">현재 단계</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">상태</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">주요 이슈</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {companies?.map((company: Company) => (
              company.courses?.map((course, idx) => (
                <tr key={course.id} className="hover:bg-gray-50">
                  {idx === 0 && (
                    <td
                      className="px-6 py-4 font-medium text-gray-900"
                      rowSpan={company.courses.length}
                    >
                      {company.name}
                    </td>
                  )}
                  <td className="px-6 py-4 text-gray-700">{course.name}</td>
                  <td className="px-6 py-4 text-gray-700">{course.stage}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
                      {getStatusText(course.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {course.issues || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/companies/${company.id}?course=${course.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>

        {(!companies || companies.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            등록된 기업이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
