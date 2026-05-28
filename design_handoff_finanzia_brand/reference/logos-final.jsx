// logos-final.jsx — Sistema de marca finanzia.
// Marca elegida: Horizonte abierto (H2 de v5).
// 2 anillos huecos + disco central, único en su familia.

const PF = {
  // Brand purples — primary palette
  deepest: '#2D1370',
  deeper:  '#3B1781',
  deep:    '#4C1D95',
  mid:     '#6D28D9',
  base:    '#7C3AED',
  light:   '#A78BFA',
  pale:    '#DDD6FE',
  cream:   '#F2EDFF',

  // Neutrals
  ink:     '#15102A',
  graphite:'#3A2F58',
  muted:   '#8478A0',
  rule:    '#EFEAF7',
  paper:   '#FFFFFF',
  warmGrey:'#FAFAFC',
};

// ─── THE MARK ────────────────────────────────────────────
// Centered in viewBox (cy=140 brings the visual centerline ≈100).
// Params:
//   color: single-tone override → used for mono / inverse
//   accent: override for the inner disc only
const Horizonte = ({ size = 180, color, accent }) => {
  const ring = color || PF.base;
  const center = color ? color : (accent || PF.deep);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M 18 140 A 82 82 0 0 1 182 140 L 168 140 A 68 68 0 0 0 32 140 Z" fill={ring} />
      <path d="M 48 140 A 52 52 0 0 1 152 140 L 138 140 A 38 38 0 0 0 62 140 Z" fill={ring} />
      <path d="M 78 140 A 22 22 0 0 1 122 140 Z" fill={center} />
    </svg>
  );
};

// ─── WORDMARK ────────────────────────────────────────────
const Wordmark = ({ color = PF.ink, size = 40 }) => (
  <div style={{
    fontFamily: '"Sora", system-ui, sans-serif',
    fontWeight: 500, fontSize: size,
    letterSpacing: '-0.05em', color, lineHeight: 1,
  }}>finanzia</div>
);

// ─── Frame primitive ─────────────────────────────────────
const Frame = ({ children, bg = PF.paper, label, idx, labelColor }) => (
  <div style={{
    position: 'relative',
    width: '100%', height: '100%',
    background: bg, boxSizing: 'border-box',
    overflow: 'hidden',
  }}>
    {idx && (
      <div style={{
        position: 'absolute', top: 18, left: 20,
        fontFamily: '"Sora", system-ui, sans-serif',
        fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: labelColor || PF.muted, fontWeight: 500,
      }}>{idx}</div>
    )}
    {label && (
      <div style={{
        position: 'absolute', bottom: 18, left: 20,
        fontFamily: '"Sora", system-ui, sans-serif',
        fontSize: 10, letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: labelColor || PF.muted, fontWeight: 500,
      }}>{label}</div>
    )}
    {children}
  </div>
);

// ─── 1 · Hero (la marca completa) ────────────────────────
const HeroFinal = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 36,
    }}>
      <Horizonte size={220} />
      <Wordmark size={52} />
    </div>
  </Frame>
);

// ─── 2 · Símbolo aislado ─────────────────────────────────
const MarkOnly = ({ idx, label, color, accent, bg = PF.paper, dark }) => (
  <Frame bg={bg} labelColor={dark ? 'rgba(255,255,255,0.5)' : undefined} idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Horizonte size={220} color={color} accent={accent} />
    </div>
  </Frame>
);

