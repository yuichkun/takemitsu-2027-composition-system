# 調査 — BBC Symphony Orchestra Professional を自作ホストで鳴らす

調査日: 2026-09-27

確度の記号は [`../README.md`](../README.md) の「3. 調査ノート」にある。
`[文献]` 出典が言っていること / `[実測]` 自分で確認した / `[導出]` 計算 / `[推測]` 根拠のない見込み

実測の道具は [`../../tools/bbcso-probe.ts`](../../tools/bbcso-probe.ts)。
生データ（WAV と走査結果の JSON）は `.local/probe/`（git 管理外）。

---

## 1. 環境

- `[実測]` プラグイン: `/Library/Audio/Plug-Ins/VST3/BBC Symphony Orchestra.vst3`（AU もある）。
  版は 1.12.14（2026-07-08 ビルド）
- `[実測]` ライブラリ: `~/Spitfire/Spitfire Audio - BBC Symphony Orchestra/`、サンプル 594GB。
  場所は `~/Music/Spitfire Audio/Settings/Spitfire.properties` に書いてある
- `[実測]` パッチは `Patches/v1.5.0/*.zmulti`（467 個、45 楽器）。中身は暗号化されているが、
  **ファイル名がそのままプラグイン内のパッチ名になる**:
  `BBCSO_b___Violins_1___Long_Sul_Pont.zmulti` → `b - Violins 1 - Long Sul Pont`
- `[実測]` 楽器と奏法の全体は、公式マニュアルの付録の一覧と一致する
  （`[文献]` BBCSO Pro User Manual v2.0, Appendix B,
  https://d1t3zg51rvnesz.cloudfront.net/p/files/product-manuals/4126/1648649726/BBCSOPro_Manual_v2.0.pdf）

## 2. ライセンス

- `[実測]` Splice の Rent-to-Own で借りている。**Splice のログインが切れると、プラグインは読み込めても全パッチの設定が開けず、無音になる。**
  プラグインのログ（`~/Library/Logs/com.spitfireaudio/`）に `Splice licence expired: EXPIRED` と
  `failed to load patch config` が出て、画面には ERROR #9 が出る
- `[実測]` Spitfire Audio アプリを起動するだけでは戻らなかった。余湖さんが Splice に再ログインして戻った

## 3. プラグインの状態（state）

**GUI なしで、どの楽器・奏法の組み合わせの状態でも作れる。** 実装は [`../../src/libraries/bbcso/state.ts`](../../src/libraries/bbcso/state.ts)。

- `[実測]` 状態は JUCE の VST3 ラッパー（`VC2!` + XML `<VST3PluginState><IComponent>…`）の中に、
  JUCE 独自の base64 で包まれた fxb 形式のチャンクがあり、その中身が平文の XML
  `<SPITFIREAUDIO_AUNTIE>` になっている
- `[実測]` XML の `<ARTICS>` に、読み込む奏法パッチが `<ARTIC>` として並ぶ。
  各 `<ARTIC>` はパッチ名（`a_name`）と、それを選ぶキースイッチの MIDI ノート番号（`t_keyswitch`、`t_type=1`）を持つ
- `[実測]` **プラグインは `a_name` に書かれたパッチを読む。** したがって、パッチ名の一覧から状態を組み立てれば、
  そのとおりの楽器が読み込まれる。雛形は GUI で1回保存した Violins 1 の状態から作った
  （[`../../src/libraries/bbcso/template.xml`](../../src/libraries/bbcso/template.xml)）
- `[実測]` 状態を読み込んで書き出し直すと、バイト単位で元と一致する（エンコーダの検算）
- `[実測]` **`rr_neighbourMin` / `rr_neighbourMax` の範囲外の鍵は鳴らない。**
  ラウンドロビンの隣接鍵借用の範囲だが、借用を切っていても発音範囲を制限する。
  ヴァイオリン由来の 55〜97 を全楽器に持ち込んだら、打楽器の低い鍵が全部無音になった。
  雛形では 0〜127 にしてある
- `[実測]` 素のインスタンス（状態なし）は `<empty/>` で、楽器が読み込まれず無音

## 4. 四分音

- `[実測]` **ピッチベンドを完全に無視する。** A4 の持続音に +2048 / +8191（最大）を送っても、
  測った音高は送らないときと同じ（Violins 1 Long、どちらも −6.2 セント）
