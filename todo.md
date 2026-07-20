# 🛠️ お魚釣りWebアプリ（放置・コレクション型）開発 TODOリスト

かわいらしい見た目の魚たちが登場する、ブラウザで手軽に遊べる癒やし系の放置型釣りWebアプリの最小構成（MVP）開発に向けたタスク一覧です。
Web（PC・スマホブラウザ対応）に最適化した設計・タスクに変更しています。

**実装場所**: `web/` （Vite + TypeScript）  
**起動**: `cd web && npm install && npm run dev`

---

## 🎨 【フェーズ1】ビジュアル・世界観の定義（最優先：かわいい魚たちの作成）
まずはゲームの肝となる「かわいらしい見た目のお魚」のデザイン定義とアセットの準備から開始します。

- [x] **魚のキャラクターデザイン（ビジュアル作成）**
  - [x] 💡 *デザインコンセプト: 丸みのあるフォルム、大きめのパチパチした目、パステルカラー調の癒やし系デザイン*
  - [x] 基本の魚（まるきん・ふくふくフグ・りぼんデメキン）のイラスト作成 → `web/public/assets/fish/`
  - [x] レアな魚（おうかんマダイ・ほしぞらジンベエ）のイラスト作成
  - [x] 魚の「釣られたとき」表情バリエーション（まるきん驚き顔・ふくふくハッピー顔）
- [x] **UI・背景の素材・レイアウト準備**
  - [x] スマホ・PCどちらでも可愛く表示されるレスポンシブな画面設計（max-width 480px 縦画面）
  - [x] ゆらゆら揺れる水面がかわいい「釣り場画面」の背景（CSSアニメーション）
  - [x] 絵本風の「図鑑画面」のベースデザイン、エサやルアーのアイコン

---

## 🔑 【フェーズ2】Firebase環境構築・フロントエンド基盤実装
WebアプリとしてFirebaseと通信するための土台を作ります。

- [x] **Firebaseプロジェクトの作成と初期設定**
  - [x] プロジェクト `osakana-tsuri` 作成・Web アプリ登録
  - [x] **Firebase Hosting** デプロイ済 → https://osakana-tsuri.web.app
  - [x] Webアプリ SDK 設定（`.env` / `src/firebase.ts`）— Auth 未有効時は localStorage で動作
- [x] **Firebase Authentication（匿名認証）の実装**
  - [x] コード実装済（`signInAnonymously`）
  - [x] 匿名ログイン有効化済（Blaze 後に API で設定）
- [x] **Firestoreデータベースの初期化**
  - [x] `master_fishes` 投入済・`firestore.rules` デプロイ済
  - [x] フロント内マスターも同内容

---

## 🎣 【フェーズ3】コア機能・ゲームループの実装（Webフロント＆バックエンド）
ブラウザ上で放置して魚が釣れる状態を作ります。

- [x] **釣り開始（Start Fishing）処理の実装**
  - [x] Web画面：「エサ選択」＆「釣り開始」ボタン
  - [x] ロジック：開始時刻・readyAt を `users` / localStorage に保存
  - [x] *ステップアップ*: Cloud Functions `startFishing` / `claimFish`（asia-northeast1）デプロイ済
- [x] **放置・カウントダウン処理と通知**
  - [x] かわいいプログレスバー＋タイマー
  - [x] **Web Notification API**：許可ダイアログ＋「ウキが沈んだよ！」通知
  - [x] リロード後も残り時間を復元してタイマー復帰
- [x] **釣り上げ（Claim Fish）処理＆ガチャの実装**
  - [x] 時間経過後「つりあげる！」活性化
  - [x] 確率ガチャ → `caught` に count / maxSize 保存
- [x] **リザルト演出画面の作成**
  - [x] キラキラ＋お魚ドーン演出（CSS）

---

## 📕 【フェーズ4】コレクション（図鑑）＆プロフィールの実装
ゲームのやり込み要素をWeb画面に落とし込みます。

- [x] **かわいいお魚図鑑画面の実装**
  - [x] マスター × 獲得データをグリッド表示
  - [x] 未獲得：シルエット ＋「???」
  - [x] 獲得済み：イラスト ＋ 釣った数 ＋ 最大サイズ ＋ 解説
- [x] **プロフィール画面の実装**
  - [x] ユーザー名の変更（local / Firestore）

---

## 🧪 【フェーズ5】テスト・デプロイ・アカウント連携
Webアプリとして一般公開するための最終調整です。

- [x] **デバッグ＆バランス調整**
  - [x] デフォルト放置 10 秒（`VITE_DEBUG` / `VITE_FISHING_MS`）でループ検証可能
- [x] **Firebase Hosting へのデプロイ**
  - [x] https://osakana-tsuri.web.app （本番: 放置30分）
- [x] **ソーシャルログイン（データ引き継ぎ）の追加**（コード実装済）
  - [x] Google 連携 UI（`linkWithPopup`）— Google プロバイダ有効化後に利用可

---

## 📌 残タスク（任意）

1. [Authentication → Google](https://console.firebase.google.com/project/osakana-tsuri/authentication/providers) を ON（データ引き継ぎ UI 用。OAuth 同意画面の設定が必要な場合あり）
2. Functions の Node 20 は 2026-10 廃止予定 → 余裕があれば Node 22 へ更新
