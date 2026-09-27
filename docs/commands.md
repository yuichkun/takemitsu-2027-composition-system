# コマンド — このリポジトリで使うもの

このリポジトリで打つコマンドを、ここに集める。仕組みの説明は [`architecture.md`](./architecture.md)。

- コマンドはリポジトリの一番上（`~/workspace/takemitsu-2027-composition-system`）で打つ
- `npm` / `pnpm` / `npx` は使わず、`vp` を使う（Vite+）

## 1. 最初に一度だけ

```sh
vp install              # 依存を入れる
vp run host:configure   # 自作ホスト（native/host）のビルドの準備
vp run host:build       # 自作ホストをビルドする
```

- JUCE をローカルの checkout から使うときは、`host:configure` に `-DJUCE_SOURCE_DIR=…` を足す
- BBC SO は Splice の Rent-to-Own で借りている。Splice のログインが切れると全部無音になる。そのときは Splice に入り直す（[`research/bbcso.md`](./research/bbcso.md) §2）

## 2. ふだん使うもの

```sh
vp dev          # プレビュー（http://localhost:5173）
vp check        # 型・lint・整形の検査
vp check --fix  # 整形を直す
```

- プレビューが一覧する楽譜は、`examples/`、`scores/`、`sketches/`、それに `PREVIEW_SCORE_DIRS` のフォルダ（`:` 区切り）の中（入れ子も）にある `.json`
- スケッチの楽譜を手で書き直すとき: `vp node src/sketch/run.ts sketches/<名前>`（プレビューが動いていれば、つまみや `sketch.ts` の保存で勝手に書き直す）
- 楽譜を保存すると、プレビューは自動で読み直す。画面を読み込み直す必要はない
- サーバを止める（Ctrl+C）と、ホストのプロセスも一緒に終わる
- `http://localhost:5173/#score=<楽譜ファイルのパス>` で、その楽譜を開いた状態のページになる

### 画面の操作

| キー | すること |
| --- | --- |
| Space | 再生 / 一時停止 |
| Enter、Home | 先頭へ |
| ← → | 前 / 次の小節へ |
| F | 全画面で譜面だけにする（Esc で戻る） |
| ⌘= ⌘− | 拡大 / 縮小（トラックパッドのピンチ、⌘ + ホイールでも） |
| ⌘0 | Fit（全部の段が見える） |
| ⌘B | 左の一覧をたたむ / ひらく |
| M | ミキサーをたたむ / ひらく |
| K | つまみの欄を隠す / 出す（スケッチを開いているとき） |
| ? | この一覧 |

譜面をクリックするとそこへ移動、再生位置の線はドラッグで動かせる。表示とズームはブラウザが覚えている

## 3. 20 分のダミー曲で試す

物差しの曲（107 パート、457 小節、1,206 秒）。作曲した曲ではなく、負荷をかけるための乱数の曲。

### 3.1 作る

```sh
vp node tools/stress-score.ts     # .local/stress/stress-20min.json を作る
```

`--minutes 20`、`--seed 1`、`--out <file>` で変えられる。

### 3.2 何もない状態から開く

1. 動いているプレビューがあれば止める（Ctrl+C）
2. ダミー曲用の保存場所を消す

   ```sh
   rm -rf .local/probe/stress-chunks
   ```

3. ダミー曲のフォルダと保存場所を指定して、プレビューを立ち上げる（ポート 5175）

   ```sh
   PREVIEW_SCORE_DIRS=.local/stress TAKEMITSU_CHUNKS_DIR=.local/probe/stress-chunks vp dev --port 5175
   ```

4. http://localhost:5175 を開き、左の一覧の `.local/stress` の下にある `stress-20min` を選ぶ

開いてから起きること:

- 最初の 15〜20 秒は、ホストが全部の音色（68 状態）を読み込み、試し音を鳴らしている。その間はレンダしない
- そのあと、再生位置の近くからレンダする。画面上部の帯が曲全体で、濃くなった所がレンダ済み
- Space で再生すると、先の 3 秒がそろった時点で鳴り始める（冒頭なら開いてから約 20 秒）。そろっていない所に来ると、その手前で待つ
- 曲全体がそろうのは約 4 分後
- 譜面は、最初の画面が約 1 秒で出る。全 457 小節を測り終わるまで（約 2 分）は段が少しずれ、そのあと近い所から段がそろう。
  描いた絵は `.local/engravings/` に残るので、2 回目からはすぐ出る