- `[実測]` **Global Tune（状態の `<PARAM id="g_tune">`、単位は半音）は効く。**
  0.5 にすると +43.6 セント。素の状態が −6.2 セントなので、差は **+49.8 セント**
- `[導出]` 四分音は「チューニングを +0.5 半音にしたインスタンス」で出すしかない。
  半音単位の音高は鍵盤で出せるので、1楽器あたりのインスタンスは「ずらしなし」と「+50 セント」の2つで足りる
- `[文献]` 自動化パラメータにも「Global Tune」がある（ホストから見てインデックス 11）。演奏中に書き換える方式は試していない

## 5. オフラインレンダ

- `[実測]` **最速のオフラインレンダと実時間ペースのレンダが、サンプル単位で完全に一致する。**
  12 秒の持続音2本で差分 0 サンプル。ラウンドロビンも含めて、同じ入力から同じ音が出る
- `[実測]` 設定 `defaultShouldStreamNonRealtimeSynchronously` は 0 のままでよい（ディスク読み込みで音が欠けない）
- `[実測]` 12 秒ぶんのレンダは読み込み待ちを除いて約 2 秒
- `[実測]` 状態を適用してから実際に鳴るまでの読み込み待ちは、1 インスタンスなら 15 秒で足りた。
  14 インスタンスを同時に読むときは 25 秒で足りた
- `[実測]` **終了時にプラグインが固まることがある**（打楽器のインスタンスを解放する途中で CPU 100% のまま戻らなかった）。
  ホストは書き出しが終わったらプラグインを解放せずに終了する

## 6. 打楽器の鍵盤割り当て

- `[文献]` Dorico 公式の BBCSO Pro 再生テンプレート（https://blog.dorico.com/2020/07/spitfire-bbc-symphony-orchestra-templates/ の
  `250303-BBCSO-Pro.zip`）の打楽器マップに、奏法ごとの鍵盤番号がある。
  テンプレートに入っている BBC SO の状態は、パッチの並び・キースイッチとも僕らの生成するものと同じ
- `[実測]` Snare 1 で一致を確認: 48 = 打撃、52 = リムショット、54 = サイドスティック、57 = ロール
- 全打楽器の表は §7 の走査結果とあわせて、演奏マップのデータとして持つ

| キースイッチ | パッチ | Dorico の割り当て（鍵盤番号 = 奏法） |
| --- | --- | --- |
| 0 | Anvil | 48 打撃 / 52 チョーク |
| 1 | Bass Drum 1 | 48 打撃 / 52 ダンプ / 53 手で止める / 57 ロール / 58 スーパーボール |
| 2 | Bass Drum 2 | 48 打撃 / 52 ハードスティック / 54 ダンプ / 56 手で止める / 57 ロール（強）/ 59 ロール（弱） |
| 3 | Cymbal（吊り） | 48 ミュート / 49 クラッシュ / 53 ハードスティック・ミュート / 54 ハードスティック / 57 ロール / 58 弓 |
| 4 | Military Drum | 48 打撃 / 52 リムショット / 54 サイドスティック / 57 ロール |
| 5 | Piatti（合わせ） | 48 チョーク / 52 打撃 / 57 ロール |
| 6 | Snare 1 | 48 打撃 / 52 リムショット / 54 サイドスティック / 57 ロール |
| 7 | Snare 2 | 48 打撃 / 52 リムショット / 54 サイドスティック / 57 ロール |
| 8 | Tam Tam | 48 ダンプ / 52 打撃 / 57 ロール / 58 弓 / 59 クレッシェンド |
| 9 | Tambourine | 48 打撃 / 52 シェイク / 57 ロール |
| 10 | Tenor Drum | 48 打撃 / 52 リムショット / 54 サイドスティック / 57 ロール |
| 11 | Toys | 48 カスタネット / 52 ウッドブロック低 / 53 中 / 55 高 / 54 ヴィブラスラップ / 57 カウベル / 58 スレイベル / 59 ギロ短 / 60 ギロ長 |
| 12 | Triangle | 48 打撃 / 52 ミュート / 57 ロール |

`[文献]` Dorico の表には入っていないが、マニュアルとサンプル名には Short Ruff（小太鼓類）もある。鍵盤は未確認。

## 7. 全楽器・全奏法の走査

