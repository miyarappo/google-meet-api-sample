# Google Meet 文字起こし取得プロトタイプ

Google Meet の文字起こしを取得して表示するシンプルなプロトタイプアプリケーションです。

## 機能

- **F1: Google OAuth 認証** - Google アカウントでのログイン機能
- **F2: 会議一覧表示** - Google Drive から会議関連ファイルを自動取得・表示
- **F3: 文字起こし取得・表示** - Google Drive 上の文字起こしファイルを検索・表示
- **F4: 複数検索戦略** - フォルダ、ファイル名、作成日時による高精度検索
- **F5: デバッグ機能** - 詳細なログ出力によるトラブルシューティング支援

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

### 3. Google Cloud Console 設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. 以下の API を有効化：
   - Google Drive API
   - Google Meet API（文字起こしファイルが Google Drive に保存される場合）
3. OAuth 2.0 認証情報を作成
4. 承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加
5. 必要なスコープを設定：
   - `https://www.googleapis.com/auth/drive.readonly` (Google Drive の読み取り専用アクセス)
   - `https://www.googleapis.com/auth/drive.file` (ユーザーがアップロードしたファイルへのアクセス)

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
│   ├── auth.ts                           # NextAuth設定
│   └── google-meet-api.ts                # Google Drive API ラッパー
└── types/
    └── next-auth.d.ts                    # NextAuth型定義拡張
```

## 現在の実装状況

### 完成済み機能

✅ **Google OAuth 認証**

- NextAuth.js を使用した Google 認証
- アクセストークンの取得と管理

✅ **Google Drive API 連携**

- 実際の Google Drive API を使用
- 文字起こしファイルの自動検索と取得
- 複数の検索戦略による高精度なファイル発見

✅ **会議一覧表示**

- Google Drive から会議関連ファイルを取得
- 会議名の自動生成と整理
- 作成日時順での表示

✅ **文字起こし表示**

- Google Docs とテキストファイルからのコンテンツ取得
- 文字起こし内容の表示
- ファイル情報（作成日時、サイズ等）の表示

✅ **レスポンシブデザイン**

- モバイル対応 UI
- Tailwind CSS によるモダンなデザイン

✅ **エラーハンドリング**

- 詳細なログ出力
- ユーザーフレンドリーなエラーメッセージ

✅ **ローディング状態**

- 非同期処理中のローディング表示

### 制限事項

⚠️ **文字起こしファイルの検索精度**

- Google Drive での文字起こしファイル検索は複数の戦略を使用
- ファイル名やフォルダ構造によって検索結果が変わる場合がある
- 必要に応じて検索ロジックの調整が必要

⚠️ **Google Meet API の制限**

- 現在は Google Drive API を使用してファイルを取得
- 将来的に Google Meet Conference Records API が利用可能になった場合は移行を検討

## 使用方法

1. アプリケーションにアクセス
2. 「Google でログイン」ボタンをクリック
3. Google 認証を完了
4. 会議一覧から対象の会議を選択
5. 文字起こしを確認

## 注意事項

- このアプリケーションは Google Drive API を使用して文字起こしファイルを取得します
- 文字起こしファイルが Google Drive に保存されている必要があります
- 適切な Google API の権限設定が必要です
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

### 文字起こしが表示されない場合

このエラーが発生する場合：

1. **Google Drive に文字起こしファイルがあるか確認**：

   - Google Drive で「transcript」「文字起こし」「Meeting」などのキーワードで検索
   - ファイル形式：テキストファイル（.txt）または Google Docs

2. **ブラウザの開発者ツールでログを確認**：

   ```bash
   # F12キーで開発者ツールを開き、Consoleタブを確認
   # 詳細な検索ログが表示されます
   ```

3. **権限の確認**：
   - Google Drive API の権限が正しく設定されているか確認
   - 必要に応じてアプリケーションの権限を再承認

### その他の認証エラー

- ブラウザのキャッシュをクリア
- シークレット/プライベートモードで試行
- 環境変数の値に余分なスペースがないか確認

## ライセンス

MIT License