- ホストは約 16 GB のメモリを使う。保存場所は 1 版で約 20 GB

### 3.3 編集して、反映を見る

ダミー曲は 1 行の巨大な JSON なので、手で直す代わりに `tools/stress-edit.ts` で直す。ファイルをその場で書き換えるので、プレビューはふつうの保存と同じように反映する。

1. 画面で再生位置を直す所に置く（帯か譜面をクリック。既定の編集場所は 229 小節）
2. 別のターミナルで編集する

   ```sh
   vp node tools/stress-edit.ts tutti            # 229 小節から 4 小節、全パートの音を半音上げる
   vp node tools/stress-edit.ts note             # 1 音だけ半音上げる
   vp node tools/stress-edit.ts dynamics --by 2  # 1 パートの強弱を 4 小節の松葉にする（--by は 0〜8）
   vp node tools/stress-edit.ts insert           # 229 小節の前に空の小節を 1 つ入れる
   vp node tools/stress-edit.ts tempo            # 229 小節から後ろのテンポを 1.1 倍にする
   vp node tools/stress-edit.ts tutti --at 100 --by 2   # 場所と量を変える
   ```

3. 画面で見る。譜面が描き直され、帯の直した所が薄くなってから濃くなる。再生すると、そろい次第鳴る
4. 元に戻す

   ```sh
   vp node tools/stress-edit.ts restore
   ```

- 編集は積み重なる。`tutti` を 2 回すると 2 半音上がる
- 最初の編集の前の状態が `.local/stress/stress-20min.json.orig` に残る。`restore` はそれを戻す
- 同じ中身に戻したときは、保存場所にあるものがそのまま使われ、すぐ鳴る
- その楽器でまだ使っていない奏法が増える編集をすると、その楽器の音色を読み直すので、数秒は全体のレンダが止まる。その楽器のチャンクは全部作り直しになる
- `--file <score.json>` で、ダミー曲以外の楽譜にも使える

## 4. 書き出す

```sh
vp node tools/render.ts examples/showcase.json            # .local/renders/showcase/mix.wav
vp node tools/render.ts examples/showcase.json --stems    # パートごとの WAV も
```

プレビューと同じ保存場所（`.local/chunks`）を使うので、足りないチャンクだけレンダする。

## 5. 確かめる道具

```sh
vp node tools/notation-check.ts examples/showcase.json        # 譜面の確かめ
vp node tools/check.ts examples/showcase.json                 # 答え合わせ
vp node tools/check.ts examples/showcase.json --self-test     # 答え合わせが欠けを見つけられるかの自己テスト
vp node tools/bench.ts .local/stress/stress-20min.json        # 編集ベンチ
```

- **譜面の確かめ**（[`../tools/notation-check.ts`](../tools/notation-check.ts)）
  - オクターヴ記譜の楽器が決めた向きで書かれているか
  - 音部記号とオクターヴ線のあとでも、加線 4 本以上の音が残るか（楽器ごとの数）
  - 小節を 1 つずつ描いて段がそろうか、描く時間（`--measures 24` で数を変える）
- **答え合わせ**（[`../tools/check.ts`](../tools/check.ts)）
  - チャンク単位: 選んだチャンクを 1 つずつ新しいプロセスでレンダし直し、保存したものと比べる
  - パート単位: プレビューと同じ規則で混ぜたものを、通しのレンダと比べる
  - `--parts 6`、`--chunks 24`、`--seed 1` で数と選び方を変えられる
  - 20 分の曲だと 5〜10 分かかる。ダミー曲に使うときは `TAKEMITSU_CHUNKS_DIR=.local/probe/stress-chunks` を前に付ける
