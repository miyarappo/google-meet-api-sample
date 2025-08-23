'use client'

import { useState, useEffect } from 'react'
import { Meeting, Transcript, TranscriptEntry } from '@/lib/google-meet-api'

interface TranscriptViewerProps {
  meeting: Meeting
  onBack: () => void
}

export default function TranscriptViewer({ meeting, onBack }: TranscriptViewerProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTranscript = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/transcripts/${meeting.conferenceRecordId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('この会議の文字起こしが見つかりません')
        }
        throw new Error('文字起こしの取得に失敗しました')
      }
      
      const data = await response.json()
      setTranscript(data.transcript)
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTranscript()
  }, [meeting.conferenceRecordId]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString)
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return timeString
    }
  }

  const getParticipantName = (entry: TranscriptEntry) => {
    if (entry.participant.signedinUser) {
      return entry.participant.signedinUser.displayName || 'ユーザー'
    }
    if (entry.participant.anonymousUser) {
      return entry.participant.anonymousUser.displayName || '匿名ユーザー'
    }
    if (entry.participant.phoneUser) {
      return entry.participant.phoneUser.displayName || '電話参加者'
    }
    return '不明な参加者'
  }

  const getWordsText = (entry: TranscriptEntry) => {
    return entry.words?.map(word => word.word).join(' ') || ''
  }

  const getParticipantColor = (participantName: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-orange-100 text-orange-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ]
    
    const hash = participantName.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">文字起こし - {meeting.space?.meetingCode || meeting.conferenceRecordId}</h2>
        </div>
        
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">文字起こしを読み込み中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">文字起こし - {meeting.space?.meetingCode || meeting.conferenceRecordId}</h2>
        </div>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="mb-2">{error}</p>
          <button 
            onClick={fetchTranscript}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold">文字起こし - {meeting.space?.meetingCode || meeting.conferenceRecordId}</h2>
        </div>
        
        <button
          onClick={fetchTranscript}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          更新
        </button>
      </div>

      {transcript && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-semibold">開始時刻:</span>
              <br />
              {transcript.startTime ? formatTime(transcript.startTime) : '-'}
            </div>
            <div>
              <span className="font-semibold">終了時刻:</span>
              <br />
              {transcript.endTime ? formatTime(transcript.endTime) : '-'}
            </div>
            <div>
              <span className="font-semibold">状態:</span>
              <br />
              {transcript.state || '-'}
            </div>
            <div>
              <span className="font-semibold">発言数:</span>
              <br />
              {transcript.entries?.length || 0}件
            </div>
          </div>
        </div>
      )}

      {!transcript || !transcript.entries || transcript.entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>この会議に文字起こしが見つかりません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcript.entries.map((entry, index) => {
            const participantName = getParticipantName(entry)
            const text = getWordsText(entry)
            
            if (!text.trim()) return null
            
            return (
              <div key={index} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getParticipantColor(participantName)}`}>
                      {participantName}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-500">
                        {formatTime(entry.startTime)}
                      </span>
                      {entry.endTime && entry.endTime !== entry.startTime && (
                        <>
                          <span className="text-xs text-gray-400">-</span>
                          <span className="text-xs text-gray-500">
                            {formatTime(entry.endTime)}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-gray-900 leading-relaxed">{text}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}