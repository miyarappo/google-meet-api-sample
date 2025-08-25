"use client";

import { useState, useEffect } from "react";
import { Meeting } from "@/lib/google-meet-api";

interface MeetingListProps {
  onMeetingSelect: (meeting: Meeting) => void;
}

export default function MeetingList({ onMeetingSelect }: MeetingListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/meetings");

      if (!response.ok) {
        throw new Error("Failed to fetch meetings");
      }

      const data = await response.json();
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP");
  };

  const getFileSize = (size?: number) => {
    if (!size) return "不明";

    const mb = size / (1024 * 1024);
    if (mb > 1) {
      return `${mb.toFixed(1)} MB`;
    } else {
      const kb = size / 1024;
      return `${kb.toFixed(1)} KB`;
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">会議一覧</h2>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">読み込み中...</span>
        </div>
      </div>
    );
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
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">会議一覧</h2>
        <button
          onClick={fetchMeetings}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
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
          {meetings.map((meeting, index) => (
            <div
              key={`${meeting.id}-${index}`}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onMeetingSelect(meeting)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{meeting.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>作成日時: {formatDate(meeting.createdTime)}</p>
                    {meeting.modifiedTime && (
                      <p>最終更新: {formatDate(meeting.modifiedTime)}</p>
                    )}
                    <p>ファイルサイズ: {getFileSize(meeting.size)}</p>
                    {meeting.meetingCode && (
                      <p>
                        会議コード:{" "}
                        <span className="font-mono">{meeting.meetingCode}</span>
                      </p>
                    )}

                    {/* カレンダー情報 */}
                    {meeting.calendarEvent && (
                      <div className="mt-2 p-2 bg-blue-50 rounded border-l-4 border-blue-200">
                        <p className="font-medium text-blue-800">
                          📅 カレンダー予定と連携済み
                        </p>
                        <p>
                          <strong>予定名:</strong>{" "}
                          {meeting.calendarEvent.summary}
                        </p>
                        {meeting.calendarEvent.startTime && (
                          <p>
                            <strong>開始時刻:</strong>{" "}
                            {formatDate(meeting.calendarEvent.startTime)}
                          </p>
                        )}
                        {meeting.calendarEvent.organizer && (
                          <p>
                            <strong>主催者:</strong>{" "}
                            {meeting.calendarEvent.organizer.displayName ||
                              meeting.calendarEvent.organizer.email}
                          </p>
                        )}
                        {meeting.calendarEvent.attendees &&
                          meeting.calendarEvent.attendees.length > 0 && (
                            <p>
                              <strong>参加者:</strong>{" "}
                              {meeting.calendarEvent.attendees.length}名
                            </p>
                          )}
                        <p className="text-xs text-blue-600 mt-1">
                          カレンダーID: {meeting.calendarEvent.calendarId} |
                          イベントID:{" "}
                          {meeting.calendarEvent.eventId.substring(0, 8)}...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-blue-600">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>

              {meeting.webViewLink && (
                <div className="mt-2">
                  <a
                    href={meeting.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Google Drive で開く
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