- **編集ベンチ**（[`../tools/bench.ts`](../tools/bench.ts)）
  - 開く、1 音、強弱、トゥッティ、小節の挿入、テンポ変更について、保存から止まらずに鳴らせるまでを測る
  - `--store <dir>` を付けないと、一時フォルダに空の保存場所を作り、終わったら消す（20 分の曲で約 15 分、途中で数十 GB 使う）
  - `--only tutti` で場面を絞れる。結果は `.local/bench/` に JSON で残る
- どちらも、動いている間は他のレンダ（プレビュー）を止めておく。測る値が乱れるため

## 6. コードを更新したとき

```sh
git pull
vp install          # 依存が変わったとき
vp run host:build   # native/host が変わったとき
```

そのあと、動いているプレビューを止めて立ち上げ直す。

- 保存場所はそのまま使える
- チャンクの形式の版が上がる更新のあとは、次に開いたとき全部を作り直す（キーが変わるので、古いものは使われない）。古いものは保存場所の上限を超えたときに消える。すぐ消したいときは、下の「溜まるものと消し方」

## 7. 環境変数

| 変数 | 既定 | 意味 |
| --- | --- | --- |
| `PREVIEW_SCORE_DIRS` | なし | プレビューが一覧する楽譜フォルダを足す（`:` 区切り） |
| `TAKEMITSU_CHUNKS_DIR` | `.local/chunks` | チャンクの保存場所 |
| `TAKEMITSU_CHUNKS_GB` | 60 | 保存場所の上限（GB）。超えると、開いている楽譜の今と直前の版以外を古い順に消す |
| `TAKEMITSU_HOSTS` | 8 | ホストのプロセス数 |
| `TAKEMITSU_HOSTS_MB` | 24000 | ホストのメモリがこれを超えたら、それ以上は音色を読み込まない（MB） |
| `TAKEMITSU_HOST` | ビルドしたもの | ホストの実行ファイルのパス |
| `TAKEMITSU_ENGRAVERS` | 4 | 譜面を描く worker thread の数 |
| `TAKEMITSU_ENGRAVINGS_DIR` | `.local/engravings` | 描いた譜面の保存場所 |
| `TAKEMITSU_ENGRAVINGS_GB` | 10 | 描いた譜面の保存場所の上限（GB）。超えると古い順に消す |

## 8. 溜まるものと消し方

どれも `.local/` の下にあり、git には入らない。消しても、次に要るときに作り直される。

| 場所 | 中身 | 消し方 |
| --- | --- | --- |
| `.local/chunks/` | `vp dev` と書き出しのチャンク | プレビューを止めて `rm -rf .local/chunks` |
| `.local/probe/stress-chunks/` | ダミー曲の試験用のチャンク（約 20〜40 GB） | プレビューを止めて `rm -rf .local/probe/stress-chunks` |
| `.local/engravings/` | 描いた譜面（1 小節ずつの SVG と位置の情報） | そのまま消してよい（次に開いたとき描き直す） |
| `.local/mixer/` | 楽譜ごとのミキサーの設定 | 楽譜名の `.json` を消す |
| `.local/renders/` | 書き出した WAV | そのまま消してよい |
| `.local/stress/` | ダミー曲 | `vp node tools/stress-score.ts` で作り直せる |
| `.local/bench/` | ベンチの結果 | そのまま消してよい |
| `.local/probe/` | 調査のスクリプトと生データ | 調査の記録（`docs/research/`）が参照している。消すと元データは戻らない |

## 9. BBC SO を調べる道具

ふだんは使わない。BBC SO の版が変わったときや、新しい楽器を足すとき用。

```sh
vp node tools/bbcso-probe.ts pitch           # ピッチベンドと調律の正確さ
vp node tools/bbcso-probe.ts stream          # オフラインレンダの速さ
vp node tools/bbcso-probe.ts scan <楽器> [奏法…]   # どの鍵が鳴るか、音量と音程（--keys 12-127 など）
vp node tools/bbcso-probe.ts scan-all        # 全楽器・全奏法を走査する（時間がかかる）
vp node tools/bbcso-probe.ts verify-gaps     # 鳴らないと出た鍵を 1 つずつ鳴らし直す
vp node tools/bbcso-summary.ts               # 走査の結果を src/libraries/bbcso/inventory.json にまとめる
```

結果の読み方は [`research/bbcso.md`](./research/bbcso.md)。
