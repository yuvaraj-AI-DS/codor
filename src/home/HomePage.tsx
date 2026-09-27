import { useEffect, useRef, useState } from 'react'
import crLogo from '../assets/cr-logo.png'
import crMark from '../assets/cr-mark.png'
import './home.css'

const EDITOR = '#/editor'

function Wordmark() {
  return <span className="h-wordmark"><span>CODOR</span><span className="h-untime">untime</span></span>
}

export function HomePage() {
  const heroRef = useRef<HTMLElement>(null)
  const [showFloat, setShowFloat] = useState(false)

  // Floating "Open Python Editor" button appears once the hero scrolls away
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setShowFloat(!e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="home">
      <div className="h-watermark" aria-hidden="true"><img src={crLogo} alt="" /></div>

      <nav className="h-nav" aria-label="Main">
        <div className="h-wrap">
          <button className="h-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src={crMark} alt="" /> CODOR
          </button>
          <div className="h-links">
            <button onClick={() => scrollTo('how')}>How it works</button>
            <button onClick={() => scrollTo('why')}>Why CODOR</button>
            <a className="h-btn h-btn-gold" href={EDITOR}>Python Editor</a>
          </div>
        </div>
      </nav>

      <main>
        <div className="h-wrap">
          <header className="h-hero" ref={heroRef}>
            <div className="h-eyebrow"><span className="h-dot" />Python 3 · runs in your browser</div>
            <h1><Wordmark /></h1>
            <p className="h-lede">Write Python and <strong>watch it run as you type</strong>. Errors are explained the moment they happen.</p>
            <div className="h-actions">
              <a className="h-btn h-btn-gold" href={EDITOR}>Open Python Editor</a>
              <button className="h-btn h-btn-line" onClick={() => scrollTo('how')}>See how it works</button>
            </div>
            <p className="h-hint">No install. No sign up. Your code never leaves the browser.</p>
            <div className="h-cue"><span />Scroll</div>
          </header>
        </div>

        <section id="how" className="h-section">
          <div className="h-wrap">
            <div className="h-head">
              <h2>No Run button. Every edit is tested.</h2>
              <p>CODORuntime re-executes your file a moment after you stop typing, so you always know whether the code in front of you works.</p>
            </div>
            <Preview />
            <ol className="h-flow">
              <li><b>01</b><h3>Write</h3><p>Type Python in a full Monaco editor with multiple files.</p></li>
              <li><b>02</b><h3>Run</h3><p>A short pause triggers execution with Pyodide — no button.</p></li>
              <li><b>03</b><h3>Verify</h3><p>Output, timing and status update live for every edit.</p></li>
              <li><b>04</b><h3>Explain</h3><p>If it breaks, Bob reads the traceback and says what went wrong.</p></li>
            </ol>
          </div>
        </section>

        <section id="why" className="h-section">
          <div className="h-wrap">
            <div className="h-head">
              <h2>Why CODOR?</h2>
              <p>Built for learning and quick checks — the feedback loop is the whole point.</p>
            </div>
            <div className="h-features">
              <div className="h-feat h-wide">
                <span className="h-tag">versions</span>
                <h3>Every file keeps its own history</h3>
                <p>Save a version in one click and roll back any time. A version is also saved automatically whenever you fix an error.</p>
                <ul>
                  <li><span>Fixed TypeError</span><span className="ok">✓</span></li>
                  <li><span>Version 2</span><span className="ok">✓</span></li>
                  <li><span>Version 1</span><span className="err">✕</span></li>
                </ul>
              </div>
              <div className="h-feat">
                <span className="h-tag">bob</span>
                <h3>Errors in plain English</h3>
                <p>Error type, line and a suggested fix, read straight from Python's own traceback.</p>
              </div>
              <div className="h-feat">
                <span className="h-tag">files</span>
                <h3>Real .py files</h3>
                <p>Import from your computer, save back as .py, or export every tab as a zip. Files can import each other.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="h-cta">
          <div className="h-wrap">
            <h2>Start writing Python.</h2>
            <p>The editor opens instantly in this tab.</p>
            <a className="h-btn h-btn-gold" href={EDITOR}>Open Python Editor</a>
          </div>
        </section>
      </main>

      <footer className="h-footer">
        <div className="h-wrap">
          <Wordmark />
          <span>Built by <b>thefours</b></span>
          <span className="h-right">© 2026 thefours</span>
        </div>
      </footer>

      <div className={`h-float${showFloat ? ' is-shown' : ''}`} aria-hidden={!showFloat}>
        <a className="h-btn h-btn-gold" href={EDITOR} tabIndex={showFloat ? 0 : -1}>
          <img src={crMark} alt="" /> Open Python Editor
        </a>
      </div>
    </div>
  )
}

// ── Animated editor preview: verified → error + Bob → fixed ──────────────

type Row = { html: string; hl?: boolean }
const OK: Row[] = [
  { html: '<span class="c"># average of scores</span>' },
  { html: '<span class="k">def</span> average(scores):' },
  { html: '    <span class="k">return</span> sum(scores) / len(scores)' },
  { html: '' },
  { html: 'marks = [<span class="n">82</span>, <span class="n">91</span>, <span class="n">77</span>]' },
  { html: '<span class="k">print</span>(<span class="s">"Average:"</span>, average(marks))' },
]
const BAD: Row[] = OK.map((r, i) =>
  i === 4 ? { html: 'marks = [<span class="n">82</span>, <span class="s">"91"</span>, <span class="n">77</span>]', hl: true } : r)

const STAGES = [
  { rows: OK, state: '● VERIFIED · 18 MS', err: false },
  { rows: BAD, state: '✕ TYPEERROR · LINE 3', err: true },
  { rows: OK, state: '✓ FIXED · 16 MS', err: false },
] as const

function Preview() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setStage(s => (s + 1) % STAGES.length), 3200)
    return () => clearInterval(id)
  }, [])

  const cur = STAGES[stage]
  return (
    <div className="h-preview" aria-label="Editor preview (animation)">
      <div className="pv-bar">
        <span className="pv-tab on"><i style={{ background: cur.err ? 'var(--err)' : 'var(--ok)' }} />main.py</span>
        <span className="pv-tab"><i style={{ background: 'var(--muted)' }} />utils.py</span>
        <span className={`pv-state${cur.err ? ' err' : ''}`}>{cur.state}</span>
      </div>
      <div className="pv-body">
        <div className="pv-code">
          {cur.rows.map((r, i) => (
            <div key={i} className={r.hl ? 'hl' : undefined}>
              <span className="ln">{i + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: r.html }} />
            </div>
          ))}
        </div>
        <div className="pv-side">
          <h4>Output</h4>
          <div className="pv-out">
            {cur.err
              ? <span className="err-text">TypeError: unsupported operand…</span>
              : 'Average: 83.33'}
          </div>
          <div className="pv-bob">
            <b>✦ Bob</b><br />
            {stage === 0 && 'Runtime is healthy.'}
            {stage === 1 && <><span className="e">TypeError · line 3</span><br /><code>+</code> can't combine an int with a str.</>}
            {stage === 2 && <><span className="ok">✓ Resolved TypeError</span><br />Re-verified clean.</>}
          </div>
        </div>
      </div>
    </div>
  )
}
