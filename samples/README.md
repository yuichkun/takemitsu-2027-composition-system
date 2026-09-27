# samples — BBC SO にない音を足す場所

楽器 id（`src/instruments/catalog.ts`）のフォルダに音声ファイルを置くと、その楽器の再生に使われる。
BBC SO より優先される。

```
samples/
  ratchet/            ← 楽器 id
    ratchet-1.wav     ← 奏法を問わず使う
  suspended-cymbal/
    bowed/            ← 奏法 id のフォルダにすると、その奏法のときだけ使う
      bow.wav
```

- 形式は WAV（モノラルでもステレオでもよい、サンプルレートは問わない）
- 同じフォルダに複数あると、音符ごとに1つを選ぶ（同じ楽譜なら毎回同じものが選ばれる）
- 強弱は音量で近似する（mf で原音のまま、1 段階ごとに 6 dB）
- 音声ファイル自体は git に入らない
