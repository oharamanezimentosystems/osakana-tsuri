# おさかなつり 🐟

かわいいお魚を集める、癒やし系の放置型釣り Web アプリ（MVP）。

## すぐ遊ぶ（ローカル）

```bash
cd web
npm install
npm run dev
```

ブラウザで表示された URL を開いてください。

- **デフォルトはデバッグモード**: 放置 **10 秒** で釣れます
- データは **localStorage** に保存（Firebase 未設定時）

## Firebase を使う

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成
2. Authentication → 匿名ログインを有効化（任意で Google も）
3. Firestore を作成し、`firestore.rules` をデプロイ
4. Web アプリを登録し、`.env` を作成:

```bash
cp .env.example .env
# 各 VITE_FIREBASE_* を埋める
```

5. `scripts/seed-master-fishes.json` の内容を `master_fishes` コレクションに登録（ドキュメント ID = 魚 ID）
6. Hosting:

```bash
npm run build
npx firebase deploy
```

## 本番向け設定

`.env` で:

```
VITE_DEBUG=false
```

放置時間が **30 分** になります。

### 匿名認証（クラウド保存）

1. [Authentication](https://console.firebase.google.com/project/osakana-tsuri/authentication) を開く  
2. 「始める」→ **匿名** を有効化  
3. （任意）Google も有効化  

未設定時は端末の localStorage ＋ **データ書き出し/読み込み** で引き継げます。

### Cloud Functions（チート対策・任意）

Blaze プランが必要です。

```bash
cd functions && npm install && npm run build
cd ..
# .env に VITE_USE_FUNCTIONS=true
npm run build
firebase deploy --only functions,hosting
```

## 画面

| タブ | 内容 |
|------|------|
| つり | エサ選択 → 放置 → 釣り上げ → リザルト演出 |
| ずかん | 未獲得はシルエット＋???、獲得済みは解説・サイズ |
| プロフィール | 名前変更、保存モード表示、Google 連携（Firebase 時） |
