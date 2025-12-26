'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import PdfViewerModal from '@/components/PdfViewerModal'
import CompanyCommentSection from '@/components/CompanyCommentSection'

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
  courses: Course[]
}

// PDF 파일 매핑
const getPdfFiles = (companyName: string, courseName: string): { businessPlan?: string; staffRegistration?: string } => {
  const companyPrefix = companyName.charAt(0).toUpperCase()
  const lowerCourseName = courseName.toLowerCase()

  if (companyPrefix === 'A') {
    if (lowerCourseName.includes('ai') || lowerCourseName.includes('개발자 양성')) {
      return {
        businessPlan: '/files/A_AI개발자양성과정_사업계획서.pdf'
        // staffRegistration 제거 - 실시간 파일 첨부 테스트용
      }
    }
    if (lowerCourseName.includes('웹') || lowerCourseName.includes('웹개발')) {
      return {
        businessPlan: '/files/A_웹개발 실무과정_사업계획서.pdf',
        staffRegistration: '/files/A_웹개발 실무과정_전담인력등록.pdf'
      }
    }
  }

  if (companyPrefix === 'B') {
    if (lowerCourseName.includes('데이터') || lowerCourseName.includes('분석')) {
      return {
        businessPlan: '/files/B_데이터분석 실무_사업계획서.pdf',
        staffRegistration: '/files/B_전담인력등록.pdf'
      }
    }
    if (lowerCourseName.includes('클라우드') || lowerCourseName.includes('엔지니어')) {
      return {
        businessPlan: '/files/B_클라우드 엔지니어 과정_사업계획서.pdf',
        staffRegistration: '/files/B_전담인력등록.pdf'
      }
    }
  }

  if (companyPrefix === 'C') {
    if (lowerCourseName.includes('보안') || lowerCourseName.includes('정보보안')) {
      return {
        businessPlan: '/files/C_보안전문가 과정_사업계획서.pdf',
        staffRegistration: '/files/C_정보보안 과정_전담인력등록.pdf'
      }
    }
  }

  return {}
}