// ─── 3 · Paleta ──────────────────────────────────────────
const Palette = ({ idx, label }) => {
  const swatches = [
    { name: 'Deepest',  hex: PF.deepest },
    { name: 'Deep',     hex: PF.deep,     role: 'Disco central' },
    { name: 'Base',     hex: PF.base,     role: 'Anillos' },
    { name: 'Light',    hex: PF.light },
    { name: 'Pale',     hex: PF.pale },
    { name: 'Ink',      hex: PF.ink,      role: 'Texto' },
  ];
  return (
    <Frame idx={idx} label={label}>
      <div style={{
        padding: '64px 40px 40px',
        height: '100%', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {swatches.map((s) => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 18,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 8,
              background: s.hex,
              flex: '0 0 auto',
              boxShadow: '0 0 0 1px rgba(20,15,40,0.04)',
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                fontFamily: '"Sora", system-ui, sans-serif',
                fontSize: 14, fontWeight: 500, color: PF.ink,
                letterSpacing: '-0.01em',
              }}>{s.name}</div>
              <div style={{
                fontFamily: '"Sora", system-ui, sans-serif',
                fontSize: 11, color: PF.muted,
                letterSpacing: '0.04em',
              }}>{s.hex.toUpperCase()}{s.role ? ` · ${s.role}` : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
};

// ─── 4 · Tipografía ──────────────────────────────────────
const Typography = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      padding: '40px 48px',
      height: '100%', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24,
    }}>
      <div style={{
        fontFamily: '"Sora", system-ui, sans-serif',
        fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: PF.muted, fontWeight: 500,
      }}>Wordmark</div>
      <div style={{
        fontFamily: '"Sora", system-ui, sans-serif',
        fontWeight: 500, fontSize: 92,
        letterSpacing: '-0.05em', color: PF.ink, lineHeight: 1,
      }}>finanzia</div>
      <div style={{
        display: 'flex', gap: 32, paddingTop: 12,
        borderTop: `1px solid ${PF.rule}`,
      }}>
        <div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 10, letterSpacing: '0.15em', color: PF.muted, textTransform: 'uppercase' }}>Familia</div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 14, color: PF.ink, marginTop: 4 }}>Sora</div>
        </div>
        <div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 10, letterSpacing: '0.15em', color: PF.muted, textTransform: 'uppercase' }}>Peso</div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 14, color: PF.ink, marginTop: 4 }}>500 · Medium</div>
        </div>
        <div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 10, letterSpacing: '0.15em', color: PF.muted, textTransform: 'uppercase' }}>Tracking</div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 14, color: PF.ink, marginTop: 4 }}>−5%</div>
        </div>
        <div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 10, letterSpacing: '0.15em', color: PF.muted, textTransform: 'uppercase' }}>Caja</div>
          <div style={{ fontFamily: '"Sora", system-ui, sans-serif', fontSize: 14, color: PF.ink, marginTop: 4 }}>Minúsculas</div>
        </div>
      </div>
    </div>
  </Frame>
);

// ─── 5 · App icon ────────────────────────────────────────
const AppIcon = ({ idx, label }) => (
  <Frame bg={PF.warmGrey} idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{
        width: 240, height: 240, borderRadius: 56,
        background: PF.deep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 18px 48px rgba(76,29,149,0.32), 0 4px 12px rgba(20,15,40,0.06)',
      }}>
        <Horizonte size={160} color="#FFFFFF" />
      </div>
      <div style={{
        fontFamily: '"Sora", system-ui, sans-serif',
        fontSize: 16, color: PF.ink, fontWeight: 500,
        letterSpacing: '-0.02em',
      }}>finanzia</div>
    </div>
  </Frame>
);

// ─── 6 · Favicon scale ladder ────────────────────────────
const ScaleLadder = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 32,
    }}>
      <div style={{
        fontFamily: '"Sora", system-ui, sans-serif',
        fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: PF.muted, fontWeight: 500,
      }}>Favicon → header</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 44 }}>
        {[16, 24, 32, 48, 72].map(s => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Horizonte size={s} />
            <div style={{
              fontFamily: '"Sora", system-ui, sans-serif',
              fontSize: 9, letterSpacing: '0.12em', color: PF.muted, fontWeight: 500,
            }}>{s}PX</div>
          </div>
        ))}
      </div>
    </div>
  </Frame>
);

