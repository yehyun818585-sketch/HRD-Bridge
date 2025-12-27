'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import PdfViewerModal from './PdfViewerModal'

interface CourseFilesSectionProps {
  courseId: string
  courseName: string
  companyName: string
  hasStaffIssue: boolean
  hasStaffDuplication?: boolean
  initialPdfFiles: { businessPlan?: string; staffRegistration?: string }
  initialIssues?: string | null
}

export default function CourseFilesSection({
  courseId,
  courseName,
  companyName,
  hasStaffIssue,
  hasStaffDuplication = false,
  initialPdfFiles,
  initialIssues
}: CourseFilesSectionProps) {
  const [uploadedFiles, setUploadedFiles] = useState<{ businessPlan?: string; staffRegistration?: string }>({})
  const [currentIssues, setCurrentIssues] = useState<string | null>(initialIssues ?? null)
  const supabase = createClient()

  // DB에서 업로드된 파일 로드
  useEffect(() => {
    const loadUploadedFiles = async () => {
      const { data } = await supabase
        .from('course_files')
        .select('file_type, file_url')
        .eq('course_id', courseId)

      if (data && data.length > 0) {
        const filesMap: { businessPlan?: string; staffRegistration?: string } = {}
        data.forEach((file) => {
          filesMap[file.file_type as 'businessPlan' | 'staffRegistration'] = file.file_url
        })
        setUploadedFiles(filesMap)
      }
    }

    loadUploadedFiles()
  }, [courseId])

  // 실시간 파일 업로드 및 이슈 변경 구독
  useEffect(() => {
    const channel = supabase
      .channel(`course-files-${courseId}`)
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
            if (newFile.course_id === courseId) {
              setUploadedFiles(prev => ({
                ...prev,
                [newFile.file_type]: newFile.file_url
              }))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldFile = payload.old as { course_id: string; file_type: string }
            if (oldFile.course_id === courseId) {
              setUploadedFiles(prev => {
                const updated = { ...prev }
                delete updated[oldFile.file_type as 'businessPlan' | 'staffRegistration']
                return updated
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'courses',
        },
        (payload) => {
          const updatedCourse = payload.new as { id: string; issues: string | null }
          if (updatedCourse.id === courseId) {
            setCurrentIssues(updatedCourse.issues)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courseId])

  // 기존 PDF와 업로드된 파일 합침
  const pdfFiles = { ...initialPdfFiles, ...uploadedFiles }

  // 현재 이슈 상태 계산 (파일 업로드 여부에 따라)
  // 전담인력 파일이 없으면 (정적 파일도, 업로드된 파일도 없으면) 이슈
  const hasNoStaffFile = !pdfFiles.staffRegistration

  // displayIssue 계산
  let displayIssue: string | null = null

  // 전담인력 파일이 없으면 "전담인력 등록 누락" 표시
  if (hasNoStaffFile) {
    displayIssue = '전담인력 등록 누락'
  }
  // 전담인력 중복이 있고, 전담인력 파일이 있을 때 중복 이슈 표시
  else if (hasStaffDuplication && pdfFiles.staffRegistration) {
    displayIssue = '전담인력 중복'
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      {/* 주요이슈 (실시간 업데이트) */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500 mb-1">주요 이슈</p>
        <p className={`font-medium ${displayIssue ? 'text-red-600' : 'text-gray-400'}`}>
          {displayIssue || '이슈 없음'}
        </p>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">서류 제출 현황</h3>
      <div className="space-y-2">
        {/* 사업계획서 */}
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
            <>
              <span className="text-xs text-green-600 font-medium">첨부됨</span>
              <PdfViewerModal pdfUrl={pdfFiles.businessPlan} />
            </>
          )}
        </div>
        {/* 전담인력 등록 */}
        <div className="flex items-center gap-2">
          {pdfFiles.staffRegistration ? (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : hasStaffIssue ? (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <span className={hasStaffIssue && !pdfFiles.staffRegistration ? 'text-red-600' : 'text-gray-700'}>
            전담인력 등록
          </span>
          {pdfFiles.staffRegistration && (
            <>
              <span className="text-xs text-green-600 font-medium">첨부됨</span>
              <PdfViewerModal pdfUrl={pdfFiles.staffRegistration} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
