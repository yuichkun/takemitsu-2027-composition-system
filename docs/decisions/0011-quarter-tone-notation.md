# 0011. 四分音の記譜は Sibelius 標準の記号とし、MusicXML では小数の alter で渡す

- 状態: 採用
- 関係する論点: Q12 / R12

## 背景

四分音を Sibelius にどう渡すかが記譜側の最大のリスクだった（[0008](./0008-quarter-tone-native.md)）。
取り込みテスト（[`../research/sibelius-musicxml-import.md`](../research/sibelius-musicxml-import.md) 2.5節）で、
Sibelius 24.3.1 の取り込み器は `<alter>` の小数値（±0.5、±1.5）だけを見て音高を決め、
臨時記号を自分で描くことが分かった。`<accidental>` 要素は無視される。

## 選択肢

| 案 | 中身 | 効いてくること |
| --- | --- | --- |
| A. Stein-Zimmermann 系（Sibelius 標準の4記号） | MusicXML に `<alter>0.5</alter>` 等を書くだけ | 追加の仕組みが要らない。記号は Sibelius の既定に固定される |
| B. 矢印系 | 取り込みでは出ない。ManuScript で記号を置く | 記譜法を自由に選べる。全四分音にプラグインの後処理が要り、記号は音符に従属しない Symbol になる |

## 決定

A を採る。**四分音の記譜は Sibelius 標準の記号（quarter-sharp / quarter-flat / three-quarters-sharp / three-quarters-flat）で、
MusicXML 射影は音高を小数の `<alter>` で書く。** `<accidental>` 要素は付けても付けなくてもよい。

## 理由

- 実測で通ることが確定している唯一の経路
- 記号が音符の属性として入るので、Sibelius の臨時記号の規則（小節内の省略、注意的記号）がそのまま効く
- 余湖さんが「四分音はこれでいい」と確認した（2026-09-07）

## 結果と副作用

- 矢印系の記譜は使わない。使いたくなったら新しい決定を書く
- Sibelius 自身の書き出し方言（alter を半音に切り捨てて臨時記号要素で運ぶ）は使わない
- 移調楽器・小節内規則・持ち替えとの組み合わせは第2回テストで確認する（`qt-06b` / `qt-07b` / `inst-02`）
