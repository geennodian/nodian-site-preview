import json, sys
ALT = json.load(open(sys.argv[1], encoding='utf-8')) if len(sys.argv) > 1 else {}
alt = lambda k, d: ALT.get(k, d)
def img(name, a, sizes, cls='', eager=False):
    load = 'fetchpriority="high" decoding="sync"' if eager else 'loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ''
    return (f'<img{c} src="img/{name}-1536.webp" srcset="img/{name}-800.webp 800w, img/{name}-1536.webp 1536w" '
            f'sizes="{sizes}" width="1536" height="1024" alt="{a}" {load}>')
def device(n, label):
    return f'''<div class="device">
          <div class="device__bar" aria-hidden="true"><span>9:41</span><i></i><b></b></div>
          <video muted loop playsinline preload="none" poster="img/poster-{n}.jpg" data-src="video/{n}.mp4" aria-label="{label}"></video>
        </div>
        <button class="vbtn" type="button" aria-label="映像を一時停止" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="i-pause" d="M7 5h4v14H7zM13 5h4v14h-4z"/><path class="i-play" d="M8 5v14l11-7z"/></svg></button>'''
FAQ = [
 ('利用者に料金はかかりますか？', 'アプリの利用は原則無料です。レンタサイクルの料金など、導入先が設定する利用料は別途かかる場合があります。'),
 ('対応している言語は？', '日本語と英語に対応しています。コース情報も音声ガイドも、選んだ言語で楽しめます。中国語・スペイン語・韓国語も順次拡大を予定しています。'),
 ('どのような資料があれば導入できますか？', 'スポットの名称や所在地、写真、パンフレット、案内板の文面など、お手元にあるもので構いません。形式は問いません。解説の原稿や音声、クイズは、それらの資料をもとに制作します。'),
 ('AIガイドは何をもとに答えますか？', '地域が用意した資料を参照して、回答の根拠にします。不適切な質問には答えない安全チェックも備えています。'),
 ('いま使っている自転車でも導入できますか？', 'スマートロックは既存の車両にも取り付けできます。レンタサイクル連携は導入準備中のため、提供時期はご相談ください。'),
 ('導入にはどのくらいかかりますか？', 'アプリのコンテンツ制作にかかる期間は、コースとスポットの数によって変わります。導入の規模に合わせて、お打ち合わせでご案内します。'),
]
faq_html = '\n'.join(f'      <details class="rv"><summary>{q}</summary><p>{a}</p></details>' for q, a in FAQ)
ld = [
 {"@context":"https://schema.org","@type":"SoftwareApplication","name":"nexpot","url":"https://nodi-an.com/nexpot/","applicationCategory":"TravelApplication","operatingSystem":"iOS, Android",
  "description":"コース案内、スポットの音声ガイド、AIへの質問、クイズをひとつにした、自転車の観光ガイドアプリ。",
  "publisher":{"@type":"Organization","name":"株式会社NODIAN","url":"https://nodi-an.com/"}},
 {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in FAQ]},
]
html = f'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>nexpot | 自転車の旅を、スマホひとつで。AI観光サイクルガイド</title>
<meta name="description" content="nexpot（ネクスポット）は、コース案内、スポットの音声ガイド、AIへの質問、クイズをひとつにした、自転車の観光ガイドアプリです。自治体・観光事業者のみなさまの導入のご相談も受け付けています。">
<link rel="canonical" href="https://nodi-an.com/nexpot/">
<meta property="og:title" content="nexpot | 知らない道を、走りたくなる。">
<meta property="og:description" content="コース案内、音声ガイド、AIへの質問。自転車の旅を、スマホひとつで。">
<meta property="og:type" content="website">
<meta property="og:url" content="https://nodi-an.com/nexpot/">
<meta property="og:image" content="https://nodi-an.com/nexpot/img/og.jpg">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0F3A44">
<link rel="icon" href="img/favicon-48.png" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="image" href="img/hero-1536.webp" imagesrcset="img/hero-800.webp 800w, img/hero-1536.webp 1536w" imagesizes="100vw" fetchpriority="high">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="nexpot.css">
<script>document.documentElement.classList.add('js');</script>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<a class="skip" href="#main">本文へ移動</a>

<header class="hd" id="hd">
  <a class="hd__logo" href="./" aria-label="nexpot トップへ">
    <img class="on-dark" src="img/logo-mark-white.svg" alt="nexpot" width="104" height="38">
    <img class="on-light" src="img/logo-mark.svg" alt="" width="104" height="38">
  </a>
  <nav class="hd__nav" aria-label="ページ内">
    <a href="#features">機能</a>
    <a href="#region">地域のみなさまへ</a>
    <a href="#flow">導入の流れ</a>
    <a href="#faq">よくある質問</a>
    <a class="hd__cta" href="../#contact_form">導入の相談</a>
  </nav>
