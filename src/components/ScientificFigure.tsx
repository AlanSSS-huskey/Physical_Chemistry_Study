import { textFor, type Locale } from "@/lib/i18n";

export function ScientificFigure({ locale }: { locale: Locale }) {
  return (
    <div className="scientific-figure">
      <div className="figure-topline">
        <span>01 / THERMODYNAMICS</span>
        <span className="figure-dot" />
      </div>
      <div className="figure-equation">ΔU = q + w</div>
      <p>{textFor(locale, "变化有迹可循。", "Every change has a balance.")}</p>
      <svg
        viewBox="0 0 400 185"
        role="img"
        aria-label={textFor(
          locale,
          "两条不同过程路径连接相同初态与终态，内能变化与路径无关",
          "Two paths connect the same initial and final states; the internal energy change is path independent",
        )}
      >
        <defs>
          <pattern
            id="figure-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M24 0H0V24"
              fill="none"
              stroke="currentColor"
              strokeWidth=".4"
            />
          </pattern>
        </defs>
        <rect
          x="20"
          y="5"
          width="360"
          height="165"
          fill="url(#figure-grid)"
          opacity=".28"
        />
        <path
          d="M45 145H365 M45 145V20"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          opacity=".35"
        />
        <path
          d="M78 125C130 115 185 25 325 42"
          stroke="#b7c9b7"
          strokeWidth="2"
          strokeDasharray="5 5"
          fill="none"
        />
        <path
          d="M78 125C160 152 242 95 325 42"
          stroke="#d5eea8"
          strokeWidth="2.5"
          fill="none"
        />
        <circle cx="78" cy="125" r="5" fill="#d5eea8" />
        <circle cx="325" cy="42" r="5" fill="#d5eea8" />
        <text x="62" y="112" fill="currentColor" fontSize="12">
          A
        </text>
        <text x="335" y="35" fill="currentColor" fontSize="12">
          B
        </text>
        <text x="164" y="62" fill="currentColor" fontSize="10" opacity=".7">
          path 1
        </text>
        <text x="225" y="117" fill="currentColor" fontSize="10" opacity=".7">
          path 2
        </text>
      </svg>
      <div className="figure-caption">
        <span>
          {textFor(
            locale,
            "状态函数，与路径无关",
            "A state function. Independent of the path.",
          )}
        </span>
        <span>ΔU₁ = ΔU₂</span>
      </div>
    </div>
  );
}
