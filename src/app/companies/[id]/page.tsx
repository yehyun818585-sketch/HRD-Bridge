import { createServerSupabaseClient } from '@/lib/supabase-server'
import CommentSection from '@/components/CommentSection'
import CourseFilesSection from '@/components/CourseFilesSection'
import CourseApprovalActions from '@/components/CourseApprovalActions'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPdfFiles, checkStaffDuplication } from '@/lib/document-validation'

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
  center_id: string
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 센터 전용 페이지 - 로그인만으로는 부족하고 role도 center여야 한다.
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, center_id')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'center') {
    redirect('/my-company')
  }

  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      center_id,
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

  // 다른 센터 소속 회사는 URL을 직접 입력해도 접근 못 하게 막는다.
  if (company.center_id !== callerProfile.center_id) {
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
            (() => {
              // PDF 파일 정보를 먼저 가져와서 이슈 상태 계산
              const pdfFiles = getPdfFiles(typedCompany.name, selectedCourse.name)

              // 전담인력 파일이 없으면 이슈 (DB 이슈 여부와 관계없이)
              const hasNoStaffFile = !pdfFiles.staffRegistration

              // 전담인력 중복 여부 체크 (동일 파일이 여러 과정에 사용되는 경우)
              const hasStaffDuplication = checkStaffDuplication(typedCompany.name, typedCompany.courses)

              return (
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
                    서류 내용은 읽기 전용, 승인/반려만 가능
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
                  <div className="md:col-span-2">
                    <CourseApprovalActions
                      courseId={selectedCourse.id}
                      courseName={selectedCourse.name}
                      status={selectedCourse.status}
                    />
                  </div>
                </div>

                {/* 서류 제출 현황 및 주요이슈 (실시간 업데이트) */}
                <CourseFilesSection
                  courseId={selectedCourse.id}
                  companyName={typedCompany.name}
                  courseName={selectedCourse.name}
                  hasStaffDuplication={hasStaffDuplication}
                  initialPdfFiles={pdfFiles}
                />
              </div>

              {/* 댓글 섹션 */}
              <CommentSection
                courseId={selectedCourse.id}
                courseName={selectedCourse.name}
                hasStaffIssue={hasNoStaffFile}
                companyName={typedCompany.name}
                totalCoursesInCompany={typedCompany.courses.length}
              />
            </>
              )
            })()
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
