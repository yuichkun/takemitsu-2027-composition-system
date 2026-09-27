# 調査 — オーケストラ音源の選定

調査日: 2026-08-31 〜 2026-09-01

確度の記号は [`../README.md`](../README.md) の「3. 調査ノート」にある。
`[文献]` 出典が言っていること / `[実測]` 自分で確認した / `[導出]` 計算 / `[推測]` 根拠のない見込み

音源は BBC Symphony Orchestra Professional に決まった（[`../decisions/0012`](../decisions/0012-bbcso-with-user-samples.md)）。
実機での調査は [`bbcso.md`](./bbcso.md)。**BBC SO はピッチベンドを無視する**ので、§1 の結論は BBC SO には当てはまらない
（[`../decisions/0013`](../decisions/0013-quarter-tones-by-instance-tuning.md)）。
第一条件は**四分音を出せること**（[`../decisions/0008`](../decisions/0008-quarter-tone-native.md)）。

---

## 1. ★最重要の結論 — すべての道がピッチベンドに収束する

**四分音を出す手段として、実用になるネイティブなチューニング機構を持つオーケストラ音源は存在しない。**
調べた全製品が、結局は**ノートごとのピッチベンド**に落ちる。

### なぜ「内蔵マイクロチューニング」が使えないか

`[文献]` SWAM と Sample Modeling はどちらも「Microtuning」機能を持つが、
**構造が12ピッチクラス（音名）単位で、オクターブ反復する**。

SWAM Solo Strings v3.8.0 マニュアル p.39:
> 「by pressing the E1 key switch detuning will be applied to **all E notes**」

Sample Modeling も同じ構造で、GUI の列は `C Db D Eb E F Gb G Ab A Bb B` の12列。

`[導出]` **この構造では、同一オクターブ内に C と C↑（四分音上げ）を併存させられない。**
どちらの機能も「E と B を -50 セントするアラブ・マカーム」用途に設計されており
（Sample Modeling は Rast / Husseini / Sigah / Saba / Bayati / Garib Higaz を工場プリセットで同梱）、
24音を必要とする現代音楽の四分音書法には原理的に使えない。

### MTS-ESP も答えにならない

`[文献]` ODDSound MTS-ESP Suite の公式ページ（https://oddsound.com/mtsespsuite.php）:
> 「Retune any plugin or MIDI device with either MTS-ESP, **MPE, MTS SysEx or MIDI pitch bend**.」

`[導出]` **ネイティブ非対応のプラグインに対しては、MTS-ESP 自身がピッチベンドに落としている。**
本システムは MIDI を自前で生成するので、MTS-ESP を挟む意味がない。
挟まないほうが、ベンドレンジを四分音用に最適化できる分だけ分解能で有利になる。

### 記譜ソフト経由の道も閉じている

`[文献]` Steinberg フォーラムで Dorico チームが明言（https://forums.steinberg.net/t/virtual-instruments-and-microtones/145938）:
Dorico の微分音メッセージ（VST3 Note Expression）に対応するのは
**NotePerformer / HALion / Pianoteq のみ**。
**Kontakt、Spitfire、Orchestral Tools、VSL は非対応。**

`[文献]` 同フォーラム、Daniel Spreadbury（Steinberg）:
> 「MIDI pitch bend has the other major disadvantage of being a **channel-wide message**,
> so it cannot practically be used for any polyphonic instrument.」

### NotePerformer — 設計は理想的だが、使えない

`[文献]` NotePerformer は **CC102 でノート単位・セント単位のデチューン**を持つ。
公式サポートページ: 「Range: X=1...64...127 (**-63 cents ... 0 cents ... +63 cents**)」
これは今回調べた中で最も筋の良い微分音制御設計。

`[文献]` **しかし記譜ソフト以外のホストにロードできない。**
Steinberg スタッフ Ulf（2025-06-26, https://forums.steinberg.net/t/now-i-have-noteperformer-5/997150）:
> 「NotePerformer will appear in the list of available VSTinstrument plug-ins in Cubase,
> but **it will fail while trying to load it in**.」

`[文献]` バイナリ自体は標準の VST3 として `/Library/Audio/Plug-ins/VST3` に入る。
つまりホストを判別して意図的に弾いている。回避手段なし。
NPPE の第三者 VST3 ホスティングも NotePerformer 5 で廃止された。

### → 設計上の帰結

`[導出]` **音源の選定と、ホストおよび MIDI 射影の設計は、切り離せる。**
どの音源を選んでも実装は「ノートごとのピッチベンド + 1声部1MIDIチャンネル」になる。
決定は [`../decisions/0010`](../decisions/0010-pitch-bend-quarter-tones.md)。

これは日程上の朗報で、**音源が決まる前にホストの実装を始められる。**

