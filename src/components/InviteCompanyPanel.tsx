'use client'

import { useState } from 'react'

interface InviteCompanyPanelProps {
  companies: { id: string; name: string }[]
}

// 센터 전용 - 기업 담당자 초대 패널. 기업은 셀프 회원가입이 불가능하고,
// 이 화면에서 센터가 이메일을 입력해 초대해야만 계정이 생성된다.
// 회사명은 직접 입력한다 - 아직 시스템에 없는 신규 회사(D사 등)도 여기서 바로
// 추가되어야 하므로 기존 회사 목록으로 제한된 드롭다운을 쓰지 않는다.
// 기존 회사명은 datalist로 자동완성만 제공해 오타로 중복 생성되는 걸 줄인다.
// (센터 계정은 이 패널이 아니라 /login의 "센터 가입" 코드 입력으로 생성된다.)
export default function InviteCompanyPanel({ companies }: InviteCompanyPanelProps) {
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, companyName: companyName.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '초대 발송에 실패했습니다.' })
      } else if (data.email?.sent === false) {
        setMessage({ type: 'error', text: `계정은 생성됐지만 메일 발송에 실패했습니다 (${data.email.reason || '알 수 없는 오류'}). 관리자에게 문의해주세요.` })
        setEmail('')
        setCompanyName('')
      } else {
        setMessage({ type: 'success', text: `${email}로 초대 메일을 보냈습니다.` })
        setEmail('')
        setCompanyName('')
      }
    } catch {
      setMessage({ type: 'error', text: '초대 요청 중 오류가 발생했습니다.' })
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">기업 담당자 초대</h2>
      <p className="text-xs text-gray-500 mb-4">기업 담당자는 셀프 회원가입이 불가능합니다. 여기서 초대해야만 계정이 생성됩니다. 아직 등록되지 않은 회사명을 입력하면 새 회사로 추가됩니다.</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-gray-500 mb-1">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@company.com"
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">소속 회사</label>
          <input
            type="text"
            list="existing-companies"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="예: D사 (신규면 새로 만들어집니다)"
            required
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="existing-companies">
            {companies.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? '발송 중...' : '초대 보내기'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
