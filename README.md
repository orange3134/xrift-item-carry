# xrift-item-carry

XRiftのアイテムに「つかんで運ぶ・視点に合わせて水平回転する」操作を追加するReact Hookです。
React Three Fiber上で動作し、`@xrift/world-components`への依存はありません。

- 自由カーソル：つかんだときの視点平面に沿ってドラッグ。
- ポインターロック／WebXR：つかんだ距離を保ち、移動・ターゲットレイに追従。
- 視点の左右回転だけを加算。上下を見てもアイテムの傾きは増えません。
- 端をつかんでも、つかんだ位置がずれないように回転・移動を計算。
- `canStart`で余白・枠などのつかめる領域を指定。
- Escape、フォーカス喪失、ポインター捕捉喪失、XR終了・コントローラー切断、無効化、アンマウントで操作を終了。

## XRiftで試せるデモアイテム

[demo-item](./demo-item/README.md) に、タイトルバーと外枠をつかめるウィンドウのデモを同梱しています。
ホワイトボードの描画・ペン・パレット・画像保存は含みません。
デモは独立した開発用パッケージで、ライブラリ本体のnpm配布には含めません。

```sh
npm ci
npm run demo:setup
npm run demo:dev
```

プレビューは http://127.0.0.1:5182/ です。XRiftへアップする場合はセットアップ後に次を実行します。

```sh
cd demo-item
npx xrift login
npm run upload
```

ビルドのみならルートから `npm run demo:build`、XRiftのチェックは `npm run demo:check`。
新規アイテム用の `xrift.json` とサムネイル、Module Federationの `./Item` エントリーを用意しています。
デモ固有の依存は `demo-item/package.json` へ分離しているので、共通フックだけを導入する利用者には不要です。

## インストール

React 19、React Three Fiber 9、Three.js 0.183系以降（0.183互換）が必要です。
ローカル開発では、アイテムのディレクトリで次を実行します。

```sh
npm install --install-links ../xrift-item-carry
```

GitHubから直接導入する場合：

```sh
npm install github:orange3134/xrift-item-carry#main
```

バージョンを固定する場合は`main`をコミットSHAへ置き換えてください。
`prepare`で配布用JSと型をビルドします。
npmレジストリへの公開は別途行ってください。

## 基本の使い方

`<Canvas>`内のコンポーネントで呼びます。`target`が移動するオブジェクト、`handle`が入力を拾うメッシュです。

```tsx
import { useRef } from 'react'
import { Group, Mesh } from 'three'
import { useItemCarry } from 'xrift-item-carry'

export function Panel() {
  const target = useRef<Group>(null)
  const handle = useRef<Mesh>(null)
  useItemCarry({
    target,
    handle,
    // この2×1の面では、中央の1.7×0.7を除いた枠だけつかめる。
    canStart: ({ local }) => Math.abs(local.x) > 0.85 || Math.abs(local.y) > 0.35,
    onEnd: transform => console.log('確定', transform),
  })
  return (
    <group ref={target}>
      <mesh ref={handle}>
        <planeGeometry args={[2, 1]} />
        <meshBasicMaterial color="lightsteelblue" />
      </mesh>
    </group>
  )
}
```

`local`は`handle`のローカル座標です。幅・高さやUIの座標系はモジュールに固定していません。
ハンドルの手前に装飾メッシュを重ねる場合、操作を遮らせたくない装飾には`raycast={() => {}}`を指定します。
タッチ入力ではCanvasの`touch-action: none`も指定してください。

## API

```ts
const { start, update, end, isCarrying } = useItemCarry({
  target,
  handle,     // 省略すると手動入力モード
  enabled,    // 初期値 true。XRiftなら placement === 'placed' など
  canStart,   // (hit: ItemHit) => boolean。自動入力モードの開始判定
  onStart,    // (transform: ItemTransform) => void
  onChange,   // (transform: ItemTransform) => void
  onEnd,      // (transform: ItemTransform) => void
})
```

| 戻り値 | 動作 |
| --- | --- |
| `start({ world, ray, view, followRay })` | ワールド座標のつかみ位置から開始。開始できたら`true` |
| `update({ ray, view })` | 現在のレイと視点方向で更新。移動できたら`true` |
| `end()` | 終了して`onEnd`を一度呼ぶ。繰り返しても安全 |
| `isCarrying()` | 現在操作中かを取得。毎フレームのReact再描画は起こさない |

