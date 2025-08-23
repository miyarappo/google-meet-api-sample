'use client'

import { useState, useEffect } from 'react'
import { Meeting } from '@/lib/google-meet-api'

interface MeetingListProps {
  onMeetingSelect: (meeting: Meeting) => void
}

export default function MeetingList({ onMeetingSelect }: MeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/meetings')
      
      if (!response.ok) {
        throw new Error('Failed to fetch meetings')
      }
      
      const data = await response.json()
      setMeetings(data.meetings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP')
  }

  const getDuration = (start: string, end?: string) => {
    if (!end) return '進行中'
    
    const startTime = new Date(start)
    const endTime = new Date(end)
    const diffMs = endTime.getTime() - startTime.getTime()
    const minutes = Math.floor(diffMs / (1000 * 60))
    
    return `${minutes}分`
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">会議一覧</h2>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">会議一覧</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>エラー: {error}</p>
          <button 
            onClick={fetchMeetings}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">会議一覧</h2>
        <button
          onClick={fetchMeetings}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          更新
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>会議が見つかりません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.name}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onMeetingSelect(meeting)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">
                    {meeting.space?.meetingCode || meeting.conferenceRecordId}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>開始時刻: {formatDate(meeting.startTime)}</p>
                    {meeting.endTime && (
                      <p>終了時刻: {formatDate(meeting.endTime)}</p>
                    )}
                    <p>時間: {getDuration(meeting.startTime, meeting.endTime)}</p>
                  </div>
                </div>
                <div className="flex items-center text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              {meeting.space?.meetingUri && (
                <div className="mt-2">
                  <a
                    href={meeting.space.meetingUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    会議に参加
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}