# 頭痛ログ（Zutsu Log）— 服薬管理Webアプリ 実装仕様書

> このファイルはClaude Codeへの実装指示書です。
> 迷ったときは「シンプルさ最優先・1ユーザー向け・スマホで使いやすい」を判断基準にしてください。

---

## 0. プロジェクト全体方針

| 項目 | 内容 |
|------|------|
| アプリ名 | 頭痛ログ（Zutsu Log） |
| 目的 | 慢性頭痛患者が服薬タイミングを逃さず記録できるWebアプリ |
| 利用人数 | **1人のみ**（マルチユーザー対応は不要） |
| 主な利用環境 | iPhoneのSafariブラウザ（PCブラウザでも使える） |
| デザイン方針 | やわらかい・親しみやすい・パステル青水色系・角丸多め |
| 言語 | 日本語のみ |

---

## 1. 技術スタック（これ以外は使わないこと）

```
フロントエンド : React + Vite
スタイリング   : Tailwind CSS
バックエンド   : Supabase（認証・DB・Storage）
ホスティング   : Vercel
通知         : Web Push API（PWA / Service Worker）
QR読み取り    : jsQR（ブラウザカメラ経由）
状態管理      : React Context + useReducer（Reduxは使わない）
ルーティング   : React Router v6
```

### ディレクトリ構成

```
src/
├── components/        # 再利用UIパーツ
│   ├── ui/            # ボタン・カード・モーダルなど汎用
│   └── features/      # 機能単位のコンポーネント
├── pages/             # 画面単位（1ファイル = 1画面）
├── hooks/             # カスタムフック
├── lib/
│   └── supabase.js    # Supabaseクライアント初期化
├── context/           # グローバル状態
└── utils/             # 日付処理・QRパースなど
```

---

## 2. Supabase テーブル定義

> **重要：RLSは設定しない（1ユーザー専用のため）**

### medicines（登録薬）

```sql
create table medicines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,           -- 薬の名前
  dose        text,                    -- 用量（例：1錠、5mg）
  note        text,                    -- メモ（色・形など）
  photo_url   text,                    -- 写真のURL（Supabase Storage）
  is_active   boolean default true,    -- false = 削除済み（論理削除）
  created_at  timestamptz default now()
);
```

### schedules（服薬スケジュール）

```sql
create table schedules (
  id          uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines(id) on delete cascade,
  label       text not null,           -- 例：「朝」「昼」「就寝前」
  time        time not null,           -- 服用時刻（例：08:00）
  days        int[] default '{1,2,3,4,5,6,7}', -- 曜日（1=月〜7=日）
  is_active   boolean default true,
  created_at  timestamptz default now()
);
```

### medication_logs（服薬記録）

```sql
create table medication_logs (
  id            uuid primary key default gen_random_uuid(),
  medicine_id   uuid references medicines(id) on delete cascade,
  schedule_id   uuid references schedules(id) on delete set null,
  scheduled_at  timestamptz not null,  -- 本来飲むべき日時
  taken_at      timestamptz,           -- 実際に飲んだ日時（nullの場合あり）
  status        text not null check (status in ('taken','taken_late','skipped','missed')),
  created_at    timestamptz default now()
);
```

### headache_logs（頭痛日記）

```sql
create table headache_logs (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,     -- 1日1レコード
  severity   int check (severity in (0,1,2)), -- 0=なし 1=中程度 2=強い
  memo       text,
  created_at timestamptz default now()
);
```

---

## 3. status の定義（medication_logs.status）

| 値 | 意味 | 表示色 |
|----|------|--------|
| `taken` | 予定通りに飲んだ | 緑 `#22c55e` |
| `taken_late` | 遅れて飲んだ | 黄 `#f59e0b` |
| `skipped` | スキップ（意図的） | グレー `#9ca3af` |
| `missed` | 飲み忘れ（自動判定） | 赤 `#ef4444` |

**missed の自動判定ロジック：**
- ページ読み込み時に「scheduled_at から40分以上経過しており、statusが未設定のレコード」を`missed`に自動更新する
- Supabase Edge Functionは使わず、フロントエンドで処理する