---

## 2. SWAM（Audio Modeling）— 物理モデリング

### 基本情報

`[文献]` 全ファミリーが **v3.12.1（2026-05-14）**。永続ライセンス、サブスクなし、**iLok 不要**。

| 製品 | 価格（2026-08-31 観測） |
| --- | --- |
| SWAM Solo Strings 3 バンドル | **$339**（定価 $396） |
| SWAM Solo Woodwinds 3 バンドル | **$699**（定価 $896） |
| SWAM Solo Brass バンドル | **$599**（定価 $747） |
| SWAM Violin 単体 | **$99** |
| SWAM String Sections | $499 |
| PolySWAM（2026年9月中旬 正式リリース予定） | 先行 $279 |

出典: https://audiomodeling.com/bundles/swam-solo-strings ほか各製品ページ

### 四分音: ピッチベンドで解決する。しかも条件が良い

`[文献]` 内蔵 Microtuning は12ピッチクラス制限で**使えない**（§1参照）。
`[文献]` 一方、Pitch Bend Up / Down が半音単位で個別設定可能。
マニュアルに「set Pitch Bend range to **48 semitones**」で最低音から最高音まで
**ジャンプなしで**ベンドできる例が載っている。

`[文献]` **サンプル再生ではない**ため移調由来のフォルマント崩れが原理的に起きない:
> 「The sound is **not produced by playing back samples**, using pre-recorded articulations」

`[文献]` **ソロ楽器はモノフォニック。** Roger Linn Design の公式ページ:
> 「These instruments are **not actually MPE-compatible because they are solo (monophonic) instruments**」

`[導出]` **モノフォニックであることが四分音にとって決定的に有利。**
同時に1音しか鳴らないので、ノートオンの直前にピッチベンドを1個置けばそのノートの高さが確定する。
MPE もチャンネル割り当てのパズルも要らない。

`[導出]` ベンドレンジは**±2半音程度に絞るべき**。48半音だと 0.7セント/step だが、
±2半音なら約 **0.03セント/step** で分解能が桁違いに細かい。

### プログラム制御との相性: 極めて良い

`[文献]` **キースイッチで制御する全パラメータが CC / アフタータッチ / NRPN でも制御できる。**
Brass マニュアル:
> 「All parameters controlled by the Key Switches can be controlled by
> **MIDI Control Change, Aftertouch and NRPN messages as well**」

`[導出]` → キースイッチを使わずに済み、ノート番号空間を汚さない。

`[文献]` `CC-HIRES`（MSB+LSB の14bit、16384段階）を受け付ける。
`[導出]` → CC11 を7bitで書くとダイナミクスが128段階しかないが、14bitなら階段が出ない。

`[文献]` フラッタータンギングが discrete スイッチではなく**連続の intensity パラメータ**。

`[文献]` **Expression（既定 CC11）を連続的に動かさないと音が出ない**（仕様）:
> 「WITHOUT SUCH A CONTROLLER, THE INSTRUMENT WILL NOT WORK」

`[推測]` これは手弾きでは負担だが、プログラム生成なら包絡を自動生成する処理を一度書けば済むので、
むしろ本システムに有利。

### 弱点

`[文献]` **ソロ楽器のみ。** セクションは重ねる必要があり、公式が位相問題を認めている:
> 「Phasing occurs when identical instruments play together」

公式の緩和策: Ambiente で配置をずらす / 異なる Instrument Body を選ぶ /
Unison Anti-Phasing / **divisi にする**。
加えて `Random Bow Amount` / `Random Finger`（左手位置＝ピッチのランダム化）/ `Vibrato Rate Rand` がある。

`[推測]` 四分音のセクションを書くなら各奏者に個別のピッチを与えたいはずなので、
この「ユニゾンで積むな、divisi にしろ」という制約は本作では実質的な問題にならない可能性がある。

`[文献]` **`[要検証]` v3.11.0（2025-12-16）で認証方式が変わった。**
> 「New centralized authorization system... Login and logout are now handled through the
> **Audio Modeling Software Center**」
> 「Added **Core Assistant: a background service** that centralizes licensing, activation,
> and communication with Audio Modeling Software Center」

`[推測]` **これがヘッドレス運用で唯一の実質的リスク。**
Core Assistant がプラグイン起動時に常駐を要求するか、ネット接続を要求するかは公式に記載がない。
**15日トライアルで最優先に検証すべき項目。**

`[文献]` SWAM インスタンス同士は **UDP マルチキャスト 224.0.0.173:9001** で相互通信し、
マニュアルは「providing local network permission... is **mandatory**」と書いている。

`[文献]` v3.12.0 で 48kHz超のサンプルレートに対応。→ 96kHz でレンダするなら v3.12 以降必須。

