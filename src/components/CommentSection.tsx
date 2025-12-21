'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string | null
  user_role: string | null
}

interface CommentSectionProps {
  courseId: string
}

export default function CommentSection({ courseId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('course_id', courseId)
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        // 각 댓글의 user_id로 프로필 정보 가져오기
        const userIds = [...new Set(data.map(c => c.user_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, role')
          .in('id', userIds)

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

        const formattedComments = data.map((item) => ({
          id: item.id,
          content: item.content,
          created_at: item.created_at,
          user_id: item.user_id,
          user_name: profileMap.get(item.user_id)?.name || null,
          user_role: profileMap.get(item.user_id)?.role || null,
        }))
        setComments(formattedComments)
      }
    }

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    fetchComments()
    getUser()

    // 실시간 댓글 구독
    const channel = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `course_id=eq.${courseId}`,
        },
        async (payload) => {
          // 새 댓글의 프로필 정보 가져오기
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', payload.new.user_id)
            .single()

          const newComment: Comment = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            user_id: payload.new.user_id,
            user_name: profile?.name || null,
            user_role: profile?.role || null,
          }

          setComments((prev) => [...prev, newComment])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [courseId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setLoading(true)
    const { error } = await supabase.from('comments').insert({
      course_id: courseId,
      user_id: user.id,
      content: newComment.trim(),
    })

    if (!error) {
      setNewComment('')
    }
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRoleBadge = (role: string) => {
    if (role === 'center') {
      return <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">센터</span>
    }
    return <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">기업</span>
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
  }

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const handleEditSubmit = async (commentId: string) => {
    if (!editContent.trim()) return

    const { error } = await supabase
      .from('comments')
      .update({ content: editContent.trim() })
      .eq('id', commentId)

    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, content: editContent.trim() } : c
        )
      )
      setEditingId(null)
      setEditContent('')
    }
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        피드백 댓글
      </h3>

      {/* 댓글 목록 */}
      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            아직 댓글이 없습니다. 첫 번째 피드백을 남겨보세요!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                {comment.user_name?.charAt(0) || '?'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {comment.user_name || '알 수 없음'}
                  </span>
                  {comment.user_role && getRoleBadge(comment.user_role)}
                  <span className="text-xs text-gray-400">
                    {formatDate(comment.created_at)}
                  </span>
                  {user && user.id === comment.user_id && (
                    <div className="flex gap-1 ml-auto">
                      <button
                        onClick={() => handleEdit(comment)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleEditSubmit(comment.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      저장
                    </button>
                    <button
                      onClick={handleEditCancel}
                      className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-700">{comment.content}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 댓글 입력 */}
      {user ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="피드백을 입력하세요... (예: 전담인력 서류 추가 필요)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {loading ? '전송중...' : '전송'}
          </button>
        </form>
      ) : (
        <p className="text-center text-gray-500 py-4">
          댓글을 작성하려면 로그인이 필요합니다.
        </p>
      )}
    </div>
  )
}
