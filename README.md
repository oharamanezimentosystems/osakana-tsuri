# おさかなつり 🐟

かわいいお魚を集める、癒やし系の放置型釣り Web アプリ。

**プレイ**: https://osakana-tsuri.web.app

## 構成

```
web/                 # Vite + TypeScript フロントエンド
  public/assets/     # 魚・UI アセット
  src/               # アプリ本体
  functions/         # Cloud Functions（startFishing / claimFish）
  firestore.rules
  firebase.json
todo.md              # 開発 TODO
```

## ローカル起動

```bash
cd web
npm install
cp .env.example .env   # Firebase 設定を記入
npm run dev
```

- デフォルトはデバッグ短待ち（`VITE_DEBUG`）
- 本番は約 30 秒待ち + 演出付き

## デプロイ

```bash
cd web
npm run build
firebase deploy --only hosting,functions,firestore:rules
```

## ライセンス

プライベート利用想定。必要に応じて変更してください。
