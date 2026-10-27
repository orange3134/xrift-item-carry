# item-carry

`useItemCarry`を使ってタイトルバー・外枠をつかめるウィンドウを作った、XRiftへアップロード可能なデモアイテムです。
描画機能はありません。中央の内容部分はつかめません。

## 初回セットアップ

このリポジトリのルートで次を実行します。

```sh
npm ci
npm run demo:setup
```

## ブラウザーで動作確認

```sh
npm run demo:dev
```

`http://127.0.0.1:5182/` を開きます。

- タイトルバー・外枠をドラッグすると移動します。
- 「視点操作を開始」を押すと、左ボタンでつかんだまま左右を見る操作で水平回転を試せます。
- W/A/S/Dで移動、Escで視点操作を解除します。
- 同じURLを別タブで開くと位置と向きが共有され、途中参加にも復元されます。
- `?item=another`は別の配置として扱います。全タブを閉じるとブラウザーの共有状態は消えます。

`npm run build`の後に`http://127.0.0.1:5182/?built=1`を開くと、アップロード用の`remoteEntry.js`から実際の`./Item`を読み込んで確認できます。

PlaywrightとEdgeがある環境では、ルートから`npm run test:demo:browser`で移動・回転・配置前の無効化・同期を自動検証できます。
`DEMO_BUNDLE=1`を設定すると、同じテストを実際のアップロード用バンドルで実行します。
必要に応じて`PLAYWRIGHT_MODULE`、`BROWSER_CHANNEL`、`DEMO_URL`を指定してください。

## XRiftへアップロード

このディレクトリ内で次を実行します。

```sh
npm run build
npm run check
npx xrift login
npm run upload
```

ログイン済みなら`npx xrift login`は不要です。リポジトリのルートからは`npm run demo:upload`も使えます。
アップロードコマンドは`xrift.json`を読み、本番ビルドとチェックを実行してから新しいデモアイテムを登録します。
初回アップロードで発行されるIDはローカルの`.xrift/`に記録されます。他人のアイテムID・認証情報は同梱しません。

XRift上では配置後に前面のタイトルバー・外枠をつかみます。
PCの視点操作・WebXRではつかんだ距離を維持し、視点の左右回転に向きが追従します。
移動途中は100ms間隔、離したときは最終位置とQuaternionをまとめて共有します。
複数人で同じ板を同時につかんだ場合の所有権ロックはありません。
インスタンスが終了した後の永続保存は対象外です。

## 構成

- `src/Item.tsx`：アップロードされるデモ本体。共通フックを利用し、XRiftの状態共有へ接続。
- `src/windowPanel.ts`：デモの見た目と、タイトルバー・外枠の領域判定。
- `src/dev.tsx`・`src/devSync.ts`・`src/PreviewNavigation.tsx`・`src/loadBuiltItem.ts`：ブラウザープレビュー専用。
- `vite.config.ts`：`./Item`を公開するModule Federation設定。開発ページはアップロード用ビルドに含めません。
- `public/thumbnail.png`：デモのサムネイル。

ライブラリ本体のnpm配布にはこのディレクトリを含めません。コードのライセンスはルートのMITライセンスです。
