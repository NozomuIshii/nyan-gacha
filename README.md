# にゃん国志 ガチャシミュレーター

React + Vite。排出率・十連保証・天井を設定して回せるガチャシミュレーター。

## 開発

    npm install
    npm run dev      # http://localhost:5173

## ビルド

    npm run build    # dist/ が生成される
    npm run preview  # ビルド結果をローカル確認

`dist/` の中身をそのままサーバーへアップロードする。
`vite.config.js` の base は "./" にしてあるので、サブディレクトリ配下でも動く。

## 画像

`public/images/` に置く。ビルド時 `dist/images/` へそのままコピーされる。
ファイル名は src/NyanGachaSimulator.jsx の FILES 配列の第2要素と一致させる。

24体分すべて配置済み。

読み込みに失敗した画像はダミーのSVGにフォールバックするため、画面は壊れない。

## 主な設定箇所

src/NyanGachaSimulator.jsx 冒頭:

    USE_IMAGES  実画像を使うか
    IMG_BASE    画像ディレクトリ
    IMG_EXT     拡張子（.webp / .png）
    HERO_IMG    ファーストビュー背景。空ならCSSで描画

演出の尺は useEffect 内の wait（R:1300 / SR:2200 / SSR:2800 ミリ秒）。
SRで「激しい揺れ」が出る確率は handleTap 内の Math.random() < 0.5。

## 統計の永続化

現状は state のみでリロードすると消える。残す場合は stats と設定を
localStorage へ保存する処理を追加する。
