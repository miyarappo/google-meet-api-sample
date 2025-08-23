'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Meeting } from '@/lib/google-meet-api'
import MeetingList from '@/components/MeetingList'
import TranscriptViewer from '@/components/TranscriptViewer'

export default function Home() {
  const { data: session, status } = useSession()
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">読み込み中...</span>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Google Meet 文字起こし
            </h1>
            <p className="text-gray-600 mb-8">
              Google Meetの会議の文字起こしを取得・表示するプロトタイプです
            </p>
            
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">ログインが必要です</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Google Meetの文字起こしにアクセスするため、Googleアカウントでログインしてください
              </p>
              
              <button
                onClick={() => signIn('google')}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Googleでログイン
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Google Meet 文字起こし
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
{session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user?.name || ''}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm font-medium text-gray-700">
                {session.user?.name}
              </span>
            </div>
            
            <button
              onClick={() => signOut()}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="py-8">
        {selectedMeeting ? (
          <TranscriptViewer
            meeting={selectedMeeting}
            onBack={() => setSelectedMeeting(null)}
          />
        ) : (
          <MeetingList onMeetingSelect={setSelectedMeeting} />
        )}
      </main>
    </div>
  )
}