`[実測]` 全 467 パッチについて、MIDI 12〜127 の各鍵を順に鳴らし、鳴る鍵・音量・音高を測った
（`vp node tools/bbcso-probe.ts scan-all`、結果は `.local/probe/scans/*.json`）。

集計は [`../../src/libraries/bbcso/inventory.json`](../../src/libraries/bbcso/inventory.json)
（`vp node tools/bbcso-summary.ts` で再生成。奏法ごとに鳴る鍵の範囲、範囲内で鳴らない鍵、音高のずれ）。

- `[実測]` **全 467 パッチが鳴った。** 鳴らない奏法はない
- `[実測]` **音高のある楽器は、どの奏法も音域の中で半音ごとに切れ目なく鳴る。**
  速い走査では「範囲内で鳴らない鍵」が 400 余り出たが、1鍵ずつ 4 秒空けて鳴らし直すと全部鳴った
  （`verify-gaps`）。前の鍵の残響に、立ち上がりの遅い音（flautando、sul tasto、harmonics など）が埋もれた誤検出だった
- `[実測]` 打楽器（Untuned Percussion）は、割り当てのある鍵だけが鳴る。§6 の表と一致する
- `[実測]` 鍵と実音のずれは、トリル・トレモロ・マルチタンギングを除く奏法の中央値で、ほとんどの楽器が 10 セント以内
  （弦のセクションで最大 22 セント、ティンパニ 8〜26、チューブラーベル 8〜18）。
  トリル類は二つの音が混ざるので、この測り方では意味がない
- `[実測]` クロタルはずれが 21〜69 セントと大きく出たが、鍵と実音の関係は他と同じだった（鍵 = 実音。91・96 の鍵で、鍵と同じ高さの成分がいちばん強い）。
  倍音が非調和なので、倍音を平均するこの測り方では値が乱れる。範囲 C6–C#8 は実音のクロタルの音域と一致する

楽器ごとの、鳴る鍵の全体の範囲（全奏法の合併。ハーモニクスを含むので実音域より広い）:

| 楽器 | 範囲 | 楽器 | 範囲 |
| --- | --- | --- | --- |
| Piccolo | D5–C8 | Horn / Horns a4 | A1–F#5 |
| Flute / Flutes a3 | B3–D7 | Trumpet / Trumpets a2 | E3–D6 |
| Bass Flute | C3–C6 | Tenor Trombone(s) | G1–D5 |
| Oboe / Oboes a3 | A3–G6 | Bass Trombones a2 | E1–G4 |
| Cor Anglais | E3–C6 | Contrabass Trombone | E1–G4 |
| Clarinet / Clarinets a3 | D3–F6 | Tuba | D1–E4 |
| Bass Clarinet | Bb1–E5 | Contrabass Tuba | A0–C4 |
| Contrabass Clarinet | Bb0–C4 | Cimbasso | E1–E4 |
| Bassoon / Bassoons a3 | Bb1–D5 | Timpani | C3–D5 |
| Contrabassoon | Bb0–Bb3 | Harp | C1–Ab7 |
| Violins 1・2（Leader 含む） | G3–C#8 | Celeste | C3–E8 |
| Violas / Viola Leader | C3–Ab7 | Glockenspiel | F5–C8 |
| Celli / Celli Leader | C2–F#7 | Xylophone | F4–C8 |
| Basses / Bass Leader | C1–F#5 | Marimba | C2–C7 |
| Crotales | C6–C#8 | Vibraphone | F3–F6 |
| Tubular bells | C#4–G5 | | |

`[実測]` 読み込み待ちは、16 インスタンス同時で 25 秒あれば足りた。

## 8. BBC SO にないもの

`[文献]` マニュアルの一覧と、`[実測]` パッチ一覧から。

- 楽器: アルトフルート（バスフルートはある）、E♭ クラリネット、ピアノは簡易版（Discover Piano）のみ、
  トムトム、テンプルブロック、ボンゴ・コンガ類、ラチェット、ウィップ、ブレーキドラム、サンダーシート
- 奏法: グリッサンドの指定、重音、キーノイズ、息音、スラップタンギング、音高を指定したハーモニクス
  （弦のハーモニクスは「Long Harmonics / Short Harmonics」のみ）、molto sul pont.・スクラッチ・弓圧、
  リーダー（ソロ）の sul pont. 持続とトレモロ sul pont.
