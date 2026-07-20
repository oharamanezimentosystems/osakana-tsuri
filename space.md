# プロジェクト名: おさかなつり (osakana-tsuri)

## 概要

かわいいパステル調のお魚を集める、**癒やし系の放置型釣り Web アプリ**（MVP）。  
ブラウザ（PC・スマホ）でエサを選んで釣りを始め、短い待ち時間と演出のあと魚を釣り上げ、図鑑にコレクションする。

| 項目 | 内容 |
|------|------|
| **本番 URL** | https://osakana-tsuri.web.app |
| **GitHub** | https://github.com/oharamanezimentosystems/osakana-tsuri |
| **Firebase プロジェクト** | `osakana-tsuri` |
| **リージョン** | Functions / Firestore: `asia-northeast1` |

---

## 技術スタック

| 領域 | 技術 |
|------|------|
| フロント | Vite 8 + TypeScript（vanilla、SPA 的単一 HTML） |
| 認証 | Firebase Authentication（匿名ログイン。Google 連携 UI あり） |
| DB | Cloud Firestore（`users` / `master_fishes`） |
| サーバー | Cloud Functions v2（`startFishing` / `claimFish` / `pingAuth`） |
| 公開 | Firebase Hosting |
| ローカル保存 | `localStorage`（Auth 失敗時・未設定時のフォールバック） |

---

## ディレクトリ構成

```
おさかなつり/
├─ space.md                 … 本ファイル（設計・共有メモ）
├─ todo.md                  … 開発 TODO
├─ README.md
├─ .gitignore
└─ web/                     … アプリ本体（ここが Firebase プロジェクトルート）
   ├─ index.html
   ├─ package.json
   ├─ .env.example          … Firebase / 待ち時間の環境変数テンプレ
   ├─ .env                  … 本番キー（git 管理外）
   ├─ firebase.json
   ├─ .firebaserc           … default: osakana-tsuri
   ├─ firestore.rules
   ├─ public/
   │  ├─ assets/fish/       … 魚スプライト PNG（透過）
   │  ├─ assets/ui/         … エサ・ルアーアイコン
   │  └─ manifest.webmanifest
   ├─ src/
   │  ├─ main.ts            … UI・タブ・タイマー・リザルト
   │  ├─ store.ts           … 状態・localStorage・クラウド同期
   │  ├─ firebase.ts        … Auth / Firestore / callable
   │  ├─ config.ts          … 待ち時間・演出ムード
   │  ├─ data/fishes.ts     … マスター魚・ガチャ重み
   │  ├─ notify.ts          … Web Notification
   │  └─ style.css          … 水面・図鑑・レスポンシブ UI
   ├─ functions/            … Cloud Functions (Node 20)
   │  └─ src/index.ts
   └─ scripts/
      ├─ seed-master-fishes.json
      └─ seed.mjs
```

---

## 画面構成

| タブ | 内容 |
|------|------|
| **つり** | エサ選択（みみず / きらきらルアー）→ 釣り開始 → 待ち演出 → 釣り上げ → リザルト |
| **ずかん** | 5種グリッド。未獲得はシルエット＋`???`、獲得済みは数・最大サイズ・解説 |
| **プロフィール** | 名前変更、保存モード表示、データ書き出し/読み込み、Google 連携 |

縦画面想定（`max-width: 480px` 中央寄せ）。

---

## ゲームループ

1. **エサ選択**  
   - `worm`: 通常確率  
   - `lure`: レア寄り（weight ブースト）
2. **釣り開始**  
   - `VITE_USE_FUNCTIONS=true` かつ Firebase ログイン済み → callable `startFishing`（**サーバー時刻**で `readyAt`）  
   - それ以外 → クライアントで `Date.now() + FISHING_DURATION_MS` を local / Firestore に保存
3. **待ち（本番 約30秒）**  
   - フェーズ表示: 投げた → 待ち → 反応 → ゲット  
   - ムードメッセージ・泳ぐ魚・ウキのピクピク・波紋  
   - タブを閉じても再開可能（`readyAt` を保持）  
   - 許可時 Web Notification「ウキが沈んだよ！」
4. **釣り上げ**  
   - Functions 時: `claimFish` で時間判定＋サーバーガチャ  
   - フォールバック: クライアント `rollFish` / `rollSizeCm`
5. **リザルト** → 図鑑更新 → すぐ次の釣りへ

### 待ち時間の設定