// ─── 7 · Lockup horizontal ───────────────────────────────
const Lockup = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 48,
    }}>
      {/* Large */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Horizonte size={72} />
        <Wordmark size={48} />
      </div>
      {/* Medium */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Horizonte size={44} />
        <Wordmark size={30} />
      </div>
      {/* Small */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Horizonte size={24} />
        <Wordmark size={16} />
      </div>
    </div>
  </Frame>
);

// ─── 8 · Web header mockup ───────────────────────────────
const WebHeader = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      paddingTop: 56,
    }}>
      {/* Browser chrome */}
      <div style={{
        height: 36, borderBottom: `1px solid ${PF.rule}`,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
        background: '#FBFAFD',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#E5DEF3' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#E5DEF3' }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: '#E5DEF3' }} />
        </div>
        <div style={{
          marginLeft: 16, padding: '4px 12px', borderRadius: 6,
          background: '#FFFFFF', border: `1px solid ${PF.rule}`,
          fontFamily: '"Sora", system-ui, sans-serif',
          fontSize: 11, color: PF.muted, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Horizonte size={12} />
          finanzia.com
        </div>
      </div>
      {/* Site nav */}
      <div style={{
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', borderBottom: `1px solid ${PF.rule}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Horizonte size={28} />
          <Wordmark size={20} />
        </div>
        <div style={{ display: 'flex', gap: 24, fontFamily: '"Sora", system-ui, sans-serif', fontSize: 13, color: PF.graphite }}>
          <div>Producto</div>
          <div>IA</div>
          <div>Precios</div>
          <div>Empresas</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            padding: '8px 14px', fontFamily: '"Sora", system-ui, sans-serif',
            fontSize: 12, color: PF.graphite,
          }}>Ingresar</div>
          <div style={{
            padding: '8px 14px', borderRadius: 6,
            background: PF.deep, color: '#fff',
            fontFamily: '"Sora", system-ui, sans-serif', fontSize: 12, fontWeight: 500,
          }}>Empieza gratis</div>
        </div>
      </div>
      {/* Hero hint */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 48px', gap: 12,
      }}>
        <div style={{
          fontFamily: '"Sora", system-ui, sans-serif',
          fontSize: 28, fontWeight: 500, color: PF.ink, letterSpacing: '-0.03em',
          textAlign: 'center', lineHeight: 1.15,
        }}>
          Tus finanzas, leídas por IA.
        </div>
        <div style={{
          fontFamily: '"Sora", system-ui, sans-serif',
          fontSize: 13, color: PF.muted, textAlign: 'center', maxWidth: 380,
        }}>
          Plataforma moderna para gestionar y entender el dinero como nunca antes.
        </div>
      </div>
    </div>
  </Frame>
);

// ─── 9 · Email signature / Business card ─────────────────
const Signature = ({ idx, label }) => (
  <Frame idx={idx} label={label}>
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{
        width: 380, padding: '32px 36px',
        background: '#FFFFFF',
        border: `1px solid ${PF.rule}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(20,15,40,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottom: `1px solid ${PF.rule}` }}>
          <Horizonte size={42} />
          <div>
            <Wordmark size={22} />
          </div>
        </div>
        <div style={{ marginTop: 18, fontFamily: '"Sora", system-ui, sans-serif' }}>
          <div style={{ fontSize: 15, color: PF.ink, fontWeight: 500, letterSpacing: '-0.01em' }}>
            Camila Rivera
          </div>
          <div style={{ fontSize: 12, color: PF.muted, marginTop: 2 }}>
            Head of Product · finanzia
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: PF.graphite }}>
            <div>camila@finanzia.com</div>
            <div>finanzia.com</div>
          </div>
        </div>
      </div>
    </div>
  </Frame>
);

Object.assign(window, {
  PF, Horizonte, Wordmark,
  HeroFinal, MarkOnly, Palette, Typography,
  AppIcon, ScaleLadder, Lockup, WebHeader, Signature,
});