---

## 3. Sample Modeling — クロマチックサンプル + 適応モデル（Kontakt）

`[文献]` 会社は稼働中。2026-06-12 のニュースで **Brass v4.0 が最終開発段階**と明言。
商業的権利は創業者から Cristian Labelli に移っている。

| 製品 | 価格 |
| --- | --- |
| Brass Bundle v3 | **€399 + VAT** |
| Solo Strings Bundle | €299 + VAT |
| Solo, Chamber & Ensemble Strings | €449 + VAT |
| Complete Bundle | €699 + VAT |

`[文献]` **フル Kontakt 不要。無料の Kontakt Player 7.10 以上で動く。** これは利点。
`[文献]` Kontakt 8 Player は **VST3 ネイティブ**（VST2 非対応）。

### 四分音

`[文献]` Brass はピッチベンドが **±3半音固定、変更不可**。Strings は変更可能（既定±1半音）。
`[導出]` ±3半音でも 14bit で約 **27 LSB/cent**。分解能は問題ない。

### ★見落としやすい落とし穴

`[文献]` **既定のCC設定が意図的にピッチを揺らす。** 四分音の精度を出すには明示的に潰す必要がある。

| CC | 機能 | 既定 |
| --- | --- | --- |
| CC28 | random detune（「the average pitch often departs from the tempered scale」） | 64 |
| CC32 | pitch fluctuation | 64 |
| CC24 | dynamics-to-pitch modulation | 64 |
| CC20 | note-on pitch-modulation depth | 64 |

`[文献]` **バッファサイズ 256 か 512 に固定する必要がある。**
FAQ が明言し、**バウンス時も同じだと書いている**:
> 「buffer size larger than 512 may lead to unwanted side effects」
> 「Make sure that the buffer size is set to 256 or 512 samples also for **mixing/bouncing**」

`[導出]` **これはヘッドレスホストの設計に直撃する。** オフラインレンダは大きいブロックを使いがち。
どの音源を選ぶにせよ、**ホストのブロックサイズは設定可能にしておくべき。**

`[推測]` `[要検証]` **ピッチベンドがエンジン内部でも使われている**
（ポルタメント、half-valve グリッサンド、shake、falls、doits）。
静的な微分音オフセットとして PB を占有したとき、内部のピッチ生成と加算されるのか上書きされるのかは
ドキュメントに記載がない。採用するなら最優先の検証項目。

`[文献]` Brass はアーティキュレーションが CC 駆動（ミュート CC100、growl CC21、flutter CC23）で良い。
**ただし Strings はキースイッチ方式**（tremolo, pizz, col legno, harmonics）。

---

## 4. Aaron Venture Infinite Series

`[文献]` Infinite Brass v1.6 / Infinite Woodwinds v2.0。**$299 each、バンドル $499。**
**Infinite Strings と Infinite Percussion は未発売（coming soon、日付なし）。**

`[文献]` **キースイッチが一切ない。全部連続CC。レガートはノートの重なりで発生。**
`[導出]` プログラム生成MIDIとの相性という一点では、調べた中で最良の設計。

`[文献]` **フル Kontakt 必須**（Player 不可）。
`[文献]` クロマチックサンプリング。`[導出]` ±50セント＝再生レート 2.93% 変化。劣化はほぼ無視できる。

`[文献]` ★**CC33「Pitch Accuracy」は意図的にピッチを外すヒューマナイズ**で、
外れた音を「0.5〜1.0秒かけて補正」する。四分音では致命的。最大値に固定する必要がある。
`[文献]` CC95〜120 は内部予約。

`[文献]` Kontakt 脱却プロジェクトが進行中。CLAP を直接実装して VST3 にラップする方式。
新機能に「**Native microtuning with support for various tuning systems**」が挙がっている。
`[推測]` ただし公式アナウンスは「Soon™」のままで、2026年4月時点でも未リリース。
native版が出ると Kontakt 版は購入不可になる。

`[導出]` **弦がないため、これ単体でオーケストラは書けない。**

---

## 5. Spitfire Audio — 特殊奏法と打楽器の答え

`[文献]` 2025年4月に **Splice が Spitfire を買収**。
`[文献]` **旧 Symphonic レンジは全部ディスコン**（Symphonic Strings / Woodwinds / Brass /
Spitfire Percussion / Orchestral Grand）。公式FAQに明記。

`[文献]` 微分音のネイティブ対応はなし（§1の Dorico 非対応リストに含まれる）。
`[導出]` サンプルのセクション音を ±50セント動かすことになるので、四分音の主力にはできない。

### ただし、特殊奏法と打楽器では他に代えがない