| モード | 値 | 設定箇所 |
|--------|-----|----------|
| 本番 Hosting | 30,000 ms | `VITE_PRODUCTION_FISHING_MS` / `config.ts` 既定 |
| 本番 Functions | 30,000 ms | `functions` の `FISHING_MS` 既定 |
| デバッグ | 10,000 ms | `VITE_DEBUG` が false でないとき + `VITE_FISHING_MS` |

旧・長時間セッションが localStorage に残っている場合、`store.migrateStaleFishingSession()` が破棄する。

---

## マスター魚（5種）

| ID | 名前 | レア | weight | アセット |
|----|------|------|--------|----------|
| `marukin` | まるきん | common | 45 | `marukin.png` / 驚き顔 |
| `fukufuku` | ふくふくフグ | common | 35 | `fukufuku.png` / ハッピー |
| `ribon_demekin` | りぼんデメキン | uncommon | 15 | `ribon_demekin.png` |
| `oukan_madai` | おうかんマダイ | rare | 4 | `oukan_madai.png` |
| `hoshizora_jinbee` | ほしぞらジンベエ | legendary | 1 | `hoshizora_jinbee.png` |

フロント内マスター: `web/src/data/fishes.ts`  
Firestore シード: `web/scripts/seed-master-fishes.json`（コレクション `master_fishes`）

---

## データモデル（Firestore）

### `master_fishes/{fishId}`

```
name, rarity, description, image, weight, minSizeCm, maxSizeCm
```

読み取り: 認証ユーザー。書き込み: ルール上禁止（シードは Admin / コンソール）。

### `users/{uid}`

```
name: string
createdAt: number
updatedAt: number
fishing: {
  baitId: string
  startedAt: number
  readyAt: number
  claimed: boolean
} | null
caught: {
  [fishId]: {
    fishId: string
    count: number
    maxSizeCm: number
    lastCaughtAt: number
  }
}
```

読み書き: `request.auth.uid == userId` のみ（`firestore.rules`）。

### localStorage

キー: `osakana-tsuri-v1`  
Auth 不可時も同構造で端末保存。プロフィールから JSON 書き出し/読み込み可能。

---

## Cloud Functions（asia-northeast1）

| 関数 | 役割 |
|------|------|
| `startFishing` | 認証必須。エサ検証。進行中なら拒否。サーバー時刻で session 保存 |
| `claimFish` | 認証必須。`readyAt` 経過チェック → ガチャ → `caught` 更新 |
| `pingAuth` | 認証確認用 |

- Runtime: Node.js 20（2026-10 廃止予定 → 将来 Node 22 推奨）  
- Cloud Run サービスに `roles/run.invoker` = `allUsers`（callable 用。中身は Auth 必須）  
- 実行 SA（compute）に Firestore 用 IAM（`datastore.user` 等）

---

## 環境変数（`web/.env`）

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=osakana-tsuri
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_DEBUG=false
VITE_USE_FUNCTIONS=true
VITE_PRODUCTION_FISHING_MS=30000
```

`.env` は git 管理外。テンプレは `.env.example`。

---

## 開発・デプロイ手順

```bash
# 開発
cd web
npm install
cp .env.example .env   # 値を埋める
npm run dev

# ビルド & 公開
npm run build
firebase deploy --only hosting,functions,firestore:rules --project osakana-tsuri

# マスター魚シード（要アクセストークン）
# TOKEN=... node scripts/seed.mjs
```

---

## デザイン方針

- 丸みのあるフォルム・大きめの目・パステルカラーの癒やし系  
- 釣り場: CSS 水面アニメ・雲・泡・ウキ  
- 図鑑: 絵本風カードグリッド  
- 縦画面ファースト、かわいいピンク系 CTA

---

## 既知の制約・今後

- Google ログインはコンソールでプロバイダ有効化が必要（匿名は有効済み）  
- Functions Node 20 のサポート期限に注意  
- チート対策の本丸は `startFishing` / `claimFish`（Functions 有効時）  
- 魚種追加・待ち時間調整は `fishes.ts` / `config.ts` / Functions の `FISHING_MS` を同期すること

---

## AI / 改修時の指針

1. この `space.md` と `todo.md` を優先参照する  
2. 待ち時間や確率を変えるときは **フロントと Functions の両方**を更新し再デプロイする  
3. 秘密情報（`.env`）をコミットしない  
4. 公開後の確認 URL は常に https://osakana-tsuri.web.app  