</header>

<main id="main">
  <section class="hero">
    {img('hero', alt('hero','緑の山あいを縫う道を走るサイクリスト'), '100vw', 'hero__img', True)}
    <div class="hero__in">
      <p class="eyebrow">AI観光サイクルガイド</p>
      <h1>知らない道を、<br>走りたくなる。</h1>
      <p class="hero__lead">コース案内、音声ガイド、AIへの質問、クイズ。<br class="pc">自転車の旅に必要なものを、スマートフォンひとつに。</p>
      <div class="hero__btns">
        <a class="btn btn--primary" href="#features">機能を見る</a>
        <a class="btn btn--ghost" href="../#contact_form">導入の相談</a>
      </div>
    </div>
  </section>

  <section class="intro">
    <h2 class="rv">スマートフォンが、<br>地域を知り尽くしたガイドに。</h2>
    <p class="rv">コースを選んで走り出すだけで、スポットの解説が流れ、気になったことはその場で聞ける。nexpotは、自転車で地域をめぐる人のための観光ガイドアプリです。</p>
  </section>

  <section class="fts" id="features" aria-label="主な機能">
    <article class="ft rv">
      <figure class="ft__media">
        {img('ride', alt('ride','田園の道を走る自転車のハンドル越しの景色'), '(max-width: 860px) 100vw, 56vw', 'ft__photo')}
        {device('nav','nexpotのナビ画面。地図上のルートに沿ってスポットを案内している')}
      </figure>
      <div class="ft__text">
        <p class="eyebrow">NAVIGATION</p>
        <h3>迷わず、奥まで。</h3>
        <p>歴史・自然・グルメなどからコースを選ぶと、地図のナビがスポットを順番に案内します。到着は自動で検知し、次の目的地へつなぎます。</p>
        <ul><li>エリアに合わせたコース表示</li><li>周辺スポットの表示</li><li>お気に入りに保存</li></ul>
      </div>
    </article>

    <article class="ft ft--flip rv">
      <figure class="ft__media">
        {img('town', alt('town','海辺の小さな町を自転車で走る二人'), '(max-width: 860px) 100vw, 56vw', 'ft__photo')}
        {device('audio','nexpotの音声ガイド画面。解説音声を再生している')}
      </figure>
      <div class="ft__text">
        <p class="eyebrow">AUDIO GUIDE</p>
        <h3>近づくと、語りだす。</h3>
        <p>スポットの範囲に入ると、解説音声が自動で再生されます。スマートフォンを操作しなくても、その場所の話が始まります。</p>
        <ul><li>男性・女性の声を選べる</li><li>再生速度は0.75〜1.5倍</li><li>ナビの音声と重ならないよう調整</li></ul>
      </div>
    </article>

    <article class="ft rv">
      <figure class="ft__media">
        {img('lake', alt('lake','湖畔で自転車を止めてスマートフォンを見る人'), '(max-width: 860px) 100vw, 56vw', 'ft__photo')}
        {device('ai','nexpotのAIガイド画面。質問にAIが答えている')}
      </figure>
      <div class="ft__text">
        <p class="eyebrow">AI GUIDE</p>
        <h3>気になったら、<br>その場で聞く。</h3>
        <p>声でも文字でも質問できます。地域の資料をもとに、AIがガイドのように、音声と文字で答えます。</p>
        <ul><li>声と文字で質問</li><li>地域の資料をもとに回答</li><li>不適切な質問には答えない安全チェック</li></ul>
      </div>
    </article>
    <p class="fts__note">映像はアプリの開発中の画面です。</p>
  </section>

  <section class="band">
    {img('coast', alt('coast','島々の浮かぶ海沿いの道を走るサイクリスト'), '100vw', 'band__img')}
  </section>

  <section class="more">
    <h2 class="rv">走ったあとまで、楽しい。</h2>
    <ul class="more__grid">
      <li class="rv"><h3>スポットクイズ</h3><p>訪れた場所にちなんだ3択クイズ。解説つきで理解が深まります。</p></li>
      <li class="rv"><h3>特典コード</h3><p>クイズに正解すると、特典コードがもらえます。</p></li>
      <li class="rv"><h3>完走記録</h3><p>距離、時間、訪れたスポットを記録し、コースを5段階で評価できます。</p></li>
      <li class="rv"><h3>旅の統計</h3><p>累計の走行距離や完走数、クイズの正答率を見返せます。</p></li>
      <li class="rv"><h3>日本語・English</h3><p>コース情報も音声ガイドも、選んだ言語で楽しめます。</p></li>
      <li class="rv"><h3>電波が弱くても</h3><p>通信に失敗しても、ワンタップで再試行できます。</p></li>
    </ul>
    <p class="more__note">iPhone・Androidに対応予定。アプリは現在、公開に向けて準備を進めています。</p>
  </section>

  <section class="region" id="region">
    <div class="region__in">
      <div class="region__head rv">
        <p class="eyebrow">FOR REGIONS</p>
        <h2>地域の資料が、<br>そのまま走れるガイドに。</h2>
        <p>自治体・観光事業者のみなさまと、その土地ならではのコースをつくります。電動アシスト自転車の導入やメンテナンスも、あわせてご相談いただけます。</p>
      </div>
      <figure class="region__photo rv"><img src="img/bikes.webp" alt="並んだ電動アシスト自転車" width="1157" height="641" loading="lazy" decoding="async"></figure>
      <ul class="region__grid">
        <li class="rv"><h3>資料からガイドをつくる</h3><p>地域が用意した資料をもとにAIが回答。クイズも資料から作成するので、問題づくりの負担はありません。</p></li>
        <li class="rv"><h3>回遊の動きが見える</h3><p>訪れたスポット、完走したコース、AIへの質問を、個人を特定しない統計データとして活用できます。</p></li>
        <li class="rv"><h3>訪日のお客さまにも</h3><p>日本語と英語に対応。中国語・スペイン語・韓国語も順次拡大を予定しています。</p></li>
        <li class="rv"><h3>レンタサイクルと連携<em>導入準備中</em></h3><p>スマートロックと連携し、QRコードで解錠。既存の車両にも取り付けできます。</p></li>
      </ul>
    </div>
  </section>

  <section class="flow" id="flow">
    <div class="flow__in">
      <div class="flow__head rv">
        <p class="eyebrow">HOW TO START</p>
        <h2>導入の流れ</h2>
        <p>解説の原稿や音声、クイズは、いまある観光資料をもとに制作します。ご用意いただくものは、お手元にあるもので構いません。</p>
      </div>
      <ol class="flow__steps">
        <li class="rv"><h3>ヒアリング・設計</h3><p>周遊コースとスポットを一緒に設計します。</p></li>
        <li class="rv"><h3>素材のご提供</h3><p>スポット情報、写真、パンフレットなどをご提供いただきます。</p></li>
        <li class="rv"><h3>コンテンツ制作</h3><p>解説原稿と英語版、AI音声、クイズを制作します。</p></li>
        <li class="rv"><h3>テスト走行・公開</h3><p>実際に走って調整し、アプリで公開します。</p></li>
      </ol>
    </div>
  </section>

  <section class="faq" id="faq">
    <h2 class="rv">よくある質問</h2>
    <div class="faq__list">
{faq_html}
    </div>
  </section>

  <section class="end" id="end">
    {img('dusk', alt('dusk','夕暮れの湖畔の道を走るサイクリスト'), '100vw', 'end__img')}
    <div class="end__in rv">
      <h2>あなたの地域を、<br>走りたくなる場所に。</h2>
      <p>コースづくりのご相談から、お気軽にどうぞ。</p>
      <a class="btn btn--primary" href="../#contact_form">導入について相談する</a>
    </div>
  </section>
</main>

<footer class="ft-site">
  <div class="ft-site__top">
    <a href="./" aria-label="nexpot トップへ"><img src="img/logo-mark-white.svg" alt="nexpot" width="88" height="32" loading="lazy"></a>
    <nav aria-label="フッター">
      <a href="#features">機能</a>
      <a href="#region">地域のみなさまへ</a>
      <a href="#flow">導入の流れ</a>
      <a href="#faq">よくある質問</a>
      <a href="../#contact_form">お問い合わせ</a>
      <a href="../">運営会社</a>
    </nav>
  </div>
  <p>nexpotは、株式会社NODIANのサービスです。風景の画像はAIで生成したイメージです。アプリの映像は開発中の画面です。</p>
  <p class="ft-site__c">© 2026 NODIAN, K.K.</p>
</footer>

<script src="js/main.js" defer></script>
</body>
</html>
'''
open('index.html', 'w', encoding='utf-8').write(html)
print('html ok')
