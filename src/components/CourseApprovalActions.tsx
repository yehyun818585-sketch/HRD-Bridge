'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { notifyComment } from '@/lib/notify-client'

interface CourseApprovalActionsProps {
  courseId: string
  courseName: string
  status: string
}

// 센터 전용 승인/반려 액션. courses.status/stage를 실제로 변경하고,
// 반려 시에는 사유를 댓글로 남겨 기업에 보완을 요청한다.
// 이미 승인된 과정은 더 조치할 게 없으므로 버튼을 숨긴다 - 기업이 파일을 다시
// 첨부/삭제하면 my-company 쪽에서 status를 pending으로 되돌려 버튼이 다시 나타난다.
export default function CourseApprovalActions({ courseId, courseName, status }: CourseApprovalActionsProps) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(profile?.role || null)
    }

    loadUser()
  }, [])

  const postComment = async (content: string) => {
    if (!userId) return
    const { data } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: userId,
      content,
    }).select().single()

    if (data) {
      notifyComment(data.id)
    }
  }

  const handleApprove = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('courses')
      .update({ status: 'approved', stage: '승인완료' })
      .eq('id', courseId)

    if (!error) {
      await postComment(`[승인] ${courseName} 서류가 승인되었습니다. 아래 파일을 다운로드하여 공단에 제출해주세요.`)
      router.refresh()
    }
    setLoading(false)
  }

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('courses')
      .update({ status: 'rejected', stage: '반려' })
      .eq('id', courseId)

    if (!error) {
      await postComment(`[반려] ${rejectReason.trim()}`)
      router.refresh()
      setShowRejectForm(false)
      setRejectReason('')
    }
    setLoading(false)
  }

  if (userRole !== 'center') return null

  if (status === 'approved') {
    return (
      <div className="p-4 bg-green-50 rounded-lg text-sm text-green-700">
        승인 완료된 과정입니다. 추가 조치가 필요 없습니다. (기업이 서류를 다시 첨부/삭제하면 재검토 대기 상태로 자동 전환됩니다)
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-500 mb-2">승인 처리 (센터)</p>
      {!showRejectForm ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            승인
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition disabled:opacity-50"
          >
            반려
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="반려 사유를 입력하세요 (댓글로 기업에 전달됩니다)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleRejectSubmit}
              disabled={loading || !rejectReason.trim()}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              반려 확정
            </button>
            <button
              onClick={() => { setShowRejectForm(false); setRejectReason('') }}
              disabled={loading}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