---

## 4. 画面一覧と遷移

```
/              → ホーム（今日の服薬状況）
/calendar      → カレンダー（月単位の服薬履歴）
/medicines     → 薬の管理（一覧・追加・編集）
/medicines/new → 薬の追加（QRスキャン含む）
/diary         → 頭痛日記（記録入力 + 過去7日表示）※ /headache/new を統合
/diary/report  → 受診モード（30日サマリー）
/settings      → 設定
```

**ナビゲーション：** 画面下部に固定のボトムナビゲーションバー（5タブ）
- ホーム・カレンダー・薬の管理・日記・設定

---

## 5. 画面別 実装仕様

---

### 5-1. ホーム画面（/）

**役割：** 今日飲む薬の状況をひと目で確認し、1タップで記録する

**表示内容：**
- 今日の日付（例：4月5日 土曜日）
- 今日の達成率バー（例：「2/3 完了」）
- 服薬カードのリスト（schedules × 今日の曜日でフィルタ）

**服薬カードの仕様：**
```
┌────────────────────────────────┐
│ 🕗 08:00  朝                   │
│ ロキソプロフェン 60mg           │
│                    [飲んだ ✓]  │
└────────────────────────────────┘
```
- status が `taken` / `taken_late` のときはカードをグレーアウト
- 「飲んだ」ボタンを押すと → status=`taken`、taken_at=現在時刻 で記録
- 予定時刻から40分以上経過している場合は → status=`taken_late` で記録
- 「スキップ」はカードを長押し or 右スワイプで選択できる

**ローディング：** Supabaseからデータ取得中はスケルトンUI表示

---

### 5-2. カレンダー画面（/calendar）

**役割：** 月単位で服薬達成状況を色で確認する

**表示仕様：**
- 月カレンダー（日曜始まり）
- 各日付セルに達成率を色で表示：
  - 100%達成 → 緑の丸
  - 50〜99% → 黄の丸
  - 1〜49%  → 赤の丸
  - 記録なし → 無色
- 日付タップ → その日の服薬ログと頭痛日記をモーダルで表示
- 月の切り替えは「< 前月」「次月 >」ボタン

---

### 5-3. 薬の管理（/medicines）

**役割：** 登録している薬の一覧と管理

**表示内容：**
- 薬カードリスト（名前・用量・スケジュール一覧）
- 右上に「＋追加」ボタン
- カードタップ → 編集画面へ
- 論理削除（is_active=false）で非表示にする。完全削除はしない

---

### 5-4. 薬の追加画面（/medicines/new）

**入力フォーム：**
```
薬の名前    [テキスト入力]
用量        [テキスト入力]（例：1錠、60mg）
メモ        [テキスト入力]（色・形など自由記述）
写真        [カメラ撮影 or ファイル選択]

服薬スケジュール（複数追加可能）
  タイミング名  [例：朝・昼・夕・就寝前・カスタム]
  時刻          [時刻ピッカー]
  曜日          [月〜日 チェックボックス 初期値:毎日]

[QRで読み取る] ボタン → QRスキャン画面へ
[保存する]     ボタン
```

---

### 5-5. QRスキャン画面

**処理フロー：**
1. `getUserMedia` でカメラ起動（iPhoneはSafariのカメラ許可が必要）
2. `jsQR` ライブラリでフレームを解析
3. QRを検出したら自動でスキャン停止
4. 読み取り結果を解析して薬名・用量・用法を抽出
5. 確認画面を表示（「この内容で登録しますか？」）
6. 確認後 → 薬の追加フォームに値をセットして戻る

**JAHIS形式のパース仕様：**
```javascript
// お薬手帳QRはカンマ区切りのテキスト
// 例: "1,ロキソプロフェン錠60mg,60mg,1錠,朝食後,7,20240401,,"
// インデックス:
//   [1] 薬品名
//   [2] 規格・含量
//   [3] 1回量
//   [4] 用法
//   [5] 日数

function parseJahisQR(rawText) {
  const lines = rawText.split('\n');
  return lines.map(line => {
    const cols = line.split(',');
    return {
      name: cols[1] || '',
      dose: `${cols[3] || ''}（${cols[2] || ''}）`,
      usage: cols[4] || '',
    };
  }).filter(d => d.name);
}
```