`ray`は正規化した方向を持つThree.jsの`Ray`、`view`はカメラのワールド方向です。
`followRay`は自由カーソルで`false`、ポインターロック・WebXRで`true`にします。
`start`に渡した位置・向きはコピーされます。
`onChange`は更新ごとに呼ばれます。ネットワーク送信の間引きは利用側で行い、`onEnd`で最終値を送信してください。
`onEnd`はキャンセル時にも現在位置を確定します。開始位置へのロールバックは行いません。

## 既存の描画・ボタン入力と組み合わせる

`handle`を省略すると入力イベントを登録しません。既存の入力処理から制御できます。
`canStart`は自動入力用なので、手動モードでは呼び出し側で領域を判定してください。

```tsx
const carry = useItemCarry({ target, enabled: placement === 'placed', onEnd: save })

// 自分のdown処理：ペンやボタンに当たらなかったときだけ開始。
carry.start({ world: hit.world, ray: hit.ray, view: hit.view, followRay: hit.followRay })
// move処理（視点やプレイヤー位置の変化にも追従するよう毎フレーム呼ぶ）。
carry.update({ ray: hit.ray, view: hit.view })
// pointerup / cancel処理。
carry.end()
```

共通の入力アダプター`useItemInput(handle, handlers, enabled)`も公開しています。
`down`で`false`を返すとその入力を消費しません。`move`・`up`・`cancel`、任意の`hover`、
`isDragging`を渡すと、マウス・タッチ・ポインターロック・XRの入力を同じ経路にまとめられます。
`ItemHit`には`local`・`world`・`ray`・`view`・`followRay`が入ります。
`isDragging`が`true`の間は、最初のつかみ位置と最新レイを使うため、対象が移動しても追従が切れません。

## XRiftで位置と向きを共有する

フックは通信・保存の方式を決めません。位置と向きは同じスナップショットで送信してください。

```tsx
const { id } = useItem()
const { states, sendState } = useInstanceStateContext()
const lastSend = useRef(0)
const key = `my-item:${id}:transform`
const save = (transform: ItemTransform) => sendState(key, transform)
const carry = useItemCarry({
  target,
  handle,
  enabled: placement === 'placed',
  onChange: transform => {
    if (performance.now() - lastSend.current < 100) return
    lastSend.current = performance.now()
    save(transform)
  },
  onEnd: save,
})
useFrame(() => {
  if (carry.isCarrying()) return
  const transform = states.get(key)
  if (target.current && isItemTransform(transform)) {
    target.current.position.fromArray(transform.position)
    target.current.quaternion.fromArray(transform.quaternion).normalize()
  }
})
```

この抜粋には`useItem`・`useInstanceStateContext`・`usePlacementState`（`@xrift/world-components`）、
`useFrame`（`@react-three/fiber`）、`isItemTransform`・`ItemTransform`（`xrift-item-carry`）のimportと、
`const { mode: placement } = usePlacementState()`を追加してください。
送信値は親オブジェクトに対するローカル位置・Quaternionです。各クライアントで配置の親が同じ座標系であることを前提とします。
同時につかむユーザー間の排他制御は利用側で実装してください。

XRiftのModule Federationでは、このライブラリを通常の依存としてバンドルし、
`react`・`three`・`@react-three/fiber`は既存アイテムと同じホスト共有設定を使います。
ライブラリ自体をホストの`shared`に追加する必要はありません。

## 開発

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

利用例は`npm run dev -- --host 127.0.0.1 --port 5181`で起動し、`http://127.0.0.1:5181/examples/`を開きます。
PlaywrightとEdgeがある環境では、起動中に`npm run test:browser`でフックの自動入力・枠の判定・各終了経路を検証できます。
必要なら`PLAYWRIGHT_MODULE`、`BROWSER_CHANNEL`、`CARRY_URL`で実行環境を指定してください。

`examples/CarryablePanel.tsx`に枠だけをつかめる実装例があります。
平行レイ・真上の視点・一周回転・親の回転と一様スケール・可視性と遮蔽判定をテストしています。
非一様スケールによるシアーを含む階層、物理エンジンによって制御される剛体は対象外です。
WebXR実機の動作は別途確認してください。

## License

[MIT](./LICENSE)