| 製品 | 価格 | 内容 |
| --- | --- | --- |
| **London Contemporary Orchestra Strings** | **$349** | **現代音楽用に作られた唯一の特殊奏法弦ライブラリ。**spectral scrubs, molto sul pont, **slackened**, **tailpiece**, **twitchy**, detuned open, **super pont scrapes**, granular tremolo, harmonics, percussive pizzicato |
| **Spitfire Symphonic Extras** | **$99** | **Scraped Percussion 45+奏法**（bicycle wheel 弓/鋸歯/strum、cymbals 弓/鋸歯/**superball**、glass 弓/scrape、icebell、**saw blade**、tamtam 各種）+ **waterphone** + **bowed aluphone** + plucked piano。旧Symphonicレンジで**唯一の生き残り** |
| **Abbey Road Orchestra: Metal Percussion** | $449 | 58楽器 **409奏法**。struck (sticks/mallets/hammers/dreads/rods), **bowed, scraped, brushed, superball drags, hands, col legno**。Tam Tams, Thundersheet, Anvils, Brake Drums, **Waterphone**, Spring Coil, Chains |
| LCO Textures | $299 | 32のテクスチュア、100+奏法 |
| Spitfire Chamber Strings Professional | $999 | 244奏法。sul pont/tasto, col legno, **Bartók pizz**, ricochet |
| Lea Bertucci — Xtended Vox / Acoustic Shadows | $29 each | **multiphonics, tongue rolls, glottal, Shepard tones, whistle-tone glissandi** |

`[文献]` **注意: Abbey Road Orchestra の「Extended」は拡張奏法ではなく拡張レガート**を意味する。
また ARO には**金管モジュールが存在しない**。

---

## 6. `[要検証]` 未調査のまま残ったもの

- **VSL（Vienna Symphonic Library）** — 担当エージェントがレート上限で落ち、
  その後 JS シェルのためページ取得もできなかった。
  「VSL が MTS-ESP に対応している」という未検証の情報が出ているが**確認できていない**。
  VSL は歴史的に最も奏法数の多いライブラリなので、**調査を再開する価値がある。**
- **Orchestral Tools（SINE Player / Berlin Series）** — 同上の理由で未調査。
- 各音源の実音での ±50セント検証（実機のみ）
- SWAM String Sections で奏者ごとに個別ピッチを与えられるか
- Kontakt を GUI なしでインスタンス化して .nki をロードできるか
  （`[推測]` 一度 GUI で読み込んで state を保存し、以後 setState で復元する運用になる可能性が高い）

---

## 7. 推薦（`[推測]` — 上記事実からの僕の判断）

**四分音は物理モデリング系、特殊奏法と打楽器はサンプル系**という分業を推す。
両者は排他ではなく、**打楽器は四分音を必要としない**ので競合しない。

| 役割 | 製品 | 価格 | 理由 |
| --- | --- | --- | --- |
| **音高のある楽器の主力** | SWAM Solo Strings / Woodwinds / Brass | $339 / $699 / $599 | 四分音がサンプル伸縮なしで出る。モノフォニックなのでピッチベンドが素直。全奏法がCC/NRPNで叩ける |
| **打楽器** | Spitfire Symphonic Extras | **$99** | 現代音楽の打楽器語彙（弓、superball、scrape、waterphone）を最安で覆う。四分音と無関係なのでサンプルで問題ない |
| **弦の特殊奏法の色** | LCO Strings | $349 | SWAM に出せない spectral scrubs / slackened / tailpiece を足す |
| 打楽器を厚くするなら | ARO Metal Percussion | $449 | 409奏法。予算が許すなら |

**買う前に必ず15日トライアルで検証する4点**（優先順）:

1. **ヘッドレス VST3 ホストで Core Assistant / Software Center 依存が邪魔しないか。**
   ネットを切った状態でレンダできるか。**これが通らなければ SWAM の採用は崩れる**
2. ピッチベンドで作った四分音の音色が、弦・木管・金管それぞれで許容できるか
   （`[文献]` 金管ではピッチベンドが**リップテンションの変化**としてモデル化される。
   実は物理的に正しいが、正規の運指音とは音色が僅かに違う）
3. String Sections で奏者ごとに個別ピッチを与えられるか
4. ホストのブロックサイズを 256/512 に固定した状態でのレンダリング速度

**設計上の申し送り**（音源によらず効く）:

- ベンドレンジは狭くする（±2半音で 0.03セント/step）
- Expression は 14bit（CC-HIRES）で書く
- キースイッチを使わず、奏法は CC / NRPN にマップする
- **ホストのブロックサイズは設定可能にする**（Sample Modeling は 256/512 必須）
- 音源が持つ「意図的なピッチ揺らし」を全部無効化する
  （SWAM: なし / Sample Modeling: CC28,32,24,20 / Aaron Venture: CC33 を最大）