**エラー処理：**
- パースに失敗した場合は「読み取れませんでした。手入力に切り替えます」と表示
- カメラ権限がない場合は「カメラへのアクセスを許可してください」と表示

---

### 5-6. 頭痛日記（/diary）

**表示内容：**
- 今日の記録フォーム（常に上部に表示）
  - 頭痛の強さ：3択ボタン（なし / 中程度 / 強い）
  - メモ：テキストエリア
  - 「保存」ボタン
- 過去7日分の記録リスト（日付・強度・メモ）
- 「受診モードで見る」ボタン → /diary/report へ

---

### 5-7. 受診モード（/diary/report）

**役割：** 医師に見せる用のサマリー画面

**表示内容：**
- 過去30日間の服薬達成率（%）
- 頭痛発生日数（強度別内訳）
- 服薬達成率の折れ線グラフ（recharts使用）
- 頭痛強度の棒グラフ（recharts使用）
- 「この画面を印刷」ボタン（`window.print()`）

---

### 5-8. 設定（/settings）

**項目：**
- 通知設定（ON/OFF・Web Push許可リクエスト）
- 朝・昼・夕のデフォルト通知時刻
- データのリセット（全記録削除・確認ダイアログ必須）
- アプリバージョン表示

---

## 6. 通知仕様（Web Push / PWA）

```
manifest.json を作成してPWA対応する
Service Worker（sw.js）でプッシュ通知を受信する
```

**通知のタイミング：**
- schedules に登録された時刻にプッシュ通知
- 通知文言例：「💊 朝の薬を飲む時間です（ロキソプロフェン）」
- 通知をタップ → アプリのホーム画面を開く

**注意：**
- iPhoneでのWeb Pushは iOS 16.4以降のSafariのみ対応
- 非対応環境では「通知はご利用の環境では使えません」と表示し、機能を非表示にする（エラーにしない）

---

## 7. デザイン仕様

### カラーパレット（パステル青水色系・やわらかい印象）

```css
--color-primary       : #4da6d9;   /* メインアクション：やわらかい水色 */
--color-primary-dark  : #2e86c1;   /* ホバー・強調：少し濃い青 */
--color-primary-light : #e0f4fb;   /* カード背景・薄いハイライト */
--color-primary-pale  : #f0faff;   /* ページ背景・最も薄い水色 */
--color-success       : #72c08a;   /* 緑（taken）：パステルグリーン */
--color-success-light : #e6f5eb;   /* 緑の薄背景 */
--color-warning       : #f0b942;   /* 黄（taken_late）：やわらかいイエロー */
--color-warning-light : #fdf6e3;   /* 黄の薄背景 */
--color-danger        : #e07070;   /* 赤（missed）：パステルレッド */
--color-danger-light  : #fdeaea;   /* 赤の薄背景 */
--color-muted         : #b0bec5;   /* グレー（skipped・非活性） */
--color-bg            : #f0faff;   /* ページ背景：最も薄い水色 */
--color-surface       : #ffffff;   /* カード背景：白 */
--color-text          : #2c3e50;   /* 本文：やわらかいネイビー */
--color-text-sub      : #7f9aaa;   /* サブテキスト：くすんだ水色グレー */
--color-border        : #cce8f4;   /* ボーダー：薄い水色 */
```

