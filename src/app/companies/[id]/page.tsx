import { createServerSupabaseClient } from '@/lib/supabase-server'
import CommentSection from '@/components/CommentSection'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Course {
  id: string
  name: string
  status: string
  stage: string
  issues: string | null
  created_at: string
}

interface Company {
  id: string
  name: string
  created_at: string
  courses: Course[]
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ course?: string }>
}) {
  const { id } = await params
  const { course: selectedCourseId } = await searchParams

  const supabase = await createServerSupabaseClient()

  const { data: company, error } = await supabase
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
        issues,
        created_at
      )
    `)
    .eq('id', id)
    .single()

  if (error || !company) {
    notFound()
  }

  const typedCompany = company as Company
  const selectedCourse = selectedCourseId
    ? typedCompany.courses.find((c) => c.id === selectedCourseId)
    : typedCompany.courses[0]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인완료'
      case 'pending': return '승인대기'
      case 'rejected': return '반려'
      default: return '준비중'
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Link
          href="/companies"
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{typedCompany.name}</h1>
          <p className="text-gray-500">총 {typedCompany.courses.length}개 과정</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 과정 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            과정 목록
          </h2>
          {typedCompany.courses.map((course) => (
            <Link
              key={course.id}
              href={`/companies/${id}?course=${course.id}`}
              className={`block p-4 rounded-lg border transition ${
                selectedCourse?.id === course.id
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900">{course.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(course.status)}`}>
                  {getStatusText(course.status)}
                </span>
              </div>
              <p className="text-sm text-gray-500">{course.stage}</p>
            </Link>
          ))}
        </div>

        {/* 과정 상세 + 댓글 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            <>
              {/* 과정 정보 (읽기 전용) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCourse.name}
                  </h2>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    읽기 전용
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">현재 단계</p>
                    <p className="font-medium text-gray-900">{selectedCourse.stage}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">승인 상태</p>
                    <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedCourse.status)}`}>
                      {getStatusText(selectedCourse.status)}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                    <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
                    <p className={`font-medium ${selectedCourse.issues ? 'text-red-600' : 'text-gray-400'}`}>
                      {selectedCourse.issues || '이슈 없음'}
                    </p>
                  </div>
                </div>

                {/* 체크리스트 (예시) */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">서류 제출 현황</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">사업계획서</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCourse.issues?.includes('전담인력') ? (
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={selectedCourse.issues?.includes('전담인력') ? 'text-red-600' : 'text-gray-700'}>
                        전담인력 등록
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCourse.issues?.includes('증빙') ? (
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className={selectedCourse.issues?.includes('증빙') ? 'text-red-600' : 'text-gray-700'}>
                        증빙서류 첨부
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 댓글 섹션 */}
              <CommentSection courseId={selectedCourse.id} />
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              과정을 선택해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
