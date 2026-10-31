// 動きは、ヘッダーの切り替え・セクションの表示・画面内の映像の再生だけに絞る
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hd = document.getElementById('hd');
  const onScroll = () => hd.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const reveal = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.rv').forEach(el => reveal.observe(el));

  // 映像は見えている間だけ再生する。止めるボタンを押したら、その映像は再生しない
  const load = v => { if (!v.src) v.src = v.dataset.src; };
  const player = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      load(v);
      if (!reduced && !v.dataset.held) v.play().catch(() => {});
    } else v.pause();
  }), { threshold: .35 });

  document.querySelectorAll('.ft__media').forEach(media => {
    const v = media.querySelector('video'), btn = media.querySelector('.vbtn');
    player.observe(v);
    const paint = () => {
      btn.setAttribute('aria-pressed', v.paused);
      btn.setAttribute('aria-label', v.paused ? '映像を再生' : '映像を一時停止');
    };
    v.addEventListener('play', paint);
    v.addEventListener('pause', paint);
    btn.addEventListener('click', () => {
      load(v);
      if (v.paused) { delete v.dataset.held; v.play().catch(() => {}); }
      else { v.dataset.held = '1'; v.pause(); }
    });
    if (reduced) { v.dataset.held = '1'; paint(); }
  });
})();