### Tailwindカスタムカラー設定（tailwind.config.js に追記）

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: '#4da6d9',
        dark:    '#2e86c1',
        light:   '#e0f4fb',
        pale:    '#f0faff',
      },
      pastel: {
        green:  '#72c08a',
        yellow: '#f0b942',
        red:    '#e07070',
        gray:   '#b0bec5',
      }
    },
    borderRadius: {
      '3xl': '1.5rem',
      '4xl': '2rem',
    }
  }
}
```

### UIルール（やわらかいデザインのための具体指定）

- **フォント：** システムフォント（`font-sans`）。文字色は `#2c3e50`（硬すぎない黒）
- **フォントサイズ：** 最小16px（iPhoneで読みやすいサイズ）
- **ボタン：** 高さ最小48px・`rounded-2xl`・影なし・パステル水色背景
- **カード：** `rounded-3xl`・`shadow-sm`・白背景・薄水色ボーダー（`border border-primary-light`）
- **入力フォーム：** `rounded-2xl`・`border border-primary-light`・フォーカス時に `ring-2 ring-primary-light`
- **ボトムナビ：** 高さ64px・固定・白背景・上に薄水色ボーダー・アクティブタブは水色アイコン
- **ローディング：** スピナーではなくスケルトンUI（薄水色の矩形でプレースホルダー）
- **エラー表示：** パステルレッドのトーストを画面上部に3秒表示
- **成功フィードバック：** 「飲んだ」ボタンを押したらカードが緑にふわっと変わる（`transition-colors duration-300`）
- **余白：** カード内padding `p-4`（16px）。カード間margin `gap-3`（12px）

### レスポンシブ

- **スマホ（375px〜）：** シングルカラム・ボトムナビ表示
- **タブレット・PC（768px〜）：** 最大幅480pxで中央寄せ（スマホアプリライクな表示・背景は薄水色）

---

## 8. 実装の優先順位（フェーズ）

### Phase 1（まず動くものを作る）
1. Supabaseプロジェクト作成・テーブル作成
2. Vite + React + Tailwind CSSのセットアップ・カスタムカラー設定
3. **薬の追加画面（/medicines/new）← 最初に実装する画面**
4. 薬の管理一覧画面（/medicines）
5. ホーム画面（薬カード表示・飲んだボタン）
6. カレンダー画面

### Phase 2（実用レベルに仕上げる）
6. 頭痛日記・受診モード
7. QRスキャン機能
8. PWA対応・Web Push通知

### Phase 3（仕上げ）
9. 設定画面
10. スケルトンUI・エラーハンドリング強化
11. Vercelデプロイ

---

## 9. 実装時の判断ルール

> Claude Codeが迷ったときのための判断基準

- **認証は不要**：1人専用のため、ログイン画面は作らない
- **削除は論理削除**：薬・スケジュールは`is_active=false`にするだけ。DBからは消さない
- **オフライン対応は後回し**：Phase 1ではネット接続前提でよい
- **アニメーションは最小限**：Tailwindのtransitionのみ使用。framer-motionは使わない
- **外部ライブラリは最小限**：recharts（グラフ）・jsQR（QR）・dayjs（日付）のみ追加OK
- **コメントは日本語で書く**：コード内コメントは日本語にする
- **型定義はJSDocで書く**：TypeScriptは使わない（Vibe Codingで複雑化を避けるため）

---

## 10. 環境変数（.env）

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`.env`は`.gitignore`に必ず追加すること。

---

## 11. 最初に実行するコマンド

```bash
# プロジェクト作成
npm create vite@latest zutsu-log -- --template react
cd zutsu-log

# 依存パッケージインストール
npm install
npm install @supabase/supabase-js react-router-dom dayjs recharts jsqr

# Tailwind CSS セットアップ
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 開発サーバー起動
npm run dev
```

---

## 12. 開発進捗

### 2026年4月5日時点

#### Phase 1 完了済み画面
- ✅ ホーム画面（/）：今日の服薬カード・達成率バー・飲んだボタン・遅れて飲むボタン
- ✅ カレンダー（/calendar）：月カレンダー・達成率色表示・頭痛マーク・日別詳細モーダル
- ✅ 薬一覧（/medicines）：カード表示・スケジュールバッジ
- ✅ 薬の追加（/medicines/new）：フォーム・写真登録・スケジュール設定・Supabase保存
- ✅ 頭痛日記（/diary）：3択記録・メモ・過去7日表示

#### 次回やること（Phase 2）
- 薬の編集画面（/medicines/:id/edit）
- 服薬履歴画面
- 受診モード（/diary/report）
- 設定画面（/settings）
- 認証・RLS・Vercelデプロイ（3名テスト用）

---

*仕様書バージョン：v3.0（Web版・Claude Code向け）*
*作成日：2026年4月*