export default function MyCompanyPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  // 업로드된 파일 상태 관리 (courseId -> { businessPlan?: string, staffRegistration?: string })
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { businessPlan?: string; staffRegistration?: string }>>({})

  const supabase = createClient()

  // DB에서 업로드된 파일 로드
  const loadUploadedFiles = async (courseIds: string[]) => {
    const { data } = await supabase
      .from('course_files')
      .select('course_id, file_type, file_url')
      .in('course_id', courseIds)

    if (data) {
      const filesMap: Record<string, { businessPlan?: string; staffRegistration?: string }> = {}
      data.forEach((file) => {
        if (!filesMap[file.course_id]) {
          filesMap[file.course_id] = {}
        }
        filesMap[file.course_id][file.file_type as 'businessPlan' | 'staffRegistration'] = file.file_url
      })
      setUploadedFiles(filesMap)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      // 현재 사용자 확인
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        setError('로그인이 필요합니다.')
        setLoading(false)
        return
      }

      setUser(currentUser)

      // 사용자 프로필에서 company_id 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role')
        .eq('id', currentUser.id)
        .single()

      if (!profile?.company_id) {
        setError('소속 기업이 등록되지 않았습니다. 관리자에게 문의하세요.')
        setLoading(false)
        return
      }

      // 기업 및 과정 정보 가져오기
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          courses (
            id,
            name,
            status,
            stage,
            issues,
            created_at
          )
        `)
        .eq('id', profile.company_id)
        .single()

      if (companyError || !companyData) {
        setError('기업 정보를 불러올 수 없습니다.')
        setLoading(false)
        return
      }

      setCompany(companyData as Company)
      if (companyData.courses?.length > 0) {
        setSelectedCourse(companyData.courses[0] as Course)
        // DB에서 업로드된 파일 로드
        const courseIds = companyData.courses.map((c: Course) => c.id)
        loadUploadedFiles(courseIds)
      }
      setLoading(false)
    }

    fetchData()
  }, [])

  // 실시간 파일 업로드/삭제 구독
  useEffect(() => {
    if (!company) return

    const channel = supabase
      .channel('course-files-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_files',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newFile = payload.new as { course_id: string; file_type: string; file_url: string }
            // 내 회사 과정인 경우에만 업데이트
            if (company.courses.some(c => c.id === newFile.course_id)) {
              setUploadedFiles(prev => ({
                ...prev,
                [newFile.course_id]: {
                  ...prev[newFile.course_id],
                  [newFile.file_type]: newFile.file_url
                }
              }))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldFile = payload.old as { course_id: string; file_type: string }
            // 내 회사 과정인 경우에만 업데이트
            if (company.courses.some(c => c.id === oldFile.course_id)) {
              setUploadedFiles(prev => {
                const updated = { ...prev }
                if (updated[oldFile.course_id]) {
                  const courseFiles = { ...updated[oldFile.course_id] }
                  delete courseFiles[oldFile.file_type as 'businessPlan' | 'staffRegistration']
                  updated[oldFile.course_id] = courseFiles
                }
                return updated
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [company])

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

  // 파일 첨부 핸들러
  const handleFileUpload = async (type: 'businessPlan' | 'staffRegistration') => {
    if (!selectedCourse || !user) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !selectedCourse) return

      setUploadingType(type)

      try {
        // Supabase Storage에 파일 업로드 (한글 파일명 제거)
        const fileExt = file.name.split('.').pop() || 'pdf'
        const safeName = `${Date.now()}.${fileExt}`
        const filePath = `${selectedCourse.id}/${type}/${safeName}`
        const { error: uploadError } = await supabase.storage
          .from('course-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) {
          throw new Error(`스토리지 업로드 실패: ${uploadError.message}`)
        }

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('course-files')
          .getPublicUrl(filePath)

        const fileUrl = urlData.publicUrl

        // DB에 파일 정보 저장 (upsert - 이미 있으면 업데이트)
        const { error: dbError } = await supabase
          .from('course_files')
          .upsert({
            course_id: selectedCourse.id,
            file_type: type,
            file_name: file.name,
            file_url: fileUrl,
            uploaded_by: user.id
          }, {
            onConflict: 'course_id,file_type'
          })

        if (dbError) {
          throw new Error(`DB 저장 실패: ${dbError.message}`)
        }

        // 로컬 상태 업데이트
        setUploadedFiles(prev => ({
          ...prev,
          [selectedCourse.id]: {
            ...prev[selectedCourse.id],
            [type]: fileUrl
          }
        }))

        alert(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일이 업로드되었습니다.\n파일명: ${file.name}`)
      } catch (err) {
        alert(`파일 업로드에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      } finally {
        setUploadingType(null)
      }
    }
    input.click()
  }

  // 파일 삭제 핸들러
  const handleFileDelete = async (type: 'businessPlan' | 'staffRegistration') => {
    if (!selectedCourse || !user) return
    if (!confirm(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일을 삭제하시겠습니까?`)) return

    try {
      // DB에서 파일 정보 삭제
      const { error: dbError } = await supabase
        .from('course_files')
        .delete()
        .eq('course_id', selectedCourse.id)
        .eq('file_type', type)

      if (dbError) {
        throw new Error(`DB 삭제 실패: ${dbError.message}`)
      }

      // 로컬 상태 업데이트
      setUploadedFiles(prev => {
        const updated = { ...prev }
        if (updated[selectedCourse.id]) {
          const courseFiles = { ...updated[selectedCourse.id] }
          delete courseFiles[type]
          updated[selectedCourse.id] = courseFiles
        }
        return updated
      })

      alert(`${type === 'businessPlan' ? '사업계획서' : '전담인력 등록'} 파일이 삭제되었습니다.`)
    } catch (err) {
      alert(`파일 삭제에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600 hover:underline">
          로그인 페이지로 이동
        </Link>
      </div>
    )
  }

  if (!company) return null

  // 기존 PDF와 업로드된 파일을 합침
  const basePdfFiles = selectedCourse ? getPdfFiles(company.name, selectedCourse.name) : {}
  const courseUploadedFiles = selectedCourse ? uploadedFiles[selectedCourse.id] || {} : {}
  const pdfFiles = { ...basePdfFiles, ...courseUploadedFiles }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-green-100 text-sm">기업 담당자 포털</p>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-green-100">총 {company.courses.length}개 과정 운영중</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* 과정 목록 */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            내 과정 목록
          </h2>
          {company.courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedCourse?.id === course.id
                  ? 'bg-green-50 border-green-200'
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
            </button>
          ))}
        </div>

        {/* 과정 상세 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            <>
              {/* 과정 정보 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCourse.name}
                  </h2>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedCourse.status)}`}>
                    {getStatusText(selectedCourse.status)}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">현재 단계</p>
                    <p className="font-medium text-gray-900">{selectedCourse.stage}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
                    <p className={`font-medium ${selectedCourse.issues ? 'text-red-600' : 'text-gray-400'}`}>
                      {selectedCourse.issues || '이슈 없음'}
                    </p>
                  </div>
                </div>

                {/* 서류 제출 현황 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">서류 제출 현황</h3>
                  <div className="space-y-3">
                    {/* 사업계획서 */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {pdfFiles.businessPlan ? (
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className="text-gray-700">사업계획서</span>
                        {pdfFiles.businessPlan && (
                          <span className="text-xs text-green-600 font-medium">첨부됨</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pdfFiles.businessPlan ? (
                          <>
                            <PdfViewerModal pdfUrl={pdfFiles.businessPlan} />
                            {/* DB에서 업로드한 파일만 삭제 가능 (기본 파일 제외) */}
                            {courseUploadedFiles.businessPlan && (
                              <button
                                onClick={() => handleFileDelete('businessPlan')}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleFileUpload('businessPlan')}
                            disabled={uploadingType === 'businessPlan'}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {uploadingType === 'businessPlan' ? '업로드 중...' : '파일 첨부'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 전담인력 등록 */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {pdfFiles.staffRegistration ? (
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        <span className={pdfFiles.staffRegistration ? 'text-gray-700' : 'text-red-600'}>
                          전담인력 등록
                        </span>
                        {pdfFiles.staffRegistration && (
                          <span className="text-xs text-green-600 font-medium">첨부됨</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pdfFiles.staffRegistration ? (
                          <>
                            <PdfViewerModal pdfUrl={pdfFiles.staffRegistration} />
                            {/* DB에서 업로드한 파일만 삭제 가능 (기본 파일 제외) */}
                            {courseUploadedFiles.staffRegistration && (
                              <button
                                onClick={() => handleFileDelete('staffRegistration')}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                              >
                                삭제
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleFileUpload('staffRegistration')}
                            disabled={uploadingType === 'staffRegistration'}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {uploadingType === 'staffRegistration' ? '업로드 중...' : '파일 첨부'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 댓글 섹션 */}
              <CompanyCommentSection
                courseId={selectedCourse.id}
                courseName={selectedCourse.name}
                companyName={company.name}
              />
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
