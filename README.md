# Google Meet文字起こし取得プロトタイプ

Google Meetの文字起こしを取得して表示するシンプルなプロトタイプアプリケーションです。

## 機能

- **F1: Google OAuth認証** - Googleアカウントでのログイン機能
- **F2: 会議一覧表示** - Google Meet会議の一覧表示
- **F3: 文字起こし取得・表示** - 選択した会議の文字起こし表示

## 技術スタック

- **Frontend**: Next.js 15.5, React 19, TypeScript, Tailwind CSS
- **Authentication**: NextAuth.js
- **Google APIs**: googleapis ライブラリ
- **UI Components**: カスタムコンポーネント（React + Tailwind CSS）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` を `.env.local` にコピーして、必要な値を設定してください：

```bash
cp .env.local.example .env.local
```

`.env.local` の内容：
```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key
```

### 3. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. Google Meet API を有効化
3. OAuth 2.0 認証情報を作成
4. 承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加
5. 必要なスコープを設定：
   - `https://www.googleapis.com/auth/drive.meet.readonly` (Google Meetで作成されたファイルの読み取り専用アクセス)

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセス

## プロジェクト構造

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts    # NextAuth設定
│   │   ├── meetings/route.ts              # 会議一覧API
│   │   └── transcripts/[meetingId]/route.ts # 文字起こしAPI
│   ├── layout.tsx                         # レイアウト
│   ├── page.tsx                          # メインページ
│   └── providers.tsx                     # プロバイダー設定
├── components/
│   ├── MeetingList.tsx                   # 会議一覧コンポーネント
│   └── TranscriptViewer.tsx              # 文字起こし表示コンポーネント
├── lib/
│   └── google-meet-api.ts                # Google Meet API ラッパー
└── types/
    └── next-auth.d.ts                    # NextAuth型定義拡張
```

## 現在の実装状況

### 完成済み機能

✅ Google OAuth認証
✅ 会議一覧表示（モックデータ）
✅ 文字起こし表示（モックデータ）
✅ レスポンシブデザイン
✅ エラーハンドリング
✅ ローディング状態

### 実装が必要な項目

⚠️ **実際のGoogle Meet API連携**
- 現在はモックデータを使用
- 実際のAPIでは以下の実装が必要：
  - Google Drive APIを使用した文字起こしファイルの取得
  - Meet Conference Records APIを使用した会議記録の取得
  - 適切なスコープ設定 (`drive.meet.readonly`)
  - Google Cloud Console でのAPI有効化と制限付きスコープの承認申請

## 使用方法

1. アプリケーションにアクセス
2. 「Googleでログイン」ボタンをクリック
3. Google認証を完了
4. 会議一覧から対象の会議を選択
5. 文字起こしを確認

## 注意事項

- 現在はプロトタイプのため、モックデータを使用しています
- 実際のGoogle Meet APIとの連携には追加の設定と実装が必要です
- 本番環境で使用する前に、適切なセキュリティ対策を実装してください

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm run start

# リント
npm run lint
```

## トラブルシューティング

### エラー 400: redirect_uri_mismatch

このエラーが発生する場合：

1. **Google Cloud Console で確認**：
   - [Console](https://console.cloud.google.com/) → APIs & Services → Credentials
   - OAuth 2.0 クライアント ID を選択
   - 「承認済みリダイレクト URI」に `http://localhost:3000/api/auth/callback/google` を追加

2. **環境変数確認**：
   ```bash
   # .env.local ファイルに正しい値が設定されているか確認
   GOOGLE_CLIENT_ID=正しいクライアントID
   GOOGLE_CLIENT_SECRET=正しいクライアントシークレット
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **開発サーバー再起動**：
   ```bash
   npm run dev
   ```

### その他の認証エラー

- ブラウザのキャッシュをクリア
- シークレット/プライベートモードで試行
- 環境変数の値に余分なスペースがないか確認

## ライセンス

MIT License
